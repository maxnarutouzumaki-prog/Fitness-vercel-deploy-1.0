import { callGeminiTask } from './geminiClient';
import type { GeminiCallResult } from './geminiClient';
import { normalizeMealAnalysis, normalizeSuggestions, buildMealPhotoRequest } from '../domain/mealAnalysis';
import type { AiMealIdea, MealAnalysisResult } from '../domain/mealAnalysis';
import type { FallbackReason } from '../domain/training';

export const AI_FAIL_MESSAGES: Record<FallbackReason, string> = {
  user_choice: 'Análise cancelada.',
  offline: 'Sem conexão com a internet.',
  not_configured: 'O Gemini ainda não está configurado neste aplicativo.',
  rate_limited: 'O limite de uso do Gemini foi atingido por agora.',
  client_limit: 'Limite diário de análises atingido neste aparelho.',
  unavailable: 'O Gemini está indisponível no momento.',
  timeout: 'O Gemini demorou demais para responder.',
  invalid_response: 'A resposta do Gemini veio incompleta ou inválida.',
  no_endpoint: 'A função de IA não foi encontrada neste endereço.',
};

export type PhotoAnalysis =
  | { ok: true; result: Extract<MealAnalysisResult, { ok: true }>; model?: string }
  | { ok: false; kind: 'ai-unavailable'; reason: FallbackReason; message: string }
  | { ok: false; kind: 'unreadable'; message: string };

/** Envia a foto (já reduzida) ao Gemini SOMENTE quando a pessoa pede a análise. */
export async function analyzeMealPhoto(dataUrl: string, note: string, options?: Parameters<typeof callGeminiTask>[2]): Promise<PhotoAnalysis> {
  const request = buildMealPhotoRequest(dataUrl, note);
  if (!request) return { ok: false, kind: 'unreadable', message: 'Esta imagem não pôde ser preparada para análise.' };
  const res: GeminiCallResult = await callGeminiTask('meal-photo', request, { timeoutMs: 45_000, ...options });
  if (!res.ok) return { ok: false, kind: 'ai-unavailable', reason: res.reason, message: AI_FAIL_MESSAGES[res.reason] };
  const normalized = normalizeMealAnalysis(res.data);
  if (!normalized.ok) return { ok: false, kind: 'unreadable', message: normalized.reason };
  return { ok: true, result: normalized, model: res.model };
}

export type SuggestionResult =
  | { ok: true; ideas: AiMealIdea[]; note: string; model?: string }
  | { ok: false; reason: FallbackReason; message: string };

export async function requestMealSuggestions(
  input: { goal: string; mealType: string; budget: string; vegetarian: boolean; preferences: string; avoid: string; healthCondition: boolean },
  options?: Parameters<typeof callGeminiTask>[2],
): Promise<SuggestionResult> {
  const res = await callGeminiTask('meal-suggestions', input, { timeoutMs: 30_000, ...options });
  if (!res.ok) return { ok: false, reason: res.reason, message: AI_FAIL_MESSAGES[res.reason] };
  const n = normalizeSuggestions(res.data);
  if (!n.ok) return { ok: false, reason: 'invalid_response', message: AI_FAIL_MESSAGES.invalid_response };
  return { ok: true, ideas: n.ideas, note: n.note, model: res.model };
}
