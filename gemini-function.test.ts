import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// @ts-ignore — função de servidor em JavaScript puro (sem tipos)
import { handle, parseModelJson, sanitizeWorkoutInput } from '../lib/gemini-core.mjs';
import { buildGeminiRequest } from '../src/domain/geminiPlan';
import { generateLocalPlan } from '../src/domain/localPlanner';
import { defaultQuestionnaire } from '../src/domain/training';
import type { Questionnaire } from '../src/domain/training';

const START = '2026-10-19';
const KEY = 'AIzaSy-TEST-KEY-NAO-REAL-0123456789';
const q: Questionnaire = { ...defaultQuestionnaire('gain-muscle'), place: 'gym', daysPerWeek: 3, minutesPerSession: 60 };

/** Plano no formato que o Gemini deveria devolver, derivado do gerador local. */
function modelPlan() {
  const plan = generateLocalPlan({ questionnaire: q, startDate: START });
  return {
    days: plan.days.map((d, i) => ({
      dayIndex: i,
      kind: d.kind,
      title: d.title,
      focus: d.focus,
      intensity: d.intensity ?? 'low',
      place: d.place ?? 'gym',
      exercises: d.exercises.map((e) => ({ name: e.name, muscles: e.muscles, sets: e.sets, reps: e.reps, restSeconds: e.restSeconds, instructions: e.instructions, alternatives: e.alternatives.map((a) => ({ name: a.name, note: 'alternativa' })) })),
      cardio: d.cardio ? { modality: d.cardio.modality, minutes: d.cardio.minutes, intensity: d.cardio.intensity } : null,
    })),
    notes: ['Aqueça antes de começar.'],
  };
}

const geminiOk = (obj: unknown) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }), { status: 200 });

let counter = 0;
const nextIp = () => `10.0.0.${++counter}`;

function request(body: unknown, init: { origin?: string | null; method?: string; raw?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.origin !== null) headers.Origin = init.origin ?? 'https://meu-app.netlify.app';
  return new Request('https://meu-app.netlify.app/.netlify/functions/gemini', {
    method: init.method ?? 'POST',
    headers,
    body: (init.method ?? 'POST') === 'GET' ? undefined : (init.raw ?? JSON.stringify(body)),
  });
}

const valid = () => ({ task: 'workout-plan', input: buildGeminiRequest(q, START, []) });

beforeEach(() => {
  process.env.GEMINI_API_KEY = KEY;
  delete process.env.GEMINI_MODEL;
  delete process.env.GEMINI_FALLBACK_MODELS;
});
afterEach(() => {
  delete process.env.GEMINI_API_KEY;
});

