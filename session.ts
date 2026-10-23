import { localDateFromTimestamp } from './dates';
import { uid } from './ids';
import { lastPerformance } from './progression';
import { parseReps } from './planning';
import type { LoggedExercise, LoggedSet, PlanDay, WeeklyPlan, WorkoutSession } from './training';

/** Sessão sem atividade por mais tempo que isso é pausada automaticamente ao reabrir o app. */
export const IDLE_PAUSE_MS = 30 * 60 * 1000;

function buildSets(targetSets: number, targetReps: string, loadKg: number | undefined): LoggedSet[] {
  const parsed = parseReps(targetReps);
  const reps = parsed ? parsed.lo : undefined;
  return Array.from({ length: Math.max(1, targetSets) }, () => ({ reps, loadKg, completed: false }));
}

/** Cria uma sessão a partir de um dia do plano. Iniciar NÃO gera check-in. */
export function createSession(plan: WeeklyPlan, day: PlanDay, history: WorkoutSession[], nowMs: number): WorkoutSession {
  const iso = new Date(nowMs).toISOString();
  const exercises: LoggedExercise[] = day.exercises.map((ex) => {
    const last = lastPerformance(ex.key, history);
    return {
      planExerciseId: ex.id,
      key: ex.key,
      name: ex.name,
      muscles: ex.muscles,
      targetSets: ex.sets,
      targetReps: ex.reps,
      restSeconds: ex.restSeconds,
      instructions: ex.instructions,
      alternatives: ex.alternatives,
      substitutedFrom: ex.substitutedFrom,
      sets: buildSets(ex.sets, ex.reps, last?.topLoadKg),
    };
  });
  return {
    id: uid('s'),
    planId: plan.id,
    dayId: day.id,
    plannedDate: day.date,
    title: day.title,
    focus: day.focus,
    place: day.place,
    startedAt: iso,
    date: localDateFromTimestamp(nowMs),
    activeMs: 0,
    runningSince: nowMs,
    lastActivityAt: nowMs,
    status: 'in-progress',
    exercises,
    cardio: day.cardio
      ? { modality: day.cardio.modality, plannedMinutes: day.cardio.minutes, minutes: day.cardio.minutes, completed: false }
      : undefined,
    createdAt: iso,
    updatedAt: iso,
  };
}

export function elapsedMs(s: WorkoutSession, nowMs: number): number {
  return s.activeMs + (s.runningSince !== undefined ? Math.max(0, nowMs - s.runningSince) : 0);
}

export function isRunning(s: WorkoutSession): boolean {
  return s.status === 'in-progress' && s.runningSince !== undefined;
}

export function pauseSession(s: WorkoutSession, nowMs: number): WorkoutSession {
  if (s.runningSince === undefined) return s;
  return { ...s, activeMs: s.activeMs + Math.max(0, nowMs - s.runningSince), runningSince: undefined, lastActivityAt: nowMs };
}

export function resumeSession(s: WorkoutSession, nowMs: number): WorkoutSession {
  if (s.status !== 'in-progress' || s.runningSince !== undefined) return s;
  return { ...s, runningSince: nowMs, lastActivityAt: nowMs };
}

export function touchSession(s: WorkoutSession, nowMs: number): WorkoutSession {
  return { ...s, lastActivityAt: nowMs };
}

/** Ao reabrir o app: se ficou parado por muito tempo, pausa no último instante de atividade. */
export function settleOnLoad(s: WorkoutSession, nowMs: number): WorkoutSession {
  if (s.status !== 'in-progress' || s.runningSince === undefined) return s;
  if (nowMs - s.lastActivityAt <= IDLE_PAUSE_MS) return s;
  return pauseSession(s, s.lastActivityAt);
}

export interface SessionStats {
  totalExercises: number;
  exercisesWithProgress: number;
  totalSets: number;
  doneSets: number;
  cardioDone: boolean;
  cardioMinutes: number;
}

export function sessionStats(s: WorkoutSession): SessionStats {
  let totalSets = 0;
  let doneSets = 0;
  let exercisesWithProgress = 0;
  for (const ex of s.exercises) {
    totalSets += ex.sets.length;
    const done = ex.sets.filter((x) => x.completed).length;
    doneSets += done;
    if (done > 0) exercisesWithProgress += 1;
  }
  return {
    totalExercises: s.exercises.length,
    exercisesWithProgress,
    totalSets,
    doneSets,
    cardioDone: !!s.cardio?.completed,
    cardioMinutes: s.cardio?.completed ? s.cardio.minutes ?? 0 : 0,
  };
}

/** Há algo útil para guardar? */
export function hasProgress(s: WorkoutSession): boolean {
  const st = sessionStats(s);
  return st.doneSets > 0 || st.cardioDone;
}

/** Tudo que estava previsto foi marcado? */
export function isFullyDone(s: WorkoutSession): boolean {
  const st = sessionStats(s);
  const setsDone = st.totalSets === 0 || st.doneSets === st.totalSets;
  const cardioOk = !s.cardio || s.cardio.completed;
  return setsDone && cardioOk;
}

export function closeSession(
  s: WorkoutSession,
  status: 'completed' | 'partial' | 'abandoned',
  nowMs: number,
): WorkoutSession {
  const paused = pauseSession(s, nowMs);
  const iso = new Date(nowMs).toISOString();
  return {
    ...paused,
    status,
    endedAt: iso,
    // A data do registro é a data LOCAL do momento em que a pessoa confirmou.
    date: localDateFromTimestamp(nowMs),
    runningSince: undefined,
    lastActivityAt: nowMs,
    updatedAt: iso,
  };
}

const ENCOURAGEMENTS = [
  'Bom trabalho. Constância vale mais do que intensidade.',
  'Treino registrado. Descanse bem e hidrate-se.',
  'Mais um passo dado. Seu corpo agradece a regularidade.',
  'Feito! Escute seu corpo e recupere-se com calma.',
];

export function encouragement(sessionId: string): string {
  let h = 0;
  for (let i = 0; i < sessionId.length; i += 1) h = (h * 31 + sessionId.charCodeAt(i)) >>> 0;
  return ENCOURAGEMENTS[h % ENCOURAGEMENTS.length];
}
