import type { BodyMetricEntry, Goal } from './types';

export type MetricKey = 'weightKg' | 'leanMassKg' | 'bodyFatPct';
export type Tone = 'favorable' | 'unfavorable' | 'neutral';

export interface MetricPoint {
  value: number;
  date: string;
}

export interface MetricSummary {
  key: MetricKey;
  latest?: MetricPoint;
  previous?: MetricPoint;
  /** latest - previous; só existe com pelo menos dois registros. */
  delta?: number;
}

const EPSILON = 0.05;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Última medida e a anterior de uma métrica (ignora registros sem esse campo). */
export function summarizeMetric(entries: BodyMetricEntry[], key: MetricKey): MetricSummary {
  const points = entries
    .filter((e) => typeof e[key] === 'number' && Number.isFinite(e[key] as number))
    .sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)))
    .map((e) => ({ value: e[key] as number, date: e.date }));

  const latest = points[points.length - 1];
  const previous = points.length >= 2 ? points[points.length - 2] : undefined;
  const delta = latest && previous ? round1(latest.value - previous.value) : undefined;
  return { key, latest, previous, delta };
}

/**
 * Interpreta uma variação conforme a métrica e o objetivo.
 * - Peso: depende da meta. Sem meta definida, ou meta neutra, não colore.
 * - Massa magra: aumentar é favorável.
 * - Gordura corporal: reduzir é favorável.
 * Variações muito pequenas ficam neutras.
 */
export function interpretChange(key: MetricKey, delta: number | undefined, goal: Goal | undefined): Tone {
  if (delta === undefined || Math.abs(delta) < EPSILON) return 'neutral';
  switch (key) {
    case 'leanMassKg':
      return delta > 0 ? 'favorable' : 'unfavorable';
    case 'bodyFatPct':
      return delta < 0 ? 'favorable' : 'unfavorable';
    case 'weightKg':
      if (goal === 'lose-fat') return delta < 0 ? 'favorable' : 'unfavorable';
      if (goal === 'gain-muscle') return delta > 0 ? 'favorable' : 'unfavorable';
      return 'neutral';
  }
}

export function formatValue(value: number, unit: string): string {
  const text = value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${text} ${unit}`;
}

export function formatDelta(delta: number, unit: string): string {
  if (Math.abs(delta) < EPSILON) return 'sem variação';
  const sign = delta > 0 ? '+' : '−';
  const text = Math.abs(delta).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${sign}${text} ${unit}`;
}
