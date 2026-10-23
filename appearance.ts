import { THEME_IDS } from './types';
import type { Appearance, ColorMode, ThemeId } from './types';

/**
 * Os códigos de cor ficam SOMENTE em styles/tokens.css.
 * Aqui só existem ids e rótulos.
 */
export const THEMES: ReadonlyArray<{ id: ThemeId; label: string }> = [
  { id: 'green', label: 'Verde' },
  { id: 'blue', label: 'Azul' },
  { id: 'pink', label: 'Rosa' },
  { id: 'red', label: 'Vermelho' },
  { id: 'orange', label: 'Laranja' },
];

export const DEFAULT_APPEARANCE: Appearance = { theme: 'green', mode: 'light' };

function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

function isColorMode(value: unknown): value is ColorMode {
  return value === 'light' || value === 'dark';
}

/** Aceita qualquer valor lido do armazenamento e devolve uma aparência válida. */
export function normalizeAppearance(input: unknown): Appearance {
  const source = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  return {
    theme: isThemeId(source.theme) ? source.theme : DEFAULT_APPEARANCE.theme,
    mode: isColorMode(source.mode) ? source.mode : DEFAULT_APPEARANCE.mode,
  };
}
