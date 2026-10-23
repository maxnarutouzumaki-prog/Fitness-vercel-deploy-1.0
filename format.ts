import { WEEKDAY_SHORT, parseISODate, weekdayMon } from './dates';
import type { ISODate } from './types';

export function weekdayShort(date: ISODate): string {
  return WEEKDAY_SHORT[weekdayMon(date)];
}

export function dayOfMonth(date: ISODate): string {
  return String(parseISODate(date).d);
}

/** "19/10" */
export function shortDate(date: ISODate): string {
  const { m, d } = parseISODate(date);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Carga com vírgula decimal: 22,5 */
export function formatKg(n: number | undefined): string {
  return `${String(n ?? 0).replace('.', ',')} kg`;
}
