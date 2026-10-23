import { uid } from './ids';
import type { ISODate, ISODateTime, MealEntry } from './types';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Café da manhã',
  lunch: 'Almoço',
  dinner: 'Jantar',
  snack: 'Lanche',
};

export const UNITS = ['g', 'ml', 'unidade', 'fatia', 'colher de sopa', 'xícara', 'porção'] as const;

export type FoodItem = NonNullable<MealEntry['items']>[number];

export const FOOD_LIMITS = { name: 60, quantity: 99999, kcal: 5000, macro: 500, notes: 300 } as const;

export function newFood(name = ''): FoodItem {
  return { id: uid('f'), name };
}

/** Aceita "12,5" ou "12.5". Vazio ou inválido = undefined (campo opcional). */
export function parseNumber(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

const clamp = (v: number | undefined, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v * 10) / 10)) : undefined;

export function sanitizeFood(f: FoodItem): FoodItem {
  return {
    id: f.id,
    name: f.name.trim().slice(0, FOOD_LIMITS.name),
    quantity: clamp(f.quantity, FOOD_LIMITS.quantity),
    unit: f.unit?.trim().slice(0, 20) || undefined,
    kcal: clamp(f.kcal, FOOD_LIMITS.kcal),
    proteinG: clamp(f.proteinG, FOOD_LIMITS.macro),
    carbsG: clamp(f.carbsG, FOOD_LIMITS.macro),
    fatG: clamp(f.fatG, FOOD_LIMITS.macro),
  };
}

export interface Totals {
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
}

const sumKnown = (values: Array<number | undefined>): number | undefined => {
  const known = values.filter((v): v is number => typeof v === 'number');
  return known.length === 0 ? undefined : Math.round(known.reduce((a, b) => a + b, 0) * 10) / 10;
};

/** Soma só o que foi informado; nada é estimado em silêncio. */
export function sumItems(items: FoodItem[]): Totals {
  return {
    kcal: sumKnown(items.map((i) => i.kcal)),
    proteinG: sumKnown(items.map((i) => i.proteinG)),
    carbsG: sumKnown(items.map((i) => i.carbsG)),
    fatG: sumKnown(items.map((i) => i.fatG)),
  };
}

export function validateMeal(items: FoodItem[]): { ok: true } | { ok: false; reason: string } {
  if (items.filter((i) => i.name.trim().length > 0).length === 0) return { ok: false, reason: 'Informe ao menos um alimento.' };
  return { ok: true };
}

export function defaultMealType(hour: number): MealType {
  if (hour < 10) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 18) return 'snack';
  return 'dinner';
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isValidTime = (t: string): boolean => HHMM.test(t);

export interface MealInput {
  id?: string;
  date: ISODate;
  time: string;
  mealType: MealType;
  items: FoodItem[];
  notes?: string;
  /** "Equilíbrio alimentar": refeição fora do habitual. */
  balance?: boolean;
  source: MealEntry['source'];
  analysis?: MealEntry['analysis'];
  corrected?: boolean;
}

/** Monta o registro final: totais sempre recalculados a partir dos itens. */
export function buildMeal(input: MealInput, nowIso: ISODateTime, existing?: MealEntry): MealEntry {
  const items = input.items.map(sanitizeFood).filter((i) => i.name.length > 0);
  const totals = sumItems(items);
  const name = items.map((i) => i.name).join(' + ').slice(0, 80) || 'Refeição';
  const hasMacros = totals.proteinG !== undefined || totals.carbsG !== undefined || totals.fatG !== undefined;
  const meal: MealEntry = {
    id: existing?.id ?? input.id ?? uid('m'),
    date: input.date,
    loggedAt: existing?.loggedAt ?? nowIso,
    name,
    portion: items.length === 1 && items[0].quantity !== undefined ? `${items[0].quantity} ${items[0].unit ?? ''}`.trim() : undefined,
    kcal: totals.kcal,
    macros: hasMacros ? { proteinG: totals.proteinG, carbsG: totals.carbsG, fatG: totals.fatG } : undefined,
    source: input.source,
    plannedMeal: !input.balance,
    mealType: input.mealType,
    time: isValidTime(input.time) ? input.time : '12:00',
    items,
    analysis: input.analysis,
    userCorrected: input.corrected || existing?.userCorrected || undefined,
    notes: input.notes?.trim().slice(0, FOOD_LIMITS.notes) || undefined,
  };
  return meal;
}

export interface DayTotals {
  count: number;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  /** Refeições sem calorias informadas: o total não as inclui. */
  withoutKcal: number;
}

export function dayTotals(meals: MealEntry[]): DayTotals {
  const sum = (pick: (m: MealEntry) => number | undefined): number | null => {
    const v = sumKnown(meals.map(pick));
    return v === undefined ? null : v;
  };
  return {
    count: meals.length,
    kcal: sum((m) => m.kcal),
    proteinG: sum((m) => m.macros?.proteinG),
    carbsG: sum((m) => m.macros?.carbsG),
    fatG: sum((m) => m.macros?.fatG),
    withoutKcal: meals.filter((m) => m.kcal === undefined).length,
  };
}

export function sortMeals(meals: MealEntry[]): MealEntry[] {
  return meals.slice().sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '') || a.loggedAt.localeCompare(b.loggedAt));
}

