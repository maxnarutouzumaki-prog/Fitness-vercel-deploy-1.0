import { useMemo, useState } from 'react';
import { BottomSheet } from '../components/BottomSheet';
import { ExerciseFormSheet } from '../components/ExerciseFormSheet';
import { ExercisePickerSheet } from '../components/ExercisePickerSheet';
import { ExerciseThumb } from '../components/ExerciseThumb';
import { Icon } from '../components/Icon';
import { EmptyState, ScreenHeader, Section } from '../components/ui';
import { WEEKDAY_NAMES, WEEKDAY_SHORT, addDays, weekdayMon } from '../domain/dates';
import { shortDate } from '../domain/format';
import { LIMITS, assignDay, copyToDay, duplicateRoutine, exerciseFromCatalog, manualExercise, moveItem, moveToDay, newRoutine, routineStatusOn, ROUTINE_STATUS_LABELS, unassignDay } from '../domain/routines';
import type { Routine, RoutineExercise } from '../domain/routines';
import { MUSCLE_LABELS } from '../domain/types';
import { links, navigate } from '../router';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';

const back = (href: string, label: string) => (
  <a className="back-link" href={href}>
    <Icon name="chevron-left" size={18} /> {label}
  </a>
);

function summary(r: Routine): string {
  const days = r.weekdays.length > 0 ? r.weekdays.map((d) => WEEKDAY_SHORT[d]).join(', ') : 'sem dia fixo';
  return [r.focus, `${r.exercises.length} exercício${r.exercises.length === 1 ? '' : 's'}`, days].filter(Boolean).join(' · ');
}

function exSub(e: RoutineExercise): string {
  const bits: string[] = [];
  if (e.sets || e.reps) bits.push(`${e.sets ?? '–'} × ${e.reps ?? '–'}`);
  if (e.loadKg) bits.push(`${String(e.loadKg).replace('.', ',')} kg`);
  if (e.restSeconds) bits.push(`desc. ${e.restSeconds}s`);
  const m = e.muscles.map((x) => MUSCLE_LABELS[x]).join(', ');
  return [bits.join(' · '), m].filter(Boolean).join(' · ') || 'Sem detalhes ainda';
}

/** Miniatura de um exercício da ficha, usando biblioteca, foto própria ou aviso de indisponível. */
function RoutineExThumb({ e }: { e: RoutineExercise }) {
  const { customExercises } = useData();
  const custom = e.customId ? customExercises.find((c) => c.id === e.customId) : undefined;
  return <ExerciseThumb item={{ catalogId: e.catalogId, imageId: e.imageId ?? custom?.imageId, name: e.name }} />;
}

export function RoutinesListScreen() {
  const { routines, saveRoutine, saveRoutines, deleteRoutine, ready } = useData();
  const toast = useToast();
  const [confirm, setConfirm] = useState<Routine | null>(null);

  const reorder = async (i: number, to: number) => {
    if (to < 0 || to >= routines.length) return;
    const moved = moveItem(routines, i, to).map((r, k) => ({ ...r, order: k, updatedAt: new Date().toISOString() }));
    await saveRoutines(moved);
  };
  const dup = async (r: Routine) => {
    await saveRoutine(duplicateRoutine(r, routines.length, new Date().toISOString()));
    toast.show('Ficha duplicada');
  };

  return (
    <div className="stack">
      {back(links.workout, 'Treino')}
      <ScreenHeader title="Minhas fichas" subtitle="Treinos cadastrados por você" />
      <a className="btn btn--primary btn--block" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }} href={links.routineEdit('novo')} data-testid="new-routine">
        Cadastrar nova ficha
      </a>
      {ready && routines.length === 0 ? (
        <EmptyState title="Nenhuma ficha ainda" text="Cadastre a ficha que você já usa: escolha exercícios da biblioteca ou crie os seus. Não há limite de fichas." />
      ) : null}
      <div className="list">
        {routines.map((r, i) => (
          <div key={r.id} className="ex-row" data-testid={`routine-${r.id}`}>
            <a className="ex-row__body" style={{ textDecoration: 'none', color: 'inherit' }} href={links.routine(r.id)}>
              <span className="ex-row__title">{r.name}</span>
              <span className="ex-row__sub" style={{ display: 'block' }}>{summary(r)}</span>
            </a>
            <span className="ex-row__actions">
              <button type="button" className="icon-btn" aria-label={`Subir ${r.name}`} disabled={i === 0} onClick={() => void reorder(i, i - 1)}><Icon name="arrow-up" size={18} /></button>
              <button type="button" className="icon-btn" aria-label={`Descer ${r.name}`} disabled={i === routines.length - 1} onClick={() => void reorder(i, i + 1)}><Icon name="arrow-down" size={18} /></button>
              <button type="button" className="icon-btn" aria-label={`Duplicar ${r.name}`} onClick={() => void dup(r)}><Icon name="copy" size={18} /></button>
              <button type="button" className="icon-btn" aria-label={`Excluir ${r.name}`} onClick={() => setConfirm(r)}><Icon name="trash" size={18} /></button>
            </span>
          </div>
        ))}
      </div>
      {routines.length > 0 ? (
        <a className="btn btn--outline" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }} href={links.routineWeek}>Ver minha semana (segunda a domingo)</a>
      ) : null}
      <BottomSheet open={!!confirm} title="Excluir ficha?" onClose={() => setConfirm(null)}>
        <p className="muted">“{confirm?.name}” será removida. Treinos já feitos com ela continuam no histórico, sem alterações.</p>
        <div className="btn-col">
          <button type="button" className="btn btn--danger" onClick={async () => { if (confirm) await deleteRoutine(confirm.id); setConfirm(null); toast.show('Ficha excluída'); }}>Excluir ficha</button>
          <button type="button" className="btn btn--outline" onClick={() => setConfirm(null)}>Cancelar</button>
        </div>
      </BottomSheet>
    </div>
  );
}

