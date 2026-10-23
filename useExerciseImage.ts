import { useEffect, useState } from 'react';
import { exerciseImagesRepo } from '../data/repositories';

const cache = new Map<string, string | null>();

/** Remove do cache uma foto trocada ou apagada. */
export function forgetImage(id: string): void {
  cache.delete(id);
}

/** Lê a foto própria (data URL) do IndexedDB, com cache em memória. */
export function useExerciseImage(imageId: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(imageId ? (cache.get(imageId) ?? null) : null);
  useEffect(() => {
    if (!imageId) {
      setUrl(null);
      return;
    }
    if (cache.has(imageId)) {
      setUrl(cache.get(imageId) ?? null);
      return;
    }
    let cancelled = false;
    exerciseImagesRepo
      .get(imageId)
      .then((img) => {
        cache.set(imageId, img?.dataUrl ?? null);
        if (!cancelled) setUrl(img?.dataUrl ?? null);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [imageId]);
  return url;
}

export function primeImage(id: string, dataUrl: string): void {
  cache.set(id, dataUrl);
}
