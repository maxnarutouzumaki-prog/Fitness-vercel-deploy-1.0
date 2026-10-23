import type { ISODate } from './types';

/**
 * Todas as datas do app são strings 'YYYY-MM-DD' no fuso LOCAL do usuário.
 * A aritmética de datas usa Date.UTC (número de dias), por isso não sofre com
 * horário de verão nem com mudanças de fuso.
 */

const MS_PER_DAY = 86_400_000;

export const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

export const WEEKDAY_NAMES = [
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
  'domingo',
] as const;

/** Segunda = 0 … domingo = 6. */
export const WEEKDAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;

/** Data de hoje no fuso local, no formato YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): ISODate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** Data local correspondente a um instante (ms desde 1970). */
export function localDateFromTimestamp(ms: number): ISODate {
  return todayISO(new Date(ms));
}

export function parseISODate(date: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d };
}

export function isValidISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { y, m, d } = parseISODate(value);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Número de dias desde 1970-01-01 (inteiro). */
export function toDayNumber(date: ISODate): number {
  const { y, m, d } = parseISODate(date);
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

export function fromDayNumber(n: number): ISODate {
  const t = new Date(n * MS_PER_DAY);
  const y = t.getUTCFullYear();
  const m = String(t.getUTCMonth() + 1).padStart(2, '0');
  const d = String(t.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromDayNumber(toDayNumber(date) + days);
}

/** Dias de `a` até `b` (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return toDayNumber(b) - toDayNumber(a);
}

/** Segunda = 0 … domingo = 6 (1970-01-01 foi uma quinta-feira). */
export function weekdayMon(date: ISODate): number {
  return (((toDayNumber(date) + 3) % 7) + 7) % 7;
}

/** Domingo = 0 … sábado = 6. */
export function weekdaySun(date: ISODate): number {
  return (((toDayNumber(date) + 4) % 7) + 7) % 7;
}

/** Milissegundos até a próxima meia-noite LOCAL (usado para virar o "hoje" sozinho). */
export function msUntilNextMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return Math.max(1000, next.getTime() - now.getTime());
}

export function monthLabel(year: number, month: number): string {
  const name = MONTH_NAMES[month - 1];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${year}`;
}

/** "12 de outubro" */
export function formatDayMonth(date: ISODate): string {
  const { m, d } = parseISODate(date);
  return `${d} de ${MONTH_NAMES[m - 1]}`;
}

/** "segunda-feira, 12 de outubro" */
export function formatLongDate(date: ISODate): string {
  return `${WEEKDAY_NAMES[weekdayMon(date)]}, ${formatDayMonth(date)}`;
}

export function formatTime(iso: string): string {
  const t = new Date(iso);
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}

/** Semanas (domingo primeiro) de um mês; null = célula fora do mês. month: 1–12. */
export function monthGrid(year: number, month: number): Array<Array<ISODate | null>> {
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const lead = weekdaySun(first);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<ISODate | null> = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<ISODate | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** "1:05:09" ou "12:34" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "42 min" / "1 h 05 min" */
export function formatMinutes(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}