export function RoutineDetailScreen({ id }: { id: string }) {
  const { routines, startRoutineSession, today, sessions, ready } = useData();
  const r = routines.find((x) => x.id === id);
  const [busy, setBusy] = useState(false);
  if (!ready) return null;
  if (!r) return <div className="stack">{back(links.routines, 'Fichas')}<EmptyState title="Ficha não encontrada" text="Ela pode ter sido excluída." /></div>;
  const status = routineStatusOn(r, today, today, sessions);
  const start = async () => {
    setBusy(true);
    const sid = await startRoutineSession(r.id, today);
    setBusy(false);
    if (sid) navigate(links.session(sid));
  };
  return (
    <div className="stack">
      {back(links.routines, 'Fichas')}
      <ScreenHeader title={r.name} subtitle={summary(r)} />
      {r.notes ? <p className="muted">{r.notes}</p> : null}
      {r.exercises.length === 0 ? (
        <EmptyState title="Ficha sem exercícios" text="Edite a ficha para adicionar exercícios." />
      ) : (
        <div className="list">
          {r.exercises.map((e) => (
            <div key={e.id} className="ex-row">
              <RoutineExThumb e={e} />
              <span className="ex-row__body"><span className="ex-row__title">{e.name}</span><span className="ex-row__sub" style={{ display: 'block' }}>{exSub(e)}</span></span>
              {e.catalogId ? <a className="icon-btn" aria-label={`Detalhes de ${e.name}`} href={links.libraryExercise(e.catalogId)}><Icon name="info" size={18} /></a> : null}
            </div>
          ))}
        </div>
      )}
      <div className="btn-col">
        <button type="button" className="btn btn--primary" disabled={busy || r.exercises.length === 0} onClick={() => void start()} data-testid="start-routine">
          {status === 'in-progress' ? 'Continuar treino' : 'Iniciar treino'}
        </button>
        <a className="btn btn--outline" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }} href={links.routineEdit(r.id)}>Editar ficha</a>
      </div>
    </div>
  );
}

