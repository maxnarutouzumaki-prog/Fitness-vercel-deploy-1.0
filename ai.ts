/**
 * Serviço de IA (Gemini).
 *
 * O frontend NUNCA contém chave de API: toda chamada passa pela função de servidor
 * `api/gemini.mjs`, que guarda GEMINI_API_KEY em variável de ambiente privada (Vercel).
 *
 * Tarefas hoje:   'workout-plan'  (plano semanal de treino)  -> ver services/geminiClient.ts
 * Alimentação:   'meal-photo' (análise aproximada de foto) e 'meal-suggestions' -> services/mealAiClient.ts
 *
 * Sem internet, sem configuração ou com limite atingido, o app segue funcionando:
 * o treino cai para o gerador local e a interface informa isso com clareza.
 */
export const AI_TASKS = ['workout-plan', 'meal-photo', 'meal-suggestions'] as const;
export type AiTask = (typeof AI_TASKS)[number];
