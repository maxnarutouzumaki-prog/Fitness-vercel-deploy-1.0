import { useEffect, useState } from 'react';

/** Relógio que atualiza a cada `intervalMs` enquanto `enabled`. */
export function useNow(intervalMs: number, enabled: boolean): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
  return now;
}