export function RoutineEditorScreen({ id }: { id: string }) {
  const { routines, saveRoutine, ready } = useData();
  const toast = useToast();
  const existing = id === 'novo' ? undefined : routines.find((r) => r.id === id);
  const [draft, setDraft] = useState<Routine | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [formEx, setFormEx] = useState<RoutineExercise | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const current = useMemo(() => draft ?? existing ?? (ready ? newRoutine('', routines.length, new Date().toISOString()) : null), [draft, existing, ready, routines.length]);
  if (!ready || !current) return null;
  if (id !== 'novo' && !existing && !draft) return <div className="stack">{back(links.routines, 'Fichas')}<EmptyState title="Ficha não encontrada" text="Ela pode ter sido excluída." /></div>;
  const set = (patch: Partial<Routine>) => setDraft({ ...current, ...patch });

  const openForm = (ex: RoutineExercise, editing: string | null) => {
    setFormEx(ex);
    setEditingId(editing);
    setPickerOpen(false);
    setFormOpen(true);
  };
  const onSaveExercise = (ex: RoutineExercise) => {
    const list = editingId ? current.exercises.map((e) => (e.id === editingId ? ex : e)) : [...current.exercises, ex];
    set({ exercises: list.slice(0, LIMITS.exercises) });
    setFormOpen(false);
  };
  const move = (i: number, to: number) => {
    if (to < 0 || to >= current.exercises.length) return;
    set({ exercises: moveItem(current.exercises, i, to) });
  };
  const save = async () => {
    if (!current.name.trim()) {
      setError('Dê um nome à ficha.');
      return;
    }
    await saveRoutine({ ...current, name: current.name.trim(), updatedAt: new Date().toISOString() });
    toast.show('Ficha salva');
    navigate(links.routine(current.id));
  };

  return (
    <div className="stack">
      {back(existing ? links.routine(existing.id) : links.routines, existing ? 'Ficha' : 'Fichas')}
      <ScreenHeader title={existing ? 'Editar ficha' : 'Nova ficha'} />
      <Section id="r-info" title="Dados da ficha">
        <div className="stack">
          <label className="field"><span className="field__label">Nome</span><input className="input" value={current.name} maxLength={LIMITS.name} placeholder="Ex.: Treino A – Peito e tríceps" onChange={(e) => set({ name: e.target.value })} /></label>
          <label className="field"><span className="field__label">Foco ou músculo principal (opcional)</span><input className="input" value={current.focus} maxLength={LIMITS.focus} onChange={(e) => set({ focus: e.target.value })} /></label>
          <div className="field">
            <span className="field__label" id="wd-label">Dias da semana (opcional)</span>
            <div className="wd-chips" role="group" aria-labelledby="wd-label">
              {WEEKDAY_SHORT.map((w, d) => {
                const on = current.weekdays.includes(d);
                return <button key={w} type="button" className={`chip${on ? ' chip--selected' : ''}`} aria-pressed={on} onClick={() => set({ weekdays: on ? current.weekdays.filter((x) => x !== d) : [...current.weekdays, d].sort() })}>{w}</button>;
              })}
            </div>
          </div>
          <label className="field"><span className="field__label">Observações (opcional)</span><textarea className="input textarea" maxLength={LIMITS.notes} value={current.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} /></label>
        </div>
      </Section>
      <Section id="r-ex" title={`Exercícios (${current.exercises.length})`}>
        <div className="stack">
          {current.exercises.length === 0 ? <p className="muted">Adicione exercícios da biblioteca ou crie os seus.</p> : null}
          {current.exercises.map((e, i) => (
            <div key={e.id} className="ex-row" data-testid="routine-ex">
              <RoutineExThumb e={e} />
              <button type="button" className="ex-row__body" style={{ textAlign: 'left', background: 'none', border: 0, font: 'inherit', color: 'inherit', padding: 0 }} onClick={() => openForm(e, e.id)} aria-label={`Editar ${e.name}`}>
                <span className="ex-row__title">{e.name}</span>
                <span className="ex-row__sub" style={{ display: 'block' }}>{exSub(e)}</span>
              </button>
              <span className="ex-row__actions">
                <button type="button" className="icon-btn" aria-label={`Subir ${e.name}`} disabled={i === 0} onClick={() => move(i, i - 1)}><Icon name="arrow-up" size={18} /></button>
                <button type="button" className="icon-btn" aria-label={`Descer ${e.name}`} disabled={i === current.exercises.length - 1} onClick={() => move(i, i + 1)}><Icon name="arrow-down" size={18} /></button>
                <button type="button" className="icon-btn" aria-label={`Remover ${e.name}`} onClick={() => set({ exercises: current.exercises.filter((x) => x.id !== e.id) })}><Icon name="trash" size={18} /></button>
              </span>
            </div>
          ))}
          <button type="button" className="btn btn--soft" onClick={() => setPickerOpen(true)} data-testid="add-exercise"><Icon name="plus" size={16} /> Adicionar exercício</button>
        </div>
      </Section>
      {error ? <p role="alert" className="muted" style={{ color: 'var(--bad)' }}>{error}</p> : null}
      <div className="btn-col">
        <button type="button" className="btn btn--primary" onClick={() => void save()} data-testid="save-routine">Salvar ficha</button>
        <a className="btn btn--outline" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }} href={existing ? links.routine(existing.id) : links.routines}>Cancelar</a>
      </div>
      <ExercisePickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPickCatalog={(c) => openForm(exerciseFromCatalog(c), null)}
        onPickCustom={(c) => openForm({ ...manualExercise(c.name, c.muscles, c.kind), customId: c.id, imageId: c.imageId, instructions: c.instructions }, null)}
        onManual={() => openForm(manualExercise(''), null)}
      />
      <ExerciseFormSheet key={`${formEx?.id ?? 'none'}-${editingId ?? 'new'}`} open={formOpen} initial={formEx} onClose={() => setFormOpen(false)} onSave={onSaveExercise} />
    </div>
  );
}

