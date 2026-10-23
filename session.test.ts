import { describe, expect, it } from 'vitest';
import { generateLocalPlan } from '../src/domain/localPlanner';
import { lastPerformance, progressionHint } from '../src/domain/progression';
import {
  closeSession,
  createSession,
  elapsedMs,
  hasProgress,
  isFullyDone,
  pauseSession,
  resumeSession,
  sessionStats,
  settleOnLoad,
} from '../src/domain/session';
import { defaultQuestionnaire } from '../src/domain/training';
import type { WorkoutSession } from '../src/domain/training';

const plan = generateLocalPlan({ questionnaire: { ...defaultQuestionnaire('gain-muscle'), place: 'gym', daysPerWeek: 3 }, startDate: '2026-10-19' });
const day = plan.days[0];
const T0 = new Date(2026, 9, 19, 10, 0, 0).getTime();

function fresh(): WorkoutSession {
  return createSession(plan, day, [], T0);
}

describe('sessão de treino', () => {
  it('iniciar cria uma sessão em andamento, sem nada concluído', () => {
    const s = fresh();
    expect(s.status).toBe('in-progress');
    expect(s.exercises).toHaveLength(day.exercises.length);
    expect(sessionStats(s).doneSets).toBe(0);
    expect(hasProgress(s)).toBe(false);
    expect(isFullyDone(s)).toBe(false);
    expect(s.endedAt).toBeUndefined();
  });

  it('cronômetro conta só o tempo ativo (pausa não conta)', () => {
    let s = fresh();
    expect(elapsedMs(s, T0 + 60_000)).toBe(60_000);
    s = pauseSession(s, T0 + 60_000);
    expect(elapsedMs(s, T0 + 600_000)).toBe(60_000);
    s = resumeSession(s, T0 + 600_000);
    expect(elapsedMs(s, T0 + 660_000)).toBe(120_000);
  });

  it('pausa automaticamente sessões esquecidas ao reabrir', () => {
    const s = fresh();
    const later = T0 + 3 * 3_600_000;
    const settled = settleOnLoad(s, later);
    expect(settled.runningSince).toBeUndefined();
    expect(elapsedMs(settled, later)).toBe(0); // última atividade foi em T0
    const active = { ...s, lastActivityAt: T0 + 10 * 60_000 };
    expect(settleOnLoad(active, T0 + 20 * 60_000).runningSince).toBeDefined();
  });

  it('marcar séries atualiza as estatísticas', () => {
    const s = fresh();
    s.exercises[0].sets[0] = { reps: 10, loadKg: 20, completed: true };
    const st = sessionStats(s);
    expect(st.doneSets).toBe(1);
    expect(st.exercisesWithProgress).toBe(1);
    expect(hasProgress(s)).toBe(true);
    expect(isFullyDone(s)).toBe(false);
  });

  it('só é "totalmente concluída" quando todas as séries e o cardio foram marcados', () => {
    const s = fresh();
    for (const ex of s.exercises) ex.sets = ex.sets.map((x) => ({ ...x, completed: true }));
    if (s.cardio) expect(isFullyDone(s)).toBe(false);
    if (s.cardio) s.cardio = { ...s.cardio, completed: true };
    expect(isFullyDone(s)).toBe(true);
  });

  it('fechar usa a data LOCAL do momento da confirmação (meia-noite)', () => {
    const start = new Date(2026, 9, 19, 23, 59, 50).getTime();
    const s = createSession(plan, day, [], start);
    expect(s.date).toBe('2026-10-19');
    const closed = closeSession(s, 'completed', start + 20_000);
    expect(closed.date).toBe('2026-10-20');
    expect(closed.status).toBe('completed');
    expect(closed.runningSince).toBeUndefined();
    expect(closed.endedAt).toBeDefined();
    expect(elapsedMs(closed, start + 999_999)).toBe(20_000);
  });

  it('abandonada preserva os dados e não vira concluída', () => {
    const s = fresh();
    s.exercises[0].sets[0] = { reps: 8, loadKg: 15, completed: true };
    const closed = closeSession(s, 'abandoned', T0 + 120_000);
    expect(closed.status).toBe('abandoned');
    expect(sessionStats(closed).doneSets).toBe(1);
  });
});

describe('progressão', () => {
  const key = day.exercises[0].key;
  const done = (loadKg: number, reps: number, difficulty?: 1 | 2 | 3 | 4 | 5, discomfort = false): WorkoutSession => {
    const s = fresh();
    s.exercises[0].sets = [0, 1, 2].map(() => ({ reps, loadKg, completed: true }));
    s.exercises[0].difficulty = difficulty;
    if (discomfort) s.exercises[0].discomfort = { present: true };
    return closeSession(s, 'completed', T0 + 3_000_000);
  };

  it('sem histórico não há sugestão nem carga pré-preenchida', () => {
    expect(lastPerformance(key, [])).toBeNull();
    expect(progressionHint('8-12', null)).toBeNull();
    expect(fresh().exercises[0].sets[0].loadKg).toBeUndefined();
  });

  it('pré-preenche a carga com a última usada', () => {
    const s = createSession(plan, day, [done(20, 12)], T0 + 86_400_000);
    expect(s.exercises[0].sets[0].loadKg).toBe(20);
  });

  it('sugere aumento pequeno quando chegou ao topo com esforço confortável', () => {
    const hint = progressionHint(day.exercises[0].reps, lastPerformance(key, [done(20, 12, 3)]));
    expect(hint?.kind).toBe('increase');
    expect(hint!.suggestedLoadKg!).toBeGreaterThan(20);
    expect(hint!.suggestedLoadKg!).toBeLessThanOrEqual(21.5);
  });

  it('mantém a carga quando foi difícil ou não chegou ao topo', () => {
    expect(progressionHint('8-12', lastPerformance(key, [done(20, 12, 5)]))?.kind).toBe('hold');
    expect(progressionHint('8-12', lastPerformance(key, [done(20, 9, 3)]))?.kind).toBe('hold');
  });

  it('não incentiva carga quando houve desconforto', () => {
    expect(progressionHint('8-12', lastPerformance(key, [done(20, 12, 3, true)]))?.kind).toBe('careful');
  });

  it('abandonadas não entram no histórico de desempenho', () => {
    const s = done(20, 12);
    expect(lastPerformance(key, [{ ...s, status: 'abandoned' }])).toBeNull();
  });
});
