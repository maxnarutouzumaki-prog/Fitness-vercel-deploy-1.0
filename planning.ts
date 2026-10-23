import { diffDays, formatLongDate } from './dates';
import type { Alternative, CardioPlan, PlanDay, PlanExercise, WeeklyPlan, WorkoutSession } from './training';
import type { ISODate, MuscleGroup } from './types';
import { MUSCLE_LABELS } from './types';

/* ───────── Repetições ───────── */

export interface ParsedReps {
  lo: number;
  hi: number;
  /** 'reps' = repetições; 's' = segundos. */
  unit: 'reps' | 's';
}

/** "8-12" → 8..12 reps; "30-45 s" → 30..45 segundos. Devolve null se não entender. */
export function parseReps(text: string): ParsedReps | null {
  const m = text.trim().match(/^(\d{1,3})(?:\s*[-–a]\s*(\d{1,3}))?\s*(s|seg|segundos)?$/i);
  if (!m) return null;
  const lo = Number(m[1]);
  const hi = m[2] ? Number(m[2]) : lo;
  if (lo < 1 || hi < lo || hi > 200) return null;
  return { lo, hi, unit: m[3] ? 's' : 'reps' };
}

export function formatReps(reps: string): string {
  const p = parseReps(reps);
  if (!p) return reps;
  const range = p.lo === p.hi ? `${p.lo}` : `${p.lo}–${p.hi}`;
  return p.unit === 's' ? `${range} s` : range;
}

/* ───────── Duração estimada ───────── */

const WARMUP_MINUTES = 5;
const SECONDS_PER_REP_SET = 40;

export function estimateMinutes(exercises: PlanExercise[], cardio?: CardioPlan): number {
  let seconds = 0;
  for (const ex of exercises) {
    const parsed = parseReps(ex.reps);
    const work = parsed?.unit === 's' ? parsed.hi : SECONDS_PER_REP_SET;
    seconds += ex.sets * (work + ex.restSeconds);
  }
  const minutes = (exercises.length > 0 ? WARMUP_MINUTES : 0) + Math.ceil(seconds / 60) + (cardio?.minutes ?? 0);
  return Math.max(0, Math.ceil(minutes / 5) * 5);
}

/* ───────── Recuperação ───────── */

const IGNORED_FOR_RECOVERY: MuscleGroup[] = ['abs', 'cardio', 'full-body', 'forearms'];

/** Grupos musculares principais exigidos por um dia de treino. */
export function majorGroups(day: Pick<PlanDay, 'exercises'>): Set<MuscleGroup> {
  const set = new Set<MuscleGroup>();
  for (const ex of day.exercises) for (const m of ex.muscles) if (!IGNORED_FOR_RECOVERY.includes(m)) set.add(m);
  return set;
}

export interface RecoveryConflict {
  first: ISODate;
  second: ISODate;
  groups: MuscleGroup[];
}

/** Dias de força seguidos que repetem 3 ou mais grupos musculares principais. */
export function recoveryConflicts(days: Array<Pick<PlanDay, 'date' | 'kind' | 'exercises'>>): RecoveryConflict[] {
  const strength = days.filter((d) => d.kind === 'strength').sort((a, b) => a.date.localeCompare(b.date));
  const out: RecoveryConflict[] = [];
  for (let i = 1; i < strength.length; i += 1) {
    const a = strength[i - 1];
    const b = strength[i];
    if (diffDays(a.date, b.date) !== 1) continue;
    const ga = majorGroups(a);
    const shared = [...majorGroups(b)].filter((g) => ga.has(g));
    if (shared.length >= 3) out.push({ first: a.date, second: b.date, groups: shared });
  }
  return out;
}

export function describeConflict(c: RecoveryConflict): string {
  const names = c.groups.map((g) => MUSCLE_LABELS[g].toLowerCase()).join(', ');
  return `${formatLongDate(c.first)} e ${formatLongDate(c.second)} treinam os mesmos grupos (${names}) em dias seguidos.`;
}

/* ───────── Estado de cada dia ───────── */

export type DayStatus = 'rest' | 'done' | 'partial' | 'in-progress' | 'missed' | 'today' | 'upcoming';

