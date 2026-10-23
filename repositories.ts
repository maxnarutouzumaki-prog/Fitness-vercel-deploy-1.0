import { Repository, STORE, idbRequest, writeTransaction } from './db';
import { addSource } from '../domain/checkins';
import type { Checkin, CheckinSource } from '../domain/checkins';
import type { Routine } from '../domain/routines';
import type { CustomExercise, ExerciseImage } from '../domain/customExercises';
import type { WeeklyPlan, WorkoutSession } from '../domain/training';
import type {
  AppearanceRecord,
  BodyMetricEntry,
  Exercise,
  MealEntry,
  ProgressPhoto,
  Profile,
  Reminder,
} from '../domain/types';

export const profileRepo = new Repository<Profile>(STORE.profile);
/** Configurações do app (hoje: aparência). Cada registro tem id próprio. */
export const settingsRepo = new Repository<AppearanceRecord>(STORE.settings);
export const exercisesRepo = new Repository<Exercise>(STORE.exercises);
export const sessionsRepo = new Repository<WorkoutSession>(STORE.sessions);
export const plansRepo = new Repository<WeeklyPlan>(STORE.plans);
export const checkinsRepo = new Repository<Checkin>(STORE.checkins);
export const mealsRepo = new Repository<MealEntry>(STORE.meals);
export const bodyMetricsRepo = new Repository<BodyMetricEntry>(STORE.bodyMetrics);
export const photosRepo = new Repository<ProgressPhoto>(STORE.photos);
export const remindersRepo = new Repository<Reminder>(STORE.reminders);

export const routinesRepo = new Repository<Routine>(STORE.routines);
export const customExercisesRepo = new Repository<CustomExercise>(STORE.customExercises);
export const exerciseImagesRepo = new Repository<ExerciseImage>(STORE.exerciseImages);

export interface MetaRecord {
  id: string;
  [key: string]: unknown;
}
export const metaRepo = new Repository<MetaRecord>(STORE.meta);

export function getMealsForDate(date: string): Promise<MealEntry[]> {
  return mealsRepo.byIndex('by-date', date);
}

/**
 * Salva a sessão e, se ela foi CONCLUÍDA e confirmada, registra o check-in do dia
 * na mesma transação: ou grava os dois, ou nenhum.
 */
export async function saveSessionWithCheckin(
  session: WorkoutSession,
  checkin: { date: string; source: CheckinSource; nowIso: string } | null,
): Promise<Checkin | null> {
  let result: Checkin | null = null;
  await writeTransaction([STORE.sessions, STORE.checkins], async (stores) => {
    stores[STORE.sessions].put(session);
    if (checkin) {
      const existing = (await idbRequest(stores[STORE.checkins].get(checkin.date))) as Checkin | undefined;
      result = addSource(existing, checkin.date, checkin.source, checkin.nowIso);
      stores[STORE.checkins].put(result);
    }
  });
  return result;
}

/** Check-in manual (atividade fora do app). Um registro por data; fontes extras só acrescentam detalhe. */
export async function saveManualCheckin(date: string, source: CheckinSource, nowIso: string): Promise<Checkin> {
  let result!: Checkin;
  await writeTransaction([STORE.checkins], async (stores) => {
    const existing = (await idbRequest(stores[STORE.checkins].get(date))) as Checkin | undefined;
    result = addSource(existing, date, source, nowIso);
    stores[STORE.checkins].put(result);
  });
  return result;
}

/** Arquiva o plano ativo (se houver) e grava o novo como ativo, sem apagar sessões. */
export async function replaceActivePlan(next: WeeklyPlan, previous: WeeklyPlan | null): Promise<void> {
  await writeTransaction([STORE.plans], (stores) => {
    if (previous && previous.id !== next.id) {
      stores[STORE.plans].put({ ...previous, status: 'archived', updatedAt: next.createdAt });
    }
    stores[STORE.plans].put(next);
  });
}
