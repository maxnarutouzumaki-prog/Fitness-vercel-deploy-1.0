import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  checkinsRepo,
  customExercisesRepo,
  exerciseImagesRepo,
  mealsRepo,
  plansRepo,
  routinesRepo,
  replaceActivePlan,
  saveManualCheckin,
  saveSessionWithCheckin,
  sessionsRepo,
} from '../data/repositories';
import { addSource, computeStreaks } from '../domain/checkins';
import type { Checkin, ManualActivity, Streaks } from '../domain/checkins';
import { localDateFromTimestamp } from '../domain/dates';
import { uid } from '../domain/ids';
import { createRoutineSession, sanitizeRoutine } from '../domain/routines';
import type { Routine } from '../domain/routines';
import type { CustomExercise, ExerciseImage } from '../domain/customExercises';
import type { MealEntry } from '../domain/types';
import { sessionsForDay } from '../domain/planning';
import { closeSession, createSession, hasProgress, settleOnLoad, touchSession } from '../domain/session';
import type { WeeklyPlan, WorkoutSession } from '../domain/training';
import { useToday } from './useToday';

export interface FinishResult {
  session: WorkoutSession;
  checkin: Checkin | null;
  streaks: Streaks;
}

export interface ManualCheckinInput {
  activity: ManualActivity;
  minutes?: number;
  note?: string;
}

interface DataState {
  ready: boolean;
  /** Data local de hoje (vira à meia-noite). */
  today: string;
  plan: WeeklyPlan | null;
  sessions: WorkoutSession[];
  checkins: Checkin[];
  activeSession: WorkoutSession | null;
  streaks: Streaks;
  /** Falha ao ler/gravar o armazenamento local. */
  storageError: boolean;
  routines: Routine[];
  customExercises: CustomExercise[];
  meals: MealEntry[];
  saveRoutine: (routine: Routine) => Promise<void>;
  saveRoutines: (routines: Routine[]) => Promise<void>;
  deleteRoutine: (id: string) => Promise<void>;
  saveCustomExercise: (exercise: CustomExercise, image?: ExerciseImage | null) => Promise<void>;
  deleteCustomExercise: (id: string) => Promise<void>;
  saveMeal: (meal: MealEntry) => Promise<void>;
  deleteMeal: (id: string) => Promise<void>;
  startRoutineSession: (routineId: string, date?: string) => Promise<string | null>;
  savePlan: (plan: WeeklyPlan) => Promise<void>;
  updatePlan: (plan: WeeklyPlan) => Promise<void>;
  startSession: (dayId: string) => Promise<string | null>;
  updateSession: (session: WorkoutSession) => void;
  finishSession: (id: string, status: 'completed' | 'partial') => Promise<FinishResult | null>;
  abandonSession: (id: string) => Promise<void>;
  manualCheckin: (input: ManualCheckinInput) => Promise<Checkin | null>;
}

