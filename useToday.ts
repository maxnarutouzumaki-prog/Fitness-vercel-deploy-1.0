import { useEffect, useState } from 'react';
import { msUntilNextMidnight, todayISO } from '../domain/dates';

/**
 * Data local de hoje. Vira sozinha à meia-noite e quando o app volta ao primeiro plano
 * (o celular pode ter ficado bloqueado durante a virada do dia).
 */
export function useToday(): string {
  const [today, setToday] = useState<string>(() => todayISO());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => setToday((prev) => {
      const next = todayISO();
      return next === prev ? prev : next;
    });
    const schedule = () => {
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, msUntilNextMidnight());
    };
    schedule();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, []);

  return today;
}
