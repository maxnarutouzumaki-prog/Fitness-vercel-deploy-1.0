import { parseReps } from './planning';
import type { WorkoutSession } from './training';
import type { ISODate } from './types';

export interface LastPerformance {
  date: ISODate;
  sets: Array<{ reps?: number; loadKg?: number }>;
  difficulty?: number;
  discomfort: boolean;
  topLoadKg?: number;
}

/** Última vez que o exercício foi realizado de verdade (séries concluídas). */
export function lastPerformance(key: string, sessions: WorkoutSession[]): LastPerformance | null {
  const ordered = sessions
    .filter((s) => s.status === 'completed' || s.status === 'partial')
    .sort((a, b) => (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt));
  for (const s of ordered) {
    const ex = s.exercises.find((e) => e.key === key);
    if (!ex) continue;
    const done = ex.sets.filter((x) => x.completed);
    if (done.length === 0) continue;
    const loads = done.map((x) => x.loadKg).filter((x): x is number => typeof x === 'number' && x > 0);
    return {
      date: s.date,
      sets: done.map((x) => ({ reps: x.reps, loadKg: x.loadKg })),
      difficulty: ex.difficulty,
      discomfort: !!ex.discomfort?.present,
      topLoadKg: loads.length > 0 ? Math.max(...loads) : undefined,
    };
  }
  return null;
}

export interface ProgressionHint {
  text: string;
  /** Carga sugerida para a próxima vez (opcional). */
  suggestedLoadKg?: number;
  kind: 'increase' | 'hold' | 'careful' | 'info';
}

function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

/**
 * Sugestão de progressão gradual com base na última execução.
 * Aumenta só quando todas as séries chegaram ao topo da faixa de repetições com esforço
 * confortável e sem desconforto; nunca sugere saltos agressivos (máx. ~5%).
 */
export function progressionHint(targetReps: string, last: LastPerformance | null): ProgressionHint | null {
  if (!last) return null;
  const parsed = parseReps(targetReps);
  const loadText = last.topLoadKg ? ` com ${last.topLoadKg} kg` : '';
  const summary = `Última vez (${last.date.split('-').reverse().join('/')}): ${last.sets.length} série(s)${loadText}.`;

  if (last.discomfort) {
    return { kind: 'careful', text: `${summary} Você relatou desconforto: mantenha leve e considere uma alternativa se persistir.` };
  }
  if (!parsed || parsed.unit === 's') {
    return { kind: 'info', text: summary };
  }
  const reps = last.sets.map((s) => s.reps).filter((r): r is number => typeof r === 'number');
  const hitTop = reps.length === last.sets.length && reps.every((r) => r >= parsed.hi);
  const easy = last.difficulty === undefined || last.difficulty <= 3;

  if (hitTop && easy && last.topLoadKg) {
    const raised = roundHalf(last.topLoadKg * 1.04);
    const next = raised > last.topLoadKg ? raised : last.topLoadKg + 0.5;
    return {
      kind: 'increase',
      suggestedLoadKg: next,
      text: `${summary} Você chegou ao topo da faixa. Se estiver confortável, tente ${next} kg.`,
    };
  }
  if (last.difficulty !== undefined && last.difficulty >= 4) {
    return { kind: 'hold', text: `${summary} Foi difícil: mantenha a carga e foque na técnica.` };
  }
  return { kind: 'hold', text: `${summary} Mantenha a carga e tente chegar a ${parsed.hi} repetições em todas as séries.` };
}
