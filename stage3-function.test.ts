import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// @ts-ignore — função de servidor em JavaScript puro (sem tipos)
import { handle, sanitizeMealPhotoInput, sanitizeMealSuggestionsInput, validateMealPhotoOutput, validateMealSuggestionsOutput } from '../lib/gemini-core.mjs';

const KEY = 'AIzaSy-TEST-KEY-NAO-REAL-0123456789';
const geminiOk = (obj: unknown) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }), { status: 200 });
let counter = 100;
const nextIp = () => `10.1.0.${++counter}`;
const req = (body: unknown, raw?: string) =>
  new Request('https://meu-app.netlify.app/.netlify/functions/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://meu-app.netlify.app' }, body: raw ?? JSON.stringify(body) });
const b64 = 'A'.repeat(400);
const photo = () => ({ task: 'meal-photo', input: { image: { mimeType: 'image/jpeg', data: b64 }, note: 'arroz' } });
const mealJson = { identifiable: true, reason: '', confidence: 'medium', items: [{ name: 'Arroz', quantity: 150, unit: 'g', kcal: 195, proteinG: 4, carbsG: 42, fatG: 0.5 }], note: 'estimativa' };

beforeEach(() => { process.env.GEMINI_API_KEY = KEY; });
afterEach(() => { delete process.env.GEMINI_API_KEY; });

describe('função gemini: tarefas de alimentação', () => {
  it('valida entrada da foto (tipo, tamanho, base64)', () => {
    expect(sanitizeMealPhotoInput(photo().input)).not.toBeNull();
    expect(sanitizeMealPhotoInput({ image: { mimeType: 'image/gif', data: b64 } })).toBeNull();
    expect(sanitizeMealPhotoInput({ image: { mimeType: 'image/jpeg', data: 'curto' } })).toBeNull();
    expect(sanitizeMealPhotoInput({ image: { mimeType: 'image/jpeg', data: '!'.repeat(300) } })).toBeNull();
    expect(sanitizeMealPhotoInput({ image: { mimeType: 'image/jpeg', data: 'A'.repeat(1_300_000) } })).toBeNull();
    expect(sanitizeMealPhotoInput(null)).toBeNull();
  });
  it('valida saídas', () => {
    expect(validateMealPhotoOutput(mealJson)).toBe(true);
    expect(validateMealPhotoOutput({ identifiable: false, items: [] })).toBe(true);
    expect(validateMealPhotoOutput({ identifiable: true, items: [] })).toBe(false);
    expect(validateMealSuggestionsOutput({ ideas: [{ title: 'a', items: ['b'] }] })).toBe(true);
    expect(validateMealSuggestionsOutput({ ideas: [] })).toBe(false);
    expect(sanitizeMealSuggestionsInput({ budget: 'xx', goal: 'zz' }).budget).toBe('any');
  });
  it('envia a imagem ao Gemini (inlineData), com a chave só no cabeçalho, e não vaza a chave', async () => {
    let seen: any = null;
    const res = await handle(req(photo()), { ip: nextIp() }, { fetchImpl: async (url: string, init: any) => { seen = { url, headers: init.headers, body: JSON.parse(init.body) }; return geminiOk(mealJson); } });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text).ok).toBe(true);
    expect(text).not.toContain(KEY);
    expect(seen.url).not.toContain(KEY);
    expect(seen.headers['x-goog-api-key']).toBe(KEY);
    expect(JSON.stringify(seen.body)).toContain('inlineData');
    expect(JSON.stringify(seen.body)).toContain(b64);
  });
  it('sem chave configurada não chama o Gemini', async () => {
    delete process.env.GEMINI_API_KEY;
    let called = false;
    const res = await handle(req(photo()), { ip: nextIp() }, { fetchImpl: async () => { called = true; return geminiOk(mealJson); } });
    expect(res.status).toBe(503);
    expect(called).toBe(false);
  });
  it('recusa imagem inválida e foto grande demais', async () => {
    const deps = { fetchImpl: async () => geminiOk(mealJson) };
    expect((await handle(req({ task: 'meal-photo', input: { image: { mimeType: 'image/gif', data: b64 } } }), { ip: nextIp() }, deps)).status).toBe(400);
    const big = { task: 'meal-photo', input: { image: { mimeType: 'image/jpeg', data: 'A'.repeat(1_250_000) } } };
    expect([400, 413]).toContain((await handle(req(big), { ip: nextIp() }, deps)).status);
  });
  it('resposta inválida do modelo vira erro tratado (sem inventar análise)', async () => {
    const res = await handle(req(photo()), { ip: nextIp() }, { fetchImpl: async () => geminiOk({ qualquer: 'coisa' }) });
    expect(res.status >= 400).toBe(true);
    expect((await res.json()).ok).not.toBe(true);
  });
  it('limite de uso do Gemini (429) é repassado como limite', async () => {
    const res = await handle(req(photo()), { ip: nextIp() }, { fetchImpl: async () => new Response('{}', { status: 429 }) });
    expect(res.status >= 400).toBe(true);
  });
  it('sugestões: devolve ideias válidas', async () => {
    const res = await handle(req({ task: 'meal-suggestions', input: { goal: 'health', budget: 'low', vegetarian: false, preferences: 'ovo', avoid: '', healthCondition: false } }), { ip: nextIp() }, { fetchImpl: async () => geminiOk({ ideas: [{ title: 'Ovo com arroz', items: ['ovo', 'arroz'] }], note: '' }) });
    expect(res.status).toBe(200);
    expect((await res.json()).plan.ideas).toHaveLength(1);
  });
});
