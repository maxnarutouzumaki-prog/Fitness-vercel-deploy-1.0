import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// @ts-ignore — função de servidor em JavaScript puro (sem tipos)
import handler from '../api/gemini.mjs';

const KEY = 'AIzaSy-TEST-KEY-NAO-REAL-0123456789';
const realFetch = globalThis.fetch;
beforeEach(() => { process.env.GEMINI_API_KEY = KEY; });
afterEach(() => { delete process.env.GEMINI_API_KEY; globalThis.fetch = realFetch; });

function mockRes() {
  const out: { status: number; headers: Record<string, string>; body: string } = { status: 0, headers: {}, body: '' };
  const res = { set statusCode(v: number) { out.status = v; }, get statusCode() { return out.status; }, setHeader: (k: string, v: string) => { out.headers[k.toLowerCase()] = v; }, end: (b: string) => { out.body = b; } };
  return { res, out };
}
const req = (over: Record<string, unknown> = {}) => ({ method: 'POST', url: '/api/gemini', headers: { host: 'meu-app.vercel.app', origin: 'https://meu-app.vercel.app', 'x-forwarded-proto': 'https', 'x-forwarded-for': '203.0.113.9', 'content-length': '999', 'content-type': 'application/json' }, body: { task: 'meal-suggestions', input: { goal: 'health', budget: 'low' } }, ...over });
const gemini = (obj: unknown) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }), { status: 200 });

describe('endpoint da Vercel (api/gemini)', () => {
  it('aceita corpo JSON já interpretado pela Vercel e responde no formato esperado pelo app', async () => {
    let seenUrl = '';
    let seenHeaders: any = null;
    globalThis.fetch = (async (url: string, init: any) => { seenUrl = url; seenHeaders = init.headers; return gemini({ ideas: [{ title: 'Ovo', items: ['ovo'] }], note: '' }); }) as any;
    const { res, out } = mockRes();
    await handler(req(), res);
    expect(out.status).toBe(200);
    const body = JSON.parse(out.body);
    expect(body.ok).toBe(true);
    expect(body.plan.ideas).toHaveLength(1);
    expect(seenHeaders['x-goog-api-key']).toBe(KEY);
    expect(seenUrl.includes(KEY)).toBe(false);
    expect(out.body.includes(KEY)).toBe(false);
  });
  it('aceita corpo em texto e em Buffer', async () => {
    globalThis.fetch = (async () => gemini({ ideas: [{ title: 'Ovo', items: ['ovo'] }] })) as any;
    for (const b of [JSON.stringify(req().body), Buffer.from(JSON.stringify(req().body))]) {
      const { res, out } = mockRes();
      await handler(req({ body: b }), res);
      expect(out.status).toBe(200);
    }
  });
  it('sem GEMINI_API_KEY responde 503 not_configured', async () => {
    delete process.env.GEMINI_API_KEY;
    const { res, out } = mockRes();
    await handler(req(), res);
    expect(out.status).toBe(503);
    expect(JSON.parse(out.body).code).toBe('not_configured');
  });
  it('recusa outra origem e método diferente de POST', async () => {
    let r = mockRes();
    await handler(req({ headers: { ...req().headers, origin: 'https://site-malicioso.example' } }), r.res);
    expect(r.out.status).toBe(403);
    r = mockRes();
    await handler(req({ method: 'GET', body: undefined }), r.res);
    expect(r.out.status).toBe(405);
  });
  it('erro inesperado devolve JSON genérico, sem detalhes', async () => {
    globalThis.fetch = (async () => { throw new Error('boom ' + KEY); }) as any;
    const { res, out } = mockRes();
    await handler(req(), res);
    expect(out.body.includes(KEY)).toBe(false);
    expect(out.status >= 400).toBe(true);
  });
});
