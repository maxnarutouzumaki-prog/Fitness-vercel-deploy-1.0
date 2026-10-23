import { diffDays } from './dates';
import type { ISODate, ISODateTime } from './types';

/**
 * Check-in diário: no máximo UM registro por data local (o id é a própria data).
 * Vários treinos ou atividades no mesmo dia viram "fontes" do mesmo check-in,
 * então contam como um único dia ativo.
 */

export type ManualActivity = 'walk' | 'run' | 'gym' | 'bike' | 'other';

export const MANUAL_ACTIVITY_LABELS: Record<ManualActivity, string> = {
  walk: 'Caminhada',
  run: 'Corrida',
  gym: 'Academia / musculação (fora do app)',
  bike: 'Bicicleta',
  other: 'Outra atividade física',
};

export const MANUAL_ACTIVITY_SHORT: Record<ManualActivity, string> = {
  walk: 'Caminhada',
  run: 'Corrida',
  gym: 'Academia',
  bike: 'Bicicleta',
  other: 'Outra atividade',
};

export interface WorkoutSource {
  kind: 'workout';
  sessionId: string;
  title: string;
  at: ISODateTime;
}

export interface ManualSource {
  kind: 'manual';
  id: string;
  activity: ManualActivity;
  minutes?: number;
  note?: string;
  at: ISODateTime;
}

export type CheckinSource = WorkoutSource | ManualSource;

export interface Checkin {
  /** Igual a `date`: garante uma única linha por dia. */
  id: ISODate;
  date: ISODate;
  sources: CheckinSource[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Acrescenta uma fonte a um check-in (criando-o se não existir). Idempotente. */
export function addSource(
  existing: Checkin | undefined,
  date: ISODate,
  source: CheckinSource,
  nowIso: ISODateTime,
): Checkin {
  const base: Checkin = existing ?? { id: date, date, sources: [], createdAt: nowIso, updatedAt: nowIso };
  const already = base.sources.some((s) =>
    source.kind === 'workout' ? s.kind === 'workout' && s.sessionId === source.sessionId : s.kind === 'manual' && s.id === source.id,
  );
  if (already) return base;
  return { ...base, sources: [...base.sources, source], updatedAt: nowIso };
}

export interface Streaks {
  /** Dias consecutivos com check-in, contando até hoje (ou até ontem, se hoje ainda está pendente). */
  current: number;
  /** Maior sequência histórica. */
  best: number;
  /** Quantidade de datas diferentes com check-in. */
  total: number;
  /** true se hoje já tem check-in. */
  todayDone: boolean;
  /** true se a sequência está viva, mas hoje ainda falta o check-in para mantê-la. */
  atRisk: boolean;
}

/**
 * Calcula sequências a partir das datas de check-in. Nada é salvo à parte: como os
 * check-ins ficam guardados, o recorde sempre pode ser recalculado.
 * Regras: cada data conta uma vez; um dia sem check-in quebra a sequência;
 * se hoje ainda não foi registrado, a sequência até ontem continua valendo
 * (o dia ainda não acabou).
 */
export function computeStreaks(dates: ISODate[], today: ISODate): Streaks {
  const unique = [...new Set(dates)].sort();
  const total = unique.length;
  if (total === 0) return { current: 0, best: 0, total: 0, todayDone: false, atRisk: false };

  let best = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i += 1) {
    run = diffDays(unique[i - 1], unique[i]) === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }

  const upToToday = unique.filter((d) => d <= today);
  const todayDone = upToToday.length > 0 && upToToday[upToToday.length - 1] === today;
  let current = 0;
  if (upToToday.length > 0) {
    const last = upToToday[upToToday.length - 1];
    const gap = diffDays(last, today);
    if (gap <= 1) {
      current = 1;
      for (let i = upToToday.length - 1; i > 0; i -= 1) {
        if (diffDays(upToToday[i - 1], upToToday[i]) === 1) current += 1;
        else break;
      }
    }
  }
  return { current, best, total, todayDone, atRisk: !todayDone && current > 0 };
}
