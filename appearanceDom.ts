import { DEFAULT_APPEARANCE, normalizeAppearance } from '../domain/appearance';
import type { Appearance } from '../domain/types';

/**
 * Cópia da aparência em localStorage, só para pintar o tema certo no primeiro quadro
 * (sem "piscar"). A fonte da verdade continua sendo o IndexedDB.
 */
export const APPEARANCE_MIRROR_KEY = 'fit:appearance';

export function readAppearanceMirror(): Appearance {
  try {
    const raw = localStorage.getItem(APPEARANCE_MIRROR_KEY);
    return raw ? normalizeAppearance(JSON.parse(raw)) : DEFAULT_APPEARANCE;
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

/** Aplica tema e modo noite imediatamente, sem recarregar a página. */
export function applyAppearance(appearance: Appearance): void {
  const root = document.documentElement;
  root.dataset.theme = appearance.theme;
  root.dataset.mode = appearance.mode;

  // A cor da barra do sistema segue o fundo atual definido nos tokens CSS.
  const background = getComputedStyle(root).getPropertyValue('--bg').trim();
  if (background) {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
  }

  try {
    localStorage.setItem(APPEARANCE_MIRROR_KEY, JSON.stringify(appearance));
  } catch {
    /* armazenamento indisponível: segue sem espelho */
  }
}
