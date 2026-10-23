import { describe, expect, it } from 'vitest';
import {
  addDays,
  diffDays,
  formatDuration,
  isValidISODate,
  localDateFromTimestamp,
  monthGrid,
  msUntilNextMidnight,
  shiftMonth,
  todayISO,
  weekdayMon,
  weekdaySun,
} from '../src/domain/dates';

describe('datas locais', () => {
  it('soma dias entre meses, anos e anos bissextos', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('calcula diferença em dias sem ser afetada por horário de verão', () => {
    expect(diffDays('2026-03-07', '2026-03-09')).toBe(2);
    expect(diffDays('2026-10-31', '2026-11-02')).toBe(2);
    expect(diffDays('2026-10-18', '2026-10-18')).toBe(0);
  });

  it('usa a data LOCAL perto da meia-noite', () => {
    expect(todayISO(new Date(2026, 9, 18, 23, 59, 59))).toBe('2026-10-18');
    expect(todayISO(new Date(2026, 9, 19, 0, 0, 1))).toBe('2026-10-19');
    expect(localDateFromTimestamp(new Date(2026, 9, 18, 23, 59, 59).getTime())).toBe('2026-10-18');
    expect(localDateFromTimestamp(new Date(2026, 9, 18, 23, 59, 59).getTime() + 2000)).toBe('2026-10-19');
  });

  it('calcula o dia da semana', () => {
    expect(weekdayMon('2026-10-19')).toBe(0); // segunda
    expect(weekdayMon('2026-10-25')).toBe(6); // domingo
    expect(weekdaySun('2026-10-18')).toBe(0); // domingo
    expect(weekdaySun('2026-10-24')).toBe(6); // sábado
  });

  it('valida datas', () => {
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('2026-10-18')).toBe(true);
    expect(isValidISODate('18/10/2026')).toBe(false);
  });

  it('monta a grade do mês começando no domingo', () => {
    const weeks = monthGrid(2026, 10);
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(weeks[4][6]).toBe('2026-10-31');
    expect(monthGrid(2024, 2).flat().filter(Boolean)).toHaveLength(29);
  });

  it('navega entre meses e anos', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 5, 0)).toEqual({ year: 2026, month: 5 });
  });

  it('calcula o tempo até a próxima meia-noite local', () => {
    expect(msUntilNextMidnight(new Date(2026, 9, 18, 23, 59, 0))).toBe(61000);
    expect(msUntilNextMidnight(new Date(2026, 9, 18, 0, 0, 0))).toBe(86401000);
  });

  it('formata duração', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(0)).toBe('0:00');
  });
});
