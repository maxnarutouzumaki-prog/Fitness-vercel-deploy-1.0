import { addDays, weekdayMon } from './dates';
import { LIBRARY, matchesTerms, normalizeText, splitTerms } from './exerciseLibrary';
import { slugify, uid } from './ids';
import { describeConflict, estimateMinutes, recoveryConflicts } from './planning';
import { WEEKDAY_NAMES } from './dates';
import type {
  Alternative,
  CardioPlan,
  EquipmentId,
  PlanDay,
  PlanExercise,
  Questionnaire,
  WeeklyPlan,
  WorkoutSession,
} from './training';
import { questionnaireHash } from './training';
import type { Intensity, MuscleGroup } from './types';

/* ───────── Pedido enviado à função (somente o necessário, sem nome) ───────── */

export interface GeminiPlanRequest {
  startDate: string;
  /** Os 7 dias da janela, na ordem. */
  window: Array<{ index: number; date: string; weekday: string }>;
  goal: Questionnaire['goal'];
  experience: Questionnaire['experience'];
  place: Questionnaire['place'];
  daysPerWeek: number;
  minutesPerSession: number;
  equipment: EquipmentId[];
  likes: string;
  avoid: string;
  limitations: string;
  limitationLevel: Questionnaire['limitationLevel'];
  cardio: Questionnaire['cardio'];
  organization: string;
  preferredWeekdays: number[];
  /** Resumo dos treinos recentes (data, tipo e situação). */
  recent: Array<{ date: string; title: string; status: string; muscles: string[] }>;
}

const clamp = (s: string, n: number) => s.trim().slice(0, n);

export function buildGeminiRequest(q: Questionnaire, startDate: string, sessions: WorkoutSession[]): GeminiPlanRequest {
  const cutoff = addDays(startDate, -14);
  const recent = sessions
    .filter((s) => s.date >= cutoff && s.status !== 'in-progress')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)
    .map((s) => ({
      date: s.date,
      title: s.title,
      status: s.status,
      muscles: [...new Set(s.exercises.filter((e) => e.sets.some((x) => x.completed)).flatMap((e) => e.muscles))].slice(0, 6),
    }));
  return {
    startDate,
    window: Array.from({ length: 7 }, (_, index) => {
      const date = addDays(startDate, index);
      return { index, date, weekday: WEEKDAY_NAMES[weekdayMon(date)] };
    }),
    goal: q.goal,
    experience: q.experience,
    place: q.place,
    daysPerWeek: q.daysPerWeek,
    minutesPerSession: q.minutesPerSession,
    equipment: q.equipment,
    likes: clamp(q.likes, 300),
    avoid: clamp(q.avoid, 300),
    limitations: q.limitationLevel === 'none' ? '' : clamp(q.limitations, 300),
    limitationLevel: q.limitationLevel,
    cardio: q.cardio,
    organization: clamp(q.organization, 300),
    preferredWeekdays: q.preferredDays,
    recent,
  };
}

/* ───────── Validação da resposta ───────── */

export type NormalizeResult = { ok: true; plan: WeeklyPlan } | { ok: false; error: string };

const MUSCLE_SYNONYMS: Record<string, MuscleGroup> = {
  chest: 'chest',
  peito: 'chest',
  peitoral: 'chest',
  back: 'back',
  costas: 'back',
  shoulders: 'shoulders',
  shoulder: 'shoulders',
  ombros: 'shoulders',
  ombro: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  antebracos: 'forearms',
  abs: 'abs',
  core: 'abs',
  abdomen: 'abs',
  abdominais: 'abs',
  glutes: 'glutes',
  gluteos: 'glutes',
  quadriceps: 'quadriceps',
  quads: 'quadriceps',
  hamstrings: 'hamstrings',
  posteriores: 'hamstrings',
  calves: 'calves',
  panturrilha: 'calves',
  panturrilhas: 'calves',
  'full-body': 'full-body',
  corpo: 'full-body',
  cardio: 'cardio',
};