describe('função gemini (servidor)', () => {
  it('sem a variável GEMINI_API_KEY responde "não configurado" e não chama a API', async () => {
    delete process.env.GEMINI_API_KEY;
    let called = false;
    const res = await handle(request(valid()), { ip: nextIp() }, { fetchImpl: async () => { called = true; return geminiOk({}); } });
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('not_configured');
    expect(called).toBe(false);
  });

  it('rejeita chamadas vindas de outro site e métodos diferentes de POST', async () => {
    const other = await handle(request(valid(), { origin: 'https://site-malicioso.example' }), { ip: nextIp() }, { fetchImpl: async () => geminiOk({}) });
    expect(other.status).toBe(403);
    const get = await handle(request(null, { method: 'GET' }), { ip: nextIp() }, { fetchImpl: async () => geminiOk({}) });
    expect(get.status).toBe(405);
  });

  it('valida o pedido: tarefa desconhecida, corpo inválido, janela errada e corpo grande', async () => {
    const deps = { fetchImpl: async () => geminiOk({}) };
    expect((await handle(request({ task: 'x', input: {} }), { ip: nextIp() }, deps)).status).toBe(400);
    expect((await handle(request(null, { raw: 'não é json' }), { ip: nextIp() }, deps)).status).toBe(400);
    const bad = valid();
    (bad.input as { window: unknown[] }).window = [];
    expect((await handle(request(bad), { ip: nextIp() }, deps)).status).toBe(400);
    const noGoal = valid();
    delete (noGoal.input as Record<string, unknown>).goal;
    expect((await handle(request(noGoal), { ip: nextIp() }, deps)).status).toBe(400);
    const huge = valid();
    (huge.input as Record<string, unknown>).filler = 'x'.repeat(20000);
    expect((await handle(request(huge), { ip: nextIp() }, deps)).status).toBe(413);
  });

  it('chama o Gemini com a chave no cabeçalho, JSON estruturado e devolve o plano', async () => {
    let seen: { url: string; headers: Record<string, string>; body: any } | null = null;
    const res = await handle(request(valid()), { ip: nextIp() }, {
      fetchImpl: async (url: string, init: any) => {
        seen = { url, headers: init.headers, body: JSON.parse(init.body) };
        return geminiOk(modelPlan());
      },
    });
    expect(res.status).toBe(200);
    const text = await res.clone().text();
    const body = JSON.parse(text);
    expect(body.ok).toBe(true);
    expect(body.model).toBe('gemini-3.8-flash');
    expect(body.plan.days).toHaveLength(7);
    // A chave só vai ao Google (cabeçalho), nunca na URL nem na resposta ao navegador.
    expect(seen!.url).toContain('gemini-3.8-flash:generateContent');
    expect(seen!.url).not.toContain(KEY);
    expect(seen!.headers['x-goog-api-key']).toBe(KEY);
    expect(seen!.body.generationConfig.responseMimeType).toBe('application/json');
    expect(text).not.toContain(KEY);
  });

  it('não envia o nome nem campos extras ao Gemini e limita textos livres', async () => {
    const payload = valid();
    Object.assign(payload.input, { name: 'Ana Paula', email: 'ana@exemplo.com', likes: 'y'.repeat(900) });
    let prompt = '';
    await handle(request(payload), { ip: nextIp() }, {
      fetchImpl: async (_u: string, init: any) => {
        prompt = JSON.parse(init.body).contents[0].parts[0].text;
        return geminiOk(modelPlan());
      },
    });
    expect(prompt).not.toContain('Ana Paula');
    expect(prompt).not.toContain('ana@exemplo.com');
    expect(prompt).not.toContain('y'.repeat(301));
  });

  it('mapeia limite de requisições, tempo esgotado e indisponibilidade', async () => {
    const mk = (status: number) => async () => new Response('{}', { status });
    const r429 = await handle(request(valid()), { ip: nextIp() }, { fetchImpl: mk(429) });
    expect([r429.status, (await r429.json()).code]).toEqual([429, 'rate_limited']);
    const r500 = await handle(request(valid()), { ip: nextIp() }, { fetchImpl: mk(500) });
    expect([r500.status, (await r500.json()).code]).toEqual([502, 'unavailable']);
    const timeout = await handle(request(valid()), { ip: nextIp() }, { fetchImpl: async () => { const e = new Error('x'); e.name = 'AbortError'; throw e; } });
    expect([timeout.status, (await timeout.json()).code]).toEqual([504, 'timeout']);
    const net = await handle(request(valid()), { ip: nextIp() }, { fetchImpl: async () => { throw new TypeError('fetch failed'); } });
    expect(net.status).toBe(502);
  });

  it('tenta o modelo alternativo quando o principal não existe', async () => {
    const urls: string[] = [];
    const res = await handle(request(valid()), { ip: nextIp() }, {
      fetchImpl: async (url: string) => {
        urls.push(url);
        return urls.length === 1 ? new Response('{}', { status: 404 }) : geminiOk(modelPlan());
      },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).model).toBe('gemini-3.5-flash-lite');
    expect(urls).toHaveLength(2);
  });

  it('respostas inválidas do modelo viram "invalid_response"', async () => {
    const garbage = await handle(request(valid()), { ip: nextIp() }, { fetchImpl: async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'olá, aqui está seu treino!' }] } }] }), { status: 200 }) });
    expect([garbage.status, (await garbage.json()).code]).toEqual([502, 'invalid_response']);
    const wrongDays = await handle(request(valid()), { ip: nextIp() }, { fetchImpl: async () => geminiOk({ days: [] }) });
    expect((await wrongDays.json()).code).toBe('invalid_response');
    const mod = modelPlan();
    mod.days[1] = { ...mod.days[1], kind: 'strength', exercises: mod.days[0].exercises };
    const wrongCount = await handle(request(valid()), { ip: nextIp() }, { fetchImpl: async () => geminiOk(mod) });
    expect((await wrongCount.json()).code).toBe('invalid_response');
  });

  it('aceita JSON dentro de bloco de código e texto ao redor', () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseModelJson('Claro! {"a":2} Pronto.')).toEqual({ a: 2 });
    expect(parseModelJson('sem json')).toBeNull();
  });

  it('limita o uso por IP', async () => {
    const ip = nextIp();
    const deps = { fetchImpl: async () => geminiOk(modelPlan()) };
    let last = 200;
    for (let i = 0; i < 21; i += 1) last = (await handle(request(valid()), { ip }, deps)).status;
    expect(last).toBe(429);
  });

  it('sanitiza valores fora do intervalo', () => {
    const input = { ...buildGeminiRequest(q, START, []), daysPerWeek: 99, minutesPerSession: 1, equipment: ['dumbbell', 'foguete'] };
    const clean = sanitizeWorkoutInput(input);
    expect(clean.daysPerWeek).toBe(6);
    expect(clean.minutesPerSession).toBe(15);
    expect(clean.equipment).toEqual(['dumbbell']);
  });
});
