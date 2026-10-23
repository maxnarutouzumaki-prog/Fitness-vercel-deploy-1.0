import { metaRepo } from '../data/repositories';
import { localDateFromTimestamp } from '../domain/dates';
import { buildGeminiRequest, normalizeGeminiPlan } from '../domain/geminiPlan';
import { avoidSecondSessionToday, generateLocalPlan } from '../domain/localPlanner';
import { canGeneratePlan } from '../domain/training';
import type { FallbackReason, Questionnaire, WeeklyPlan, WorkoutSession } from '../domain/training';
import { requestWorkoutPlan } from './geminiClient';

/** Limite diário de gerações com o Gemini por aparelho: evita chamadas repetitivas à API. */
export const DAILY_GEMINI_LIMIT = 5;
const USAGE_ID = 'geminiUsage';

export interface GeminiUsage {
  date: string;
  count: number;
}

export async function readGeminiUsage(today: string): Promise<GeminiUsage> {
  try {
    const rec = await metaRepo.get(USAGE_ID);
    if (rec && rec.date === today && typeof rec.count === 'number') return { date: today, count: rec.count };
  } catch {
    /* sem armazenamento: trata como zero */
  }
  return { date: today, count: 0 };
}

async function bumpGeminiUsage(today: string): Promise<void> {
  try {
    const current = await readGeminiUsage(today);
    await metaRepo.put({ id: USAGE_ID, date: today, count: current.count + 1 });
  } catch {
    /* contador é só proteção local */
  }
}

export interface GenerateOptions {
  questionnaire: Questionnaire;
  sessions: WorkoutSession[];
  /** 'gemini' tenta a IA e cai para o gerador local se falhar; 'local' nunca chama a API. */
  mode: 'gemini' | 'local';
  /** Instante usado como "agora" (injetável em testes). */
  nowMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Gera um plano semanal começando HOJE (data local). O plano vem do Gemini apenas se a
 * resposta passar na validação; em qualquer outro caso vem do gerador local, e o plano
 * registra o motivo para que a interface possa explicar com honestidade.
 */
export async function generatePlan(options: GenerateOptions): Promise<WeeklyPlan> {
  const q = options.questionnaire;
  const gate = canGeneratePlan(q);
  if (!gate.ok) throw new Error(gate.reason);

  const nowMs = options.nowMs ?? Date.now();
  const today = localDateFromTimestamp(nowMs);
  const nowIso = new Date(nowMs).toISOString();
  const completedToday = options.sessions.some((s) => s.status === 'completed' && s.date === today);

  const local = (reason: FallbackReason): WeeklyPlan => {
    const plan = generateLocalPlan({ questionnaire: q, startDate: today, sessions: options.sessions, nowIso });
    return avoidSecondSessionToday({ ...plan, fallbackReason: reason }, completedToday);
  };

  if (options.mode === 'local') return local('user_choice');

  const usage = await readGeminiUsage(today);
  if (usage.count >= DAILY_GEMINI_LIMIT) return local('client_limit');

  const request = buildGeminiRequest(q, today, options.sessions);
  const result = await requestWorkoutPlan(request, { fetchImpl: options.fetchImpl });
  if (!result.ok) {
    // Só conta como uso se houve resposta do servidor (evita punir falta de internet).
    if (result.reason !== 'offline' && result.reason !== 'no_endpoint' && result.reason !== 'not_configured') {
      await bumpGeminiUsage(today);
    }
    return local(result.reason);
  }
  await bumpGeminiUsage(today);
  const normalized = normalizeGeminiPlan(result.data, q, today, result.model, nowIso);
  if (!normalized.ok) return local('invalid_response');
  return avoidSecondSessionToday(normalized.plan, completedToday);
}
