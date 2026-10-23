import { describe, expect, it } from 'vitest';
import { formatDelta, interpretChange, summarizeMetric } from '../src/domain/evolution';
import type { BodyMetricEntry } from '../src/domain/types';

const entry = (date: string, weightKg?: number, bodyFatPct?: number): BodyMetricEntry => ({
  id: date,
  date,
  weightKg,
  bodyFatPct,
  createdAt: `${date}T10:00:00.000Z`,
});

describe('summarizeMetric', () => {
  it('não inventa dados quando não há registros', () => {
    const s = summarizeMetric([], 'weightKg');
    expect(s.latest).toBeUndefined();
    expect(s.delta).toBeUndefined();
  });

  it('com um único registro não calcula variação', () => {
    const s = summarizeMetric([entry('2026-01-01', 80)], 'weightKg');
    expect(s.latest?.value).toBe(80);
    expect(s.delta).toBeUndefined();
  });

  it('calcula a variação entre os dois últimos registros, mesmo fora de ordem', () => {
    const s = summarizeMetric([entry('2026-02-01', 79.6), entry('2026-01-01', 80), entry('2026-01-15', 80.2)], 'weightKg');
    expect(s.latest?.value).toBe(79.6);
    expect(s.delta).toBe(-0.6);
  });

  it('ignora registros que não têm a métrica', () => {
    const s = summarizeMetric([entry('2026-01-01', 80), entry('2026-01-02', undefined, 20)], 'weightKg');
    expect(s.latest?.value).toBe(80);
  });
});

describe('interpretChange', () => {
  it('peso depende do objetivo', () => {
    expect(interpretChange('weightKg', -1, 'lose-fat')).toBe('favorable');
    expect(interpretChange('weightKg', 1, 'lose-fat')).toBe('unfavorable');
    expect(interpretChange('weightKg', 1, 'gain-muscle')).toBe('favorable');
    expect(interpretChange('weightKg', -1, 'gain-muscle')).toBe('unfavorable');
  });

  it('peso sem objetivo ou com objetivo neutro não é colorido', () => {
    expect(interpretChange('weightKg', -1, undefined)).toBe('neutral');
    expect(interpretChange('weightKg', 1, 'health')).toBe('neutral');
    expect(interpretChange('weightKg', 1, 'conditioning')).toBe('neutral');
  });

  it('massa magra sobe = favorável; gordura desce = favorável', () => {
    expect(interpretChange('leanMassKg', 0.5, undefined)).toBe('favorable');
    expect(interpretChange('bodyFatPct', -0.5, undefined)).toBe('favorable');
    expect(interpretChange('bodyFatPct', 0.5, undefined)).toBe('unfavorable');
  });

  it('variações mínimas ou ausentes são neutras', () => {
    expect(interpretChange('weightKg', 0.01, 'lose-fat')).toBe('neutral');
    expect(interpretChange('weightKg', undefined, 'lose-fat')).toBe('neutral');
  });
});

describe('formatDelta', () => {
  it('usa sinal e vírgula decimal', () => {
    expect(formatDelta(-0.4, 'kg')).toBe('−0,4 kg');
    expect(formatDelta(1.25, 'kg')).toBe('+1,3 kg');
    expect(formatDelta(0, 'kg')).toBe('sem variação');
  });
});
