import { uid } from './ids';
import { sanitizeFood } from './nutrition';
import type { FoodItem } from './nutrition';

export const MEAL_PHOTO_DISCLAIMER =
  'Estimativa aproximada: uma foto não permite saber o peso, os ingredientes escondidos, o óleo ou o molho. Revise e corrija antes de salvar.';

export const PHOTO_PRIVACY_NOTICE =
  'Ao analisar, esta foto será enviada ao serviço de IA (Google Gemini) por uma função segura deste app. Nada é enviado sem você tocar em “Analisar”.';

export interface MealPhotoRequest {
  image: { mimeType: 'image/jpeg' | 'image/png' | 'image/webp'; data: string };
  note: string;
}

/** Separa o tipo e o conteúdo base64 de um data URL. Devolve null se não for uma imagem aceita. */
export function buildMealPhotoRequest(dataUrl: string, note = ''): MealPhotoRequest | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  return { image: { mimeType: m[1] as MealPhotoRequest['image']['mimeType'], data: m[2] }, note: note.trim().slice(0, 200) };
}

export type Confidence = 'low' | 'medium' | 'high';

export type MealAnalysisResult =
  | { ok: true; items: FoodItem[]; confidence: Confidence; note: string }
  | { ok: false; reason: string };

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v.replace(',', '.'))) && Number(v.replace(',', '.')) >= 0 ? Number(v.replace(',', '.')) : undefined);
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Valida e limpa a resposta do Gemini. Nada daqui é salvo sem revisão do usuário:
 * o resultado alimenta a tela de revisão, onde tudo pode ser corrigido.
 */
export function normalizeMealAnalysis(raw: unknown): MealAnalysisResult {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'A resposta da análise veio incompleta.' };
  const r = raw as Record<string, unknown>;
  if (r.identifiable === false) {
    const why = str(r.reason, 200);
    return { ok: false, reason: why || 'Não foi possível identificar os alimentos nesta imagem.' };
  }
  if (!Array.isArray(r.items) || r.items.length === 0) return { ok: false, reason: 'Nenhum alimento foi identificado nesta imagem.' };
  const items: FoodItem[] = [];
  for (const entry of r.items.slice(0, 15)) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const name = str(e.name, 60);
    if (!name) continue;
    items.push(
      sanitizeFood({
        id: uid('f'),
        name,
        quantity: num(e.quantity),
        unit: str(e.unit, 20) || undefined,
        kcal: num(e.kcal),
        proteinG: num(e.proteinG),
        carbsG: num(e.carbsG),
        fatG: num(e.fatG),
      }),
    );
  }
  if (items.length === 0) return { ok: false, reason: 'Nenhum alimento válido foi identificado nesta imagem.' };
  const c = r.confidence;
  const confidence: Confidence = c === 'high' || c === 'medium' || c === 'low' ? c : 'low';
  return { ok: true, items, confidence, note: str(r.note, 300) };
}

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  low: 'Incerteza alta',
  medium: 'Incerteza média',
  high: 'Incerteza menor',
};

export interface AiMealIdea {
  title: string;
  items: string[];
  swap?: string;
  note?: string;
}

export function normalizeSuggestions(raw: unknown): { ok: true; ideas: AiMealIdea[]; note: string } | { ok: false } {
  if (!raw || typeof raw !== 'object') return { ok: false };
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.ideas)) return { ok: false };
  const ideas: AiMealIdea[] = [];
  for (const entry of r.ideas.slice(0, 6)) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const title = str(e.title, 80);
    const items = Array.isArray(e.items) ? e.items.map((i) => str(i, 60)).filter(Boolean).slice(0, 8) : [];
    if (!title || items.length === 0) continue;
    ideas.push({ title, items, swap: str(e.swap, 120) || undefined, note: str(e.note, 160) || undefined });
  }
  return ideas.length === 0 ? { ok: false } : { ok: true, ideas, note: str(r.note, 240) };
}
