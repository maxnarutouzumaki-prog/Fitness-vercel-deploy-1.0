import { bodyMetricsRepo, getMealsForDate } from '../data/repositories';
import { todayISO } from '../domain/dates';
import { summarizeMetric } from '../domain/evolution';
import type { MetricKey, MetricSummary } from '../domain/evolution';

/** Resumo de refeições e evolução corporal (o treino e o check-in vêm do DataContext). */
export interface HomeSummary {
  mealsCount: number;
  /** Soma das refeições que têm kcal estimada; null quando não há nenhuma. */
  mealsKcal: number | null;
  metrics: Record<MetricKey, MetricSummary>;
  hasAnyMetric: boolean;
}

const KEYS: MetricKey[] = ['weightKg', 'leanMassKg', 'bodyFatPct'];

export function emptySummary(): HomeSummary {
  return buildSummary([], []);
}

export function buildSummary(
  meals: { kcal?: number }[],
  bodyEntries: Parameters<typeof summarizeMetric>[0],
): HomeSummary {
  const withKcal = meals.filter((m) => typeof m.kcal === 'number');
  const metrics = Object.fromEntries(KEYS.map((k) => [k, summarizeMetric(bodyEntries, k)])) as Record<
    MetricKey,
    MetricSummary
  >;
  return {
    mealsCount: meals.length,
    mealsKcal: withKcal.length > 0 ? withKcal.reduce((sum, m) => sum + (m.kcal ?? 0), 0) : null,
    metrics,
    hasAnyMetric: KEYS.some((k) => metrics[k].latest !== undefined),
  };
}

/** Lê somente dados reais salvos no aparelho. Sem registros, devolve um resumo vazio. */
export async function loadHomeSummary(date: string = todayISO()): Promise<HomeSummary> {
  const [meals, bodyEntries] = await Promise.all([getMealsForDate(date), bodyMetricsRepo.all()]);
  return buildSummary(meals, bodyEntries);
}
