import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, normalizeAppearance } from '../src/domain/appearance';
import { parseRoute } from '../src/router';

describe('normalizeAppearance', () => {
  it('usa os padrões para valores inválidos', () => {
    expect(normalizeAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(normalizeAppearance({ theme: 'roxo', mode: 'x' })).toEqual(DEFAULT_APPEARANCE);
  });

  it('tema e modo noite são independentes', () => {
    expect(normalizeAppearance({ theme: 'pink', mode: 'dark' })).toEqual({ theme: 'pink', mode: 'dark' });
    expect(normalizeAppearance({ theme: 'orange' })).toEqual({ theme: 'orange', mode: 'light' });
    expect(normalizeAppearance({ mode: 'dark' })).toEqual({ theme: 'green', mode: 'dark' });
  });
});

describe('parseRoute', () => {
  it('reconhece as cinco seções e cai em início quando desconhecida', () => {
    expect(parseRoute('#/treino').key).toBe('treino');
    expect(parseRoute('#/refeicoes').key).toBe('refeicoes');
    expect(parseRoute('#/evolucao').key).toBe('evolucao');
    expect(parseRoute('#/perfil').key).toBe('perfil');
    expect(parseRoute('').key).toBe('inicio');
    expect(parseRoute('#/qualquer-coisa').key).toBe('inicio');
    expect(parseRoute('#/treino/dia/2026-10-19')).toEqual({ key: 'treino', params: ['dia', '2026-10-19'], tab: 'treino' });
    expect(parseRoute('#/questionario').tab).toBe('treino');
  });
});