function toMuscle(value: unknown): MuscleGroup | null {
  if (typeof value !== 'string') return null;
  const key = normalizeText(value).replace(/\s+/g, '-');
  return MUSCLE_SYNONYMS[key] ?? MUSCLE_SYNONYMS[key.split('-')[0]] ?? null;
}

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function int(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const REPS_PATTERN = /^\d{1,3}(\s*[-–]\s*\d{1,3})?(\s*(s|seg|segundos))?$/i;

function toIntensity(value: unknown, q: Questionnaire): Intensity {
  let v: Intensity = value === 'low' || value === 'moderate' || value === 'high' ? value : 'moderate';
  if (q.experience === 'beginner' && v === 'high') v = 'moderate';
  if (q.limitationLevel !== 'none') v = 'low';
  return v;
}

function cleanCardio(raw: unknown, q: Questionnaire): CardioPlan | undefined {
  if (q.cardio === 'avoid' || !isObject(raw)) return undefined;
  const minutes = int(raw.minutes, 0, 45, 0);
  const modality = str(raw.modality, 60);
  if (minutes < 5 || !modality) return undefined;
  return { modality, minutes, intensity: toIntensity(raw.intensity, q), note: str(raw.note, 200) || undefined };
}

function cleanExercise(raw: unknown, dayId: string, n: number, q: Questionnaire, avoid: string[]): PlanExercise | null {
  if (!isObject(raw)) return null;
  const name = str(raw.name, 80);
  if (!name || matchesTerms({ name }, avoid)) return null;
  const muscles = (Array.isArray(raw.muscles) ? raw.muscles : []).map(toMuscle).filter((m): m is MuscleGroup => m !== null);
  const repsRaw = str(raw.reps, 20);
  const norm = normalizeText(name);
  const lib = LIBRARY.find((e) => normalizeText(e.name) === norm);
  const key = lib ? lib.id : `g-${slugify(name)}`;
  const m = muscles.length > 0 ? [...new Set(muscles)].slice(0, 4) : lib ? lib.muscles : (['full-body'] as MuscleGroup[]);
  const alternatives: Alternative[] = (Array.isArray(raw.alternatives) ? raw.alternatives : [])
    .slice(0, 3)
    .map((a): Alternative | null => {
      if (!isObject(a)) return null;
      const altName = str(a.name, 80);
      if (!altName || matchesTerms({ name: altName }, avoid)) return null;
      const altLib = LIBRARY.find((e) => normalizeText(e.name) === normalizeText(altName));
      return {
        key: altLib ? altLib.id : `g-${slugify(altName)}`,
        libraryId: altLib?.id,
        name: altName,
        muscles: altLib ? altLib.muscles : m,
        note: str(a.note, 160) || undefined,
        instructions: altLib?.instructions,
      };
    })
    .filter((a): a is Alternative => a !== null && a.key !== key);
  return {
    id: `${dayId}-e${n}`,
    key,
    libraryId: lib?.id,
    name,
    muscles: m,
    sets: int(raw.sets, 1, 6, 3),
    reps: REPS_PATTERN.test(repsRaw) ? repsRaw : '8-12',
    restSeconds: int(raw.restSeconds, 20, 300, 60),
    instructions: str(raw.instructions, 280) || 'Execute com controle, amplitude confortável e respiração constante. Pare se sentir dor.',
    alternatives,
  };
}

/**
 * Valida e normaliza o JSON do Gemini. Qualquer problema estrutural devolve erro
 * (o app então usa o gerador local). Problemas pequenos são corrigidos com valores seguros.
 */
export function normalizeGeminiPlan(
  raw: unknown,
  q: Questionnaire,
  startDate: string,
  model: string | undefined,
  nowIso: string = new Date().toISOString(),
): NormalizeResult {
  if (!isObject(raw) || !Array.isArray(raw.days)) return { ok: false, error: 'Resposta sem a lista de dias.' };
  if (raw.days.length !== 7) return { ok: false, error: 'A resposta não tem 7 dias.' };

  // Ordena por dayIndex quando vier completo; senão usa a ordem recebida.
  const indices = raw.days.map((d) => (isObject(d) && typeof d.dayIndex === 'number' ? d.dayIndex : -1));
  const usable = new Set(indices).size === 7 && indices.every((i) => i >= 0 && i <= 6);
  const ordered = usable
    ? [...raw.days].sort((a, b) => (a as Record<string, number>).dayIndex - (b as Record<string, number>).dayIndex)
    : raw.days;

  const avoid = splitTerms(q.avoid);
  const target = Math.max(1, Math.min(6, Math.round(q.daysPerWeek)));
  const days: PlanDay[] = [];
  let trainingCount = 0;
  let trainingOrder = 0;

  for (let i = 0; i < 7; i += 1) {
    const rawDay = ordered[i];
    if (!isObject(rawDay)) return { ok: false, error: `Dia ${i + 1} inválido.` };
    const date = addDays(startDate, i);
    const dayId = uid('d');
    const kind = rawDay.kind === 'strength' || rawDay.kind === 'cardio' || rawDay.kind === 'rest' ? rawDay.kind : null;
    if (!kind) return { ok: false, error: `Dia ${i + 1} sem tipo válido.` };

    if (kind === 'rest') {
      days.push({
        id: dayId,
        date,
        kind: 'rest',
        title: str(rawDay.title, 60) || 'Descanso',
        focus: str(rawDay.focus, 80) || 'Recuperação',
        estimatedMinutes: 0,
        exercises: [],
        note: str(rawDay.note, 240) || 'Dia de recuperação.',
      });
      continue;
    }

    trainingCount += 1;
    const place: 'gym' | 'home' =
      q.place === 'both' ? (rawDay.place === 'home' || rawDay.place === 'gym' ? rawDay.place : trainingOrder % 2 === 0 ? 'gym' : 'home') : q.place;
    trainingOrder += 1;
    const title = str(rawDay.title, 60);
    if (!title) return { ok: false, error: `Dia ${i + 1} sem título.` };
    let cardio = cleanCardio(rawDay.cardio, q);

    if (kind === 'cardio') {
      if (!cardio) return { ok: false, error: `Dia ${i + 1} (cardio) sem atividade válida.` };
      days.push({
        id: dayId,
        date,
        kind: 'cardio',
        title,
        focus: str(rawDay.focus, 80) || 'Cardio',
        place,
        estimatedMinutes: estimateMinutes([], cardio),
        intensity: cardio.intensity,
        exercises: [],
        cardio,
        note: str(rawDay.note, 240) || undefined,
      });
      continue;
    }

    let exercises = (Array.isArray(rawDay.exercises) ? rawDay.exercises : [])
      .slice(0, 9)
      .map((e, n) => cleanExercise(e, dayId, n + 1, q, avoid))
      .filter((e): e is PlanExercise => e !== null);
    if (exercises.length < 3) return { ok: false, error: `Dia ${i + 1} com poucos exercícios válidos.` };
    exercises = exercises.map((e, n) => ({ ...e, id: `${dayId}-e${n + 1}` }));

    const limit = q.minutesPerSession * 1.15;
    const fits = () => estimateMinutes(exercises, cardio) <= limit;
    if (!fits()) cardio = undefined;
    while (!fits() && exercises.length > 3) exercises = exercises.slice(0, -1);
    if (!fits()) return { ok: false, error: `Dia ${i + 1} excede o tempo disponível.` };
    if (exercises.reduce((sum, e) => sum + e.sets, 0) > 30) return { ok: false, error: `Dia ${i + 1} com volume excessivo.` };

    days.push({
      id: dayId,
      date,
      kind: 'strength',
      title,
      focus: str(rawDay.focus, 80) || 'Treino de força',
      place,
      estimatedMinutes: estimateMinutes(exercises, cardio),
      intensity: toIntensity(rawDay.intensity, q),
      exercises,
      cardio,
      note: str(rawDay.note, 240) || undefined,
    });
  }

  if (trainingCount !== target) return { ok: false, error: `Esperados ${target} dias de treino, vieram ${trainingCount}.` };

  const notes = (Array.isArray(raw.notes) ? raw.notes : [])
    .map((n) => str(n, 220))
    .filter((n) => n.length > 0)
    .slice(0, 4);
  notes.unshift('Plano gerado com o Gemini a partir das suas respostas e revisado pelo app. Não substitui orientação profissional.');
  for (const c of recoveryConflicts(days)) notes.push(describeConflict(c));

  return {
    ok: true,
    plan: {
      id: uid('plan'),
      startDate,
      endDate: addDays(startDate, 6),
      source: 'gemini',
      model,
      status: 'active',
      days,
      notes,
      questionnaireHash: questionnaireHash(q),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  };
}
