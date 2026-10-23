import { useEffect, useState } from 'react';

export type TabKey = 'inicio' | 'treino' | 'refeicoes' | 'evolucao' | 'perfil';
export type RouteKey = TabKey | 'questionario';

export const TABS: ReadonlyArray<TabKey> = ['inicio', 'treino', 'refeicoes', 'evolucao', 'perfil'];
const ROUTES: ReadonlyArray<RouteKey> = [...TABS, 'questionario'];

export interface Route {
  key: RouteKey;
  /** Segmentos depois da seção (ex.: ['dia', '2026-10-19']). */
  params: string[];
  /** Aba destacada na barra inferior. */
  tab: TabKey;
}

/** Rotas por hash (#/treino/dia/2026-10-19): funcionam em qualquer hospedagem estática. */
export function parseRoute(hash: string): Route {
  const [path] = hash.replace(/^#\/?/, '').split('?');
  const [first, ...params] = path.split('/').filter(Boolean);
  const key = (ROUTES as readonly string[]).includes(first) ? (first as RouteKey) : 'inicio';
  return { key, params: key === first ? params : [], tab: key === 'questionario' ? 'treino' : key };
}

export const links = {
  home: '#/inicio',
  workout: '#/treino',
  day: (date: string) => `#/treino/dia/${date}`,
  session: (id: string) => `#/treino/sessao/${id}`,
  history: '#/treino/historico',
  routines: '#/treino/fichas',
  routine: (id: string) => `#/treino/ficha/${id}`,
  routineEdit: (id: string) => `#/treino/editar/${id}`,
  routineWeek: '#/treino/semana',
  library: '#/treino/biblioteca',
  libraryExercise: (id: string) => `#/treino/exercicio/${id}`,
  meals: '#/refeicoes',
  questionnaire: '#/questionario',
  profile: '#/perfil',
  profileConsistency: '#/perfil/consistencia',
};

export function navigate(href: string): void {
  window.location.hash = href.replace(/^#/, '');
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}
