import { normalizeText } from './exerciseLibrary';
import type { ExerciseKind } from './catalog';
import type { ISODateTime, MuscleGroup } from './types';

/** Exercício criado pela pessoa (fora da biblioteca). */
export interface CustomExercise {
  id: string;
  name: string;
  muscles: MuscleGroup[];
  kind: ExerciseKind;
  instructions?: string;
  /** Foto própria (referência em exerciseImages). */
  imageId?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Foto reduzida, guardada como data URL (JPEG) no IndexedDB. Nunca é enviada ao Gemini. */
export interface ExerciseImage {
  id: string;
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: ISODateTime;
}

export const IMAGE_MAX_DIM = 640;
/** Tamanho alvo depois de comprimir; acima do limite rígido a foto é recusada. */
export const IMAGE_TARGET_BYTES = 120_000;
export const IMAGE_HARD_LIMIT_BYTES = 350_000;
export const MAX_CUSTOM_IMAGES = 200;

export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function isImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
}

/** Bytes aproximados de um data URL em base64. */
export function dataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',');
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : '';
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - pad);
}

export function validateCustomExercise(input: { name: string }): { ok: true } | { ok: false; reason: string } {
  const name = input.name.trim();
  if (name.length < 2) return { ok: false, reason: 'Dê um nome ao exercício (mínimo 2 letras).' };
  if (name.length > 60) return { ok: false, reason: 'O nome pode ter no máximo 60 caracteres.' };
  return { ok: true };
}

/** Já existe um exercício próprio com o mesmo nome (ignorando acentos e maiúsculas)? */
export function findDuplicateName(list: CustomExercise[], name: string, exceptId?: string): CustomExercise | undefined {
  const n = normalizeText(name);
  return list.find((c) => c.id !== exceptId && normalizeText(c.name) === n);
}