/* ───────── Equilíbrio alimentar ───────── */

export const BALANCE_INTRO =
  'Uma refeição isolada não define seu resultado de longo prazo. O que pesa é o conjunto dos dias. Registrar sem julgamento ajuda a enxergar o todo.';

export const BALANCE_TIPS: string[] = [
  'Na próxima refeição, siga seu padrão habitual normalmente. Não é preciso pular nada nem mudar seu plano.',
  'Beba água e, se tiver fome, faça a refeição seguinte normalmente, com algo que você goste.',
  'Se der vontade, inclua uma porção de legumes ou frutas na próxima refeição, como um acréscimo, só se você tiver vontade.',
  'Siga seu dia como planejado. Uma refeição diferente faz parte de uma rotina saudável e sustentável.',
  'Se o treino estava no plano, ótimo; se não estava, tudo bem. Atividade física não é para "pagar" comida.',
];

export function balanceTip(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return BALANCE_TIPS[h % BALANCE_TIPS.length];
}

/** Termos que o app nunca usa ao falar de refeições fora do habitual (verificado em teste). */
export const FORBIDDEN_BALANCE_TERMS = ['compensar', 'queimar', 'culpa', 'pecado', 'jejum', 'punição', 'castigo', 'pagar as calorias', 'cheat'];

/* ───────── Sugestões locais (sem IA) ───────── */

export type Budget = 'low' | 'medium' | 'any';

export interface MealIdea {
  id: string;
  title: string;
  mealType: MealType;
  items: string[];
  vegetarian: boolean;
  budget: 'low' | 'medium';
  note: string;
}

export const MEAL_IDEAS: MealIdea[] = [
  { id: 'arroz-feijao-ovo', title: 'Arroz, feijão e ovo', mealType: 'lunch', items: ['arroz', 'feijão', 'ovo mexido', 'salada simples'], vegetarian: true, budget: 'low', note: 'Combinação clássica, barata e completa.' },
  { id: 'frango-legumes', title: 'Frango grelhado com legumes', mealType: 'dinner', items: ['peito ou sobrecoxa de frango', 'legumes da estação', 'arroz ou batata'], vegetarian: false, budget: 'medium', note: 'Prefira os legumes mais baratos da estação.' },
  { id: 'aveia-banana', title: 'Aveia com banana', mealType: 'breakfast', items: ['aveia', 'leite ou água', 'banana'], vegetarian: true, budget: 'low', note: 'Rápido e acessível.' },
  { id: 'pao-ovo-fruta', title: 'Pão com ovo e uma fruta', mealType: 'breakfast', items: ['pão', 'ovo', 'fruta'], vegetarian: true, budget: 'low', note: 'Troque o pão por tapioca ou cuscuz, se preferir.' },
  { id: 'sardinha-cuscuz', title: 'Sardinha com cuscuz', mealType: 'lunch', items: ['sardinha em lata', 'cuscuz', 'tomate e cebola'], vegetarian: false, budget: 'low', note: 'Fonte de proteína econômica.' },
  { id: 'omelete-legumes', title: 'Omelete de legumes', mealType: 'dinner', items: ['ovos', 'legumes picados', 'queijo (opcional)'], vegetarian: true, budget: 'low', note: 'Aproveite sobras de legumes.' },
  { id: 'iogurte-fruta', title: 'Iogurte natural com fruta', mealType: 'snack', items: ['iogurte natural', 'fruta picada', 'aveia (opcional)'], vegetarian: true, budget: 'low', note: 'Lanche simples.' },
  { id: 'lentilha-arroz', title: 'Lentilha ou grão-de-bico com arroz', mealType: 'lunch', items: ['lentilha ou grão-de-bico', 'arroz', 'salada'], vegetarian: true, budget: 'low', note: 'Boa opção sem carne.' },
  { id: 'carne-moida-abobrinha', title: 'Carne moída com abobrinha e arroz', mealType: 'dinner', items: ['carne moída', 'abobrinha', 'arroz'], vegetarian: false, budget: 'medium', note: 'Rende bem e dá para congelar porções.' },
  { id: 'banana-amendoim', title: 'Banana com pasta de amendoim', mealType: 'snack', items: ['banana', 'pasta de amendoim'], vegetarian: true, budget: 'medium', note: 'Lanche prático para levar.' },
];

export function suggestLocal(opts: { budget: Budget; vegetarian: boolean; avoid: string; mealType?: MealType }): MealIdea[] {
  const avoid = opts.avoid
    .toLowerCase()
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
  return MEAL_IDEAS.filter((m) => {
    if (opts.mealType && m.mealType !== opts.mealType) return false;
    if (opts.vegetarian && !m.vegetarian) return false;
    if (opts.budget === 'low' && m.budget !== 'low') return false;
    const text = `${m.title} ${m.items.join(' ')}`.toLowerCase();
    return !avoid.some((a) => text.includes(a));
  });
}

export const HEALTH_NOTICE =
  'As sugestões são gerais e não substituem orientação de nutricionista ou médico. Com condição de saúde (diabetes, doença renal, gestação, transtorno alimentar etc.), procure acompanhamento profissional.';
