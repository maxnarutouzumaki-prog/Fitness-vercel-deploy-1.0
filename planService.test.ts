import { describe, expect, it } from 'vitest';
import { defaultQuestionnaire } from '../src/domain/training';
import type { Questionnaire, WorkoutSession } from '../src/domain/training';
import { generateLocalPlan } from '../src/domain/localPlanner';
import { generatePlan } from '../src/services/planService';

const NOW = new Date(2026, 9, 19, 9, 0, 0).getTime(); // segunda, 19/10/2026 (hora local)
const q: Questionnaire = { ...defaultQuestionnaire('gain-muscle'), place: 'gym', daysPerWeek: 3, minutesPerSession: 60 };

function modelJson() {
  const plan = generateLocalPlan({ questionnaire: q, startDate: '2026-10-19' });
  return {
    days: plan.days.map((d, i) => ({
      dayIndex: i, kind: d.kind, title: d.title, focus: d.focus, intensity: d.intensity ?? 'low', place: d.place ?? 'gym',
      exercises: d.exercises.map((e) => ({ name: e.name, muscles: e.muscles, sets: e.sets, reps: e.reps, restSeconds: e.restSeconds, instructions: e.instructions, alternatives: [] })),
      cardio: d.cardio ?? null,
    })),
  };
}
const serverOk = async () => new Response(JSON.stringify({ ok: true, model: 'gemini-3.8-flash', plan: modelJson() }), { status: 200 });
const serverFail = (status: number, code: string) => async () => new Response(JSON.stringify({ ok: false, code }), { status });

const run = (fetchImpl: typeof fetch, sessions: WorkoutSession[] = [], mode: 'gemini' | 'local' = 'gemini') =>
  generatePlan({ questionnaire: q, sessions, mode, nowMs: NOW, fetchImpl });

describe('geração do plano (Gemini com contingência local)', () => {
  it('modo local nunca chama a API e se identifica como gerador do app', async () => {
    let called = false;
    const plan = await run((async () => { called = true; return serverOk(); }) as unknown as typeof fetch, [], 'local');
    expect(called).toBe(false);
    expect(plan.source).toBe('local');
    expect(plan.fallbackReason).toBe('user_choice');
    expect(plan.startDate).toBe('2026-10-19');
    expect(plan.days).toHaveLength(7);
  });

  it('usa o Gemini quando a resposta é válida', async () => {
    const plan = await run(serverOk as unknown as typeof fetch);
    expect(plan.source).toBe('gemini');
    expect(plan.model).toBe('gemini-3.8-flash');
    expect(plan.fallbackReason).toBeUndefined();
    expect(plan.days.filter((d) => d.kind === 'strength')).toHaveLength(3);
  });

  it('cai para o gerador local, com o motivo certo, quando o Gemini falha', async () => {
    const cases: Array<[typeof fetch, string]> = [
      [serverFail(503, 'not_configured') as unknown as typeof fetch, 'not_configured'],
      [serverFail(429, 'rate_limited') as unknown as typeof fetch, 'rate_limited'],
      [serverFail(504, 'timeout') as unknown as typeof fetch, 'timeout'],
      [serverFail(502, 'unavailable') as unknown as typeof fetch, 'unavailable'],
      [(async () => new Response('<html>site</html>', { status: 200 })) as unknown as typeof fetch, 'no_endpoint'],
      [(async () => new Response('nope', { status: 404 })) as unknown as typeof fetch, 'no_endpoint'],
      [(async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch, 'unavailable'],
    ];
    for (const [impl, reason] of cases) {
      const plan = await run(impl);
      expect(plan.source).toBe('local');
      expect(plan.fallbackReason).toBe(reason);
      expect(plan.days).toHaveLength(7);
    }
  });

  it('resposta do Gemini com estrutura errada também cai para o gerador local', async () => {
    const bad = (async () => new Response(JSON.stringify({ ok: true, model: 'x', plan: { days: [{ kind: 'rest' }] } }), { status: 200 })) as unknown as typeof fetch;
    const plan = await run(bad);
    expect(plan.source).toBe('local');
    expect(plan.fallbackReason).toBe('invalid_response');
  });

  it('não coloca segunda sessão no mesmo dia se já concluiu um treino hoje', async () => {
    const done = { status: 'completed', date: '2026-10-19', title: 'Corpo todo A', exercises: [] } as unknown as WorkoutSession;
    const plan = await run(serverOk as unknown as typeof fetch, [done]);
    expect(plan.days[0].kind).toBe('rest');
    expect(plan.days.filter((d) => d.kind === 'strength')).toHaveLength(3);
  });

  it('dor significativa sem liberação profissional não gera plano', async () => {
    let failed = false;
    try {
      await generatePlan({ questionnaire: { ...q, limitationLevel: 'significant' }, sessions: [], mode: 'local', nowMs: NOW });
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });
});
