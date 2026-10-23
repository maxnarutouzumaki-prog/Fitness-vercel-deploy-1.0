import { findCatalog, alternativesFor } from './catalog';
import type { CatalogExercise, ExerciseKind } from './catalog';
import { weekdayMon } from './dates';
import { slugify, uid } from './ids';
import { estimateMinutes } from './planning';
import { createSession } from './session';
import type { LoggedExercise, PlanDay, PlanExercise, WeeklyPlan, WorkoutSession } from './training';
import type { ISODate, ISODateTime, MuscleGroup } from './types';

/** Ficha de treino cadastrada pela pessoa. Independente do plano semanal gerado (IA/local). */
export interface RoutineExercise {
  id: string;
  /** Exercício da biblioteca (opcional). */
  catalogId?: string;
  /** Exercício personalizado (opcional). */
  customId?: string;
  name: string;
  muscles: MuscleGroup[];
  kind: ExerciseKind;
  sets?: number;
  reps?: string;
  loadKg?: number;
  restSeconds?: number;
  instructions?: string;
  notes?: string;
  /** Foto específica deste item (opcional). */
  imageId?: string;
}

export interface Routine {
  id: string;
  name: string;
  /** Objetivo ou grupo muscular principal (texto livre). */
  focus: string;
  /** Dias da semana: 0 = segunda … 6 = domingo. Vazio = sem dia fixo. */
  weekdays: number[];
  exercises: RoutineExercise[];
  notes?: string;
  order: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export const LIMITS = { name: 60, focus: 60, exercises: 40, notes: 500, exerciseName: 80, reps: 20, sets: 20, loadKg: 999, rest: 900 } as const;

export function newRoutine(name: string, order: number, nowIso: ISODateTime): Routine {
  return { id: uid('r'), name: name.trim() || 'Novo treino', focus: '', weekdays: [], exercises: [], order, createdAt: nowIso, updatedAt: nowIso };
}

export function exerciseFromCatalog(ex: CatalogExercise): RoutineExercise {
  return { id: uid('re'), catalogId: ex.id, name: ex.name, muscles: ex.muscles, kind: ex.kind, sets: ex.sets, reps: ex.reps, restSeconds: ex.restSeconds, instructions: ex.instructions };
}

/** Exercício manual: só o nome é necessário; o resto pode ser preenchido depois. */
export function manualExercise(name: string, muscles: MuscleGroup[] = [], kind: ExerciseKind = 'strength'): RoutineExercise {
  return { id: uid('re'), name: name.trim(), muscles, kind };
}

const clampInt = (v: number | undefined, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : undefined;

export function sanitizeExercise(e: RoutineExercise): RoutineExercise {
  const out: RoutineExercise = { ...e, name: e.name.trim().slice(0, LIMITS.exerciseName) || 'Exercício' };
  out.sets = clampInt(e.sets, 1, LIMITS.sets);
  out.restSeconds = clampInt(e.restSeconds, 0, LIMITS.rest);
  out.reps = e.reps?.trim().slice(0, LIMITS.reps) || undefined;
  const load = typeof e.loadKg === 'number' && Number.isFinite(e.loadKg) ? Math.max(0, Math.min(LIMITS.loadKg, Math.round(e.loadKg * 100) / 100)) : undefined;
  out.loadKg = load;
  out.instructions = e.instructions?.trim().slice(0, 600) || undefined;
  out.notes = e.notes?.trim().slice(0, 300) || undefined;
  return out;
}

export function sanitizeRoutine(r: Routine, nowIso: ISODateTime): Routine {
  const weekdays = [...new Set(r.weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
  return {
    ...r,
    name: r.name.trim().slice(0, LIMITS.name) || 'Treino',
    focus: r.focus.trim().slice(0, LIMITS.focus),
    notes: r.notes?.trim().slice(0, LIMITS.notes) || undefined,
    weekdays,
    exercises: r.exercises.slice(0, LIMITS.exercises).map(sanitizeExercise),
    updatedAt: nowIso,
  };
}

export function duplicateRoutine(r: Routine, order: number, nowIso: ISODateTime): Routine {
  return {
    ...r,
    id: uid('r'),
    name: `${r.name} (cópia)`.slice(0, LIMITS.name),
    // A cópia nasce sem dia fixo para não criar duas sessões no mesmo dia sem a pessoa querer.
    weekdays: [],
    exercises: r.exercises.map((e) => ({ ...e, id: uid('re') })),
    order,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/* ───────── Semana ───────── */

export function routinesOn(routines: Routine[], date: ISODate): Routine[] {
  const wd = weekdayMon(date);
  return routines.filter((r) => r.weekdays.includes(wd)).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pt-BR'));
}

/** Segunda a domingo: lista de fichas por dia da semana. */
export function weekLayout(routines: Routine[]): Routine[][] {
  return Array.from({ length: 7 }, (_, wd) => routines.filter((r) => r.weekdays.includes(wd)).sort((a, b) => a.order - b.order));
}

export function assignDay(r: Routine, wd: number, nowIso: ISODateTime): Routine {
  return r.weekdays.includes(wd) ? r : { ...r, weekdays: [...r.weekdays, wd].sort((a, b) => a - b), updatedAt: nowIso };
}
export function unassignDay(r: Routine, wd: number, nowIso: ISODateTime): Routine {
  return { ...r, weekdays: r.weekdays.filter((d) => d !== wd), updatedAt: nowIso };
}
/** Move a ficha de um dia para outro (mantém os demais dias). */
export function moveToDay(r: Routine, from: number, to: number, nowIso: ISODateTime): Routine {
  return assignDay(unassignDay(r, from, nowIso), to, nowIso);
}
/** Copia: a ficha passa a ser feita também no outro dia. */
export function copyToDay(r: Routine, to: number, nowIso: ISODateTime): Routine {
  return assignDay(r, to, nowIso);
}

/* ───────── Execução ───────── */

export function routineExerciseKey(e: RoutineExercise): string {
  return e.catalogId ?? (e.customId ? `c-${e.customId}` : `n-${slugify(e.name) || e.id}`);
}

export function routineDayId(routineId: string, date: ISODate): string {
  return `routine:${routineId}:${date}`;
}

/** Converte a ficha em um "dia de treino" para reutilizar a tela de execução existente. */
export function routineToPlanDay(r: Routine, date: ISODate): PlanDay {
  const exercises: PlanExercise[] = r.exercises.map((e) => {
    const cat = findCatalog(e.catalogId);
    return {
      id: e.id,
      key: routineExerciseKey(e),
      libraryId: e.catalogId,
      name: e.name,
      muscles: e.muscles,
      sets: e.sets ?? cat?.sets ?? 3,
      reps: e.reps ?? cat?.reps ?? '10',
      restSeconds: e.restSeconds ?? cat?.restSeconds ?? 60,
      instructions: e.instructions ?? cat?.instructions ?? '',
      alternatives: alternativesFor(e.muscles, e.catalogId ?? '', 3, e.kind),
    };
  });
  return {
    id: routineDayId(r.id, date),
    date,
    kind: 'strength',
    title: r.name,
    focus: r.focus,
    estimatedMinutes: estimateMinutes(exercises),
    exercises,
    note: r.notes,
  };
}

function syntheticPlan(r: Routine, date: ISODate, nowIso: ISODateTime): WeeklyPlan {
  return {
    id: `routine:${r.id}`,
    startDate: date,
    endDate: date,
    source: 'local',
    status: 'archived',
    days: [],
    notes: [],
    questionnaireHash: '',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/**
 * Inicia uma sessão a partir da ficha. A sessão guarda uma CÓPIA dos exercícios: editar a ficha
 * depois nunca altera sessões já registradas. Iniciar não gera check-in.
 */
export function createRoutineSession(r: Routine, date: ISODate, history: WorkoutSession[], nowMs: number): WorkoutSession {
  const nowIso = new Date(nowMs).toISOString();
  const day = routineToPlanDay(r, date);
  const base = createSession(syntheticPlan(r, date, nowIso), day, history, nowMs);
  const byId = new Map(r.exercises.map((e) => [e.id, e]));
  const exercises: LoggedExercise[] = base.exercises.map((le) => {
    const src = byId.get(le.planExerciseId);
    const planned = src?.loadKg;
    // Carga da ficha só entra onde o histórico ainda não sugeriu uma carga.
    return planned === undefined ? le : { ...le, sets: le.sets.map((s) => (s.loadKg === undefined ? { ...s, loadKg: planned } : s)) };
  });
  return { ...base, exercises, source: 'routine', routineId: r.id };
}

export type RoutineStatus = 'done' | 'partial' | 'in-progress' | 'missed' | 'pending' | 'later';

export function routineStatusOn(r: Routine, date: ISODate, today: ISODate, sessions: WorkoutSession[]): RoutineStatus {
  const mine = sessions.filter((s) => s.routineId === r.id && s.plannedDate === date);
  if (mine.some((s) => s.status === 'in-progress')) return 'in-progress';
  if (mine.some((s) => s.status === 'completed')) return 'done';
  if (mine.some((s) => s.status === 'partial')) return 'partial';
  if (date < today) return 'missed';
  return date === today ? 'pending' : 'later';
}

export const ROUTINE_STATUS_LABELS: Record<RoutineStatus, string> = {
  done: 'Concluído',
  partial: 'Parcial',
  'in-progress': 'Em andamento',
  missed: 'Não feito',
  pending: 'Hoje',
  later: 'Programado',
};