export function sessionsForDay(sessions: WorkoutSession[], dayId: string): WorkoutSession[] {
  return sessions.filter((s) => s.dayId === dayId).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export function dayStatus(day: PlanDay, sessions: WorkoutSession[], today: ISODate): DayStatus {
  if (day.kind === 'rest') return 'rest';
  const mine = sessionsForDay(sessions, day.id);
  if (mine.some((s) => s.status === 'completed')) return 'done';
  if (mine.some((s) => s.status === 'in-progress')) return 'in-progress';
  if (mine.some((s) => s.status === 'partial')) return 'partial';
  if (day.date < today) return 'missed';
  if (day.date === today) return 'today';
  return 'upcoming';
}

export const DAY_STATUS_LABELS: Record<DayStatus, string> = {
  rest: 'Descanso',
  done: 'Concluído',
  partial: 'Parcial',
  'in-progress': 'Em andamento',
  missed: 'Não realizado',
  today: 'Hoje',
  upcoming: 'Planejado',
};

/* ───────── Reorganizar a semana ───────── */

export interface MoveOption {
  day: PlanDay;
  allowed: boolean;
  /** Motivo quando não permitido. */
  reason?: string;
  /** Avisos de recuperação quando permitido. */
  warnings: string[];
}

function swapDates(plan: WeeklyPlan, a: PlanDay, b: PlanDay): PlanDay[] {
  return plan.days.map((d) => {
    if (d.id === a.id) return { ...d, date: b.date, movedFrom: a.date };
    if (d.id === b.id) return { ...d, date: a.date, movedFrom: b.kind === 'rest' ? undefined : b.date };
    return d;
  });
}

/**
 * Opções para reorganizar um dia. A troca sempre é feita com outro dia da semana,
 * então nunca surgem duas sessões no mesmo dia nem acúmulo de treinos perdidos.
 * Um treino perdido só pode ir para um dia de descanso de hoje em diante.
 */
export function moveOptions(plan: WeeklyPlan, dayId: string, today: ISODate, doneDayIds: Set<string>): MoveOption[] {
  const source = plan.days.find((d) => d.id === dayId);
  if (!source || source.kind === 'rest') return [];
  const before = new Set(recoveryConflicts(plan.days).map((c) => `${c.first}|${c.second}`));
  return plan.days
    .filter((d) => d.id !== source.id)
    .map<MoveOption>((target) => {
      if (target.date < today) return { day: target, allowed: false, reason: 'Esse dia já passou.', warnings: [] };
      if (doneDayIds.has(target.id)) return { day: target, allowed: false, reason: 'Treino já concluído.', warnings: [] };
      if (source.date < today && target.kind !== 'rest') {
        return { day: target, allowed: false, reason: 'Escolha um dia de descanso para não acumular treinos.', warnings: [] };
      }
      const moved = swapDates(plan, source, target);
      const warnings = recoveryConflicts(moved)
        .filter((c) => !before.has(`${c.first}|${c.second}`))
        .map(describeConflict);
      return { day: target, allowed: true, warnings };
    })
    .sort((a, b) => a.day.date.localeCompare(b.day.date));
}

export function movePlanDay(plan: WeeklyPlan, dayId: string, targetDayId: string, nowIso: string): WeeklyPlan {
  const source = plan.days.find((d) => d.id === dayId);
  const target = plan.days.find((d) => d.id === targetDayId);
  if (!source || !target || source.id === target.id) return plan;
  const days = swapDates(plan, source, target).sort((a, b) => a.date.localeCompare(b.date));
  return { ...plan, days, updatedAt: nowIso };
}

/* ───────── Substituir exercício ───────── */

export function substituteExercise(
  plan: WeeklyPlan,
  dayId: string,
  exerciseId: string,
  altKey: string,
  nowIso: string,
): WeeklyPlan {
  const days = plan.days.map((day) => {
    if (day.id !== dayId) return day;
    const exercises = day.exercises.map((ex): PlanExercise => {
      if (ex.id !== exerciseId) return ex;
      const alt = ex.alternatives.find((a) => a.key === altKey);
      if (!alt) return ex;
      const original: Alternative = {
        key: ex.key,
        name: ex.name,
        muscles: ex.muscles,
        instructions: ex.instructions,
        libraryId: ex.libraryId,
      };
      const rest = ex.alternatives.filter((a) => a.key !== altKey);
      return {
        ...ex,
        key: alt.key,
        libraryId: alt.libraryId,
        name: alt.name,
        muscles: alt.muscles.length > 0 ? alt.muscles : ex.muscles,
        instructions: alt.instructions ?? alt.note ?? ex.instructions,
        alternatives: [original, ...rest].slice(0, 4),
        substitutedFrom: ex.substitutedFrom ?? ex.name,
      };
    });
    return { ...day, exercises };
  });
  return { ...plan, days, updatedAt: nowIso };
}

/** O plano ainda cobre a data de hoje? */
export function planCoversDate(plan: WeeklyPlan, date: ISODate): boolean {
  return date >= plan.startDate && date <= plan.endDate;
}

export function findDay(plan: WeeklyPlan | null | undefined, date: ISODate): PlanDay | undefined {
  return plan?.days.find((d) => d.date === date);
}

export function nextTrainingDay(plan: WeeklyPlan, after: ISODate): PlanDay | undefined {
  return plan.days.filter((d) => d.kind !== 'rest' && d.date > after).sort((a, b) => a.date.localeCompare(b.date))[0];
}