const DataContext = createContext<DataState | null>(null);

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const next = list.slice();
  next[i] = item;
  return next;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const today = useToday();
  const [ready, setReady] = useState(false);
  const [plan, setPlanState] = useState<WeeklyPlan | null>(null);
  const [sessions, setSessionsState] = useState<WorkoutSession[]>([]);
  const [checkins, setCheckinsState] = useState<Checkin[]>([]);
  const [storageError, setStorageError] = useState(false);
  const [routines, setRoutinesState] = useState<Routine[]>([]);
  const [customExercises, setCustomState] = useState<CustomExercise[]>([]);
  const [meals, setMealsState] = useState<MealEntry[]>([]);
  const routinesRef = useRef<Routine[]>([]);
  const customRef = useRef<CustomExercise[]>([]);

  // Refs espelham o estado para que as ações (estáveis) nunca leiam valores velhos.
  const planRef = useRef<WeeklyPlan | null>(null);
  const sessionsRef = useRef<WorkoutSession[]>([]);
  const checkinsRef = useRef<Checkin[]>([]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const setPlan = useCallback((p: WeeklyPlan | null) => {
    planRef.current = p;
    setPlanState(p);
  }, []);
  const setSessions = useCallback((updater: (prev: WorkoutSession[]) => WorkoutSession[]) => {
    sessionsRef.current = updater(sessionsRef.current);
    setSessionsState(sessionsRef.current);
  }, []);
  const setCheckins = useCallback((updater: (prev: Checkin[]) => Checkin[]) => {
    checkinsRef.current = updater(checkinsRef.current);
    setCheckinsState(checkinsRef.current);
  }, []);

  /** Grava em ordem, uma operação por vez, sem derrubar a interface em caso de erro. */
  const enqueue = useCallback(<T,>(job: () => Promise<T>): Promise<T | undefined> => {
    const run = queue.current.then(job).catch(() => {
      setStorageError(true);
      return undefined;
    });
    queue.current = run;
    return run as Promise<T | undefined>;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [plans, storedSessions, storedCheckins, storedRoutines, storedCustom, storedMeals] = await Promise.all([
          plansRepo.all(),
          sessionsRepo.all(),
          checkinsRepo.all(),
          routinesRepo.all(),
          customExercisesRepo.all(),
          mealsRepo.all(),
        ]);
        if (cancelled) return;
        const now = Date.now();
        const settled = storedSessions.map((s) => settleOnLoad(s, now));
        settled.forEach((s, i) => {
          if (s !== storedSessions[i]) void enqueue(() => sessionsRepo.put(s));
        });
        const active = plans.filter((p) => p.status === 'active').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
        setPlan(active);
        setSessions(() => settled);
        setCheckins(() => storedCheckins);
        routinesRef.current = storedRoutines.sort((a, b) => a.order - b.order);
        setRoutinesState(routinesRef.current);
        customRef.current = storedCustom;
        setCustomState(storedCustom);
        setMealsState(storedMeals);
      } catch {
        if (!cancelled) setStorageError(true);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enqueue, setCheckins, setPlan, setSessions]);

  const savePlan = useCallback(
    async (next: WeeklyPlan) => {
      const previous = planRef.current;
      setPlan(next);
      await enqueue(() => replaceActivePlan(next, previous));
    },
    [enqueue, setPlan],
  );

  const updatePlan = useCallback(
    async (next: WeeklyPlan) => {
      setPlan(next);
      await enqueue(() => plansRepo.put(next));
    },
    [enqueue, setPlan],
  );

  const startSession = useCallback(
    async (dayId: string): Promise<string | null> => {
      const current = planRef.current;
      const day = current?.days.find((d) => d.id === dayId);
      if (!current || !day || day.kind === 'rest') return null;
      // Já existe sessão em andamento? Continua nela (nunca cria duas ao mesmo tempo).
      const running = sessionsRef.current.find((s) => s.status === 'in-progress');
      if (running) return running.id;
      const session = createSession(current, day, sessionsRef.current, Date.now());
      setSessions((prev) => upsert(prev, session));
      await enqueue(() => sessionsRepo.put(session));
      return session.id;
    },
    [enqueue, setSessions],
  );

  const saveRoutine = useCallback(
    async (routine: Routine) => {
      const clean = sanitizeRoutine(routine, new Date().toISOString());
      routinesRef.current = upsert(routinesRef.current, clean).sort((a, b) => a.order - b.order);
      setRoutinesState(routinesRef.current);
      await enqueue(() => routinesRepo.put(clean));
    },
    [enqueue],
  );

  const saveRoutines = useCallback(
    async (list: Routine[]) => {
      let next = routinesRef.current;
      for (const r of list) next = upsert(next, r);
      routinesRef.current = next.slice().sort((a, b) => a.order - b.order);
      setRoutinesState(routinesRef.current);
      await enqueue(async () => {
        for (const r of list) await routinesRepo.put(r);
      });
    },
    [enqueue],
  );

  const deleteRoutine = useCallback(
    async (id: string) => {
      // Sessões já registradas permanecem no histórico (guardam cópia própria dos exercícios).
      routinesRef.current = routinesRef.current.filter((r) => r.id !== id);
      setRoutinesState(routinesRef.current);
      await enqueue(() => routinesRepo.delete(id));
    },
    [enqueue],
  );

  const saveCustomExercise = useCallback(
    async (exercise: CustomExercise, image?: ExerciseImage | null) => {
      customRef.current = upsert(customRef.current, exercise);
      setCustomState(customRef.current);
      await enqueue(async () => {
        if (image) await exerciseImagesRepo.put(image);
        await customExercisesRepo.put(exercise);
      });
    },
    [enqueue],
  );

  const deleteCustomExercise = useCallback(
    async (id: string) => {
      const found = customRef.current.find((c) => c.id === id);
      customRef.current = customRef.current.filter((c) => c.id !== id);
      setCustomState(customRef.current);
      await enqueue(async () => {
        await customExercisesRepo.delete(id);
        if (found?.imageId) await exerciseImagesRepo.delete(found.imageId);
      });
    },
    [enqueue],
  );

  const saveMeal = useCallback(
    async (meal: MealEntry) => {
      setMealsState((prev) => upsert(prev, meal));
      await enqueue(() => mealsRepo.put(meal));
    },
    [enqueue],
  );

  const deleteMeal = useCallback(
    async (id: string) => {
      setMealsState((prev) => prev.filter((m) => m.id !== id));
      await enqueue(() => mealsRepo.delete(id));
    },
    [enqueue],
  );

  const startRoutineSession = useCallback(
    async (routineId: string, date?: string): Promise<string | null> => {
      const routine = routinesRef.current.find((r) => r.id === routineId);
      if (!routine) return null;
      const running = sessionsRef.current.find((s) => s.status === 'in-progress');
      if (running) return running.id;
      const session = createRoutineSession(routine, date ?? localDateFromTimestamp(Date.now()), sessionsRef.current, Date.now());
      setSessions((prev) => upsert(prev, session));
      await enqueue(() => sessionsRepo.put(session));
      return session.id;
    },
    [enqueue, setSessions],
  );

  const updateSession = useCallback(
    (session: WorkoutSession) => {
      if (session.status !== 'in-progress') return;
      const next = touchSession({ ...session, updatedAt: new Date().toISOString() }, Date.now());
      setSessions((prev) => upsert(prev, next));
      void enqueue(() => sessionsRepo.put(next));
    },
    [enqueue, setSessions],
  );

  const finishSession = useCallback(
    async (id: string, status: 'completed' | 'partial'): Promise<FinishResult | null> => {
      const current = sessionsRef.current.find((s) => s.id === id);
      if (!current || current.status !== 'in-progress') return null;
      const nowMs = Date.now();
      const closed = closeSession(current, status, nowMs);
      const nowIso = new Date(nowMs).toISOString();
      setSessions((prev) => upsert(prev, closed));

      // O check-in só nasce da CONCLUSÃO confirmada, na mesma transação que salva a sessão.
      const link =
        status === 'completed'
          ? { date: closed.date, source: { kind: 'workout' as const, sessionId: closed.id, title: closed.title, at: nowIso }, nowIso }
          : null;
      // A interface atualiza na hora (otimista); a gravação em disco confirma logo depois.
      let checkin: Checkin | null = null;
      if (link) {
        const optimistic = addSource(checkinsRef.current.find((c) => c.id === link.date), link.date, link.source, nowIso);
        checkin = optimistic;
        setCheckins((prev) => upsert(prev, optimistic));
      }
      const saved = await enqueue(() => saveSessionWithCheckin(closed, link));
      if (saved) {
        checkin = saved;
        setCheckins((prev) => upsert(prev, saved));
      }
      const dates = checkinsRef.current.map((c) => c.date);
      return { session: closed, checkin, streaks: computeStreaks(dates, localDateFromTimestamp(Date.now())) };
    },
    [enqueue, setCheckins, setSessions],
  );

  const abandonSession = useCallback(
    async (id: string) => {
      const current = sessionsRef.current.find((s) => s.id === id);
      if (!current || current.status !== 'in-progress') return;
      const closed = closeSession(current, 'abandoned', Date.now());
      if (!hasProgress(closed)) {
        // Nada foi feito: não há o que preservar no histórico.
        setSessions((prev) => prev.filter((s) => s.id !== id));
        await enqueue(() => sessionsRepo.delete(id));
        return;
      }
      setSessions((prev) => upsert(prev, closed));
      await enqueue(() => saveSessionWithCheckin(closed, null));
    },
    [enqueue, setSessions],
  );

  const manualCheckin = useCallback(
    async (input: ManualCheckinInput): Promise<Checkin | null> => {
      const nowMs = Date.now();
      const date = localDateFromTimestamp(nowMs);
      const nowIso = new Date(nowMs).toISOString();
      const minutes = input.minutes && input.minutes > 0 ? Math.min(Math.round(input.minutes), 600) : undefined;
      const note = input.note?.trim().slice(0, 200) || undefined;
      const source = { kind: 'manual' as const, id: uid('m'), activity: input.activity, minutes, note, at: nowIso };
      const saved = await enqueue(() => saveManualCheckin(date, source, nowIso));
      if (!saved) return null;
      setCheckins((prev) => upsert(prev, saved));
      return saved;
    },
    [enqueue, setCheckins],
  );

  const activeSession = useMemo(() => sessions.find((s) => s.status === 'in-progress') ?? null, [sessions]);
  const streaks = useMemo(() => computeStreaks(checkins.map((c) => c.date), today), [checkins, today]);

  const value = useMemo<DataState>(
    () => ({
      ready,
      today,
      plan,
      routines,
      customExercises,
      meals,
      saveRoutine,
      saveRoutines,
      deleteRoutine,
      saveCustomExercise,
      deleteCustomExercise,
      saveMeal,
      deleteMeal,
      startRoutineSession,
      sessions,
      checkins,
      activeSession,
      streaks,
      storageError,
      savePlan,
      updatePlan,
      startSession,
      updateSession,
      finishSession,
      abandonSession,
      manualCheckin,
    }),
    [ready, today, plan, routines, customExercises, meals, saveRoutine, saveRoutines, deleteRoutine, saveCustomExercise, deleteCustomExercise, saveMeal, deleteMeal, startRoutineSession, sessions, checkins, activeSession, streaks, storageError, savePlan, updatePlan, startSession, updateSession, finishSession, abandonSession, manualCheckin],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData deve ser usado dentro de <DataProvider>.');
  return ctx;
}

/** Sessões de um dia do plano (mais antigas primeiro). */
export function useDaySessions(dayId: string | undefined): WorkoutSession[] {
  const { sessions } = useData();
  return useMemo(() => (dayId ? sessionsForDay(sessions, dayId) : []), [sessions, dayId]);
}
