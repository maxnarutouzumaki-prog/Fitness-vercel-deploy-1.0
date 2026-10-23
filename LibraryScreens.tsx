import { useMemo, useState } from 'react';
import { ExerciseArtView } from '../components/ExerciseArt';
import { ExerciseThumb } from '../components/ExerciseThumb';
import { Icon } from '../components/Icon';
import { EmptyState, ScreenHeader } from '../components/ui';
import { CATALOG, KIND_LABELS, artFor, findCatalog, searchCatalog } from '../domain/catalog';
import { MUSCLE_LABELS } from '../domain/types';
import type { MuscleGroup } from '../domain/types';
import { links } from '../router';

const FILTERS: MuscleGroup[] = ['biceps', 'triceps', 'chest', 'back', 'shoulders', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'abs', 'cardio', 'full-body'];

export function LibraryScreen() {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const list = useMemo(() => searchCatalog(query, muscle ? { muscle } : undefined), [query, muscle]);
  return (
    <div className="stack">
      <a className="back-link" href={links.workout}><Icon name="chevron-left" size={18} /> Treino</a>
      <ScreenHeader title="Biblioteca de exercícios" subtitle={`${CATALOG.length} exercícios com ilustração`} />
      <label className="field search-box"><span className="field__label">Buscar</span><input className="input" type="search" value={query} placeholder="Nome do exercício" onChange={(e) => setQuery(e.target.value)} /></label>
      <div className="cat-scroll" role="group" aria-label="Grupo muscular">
        <button type="button" className={`chip${muscle === null ? ' chip--selected' : ''}`} aria-pressed={muscle === null} onClick={() => setMuscle(null)}>Todos</button>
        {FILTERS.map((m) => <button key={m} type="button" className={`chip${muscle === m ? ' chip--selected' : ''}`} aria-pressed={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>{MUSCLE_LABELS[m]}</button>)}
      </div>
      {list.length === 0 ? <EmptyState title="Nada encontrado" text="Tente outro nome ou limpe o filtro." /> : null}
      <div className="list">
        {list.map((e) => (
          <a key={e.id} href={links.libraryExercise(e.id)} className="ex-row" style={{ textDecoration: 'none', color: 'inherit' }} data-testid={`lib-${e.id}`}>
            <ExerciseThumb item={{ catalogId: e.id, name: e.name }} />
            <span className="ex-row__body"><span className="ex-row__title">{e.name}</span><span className="ex-row__sub" style={{ display: 'block' }}>{e.muscles.map((m) => MUSCLE_LABELS[m]).join(', ')} · {KIND_LABELS[e.kind]}</span></span>
          </a>
        ))}
      </div>
    </div>
  );
}

export function ExerciseDetailScreen({ id }: { id: string }) {
  const ex = findCatalog(id);
  const art = artFor(id);
  if (!ex) return <div className="stack"><a className="back-link" href={links.library}><Icon name="chevron-left" size={18} /> Biblioteca</a><EmptyState title="Exercício não encontrado" text="Ele não existe na biblioteca." /></div>;
  return (
    <div className="stack">
      <a className="back-link" href={links.library}><Icon name="chevron-left" size={18} /> Biblioteca</a>
      <ScreenHeader title={ex.name} subtitle={`${ex.muscles.map((m) => MUSCLE_LABELS[m]).join(', ')} · ${KIND_LABELS[ex.kind]} · ${ex.equipment}`} />
      <section className="panel stack">
        {art ? <ExerciseArtView art={art} mode="detail" label={ex.name} /> : <ExerciseThumb item={{ name: ex.name }} large />}
        <p className="muted">Ilustração esquemática feita para o app (não é uma foto).</p>
        <div className="grid-3">
          <div className="stat"><span className="stat__value">{ex.sets}</span><span className="stat__label">séries</span></div>
          <div className="stat"><span className="stat__value" style={{ fontSize: 18 }}>{ex.reps}</span><span className="stat__label">repetições</span></div>
          <div className="stat"><span className="stat__value">{ex.restSeconds}s</span><span className="stat__label">descanso</span></div>
        </div>
        <div><strong>Como executar</strong><p className="muted">{ex.instructions}</p></div>
      </section>
    </div>
  );
}