/** Semana de segunda a domingo: atribuir, mover e copiar fichas entre dias; vários treinos no mesmo dia. */
export function RoutineWeekScreen() {
  const { routines, saveRoutine, today, sessions, startRoutineSession } = useData();
  const toast = useToast();
  const [addFor, setAddFor] = useState<number | null>(null);
  const [moveFor, setMoveFor] = useState<{ r: Routine; from: number; mode: 'move' | 'copy' } | null>(null);
  const todayWd = weekdayMon(today);
  const monday = addDays(today, -todayWd);

  const apply = async (r: Routine) => saveRoutine({ ...r, updatedAt: new Date().toISOString() });
  const nowIso = () => new Date().toISOString();

  return (
    <div className="stack">
      {back(links.workout, 'Treino')}
      <ScreenHeader title="Minha semana" subtitle="Fichas por dia, de segunda a domingo" />
      {routines.length === 0 ? <EmptyState title="Sem fichas" text="Cadastre uma ficha para distribuir pela semana." /> : null}
      <div className="weekgrid">
        {WEEKDAY_NAMES.map((name, wd) => {
          const date = addDays(monday, wd);
          const list = routines.filter((r) => r.weekdays.includes(wd));
          return (
            <section key={name} className={`weekday${wd === todayWd ? ' weekday--today' : ''}`} data-testid={`wd-${wd}`} aria-label={name}>
              <div className="weekday__head">
                <span>{name} <span className="muted">· {shortDate(date)}</span></span>
                <button type="button" className="btn btn--outline btn--small" disabled={routines.length === 0} aria-label={`Adicionar ficha na ${name}`} onClick={() => setAddFor(wd)}>+ Ficha</button>
              </div>
              {list.length === 0 ? <p className="weekday__rest">Descanso</p> : null}
              {list.map((r) => {
                const st = routineStatusOn(r, date, today, sessions);
                return (
                  <div key={r.id} className="weekday__item">
                    <a className="ex-row__body" style={{ textDecoration: 'none', color: 'inherit' }} href={links.routine(r.id)}>
                      <span className="ex-row__title">{r.name}</span>
                      <span className="ex-row__sub" style={{ display: 'block' }}>{ROUTINE_STATUS_LABELS[st]} · {r.exercises.length} exerc.</span>
                    </a>
                    <span className="ex-row__actions">
                      {wd === todayWd && st !== 'done' ? <button type="button" className="icon-btn" aria-label={`Iniciar ${r.name}`} onClick={async () => { const sid = await startRoutineSession(r.id, date); if (sid) navigate(links.session(sid)); }}><Icon name="play" size={18} /></button> : null}
                      <button type="button" className="icon-btn" aria-label={`Mover ${r.name}`} onClick={() => setMoveFor({ r, from: wd, mode: 'move' })}><Icon name="repeat" size={18} /></button>
                      <button type="button" className="icon-btn" aria-label={`Copiar ${r.name} para outro dia`} onClick={() => setMoveFor({ r, from: wd, mode: 'copy' })}><Icon name="copy" size={18} /></button>
                      <button type="button" className="icon-btn" aria-label={`Tirar ${r.name} da ${name}`} onClick={async () => { await apply(unassignDay(r, wd, nowIso())); toast.show('Dia liberado'); }}><Icon name="x" size={18} /></button>
                    </span>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
      <p className="muted">A semana se repete toda semana. Mais de uma ficha no mesmo dia vale como um único dia ativo na sua consistência, e cada treino fica separado no histórico.</p>

      <BottomSheet open={addFor !== null} title={addFor !== null ? `Adicionar na ${WEEKDAY_NAMES[addFor]}` : ''} onClose={() => setAddFor(null)}>
        <div className="list">
          {routines.map((r) => (
            <button key={r.id} type="button" className="row-link" disabled={addFor !== null && r.weekdays.includes(addFor)} onClick={async () => { if (addFor !== null) { await apply(assignDay(r, addFor, nowIso())); } setAddFor(null); }}>
              <span className="row-link__body"><span className="row-link__title">{r.name}</span><span className="row-link__sub" style={{ display: 'block' }}>{addFor !== null && r.weekdays.includes(addFor) ? 'Já está neste dia' : summary(r)}</span></span>
            </button>
          ))}
        </div>
      </BottomSheet>
      <BottomSheet open={!!moveFor} title={moveFor?.mode === 'copy' ? 'Copiar para qual dia?' : 'Mover para qual dia?'} onClose={() => setMoveFor(null)}>
        <div className="list">
          {WEEKDAY_NAMES.map((n, d) => (
            <button key={n} type="button" className="row-link" disabled={!moveFor || d === moveFor.from || moveFor.r.weekdays.includes(d)} onClick={async () => { if (!moveFor) return; await apply(moveFor.mode === 'copy' ? copyToDay(moveFor.r, d, nowIso()) : moveToDay(moveFor.r, moveFor.from, d, nowIso())); setMoveFor(null); toast.show(moveFor.mode === 'copy' ? 'Ficha copiada' : 'Ficha movida'); }}>
              <span className="row-link__body"><span className="row-link__title">{n}</span></span>
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
