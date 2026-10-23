import { useMemo, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { ExerciseThumb } from './ExerciseThumb';
import { Icon } from './Icon';
import { KIND_LABELS, searchCatalog } from '../domain/catalog';
import type { CatalogExercise } from '../domain/catalog';
import { normalizeText } from '../domain/exerciseLibrary';
import { MUSCLE_LABELS } from '../domain/types';
import type { MuscleGroup } from '../domain/types';
import type { CustomExercise } from '../domain/customExercises';
import { useData } from '../state/DataContext';

const FILTERS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'abs', 'cardio', 'full-body'];

interface Props {
  open: boolean;
  onClose: () => void;
  onPickCatalog: (e: CatalogExercise) => void;
  onPickCustom: (e: CustomExercise) => void;
  onManual: () => void;
}

/** Busca na biblioteca (com imagem de cada exercício), nos "meus exercícios" ou entrada manual. */
export function ExercisePickerSheet({ open, onClose, onPickCatalog, onPickCustom, onManual }: Props) {
  const { customExercises } = useData();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const results = useMemo(() => searchCatalog(query, muscle ? { muscle } : undefined), [query, muscle]);
  const mine = useMemo(
    () => customExercises.filter((c) => (!muscle || c.muscles.includes(muscle)) && (query.trim() === '' || normalizeText(c.name).includes(normalizeText(query)))),
    [customExercises, query, muscle],
  );
  return (
    <BottomSheet open={open} title="Adicionar exercício" onClose={onClose}>
      <div className="stack">
        <button type="button" className="btn btn--soft" onClick={onManual}>
          <Icon name="plus" size={16} /> Criar exercício manualmente
        </button>
        <label className="field search-box">
          <span className="field__label">Buscar</span>
          <input className="input" type="search" placeholder="Ex.: supino, agachamento…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="cat-scroll" role="group" aria-label="Filtrar por grupo muscular">
          <button type="button" className={`chip${muscle === null ? ' chip--selected' : ''}`} aria-pressed={muscle === null} onClick={() => setMuscle(null)}>Todos</button>
          {FILTERS.map((m) => (
            <button key={m} type="button" className={`chip${muscle === m ? ' chip--selected' : ''}`} aria-pressed={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>
              {MUSCLE_LABELS[m]}
            </button>
          ))}
        </div>
        {mine.length > 0 ? (
          <div className="list">
            <p className="field__label">Meus exercícios</p>
            {mine.map((c) => (
              <button key={c.id} type="button" className="ex-row ex-row--btn" onClick={() => onPickCustom(c)}>
                <ExerciseThumb item={{ imageId: c.imageId, name: c.name }} />
                <span className="ex-row__body"><span className="ex-row__title">{c.name}</span><span className="ex-row__sub" style={{ display: 'block' }}>{c.muscles.map((m) => MUSCLE_LABELS[m]).join(', ') || KIND_LABELS[c.kind]}</span></span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="list" aria-label="Biblioteca">
          <p className="field__label">Biblioteca ({results.length})</p>
          {results.length === 0 ? <p className="muted">Nenhum exercício encontrado. Você pode criar um manualmente acima.</p> : null}
          {results.map((e) => (
            <button key={e.id} type="button" className="ex-row ex-row--btn" data-testid={`pick-${e.id}`} onClick={() => onPickCatalog(e)}>
              <ExerciseThumb item={{ catalogId: e.id, name: e.name }} />
              <span className="ex-row__body">
                <span className="ex-row__title">{e.name}</span>
                <span className="ex-row__sub" style={{ display: 'block' }}>{e.muscles.map((m) => MUSCLE_LABELS[m]).join(', ')} · {KIND_LABELS[e.kind]}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}
