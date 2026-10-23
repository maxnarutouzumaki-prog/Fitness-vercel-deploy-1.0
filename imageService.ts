import { IMAGE_HARD_LIMIT_BYTES, IMAGE_MAX_DIM, IMAGE_TARGET_BYTES, dataUrlBytes, fitWithin } from '../domain/customExercises';
import type { ExerciseImage } from '../domain/customExercises';
import { uid } from '../domain/ids';

export type CompressResult = { ok: true; image: ExerciseImage } | { ok: false; reason: string };

function loadBitmap(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode'));
    };
    img.src = url;
  });
}

/**
 * Reduz a foto no próprio aparelho (máx. 640 px, JPEG) e devolve um registro para o IndexedDB.
 * A foto nunca é enviada a nenhum serviço por aqui.
 */
export async function compressImage(file: File, maxDim: number = IMAGE_MAX_DIM, targetBytes: number = IMAGE_TARGET_BYTES): Promise<CompressResult> {
  if (!file.type.startsWith('image/')) return { ok: false, reason: 'Escolha um arquivo de imagem.' };
  let bmp;
  try {
    bmp = await loadBitmap(file);
  } catch {
    return { ok: false, reason: 'Não foi possível abrir esta imagem. Tente outra foto (JPG ou PNG).' };
  }
  try {
    const { width, height } = fitWithin(bmp.width, bmp.height, maxDim);
    if (!width) return { ok: false, reason: 'A imagem parece vazia.' };
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, reason: 'Seu navegador não conseguiu processar a imagem.' };
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bmp.source, 0, 0, width, height);
    let quality = 0.82;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrlBytes(dataUrl) > targetBytes && quality > 0.4) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    const bytes = dataUrlBytes(dataUrl);
    if (bytes > IMAGE_HARD_LIMIT_BYTES) return { ok: false, reason: 'A imagem continua grande demais. Escolha uma foto menor.' };
    return { ok: true, image: { id: uid('img'), dataUrl, width, height, bytes, createdAt: new Date().toISOString() } };
  } finally {
    bmp.release();
  }
}
