import { describe, expect, it } from 'vitest';
import { LIBRARY_BY_ID, normalizeText } from '../src/domain/exerciseLibrary';
import { chooseTrainingDays, generateLocalPlan, avoidSecondSessionToday } from '../src/domain/localPlanner';
import { estimateMinutes, recoveryConflicts } from '../src/domain/planning';
import { canGeneratePlan, defaultQuestionnaire, questionnaireHash } from '../src/domain/training';
import type { Questionnaire, WorkoutSession } from '../src/domain/training';

const START = '2026-10-19'; // segunda-feira

function q(over: Partial<Questionnaire> = {}): Questionnaire {
  return { ...defaultQuestionnaire('gain-muscle'), place: 'gym', daysPerWeek: 3, minutesPerSession: 60, ...over };
}

describe('gerador local de treino semanal', () => {
  it('monta sete dias consecutivos com treinos e descansos coerentes', () => {
    const plan = generateLocalPlan({ questionnaire: q(), startDate: START });
    expect(plan.days).toHaveLength(7);
    expect(plan.days.map((d) => d.date)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
    expect(plan.days.filter((d) => d.kind === 'strength')).toHaveLength(3);
    expect(plan.days.filter((d) => d.kind === 'rest')).toHaveLength(4);
    expect(plan.source).toBe('local');
    for (const d of plan.days.filter((x) => x.kind === 'strength')) {
      expect(d.exercises.length).toBeGreaterThanOrEqual(3);
      expect(d.title.length).toBeGreaterThan(0);
      for (const ex of d.exercises) {
        expect(ex.sets).toBeGreaterThan(0);
        expect(ex.reps).toMatch(/\d/);
        expect(ex.restSeconds).toBeGreaterThan(0);
        expect(ex.instructions.length).toBeGreaterThan(10);
      }
    }
  });

  it('respeita de 1 a 6 dias por semana e evita sobrecarga em dias seguidos', () => {
    for (const place of ['gym', 'home'] as const) {
      for (let k = 1; k <= 6; k += 1) {
        const plan = generateLocalPlan({ questionnaire: q({ daysPerWeek: k, place, equipment: ['dumbbell', 'bench', 'band', 'pullup'] }), startDate: START });
        expect(plan.days.filter((d) => d.kind === 'strength')).toHaveLength(k);
        expect(recoveryConflicts(plan.days)).toEqual([]);
      }
    }
  });

  it('espalha os treinos ao longo da semana', () => {
    expect(chooseTrainingDays(3, START, [], false)).toEqual([0, 3, 6]);
    expect(chooseTrainingDays(4, START, [], false)).toEqual([0, 2, 4, 6]);
    expect(chooseTrainingDays(2, START, [], false)).toEqual([0, 6]);
  });

  it('respeita dias preferidos quando há dias suficientes', () => {
    // terça (1), quinta (3), sábado (5)
    const idx = chooseTrainingDays(3, START, [1, 3, 5], false);
    expect(idx).toEqual([1, 3, 5]);
  });

  it('não coloca treino no primeiro dia se acabou de treinar', () => {
    const recent = { status: 'completed', date: '2026-10-18' } as WorkoutSession;
    const plan = generateLocalPlan({ questionnaire: q({ daysPerWeek: 3 }), startDate: START, sessions: [recent] });
    expect(plan.days[0].kind).toBe('rest');
  });

  it('em casa sem equipamentos usa só exercícios com o peso do corpo', () => {
    const plan = generateLocalPlan({ questionnaire: q({ place: 'home', equipment: [] }), startDate: START });
    for (const d of plan.days) {
      for (const ex of d.exercises) {
        const lib = LIBRARY_BY_ID[ex.libraryId ?? ''];
        expect(lib.requires.every((r) => r === 'bodyweight')).toBe(true);
      }
    }
  });

  it('em casa usa apenas os equipamentos informados', () => {
    const plan = generateLocalPlan({ questionnaire: q({ place: 'home', equipment: ['dumbbell'] }), startDate: START });
    let usedDumbbell = false;
    for (const ex of plan.days.flatMap((d) => d.exercises)) {
      const lib = LIBRARY_BY_ID[ex.libraryId ?? ''];
      expect(lib.requires.every((r) => r === 'bodyweight' || r === 'dumbbell')).toBe(true);
      if (lib.requires.includes('dumbbell')) usedDumbbell = true;
    }
    expect(usedDumbbell).toBe(true);
  });

  it('local "nos dois" alterna academia e casa', () => {
    const plan = generateLocalPlan({ questionnaire: q({ place: 'both', daysPerWeek: 4 }), startDate: START });
    const places = plan.days.filter((d) => d.kind === 'strength').map((d) => d.place);
    expect(places).toEqual(['gym', 'home', 'gym', 'home']);
  });

  it('evita exercícios que a pessoa pediu para evitar', () => {
    const plan = generateLocalPlan({ questionnaire: q({ avoid: 'Agachamento, supino' }), startDate: START });
    for (const ex of plan.days.flatMap((d) => d.exercises)) {
      const n = normalizeText(ex.name);
      expect(n.includes('agachamento')).toBe(false);
      expect(n.includes('supino')).toBe(false);
      for (const alt of ex.alternatives) expect(normalizeText(alt.name).includes('agachamento')).toBe(false);
    }
  });

  it('prioriza exercícios de que a pessoa gosta', () => {
    const plan = generateLocalPlan({ questionnaire: q({ likes: 'Remada sentada' }), startDate: START });
    expect(plan.days.flatMap((d) => d.exercises).some((e) => e.name === 'Remada sentada na máquina')).toBe(true);
  });

  it('cabe no tempo disponível por sessão', () => {
    for (const minutes of [30, 45, 60, 90]) {
      const plan = generateLocalPlan({ questionnaire: q({ minutesPerSession: minutes, goal: 'lose-fat' }), startDate: START });
      for (const d of plan.days.filter((x) => x.kind === 'strength')) {
        expect(d.estimatedMinutes).toBeLessThanOrEqual(minutes);
        expect(d.estimatedMinutes).toBe(estimateMinutes(d.exercises, d.cardio));
      }
    }
  });

  it('inclui cardio quando apropriado e respeita quem não quer cardio', () => {
    const withCardio = generateLocalPlan({ questionnaire: q({ goal: 'lose-fat', cardio: 'some' }), startDate: START });
    expect(withCardio.days.filter((d) => d.kind === 'strength').every((d) => !!d.cardio)).toBe(true);
    for (const d of withCardio.days) if (d.cardio) expect(d.cardio.minutes).toBeLessThanOrEqual(20);
    const none = generateLocalPlan({ questionnaire: q({ goal: 'lose-fat', cardio: 'avoid' }), startDate: START });
    expect(none.days.every((d) => !d.cardio)).toBe(true);
  });

  it('iniciante nunca recebe intensidade alta nem barras técnicas', () => {
    const plan = generateLocalPlan({ questionnaire: q({ experience: 'beginner', goal: 'strength' }), startDate: START });
    const names = plan.days.flatMap((d) => d.exercises).map((e) => e.libraryId);
    expect(names.includes('back-squat')).toBe(false);
    expect(names.includes('barbell-deadlift')).toBe(false);
    for (const d of plan.days) expect(d.intensity === 'high').toBe(false);
  });

  it('com limitação no joelho evita exercícios que sobrecarregam o joelho', () => {
    const plan = generateLocalPlan({ questionnaire: q({ limitationLevel: 'mild', limitations: 'Dor leve no joelho direito' }), startDate: START });
    for (const ex of plan.days.flatMap((d) => d.exercises)) {
      expect(LIBRARY_BY_ID[ex.libraryId ?? ''].stress.includes('knee')).toBe(false);
    }
    for (const d of plan.days.filter((x) => x.kind === 'strength')) expect(d.intensity).toBe('low');
  });

  it('ids de dias e exercícios são únicos', () => {
    const plan = generateLocalPlan({ questionnaire: q({ daysPerWeek: 5 }), startDate: START });
    const ids = [...plan.days.map((d) => d.id), ...plan.days.flatMap((d) => d.exercises.map((e) => e.id))];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('é determinístico quanto ao conteúdo', () => {
    const a = generateLocalPlan({ questionnaire: q(), startDate: START });
    const b = generateLocalPlan({ questionnaire: q(), startDate: START });
    expect(a.days.map((d) => [d.title, d.exercises.map((e) => e.name)])).toEqual(b.days.map((d) => [d.title, d.exercises.map((e) => e.name)]));
  });

  it('há alternativas para os exercícios na academia', () => {
    const plan = generateLocalPlan({ questionnaire: q(), startDate: START });
    const exercises = plan.days.flatMap((d) => d.exercises).filter((e) => e.libraryId && LIBRARY_BY_ID[e.libraryId].pattern !== 'calves');
    expect(exercises.filter((e) => e.alternatives.length > 0).length).toBeGreaterThan(exercises.length / 2);
  });

  it('não coloca segunda sessão hoje se já treinou', () => {
    const plan = generateLocalPlan({ questionnaire: q({ daysPerWeek: 6 }), startDate: START });
    expect(plan.days[0].kind).toBe('strength');
    const adjusted = avoidSecondSessionToday(plan, true);
    expect(adjusted.days[0].kind).toBe('rest');
    expect(adjusted.days.filter((d) => d.kind === 'strength')).toHaveLength(6);
    expect(new Set(adjusted.days.map((d) => d.date)).size).toBe(7);
  });
});

describe('questionário', () => {
  it('o hash muda quando as respostas relevantes mudam', () => {
    const a = q();
    expect(questionnaireHash(a)).toBe(questionnaireHash({ ...a }));
    expect(questionnaireHash(a)).not.toBe(questionnaireHash({ ...a, goal: 'lose-fat' }));
    expect(questionnaireHash(a)).not.toBe(questionnaireHash({ ...a, daysPerWeek: 4 }));
    expect(questionnaireHash(a)).not.toBe(questionnaireHash({ ...a, equipment: ['band'] }));
  });

  it('dor significativa bloqueia a geração até haver liberação profissional', () => {
    expect(canGeneratePlan(q({ limitationLevel: 'significant' })).ok).toBe(false);
    expect(canGeneratePlan(q({ limitationLevel: 'significant', clearedByProfessional: true })).ok).toBe(true);
    expect(canGeneratePlan(q({ limitationLevel: 'mild' })).ok).toBe(true);
  });
});
