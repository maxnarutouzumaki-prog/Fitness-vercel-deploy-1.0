/**
 * Endpoint da Vercel: POST /api/gemini
 * Converte a requisição Node da Vercel para o padrão Web (Request/Response) e chama o núcleo,
 * que é o mesmo código usado antes (validação, limite de uso, chamada ao Gemini).
 * A chave fica SOMENTE na variável de ambiente GEMINI_API_KEY (painel da Vercel).
 */
import { handle } from '../lib/gemini-core.mjs';

// Tempo máximo da função (o Gemini pode levar alguns segundos para responder).
export const config = { maxDuration: 60 };

const DROP = new Set(['content-length', 'host', 'connection', 'transfer-encoding']);

async function readBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (req.body && Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  try {
    const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim();
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined || DROP.has(key.toLowerCase())) continue;
      headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
    }
    const init = { method: req.method, headers };
    if (req.method !== 'GET' && req.method !== 'HEAD') init.body = await readBody(req);
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || String(req.headers['x-real-ip'] || '') || req.socket?.remoteAddress || 'unknown';
    const response = await handle(new Request(`${proto}://${host}${req.url || '/api/gemini'}`, init), { ip });
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(await response.text());
  } catch {
    // Nunca vaza detalhes (nem a chave) em caso de erro inesperado.
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end('{"ok":false,"code":"unavailable"}');
  }
}
