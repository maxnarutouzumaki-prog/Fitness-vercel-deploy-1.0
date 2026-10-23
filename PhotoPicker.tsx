import { useRef, useState } from 'react';
import { Icon } from './Icon';
import { compressImage } from '../services/imageService';
import type { ExerciseImage } from '../domain/customExercises';

interface Props {
  /** Pré-visualização atual (data URL). */
  preview: string | null;
  onPick: (image: ExerciseImage) => void;
  onClear?: () => void;
  label: string;
  /** Máximo em pixels do lado maior. */
  maxDim?: number;
  targetBytes?: number;
}

/** Botões "Tirar foto" e "Escolher da galeria": a imagem é reduzida no aparelho. */
export function PhotoPicker({ preview, onPick, onClear, label, maxDim, targetBytes }: Props) {
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    const res = await compressImage(file, maxDim, targetBytes);
    setBusy(false);
    if (res.ok) onPick(res.image);
    else setError(res.reason);
  };

  return (
    <div className="stack" style={{ gap: 8 }}>
      {preview ? <img className="preview-img" src={preview} alt={label} /> : null}
      <div className="btn-row">
        <button type="button" className="btn btn--outline btn--small" disabled={busy} onClick={() => cam.current?.click()}>
          <Icon name="camera" size={16} /> Tirar foto
        </button>
        <button type="button" className="btn btn--outline btn--small" disabled={busy} onClick={() => gal.current?.click()}>
          <Icon name="image" size={16} /> Galeria
        </button>
        {preview && onClear ? (
          <button type="button" className="btn btn--danger btn--small" onClick={onClear}>
            Remover
          </button>
        ) : null}
      </div>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden aria-label={`${label} (câmera)`} onChange={(e) => { void handle(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={gal} type="file" accept="image/*" hidden aria-label={`${label} (galeria)`} onChange={(e) => { void handle(e.target.files?.[0]); e.target.value = ''; }} />
      {busy ? <p className="muted">Preparando a imagem…</p> : null}
      {error ? <p className="muted" role="alert" style={{ color: 'var(--bad)' }}>{error}</p> : null}
    </div>
  );
}
