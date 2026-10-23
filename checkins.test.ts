import { describe, expect, it } from 'vitest';
import { addSource, computeStreaks } from '../src/domain/checkins';
import type { Checkin } from '../src/domain/checkins';

const range = (from: string, n: number): string[] => {
  const [y, m, d] = from.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const t = new Date(Date.UTC(y, m - 1, d + i));
    return t.toISOString().slice(0, 10);
  });
};

describe('sequência de check-ins', () => {
  it('sem check-ins tudo é zero', () => {
    expect(computeStreaks([], '2026-10-18')).toEqual({ current: 0, best: 0, total: 0, todayDone: false, atRisk: false });
  });

  it('conta dias consecutivos até hoje', () => {
    const s = computeStreaks(range('2026-10-14', 5), '2026-10-18');
    expect(s.current).toBe(5);
    expect(s.best).toBe(5);
    expect(s.total).toBe(5);
    expect(s.todayDone).toBe(true);
    expect(s.atRisk).toBe(false);
  });

  it('mantém a sequência viva se hoje ainda está pendente', () => {
    const s = computeStreaks(['2026-10-16', '2026-10-17'], '2026-10-18');
    expect(s.current).toBe(2);
    expect(s.todayDone).toBe(false);
    expect(s.atRisk).toBe(true);
  });

  it('um dia sem check-in interrompe a sequência, mas o recorde permanece', () => {
    const dates = [...range('2026-10-10', 5), '2026-10-17'];
    const s = computeStreaks(dates, '2026-10-18');
    expect(s.current).toBe(1);
    expect(s.best).toBe(5);
    const broken = computeStreaks(dates, '2026-10-19');
    expect(broken.current).toBe(0);
    expect(broken.best).toBe(5);
    expect(broken.total).toBe(6);
  });

  it('data repetida conta uma vez só', () => {
    const s = computeStreaks(['2026-10-18', '2026-10-18', '2026-10-18'], '2026-10-18');
    expect(s.total).toBe(1);
    expect(s.current).toBe(1);
  });

  it('funciona entre meses, anos e em ano bissexto', () => {
    expect(computeStreaks(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'], '2027-01-02').current).toBe(4);
    expect(computeStreaks(['2028-02-28', '2028-02-29', '2028-03-01'], '2028-03-01').current).toBe(3);
    expect(computeStreaks(['2026-02-28', '2026-03-01'], '2026-03-01').current).toBe(2);
  });

  it('não é afetada por mudança de horário de verão', () => {
    expect(computeStreaks(['2026-03-07', '2026-03-08', '2026-03-09'], '2026-03-09').current).toBe(3);
    expect(computeStreaks(['2026-10-31', '2026-11-01', '2026-11-02'], '2026-11-02').current).toBe(3);
  });

  it('ignora datas futuras no cálculo da sequência atual', () => {
    const s = computeStreaks(['2026-10-17', '2026-10-18', '2026-10-25'], '2026-10-18');
    expect(s.current).toBe(2);
  });
});

describe('fontes do check-in', () => {
  const now = '2026-10-18T10:00:00.000Z';
  const w1 = { kind: 'workout' as const, sessionId: 's1', title: 'Corpo todo A', at: now };
  const w2 = { kind: 'workout' as const, sessionId: 's2', title: 'Corpo todo B', at: now };

  it('cria o check-in na primeira fonte', () => {
    const c = addSource(undefined, '2026-10-18', w1, now);
    expect(c.id).toBe('2026-10-18');
    expect(c.sources).toHaveLength(1);
  });

  it('dois treinos no mesmo dia viram um único check-in (um dia ativo)', () => {
    let c: Checkin | undefined = addSource(undefined, '2026-10-18', w1, now);
    c = addSource(c, '2026-10-18', w2, now);
    expect(c.sources).toHaveLength(2);
    expect(computeStreaks([c.date], '2026-10-18').total).toBe(1);
  });

  it('é idempotente para a mesma sessão', () => {
    let c: Checkin | undefined = addSource(undefined, '2026-10-18', w1, now);
    c = addSource(c, '2026-10-18', w1, now);
    expect(c.sources).toHaveLength(1);
  });

  it('atividade manual convive com treino no mesmo dia', () => {
    let c: Checkin | undefined = addSource(undefined, '2026-10-18', w1, now);
    c = addSource(c, '2026-10-18', { kind: 'manual', id: 'm1', activity: 'walk', minutes: 30, at: now }, now);
    expect(c.sources.map((s) => s.kind)).toEqual(['workout', 'manual']);
  });
});
