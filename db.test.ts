import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { closeDb } from '../src/data/db';
import { bodyMetricsRepo, getMealsForDate, mealsRepo, profileRepo, settingsRepo } from '../src/data/repositories';
import { buildSummary } from '../src/services/homeSummary';

afterEach(async () => {
  await Promise.all([profileRepo.clear(), settingsRepo.clear(), mealsRepo.clear(), bodyMetricsRepo.clear()]);
  await closeDb();
});

describe('persistência (IndexedDB)', () => {
  it('salva e relê o perfil', async () => {
    await profileRepo.put({
      id: 'me',
      schemaVersion: 1,
      name: 'Ana',
      goal: 'health',
      onboardingDone: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await closeDb(); // simula fechar e reabrir o app
    const loaded = await profileRepo.get('me');
    expect(loaded?.name).toBe('Ana');
    expect(loaded?.goal).toBe('health');
  });

  it('salva tema e modo noite de forma independente', async () => {
    await settingsRepo.put({ id: 'appearance', theme: 'pink', mode: 'dark', updatedAt: '2026-01-01T00:00:00.000Z' });
    await closeDb();
    const loaded = await settingsRepo.get('appearance');
    expect(loaded?.theme).toBe('pink');
    expect(loaded?.mode).toBe('dark');
  });

  it('consulta refeições por data', async () => {
    const base = { loggedAt: '2026-01-01T12:00:00.000Z', source: 'manual' as const, plannedMeal: true };
    await mealsRepo.put({ ...base, id: 'a', date: '2026-01-01', name: 'Almoço', kcal: 600 });
    await mealsRepo.put({ ...base, id: 'b', date: '2026-01-02', name: 'Jantar' });
    const day = await getMealsForDate('2026-01-01');
    expect(day.map((m) => m.id)).toEqual(['a']);
  });
});

describe('resumo da tela Início', () => {
  it('sem registros não inventa números', () => {
    const s = buildSummary([], []);
    expect(s.mealsCount).toBe(0);
    expect(s.mealsKcal).toBeNull();
    expect(s.hasAnyMetric).toBe(false);
  });

  it('soma kcal apenas das refeições que têm estimativa', () => {
    const s = buildSummary([{ kcal: 500 }, {}, { kcal: 250 }], []);
    expect(s.mealsCount).toBe(3);
    expect(s.mealsKcal).toBe(750);
  });
});
