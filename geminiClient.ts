import type { GeminiPlanRequest } from '../domain/geminiPlan';
import type { FallbackReason } from '../domain/training';

/**
 * Cliente da função de servidor que fala com o Gemini. Nunca recebe nem guarda chaves.
 * Cada falha vira um motivo claro (FallbackReason) para a interface explicar ao usuário.
 */

const DEFAULT_ENDPOINT = '/api/gemini';
const ENDPOINT: string = (import.meta.env?.VITE_GEMINI_ENDPOINT as string | undefined) || DEFAULT_ENDPOINT;
export const DEFAULT_TIMEOUT_MS = 35_000;

export type GeminiCallResult =
  | { ok: true; data: unknown; model?: string }
  | { ok: false; reason: FallbackReason };

function reasonFromCode(code: unknown, status: number): FallbackReason {
  switch (code) {
    case 'not_configured':
      return 'not_configured';
    case 'rate_limited':
      return 'rate_limited';
    case 'timeout':
      return 'timeout';
    case 'invalid_response':
      return 'invalid_response';
    default:
      break;
  }
  if (status === 404) return 'no_endpoint';
  if (status === 429) return 'rate_limited';
  if (status === 504 || status === 408) return 'timeout';
  return 'unavailable';
}

/** Chamada genérica reutilizável por outras tarefas (ex.: alimentação, na próxima etapa). */
export async function callGeminiTask(
  task: string,
  input: unknown,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch; endpoint?: string } = {},
): Promise<GeminiCallResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, reason: 'offline' };
  const doFetch = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await doFetch(options.endpoint ?? ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, input }),
      signal: controller.signal,
      cache: 'no-store',
    });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // Resposta que não é JSON (ex.: página HTML do site quando a função não existe).
      return { ok: false, reason: response.status === 404 || response.ok ? 'no_endpoint' : 'unavailable' };
    }
    const obj = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
    if (response.ok && obj.ok === true && 'plan' in obj) {
      return { ok: true, data: obj.plan, model: typeof obj.model === 'string' ? obj.model : undefined };
    }
    return { ok: false, reason: reasonFromCode(obj.code, response.status) };
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return { ok: false, reason: 'timeout' };
    return { ok: false, reason: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}

export function requestWorkoutPlan(request: GeminiPlanRequest, options?: Parameters<typeof callGeminiTask>[2]) {
  return callGeminiTask('workout-plan', request, options);
}
