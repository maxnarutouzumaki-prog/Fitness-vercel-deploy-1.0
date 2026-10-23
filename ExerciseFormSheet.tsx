import { useEffect, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { ExerciseArtView } from './ExerciseArt';
import { NumberField } from './NumberField';
import { PhotoPicker } from './PhotoPicker';
import { artFor } from '../domain/catalog';
import type { ExerciseKind } from '../domain/catalog';
import { KIND_LABELS } from '../domain/catalog';
import { findDuplicateName, validateCustomExercise } from '../domain/customExercises';
import type { CustomExercise, ExerciseImage } from '../domain/customExercises';
import { uid } from '../domain/ids';
import { sanitizeExercise } from '../domain/routines';
import type { RoutineExercise } from '../domain/routines';
import { MUSCLE_LABELS } from '../domain/types';
import type { MuscleGroup } from '../domain/types';
import { useData } from '../state/DataContext';
import { forgetImage, primeImage, useExerciseImage } from '../state/useExerciseImage';

const MUSCLES = Object.keys(MUSCLE_LABELS) as MuscleGroup[];

interface Props {
  open: boolean;
  initial: RoutineExercise | null;
  onClose: () => void;
  onSave: (exercise: RoutineExercise) => void;
}

/** Formulário do exercício dentro da ficha. Exercício fora da biblioteca vira "meu exercício" (com foto opcional). */
export function ExerciseFormSheet({ open, initial, onClose, onSave }: Props) {
  const { customExercises, saveCustomExercise } = useData();
  const [draft, setDraft] = useState<RoutineExercise | null>(initial);
  const [newImage, setNewImage] = useState<ExerciseImage | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(initial);
    setNewImage(null);
    setRemovePhoto(false);
    setError('');
  }, [initial, open]);

  const custom = draft?.customId ? customExercises.find((c) => c.id === draft.customId) : undefined;
  const storedPhoto = useExerciseImage(custom?.imageId ?? draft?.imageId);
  if (!draft) return null;
  const fromLibrary = !!draft.catalogId;
  const art = artFor(draft.catalogId);
  const photo = removePhoto ? null : (newImage?.dataUrl ?? storedPhoto);
  const set = (patch: Partial<RoutineExercise>) => setDraft({ ...draft, ...patch });
  const isTime = draft.kind !== 'strength';

  const submit = async () => {
    let ex = sanitizeExercise({ ...draft, name: draft.name.trim() });
    if (!ex.name || ex.name === 'Exercício' && !draft.name.trim()) {
      setError('Dê um nome ao exercício.');
      return;
    }
    if (!fromLibrary) {
      const valid = validateCustomExercise({ name: ex.name });
      if (!valid.ok) {
        setError(valid.reason);
        return;
      }
      const existingId = draft.customId;
      const dup = findDuplicateName(customExercises, ex.name, existingId);
      const id = existingId ?? dup?.id ?? uid('cx');
      const prev = customExercises.find((c) => c.id === id);
      const now = new Date().toISOString();
      let imageId = removePhoto ? undefined : (newImage?.id ?? prev?.imageId);
      if (removePhoto && prev?.imageId) forgetImage(prev.imageId);
      const record: CustomExercise = {
        id,
        name: ex.name,
        muscles: ex.muscles,
        kind: ex.kind,
        instructions: ex.instructions,
        imageId,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
      };
      if (newImage) primeImage(newImage.id, newImage.dataUrl);
      await saveCustomExercise(record, newImage);
      ex = { ...ex, customId: id, imageId };
    } else if (newImage) {
      ex = { ...ex, imageId: newImage.id };
    }
    onSave(ex);
  };

  return (
    <BottomSheet open={open} title={draft.name || 'Novo exercício'} onClose={onClose}>
      <div className="stack">
        {fromLibrary && art ? <ExerciseArtView art={art} mode="detail" label={draft.name} /> : null}
        {!fromLibrary ? (
          <div className="field">
            <span className="field__label">Foto do exercício (opcional)</span>
            <PhotoPicker
              label="Foto do exercício"
              preview={photo}
              onPick={(img) => {
                primeImage(img.id, img.dataUrl);
                setNewImage(img);
                setRemovePhoto(false);
              }}
              onClear={() => {
                setNewImage(null);
                setRemovePhoto(true);
              }}
            />
            <p className="field__hint">A foto fica só no seu aparelho e nunca é enviada à IA.</p>
          </div>
        ) : null}
        <label className="field">
          <span className="field__label">Nome</span>
          <input className="input" value={draft.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} />
        </label>
        {!fromLibrary ? (
          <>
            <label className="field">
              <span className="field__label">Grupo muscular</span>
              <select className="select" value={draft.muscles[0] ?? ''} onChange={(e) => set({ muscles: e.target.value ? [e.target.value as MuscleGroup] : [] })}>
                <option value="">Não informar</option>
                {MUSCLES.map((m) => <option key={m} value={m}>{MUSCLE_LABELS[m]}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Tipo</span>
              <select className="select" value={draft.kind} onChange={(e) => set({ kind: e.target.value as ExerciseKind })}>
                {(Object.keys(KIND_LABELS) as ExerciseKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
              </select>
            </label>
          </>
        ) : null}
        <div className="food-row__grid">
          <label className="field"><span className="field__label">Séries</span><NumberField label="Séries" value={draft.sets} max={20} onCommit={(v) => set({ sets: v })} /></label>
          <label className="field">
            <span className="field__label">{isTime ? 'Duração (ex.: 20 min)' : 'Repetições'}</span>
            <input className="input input--small" aria-label="Repetições ou duração" value={draft.reps ?? ''} maxLength={20} placeholder={isTime ? '20 min' : '8-12'} onChange={(e) => set({ reps: e.target.value })} />
          </label>
          {!isTime ? <label className="field"><span className="field__label">Carga (kg)</span><NumberField label="Carga em kg" value={draft.loadKg} inputMode="decimal" max={999} onCommit={(v) => set({ loadKg: v })} /></label> : null}
          <label className="field"><span className="field__label">Descanso (s)</span><NumberField label="Descanso em segundos" value={draft.restSeconds} max={900} onCommit={(v) => set({ restSeconds: v })} /></label>
        </div>
        <label className="field">
          <span className="field__label">Como executar (opcional)</span>
          <textarea className="input textarea" maxLength={600} value={draft.instructions ?? ''} onChange={(e) => set({ instructions: e.target.value })} />
        </label>
        <label className="field">
          <span className="field__label">Notas pessoais (opcional)</span>
          <input className="input" maxLength={300} value={draft.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
        </label>
        {error ? <p role="alert" className="muted" style={{ color: 'var(--bad)' }}>{error}</p> : null}
        <div className="btn-col">
          <button type="button" className="btn btn--primary" onClick={() => void submit()}>Salvar exercício</button>
          <button type="button" className="btn btn--outline" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </BottomSheet>
  );
}
