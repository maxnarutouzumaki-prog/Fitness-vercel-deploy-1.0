import { artFor, findCatalog } from '../domain/catalog';
import { ExerciseArtView } from './ExerciseArt';
import { useExerciseImage } from '../state/useExerciseImage';

export interface ThumbRef {
  /** Id da biblioteca (ou chave de exercício da biblioteca). */
  catalogId?: string;
  /** Foto própria (exercício personalizado). */
  imageId?: string;
  name: string;
}

/** Resolve a chave de um exercício registrado ("c-<id>" = personalizado) para a referência da imagem. */
export function refFromKey(key: string, name: string, customs: Array<{ id: string; imageId?: string }>): ThumbRef {
  if (key.startsWith('c-')) {
    const c = customs.find((x) => x.id === key.slice(2));
    return { imageId: c?.imageId, name };
  }
  return { catalogId: findCatalog(key) ? key : undefined, name };
}

/**
 * Miniatura do exercício: foto própria > ilustração da biblioteca > aviso "Imagem indisponível".
 * Nunca reaproveita a imagem de outro exercício.
 */
export function ExerciseThumb({ item, large = false }: { item: ThumbRef; large?: boolean }) {
  const photo = useExerciseImage(item.imageId);
  const art = artFor(item.catalogId);
  const cls = `thumb${large ? ' thumb--lg' : ''}`;
  if (photo) {
    return (
      <span className={cls} data-testid="thumb-photo">
        <img src={photo} alt={`Foto: ${item.name}`} loading="lazy" />
      </span>
    );
  }
  if (art) {
    return (
      <span className={cls} data-testid="thumb-art">
        <ExerciseArtView art={art} mode="thumb" label={item.name} />
      </span>
    );
  }
  return (
    <span className={cls} data-testid="thumb-none" role="img" aria-label={`Imagem indisponível: ${item.name}`}>
      <span className="thumb__none">Imagem indisponível</span>
    </span>
  );
}
