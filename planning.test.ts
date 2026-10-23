import { describe, expect, it } from 'vitest';
import { generateLocalPlan } from '../src/domain/localPlanner';
import { dayStatus, estimateMinutes, moveOptions, movePlanDay, parseReps, substituteExercise } from '../src/domain/planning';
import { defaultQuestionnaire } from '../src/domain/training';
import type { Questionnaire, WorkoutSession } from '../src/domain/training';

const START = '2026-10-19';
const NOW = '2026-10-19T12:00:00.000Z';

function plan(over: Partial<Questionnaire> = {}) {
  return generateLocalPlan({ questionnaire: { ...defaultQuestionnaire('gain-muscle'), place: 'gym', daysPerWeek: 3, minutesPerSession: 60, ...over }, startDate: START });
}

describe('repetições', () => {
  it('entende faixas, valores únicos e segundos', () => {
    expect(parseReps('8-12')).toEqual({ lo: 8, hi: 12, unit: 'reps' });
    expect(parseReps('10')).toEqual({ lo: 10, hi: 10, unit: 'reps' });
    expect(parseReps('30-45 s')).toEqual({ lo: 30, hi: 45, unit: 's' });
    expect(parseReps('abc')).toBeNull();
    expect(parseReps('12-8')).toBeNull();
  });

  it('estima duração de forma crescente', () => {
    const p = plan();
    const day = p.days.find((d) => d.kind === 'strength')!;
    expect(estimateMinutes(day.exercises.slice(0, 3))).toBeLessThan(estimateMinutes(day.exercises));
    expect(estimateMinutes([])).toBe(0);
  });
});

describe('reorganizar a semana', () => {
  it('trocar com um descanso mantém sete datas únicas e nenhuma sessão dupla', () => {
    const p = plan(); // treinos em 0, 3 e 6
    const source = p.days[0];
    const target = p.days[1]; // descanso
    const moved = movePlanDay(p, source.id, target.id, NOW);
    expect(moved.days).toHaveLength(7);
    expect(new Set(moved.days.map((d) => d.date)).size).toBe(7);
    expect(moved.days[1].id).toBe(source.id);
    expect(moved.days[1].movedFrom).toBe('2026-10-19');
    expect(moved.days[0].kind).toBe('rest');
    expect(moved.days.filter((d) => d.kind === 'strength')).toHaveLength(3);
  });

  it('um treino perdido só pode ir para um descanso de hoje em diante', () => {
    const p = plan();
    const missed = p.days[0]; // 19/10, perdido (hoje = 21/10)
    const options = moveOptions(p, missed.id, '2026-10-21', new Set());
    for (const o of options) {
      if (o.day.date < '2026-10-21') expect(o.allowed).toBe(false);
      else if (o.day.kind !== 'rest') expect(o.allowed).toBe(false);
      else expect(o.allowed).toBe(true);
    }
    expect(options.some((o) => o.allowed)).toBe(true);
  });

  it('não permite trocar com treino já concluído e avisa sobre recuperação', () => {
    const p = plan({ daysPerWeek: 3 });
    const [a, , , b] = p.days; // treinos em 0 e 3
    const doneTarget = moveOptions(p, a.id, '2026-10-19', new Set([b.id])).find((o) => o.day.id === b.id)!;
    expect(doneTarget.allowed).toBe(false);

    // Mover o último treino (dia 6) para o dia 4 ficaria colado no de dia 3: corpo todo em dias seguidos.
    const last = p.days[6];
    const opt = moveOptions(p, last.id, '2026-10-19', new Set()).find((o) => o.day.date === '2026-10-23')!;
    expect(opt.allowed).toBe(true);
    expect(opt.warnings.length).toBeGreaterThan(0);
  });

  it('substitui um exercício e mantém o original como alternativa', () => {
    const p = plan();
    const day = p.days.find((d) => d.kind === 'strength')!;
    const ex = day.exercises.find((e) => e.alternatives.length > 0)!;
    const alt = ex.alternatives[0];
    const next = substituteExercise(p, day.id, ex.id, alt.key, NOW);
    const updated = next.days.find((d) => d.id === day.id)!.exercises.find((e) => e.id === ex.id)!;
    expect(updated.name).toBe(alt.name);
    expect(updated.substitutedFrom).toBe(ex.name);
    expect(updated.alternatives.some((a) => a.name === ex.name)).toBe(true);
    expect(updated.sets).toBe(ex.sets);
    // O plano original não é alterado.
    expect(day.exercises.find((e) => e.id === ex.id)!.name).toBe(ex.name);
  });
});

describe('estado do dia', () => {
  const p = plan();
  const day = p.days[0];
  const base = { dayId: day.id, startedAt: '2026-10-19T10:00:00.000Z' } as WorkoutSession;

  it('classifica descanso, hoje, futuro e perdido', () => {
    expect(dayStatus(p.days[1], [], '2026-10-19')).toBe('rest');
    expect(dayStatus(day, [], '2026-10-19')).toBe('today');
    expect(dayStatus(day, [], '2026-10-18')).toBe('upcoming');
    expect(dayStatus(day, [], '2026-10-20')).toBe('missed');
  });

  it('só considera concluído com sessão concluída; abandonada não conta', () => {
    expect(dayStatus(day, [{ ...base, status: 'abandoned' }], '2026-10-19')).toBe('today');
    expect(dayStatus(day, [{ ...base, status: 'in-progress' }], '2026-10-19')).toBe('in-progress');
    expect(dayStatus(day, [{ ...base, status: 'partial' }], '2026-10-20')).toBe('partial');
    expect(dayStatus(day, [{ ...base, status: 'completed' }], '2026-10-20')).toBe('done');
  });
});
