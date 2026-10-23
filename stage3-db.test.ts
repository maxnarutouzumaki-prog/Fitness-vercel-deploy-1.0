import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { DB_NAME, DB_VERSION, STORE, closeDb } from '../src/data/db';
import { customExercisesRepo, exerciseImagesRepo, mealsRepo, profileRepo, routinesRepo, sessionsRepo } from '../src/data/repositories';
import { newRoutine } from '../src/domain/routines';

afterEach(async () => {
  await Promise.all([routinesRepo.clear(), customExercisesRepo.clear(), exerciseImagesRepo.clear(), mealsRepo.clear(), profileRepo.clear(), sessionsRepo.clear()]);
  await closeDb();
});

/** Cria um banco "antigo" (versão 2) com dados e abre com o código novo. */
function seedV2(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const n of ['profile', 'settings', 'exercises', 'plannedWorkouts', 'sessions', 'meals', 'bodyMetrics', 'photos', 'reminders', 'plans', 'checkins', 'meta']) db.createObjectStore(n, { keyPath: 'id' });
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(['profile', 'meals'], 'readwrite');
      tx.objectStore('profile').put({ id: 'me', name: 'Ana', onboardingDone: true });
      tx.objectStore('meals').put({ id: 'old', date: '2026-01-01', name: 'Almoço antigo', kcal: 500, source: 'manual', plannedMeal: true, loggedAt: '2026-01-01T12:00:00.000Z' });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

describe('banco v3', () => {
  it('a versão foi aumentada e os novos stores existem', async () => {
    expect(DB_VERSION).toBe(3);
    await routinesRepo.put(newRoutine('A', 0, '2026-01-01T00:00:00.000Z'));
    expect(STORE.routines).toBe('routines');
    expect((await routinesRepo.all()).length).toBe(1);
  });
  it('migra de v2 para v3 sem perder perfil nem refeições antigas', async () => {
    await closeDb();
    await new Promise<void>((res) => { const d = indexedDB.deleteDatabase(DB_NAME); d.onsuccess = () => res(); d.onerror = () => res(); });
    await seedV2();
    const profile = await profileRepo.get('me');
    expect(profile?.name).toBe('Ana');
    const meal = await mealsRepo.get('old');
    expect(meal?.kcal).toBe(500);
    await routinesRepo.put(newRoutine('Nova', 0, '2026-01-01T00:00:00.000Z'));
    await exerciseImagesRepo.put({ id: 'i1', dataUrl: 'data:image/jpeg;base64,AAAA', width: 1, height: 1, bytes: 3, createdAt: '2026-01-01T00:00:00.000Z' });
    await closeDb();
    expect((await routinesRepo.all())[0].name).toBe('Nova');
    expect((await exerciseImagesRepo.get('i1'))?.bytes).toBe(3);
  });
  it('fichas, exercícios próprios e fotos persistem após reabrir', async () => {
    await customExercisesRepo.put({ id: 'c1', name: 'Meu', muscles: [], kind: 'strength', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
    await closeDb();
    expect((await customExercisesRepo.get('c1'))?.name).toBe('Meu');
  });
});
