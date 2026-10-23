import { useEffect, useMemo, useState } from 'react';
import { BottomSheet } from '../components/BottomSheet';
import { Icon } from '../components/Icon';
import { ExerciseThumb, refFromKey } from '../components/ExerciseThumb';
import { NumberField } from '../components/NumberField';
import { kindForKey, repsUnitLabel } from '../domain/catalog';
import { EmptyState } from '../components/ui';
import { formatDuration, formatLongDate, formatMinutes } from '../domain/dates';
import { formatKg } from '../domain/format';
import { lastPerformance, progressionHint } from '../domain/progression';
import { elapsedMs, encouragement, hasProgress, isFullyDone, isRunning, pauseSession, resumeSession, sessionStats } from '../domain/session';
import { DIFFICULTY_LABELS, SESSION_STATUS_LABELS } from '../domain/training';
import type { Difficulty, LoggedExercise, WorkoutSession } from '../domain/training';
import { MUSCLE_LABELS } from '../domain/types';
import { links, navigate } from '../router';
import type { FinishResult } from '../state/DataContext';
import { useData } from '../state/DataContext';
import { useNow } from '../state/useNow';

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

export function SessionSummary({ session, result }: { session: WorkoutSession; result?: FinishResult | null }) {
  const st = sessionStats(session);
  const completed = session.status === 'completed';
  return (
    <div className="stack">
      <a className="back-link" href={links.workout}>
        <Icon name="chevron-left" size={18} /> Treino
      </a>
      <section className="panel stack">
        <div className="summary-hero">
          <span className="summary-hero__icon">
            <Icon name={completed ? 'check-circle' : 'clock'} size={34} />
          </span>
          <h1 className="screen-title">{completed ? 'Treino concluído' : SESSION_STATUS_LABELS[session.status]}</h1>
          <p className="muted">{session.title} · {formatLongDate(session.date)}</p>
        </div>
        <div className="grid-3">
          <div className="stat"><span className="stat__value">{formatMinutes(Math.round(session.activeMs / 60000))}</span><span className="stat__label">duração</span></div>
          <div className="stat"><span className="stat__value">{st.exercisesWithProgress}/{st.totalExercises}</span><span className="stat__label">exercícios</span></div>
          <div className="stat"><span className="stat__value">{st.doneSets}/{st.totalSets}</span><span className="stat__label">séries</span></div>
        </div>
        {session.cardio ? (
          <p className="kv"><span>Cardio ({session.cardio.modality})</span><span>{session.cardio.completed ? `${session.cardio.minutes ?? 0} min` : 'não feito'}</span></p>
        ) : null}
        {completed ? <p>{encouragement(session.id)}</p> : <p className="muted">Treino parcial salvo no histórico. Ele não conta como dia ativo; o check-in vem só de treinos concluídos.</p>}
        {result?.checkin && completed ? (
          <div className="banner" role="status">
            <Icon name="flame" size={20} />
            <span>
              Check-in de hoje registrado. Sequência atual: <strong>{result.streaks.current}</strong> {plural(result.streaks.current, 'dia', 'dias')}.
            </span>
          </div>
        ) : null}
      </section>
      <section className="panel stack">
        <h2 className="h3">Exercícios</h2>
        {session.exercises.map((ex) => (
          <div key={ex.planExerciseId}>
            <div className="ex__name" style={{ fontSize: 16 }}>{ex.name}</div>
            <div className="ex__meta">
              {ex.sets.filter((s) => s.completed).map((s) => `${s.reps ?? '–'}×${formatKg(s.loadKg)}`).join(' · ') || 'sem séries marcadas'}
            </div>
            {ex.difficulty ? <div className="ex__meta">Esforço: {DIFFICULTY_LABELS[ex.difficulty]}</div> : null}
            {ex.discomfort?.present ? <div className="ex__meta">Desconforto relatado{ex.discomfort.note ? `: ${ex.discomfort.note}` : ''}</div> : null}
            {ex.notes ? <div className="ex__meta">Nota: {ex.notes}</div> : null}
          </div>
        ))}
        {session.notes ? <p className="muted">Anotações: {session.notes}</p> : null}
      </section>
      <a className="btn btn--primary" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }} href={links.home}>
        Voltar ao início
      </a>
    </div>
  );
}

export function SessionScreen({ id }: { id: string }) {
  const { sessions, updateSession, finishSession, abandonSession, sessions: all, ready, customExercises } = useData();
  const session = sessions.find((s) => s.id === id);
  const [result, setResult] = useState<FinishResult | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [subIdx, setSubIdx] = useState<number | null>(null);
  const [rest, setRest] = useState<{ until: number; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const running = !!session && session.status === 'in-progress' && isRunning(session);
  const now = useNow(1000, !!session && session.status === 'in-progress' && (running || !!rest));
  const restLeft = rest ? Math.max(0, Math.ceil((rest.until - now) / 1000)) : 0;

  useEffect(() => {
    if (rest && now >= rest.until) {
      const t = setTimeout(() => setRest(null), 4000);
      return () => clearTimeout(t);
    }
  }, [now, rest]);

  const history = useMemo(() => all.filter((s) => s.id !== id), [all, id]);

  if (!ready) return null;
  if (!session) return <div className="stack"><a className="back-link" href={links.workout}><Icon name="chevron-left" size={18} /> Treino</a><EmptyState title="Treino não encontrado" text="Esta sessão não existe mais neste aparelho." /></div>;
  if (session.status !== 'in-progress') return <SessionSummary session={session} result={result} />;

  const patch = (next: WorkoutSession) => updateSession(next);
  const patchEx = (i: number, fn: (e: LoggedExercise) => LoggedExercise) =>
    patch({ ...session, exercises: session.exercises.map((e, k) => (k === i ? fn(e) : e)) });

  const elapsed = elapsedMs(session, now || Date.now());
  const stats = sessionStats(session);
  const fully = isFullyDone(session);
  const progress = hasProgress(session);

  const togglePause = () => patch(running ? pauseSession(session, Date.now()) : resumeSession(session, Date.now()));

  const finish = async (status: 'completed' | 'partial') => {
    setBusy(true);
    const r = await finishSession(session.id, status);
    setBusy(false);
    setFinishOpen(false);
    if (r) setResult(r);
  };

  const abandon = async () => {
    setBusy(true);
    await abandonSession(session.id);
    navigate(links.workout);
  };

  const subEx = subIdx !== null ? session.exercises[subIdx] : null;
  const doSub = (altKey: string) => {
    if (subIdx === null) return;
    patchEx(subIdx, (e) => {
      const alt = e.alternatives.find((a) => a.key === altKey);
      if (!alt) return e;
      const original = { key: e.key, name: e.name, muscles: e.muscles, instructions: e.instructions };
      return {
        ...e,
        key: alt.key,
        name: alt.name,
        muscles: alt.muscles.length > 0 ? alt.muscles : e.muscles,
        instructions: alt.instructions ?? alt.note ?? e.instructions,
        alternatives: [original, ...e.alternatives.filter((a) => a.key !== altKey)].slice(0, 4),
        substitutedFrom: e.substitutedFrom ?? e.name,
      };
    });
    setSubIdx(null);
  };

  return (
    <div className="stack">
      <div className="session-bar">
        <div>
          <div className={`timer${running ? '' : ' timer--paused'}`} role="timer" aria-label="Tempo de treino">{formatDuration(Math.floor(elapsed / 1000))}</div>
          <div className="muted">{session.title} · {stats.doneSets}/{stats.totalSets} séries{running ? '' : ' · pausado'}</div>
        </div>
        <button type="button" className="btn btn--soft btn--small" onClick={togglePause}>
          <Icon name={running ? 'pause' : 'play'} size={16} /> {running ? 'Pausar' : 'Retomar'}
        </button>
      </div>

      {rest ? (
        <div className="rest-timer" role="status">
          <span>{restLeft > 0 ? `Descanso: ${restLeft}s` : 'Descanso terminou. Próxima série!'}</span>
          <button type="button" className="btn btn--small btn--outline" onClick={() => setRest(null)}>Pular</button>
        </div>
      ) : null}

      {session.exercises.map((ex, i) => {
        const done = ex.sets.length > 0 && ex.sets.every((s) => s.completed);
        const lastPerf = lastPerformance(ex.key, history);
        const hint = progressionHint(ex.targetReps, lastPerf);
        const kind = kindForKey(ex.key, customExercises);
        const strength = kind === 'strength';
        const unitLabel = repsUnitLabel(kind, ex.targetReps);
        return (
          <section key={ex.planExerciseId} className={`panel ex${done ? ' ex--done' : ''}`} aria-label={ex.name}>
            <div className="ex__head">
              <ExerciseThumb item={refFromKey(ex.key, ex.name, customExercises)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ex__name">{ex.name}</div>
                <div className="ex__meta">{ex.targetSets} × {ex.targetReps} · descanso {ex.restSeconds}s · {ex.muscles.map((m) => MUSCLE_LABELS[m]).join(', ')}</div>
              </div>
              {ex.alternatives.length > 0 ? <button type="button" className="icon-btn" aria-label={`Trocar ${ex.name}`} onClick={() => setSubIdx(i)}><Icon name="repeat" size={18} /></button> : null}
            </div>
            {hint ? <p className={`hint${hint.kind === 'careful' ? ' hint--careful' : ''}`}>{hint.text}</p> : null}
            <details className="details"><summary>Como executar</summary><p className="muted">{ex.instructions}</p></details>
            {lastPerf ? <p className="muted" data-testid="last-perf">Última vez: {lastPerf.sets.map((x) => `${x.reps ?? '–'}${strength ? ` × ${formatKg(x.loadKg)}` : ''}`).join(' · ')}</p> : null}
            <div className="set__labels" aria-hidden="true"><span>#</span><span>{unitLabel}</span><span>{strength ? 'Carga (kg)' : ''}</span><span>Feita</span></div>
            {ex.sets.map((s, k) => (
              <div className="set" key={k}>
                <span className="set__n">{k + 1}</span>
                <NumberField label={`${unitLabel} da série ${k + 1} de ${ex.name}`} value={s.reps} max={999} onCommit={(v) => patchEx(i, (e) => ({ ...e, sets: e.sets.map((x, j) => (j === k ? { ...x, reps: v } : x)) }))} />
                {strength ? <NumberField label={`Carga em kg da série ${k + 1} de ${ex.name}`} value={s.loadKg} inputMode="decimal" max={999} onCommit={(v) => patchEx(i, (e) => ({ ...e, sets: e.sets.map((x, j) => (j === k ? { ...x, loadKg: v } : x)) }))} /> : <span />}
                <button
                  type="button"
                  className="set__ok"
                  aria-pressed={s.completed}
                  aria-label={`Série ${k + 1} de ${ex.name} ${s.completed ? 'feita' : 'não feita'}`}
                  onClick={() => {
                    const completed = !s.completed;
                    patchEx(i, (e) => ({ ...e, sets: e.sets.map((x, j) => (j === k ? { ...x, completed } : x)) }));
                    if (completed && ex.restSeconds > 0 && k < ex.sets.length - 1) setRest({ until: Date.now() + ex.restSeconds * 1000, label: ex.name });
                  }}
                >
                  <Icon name="check" size={20} strokeWidth={2.6} />
                </button>
              </div>
            ))}
            <div className="btn-row">
              <button type="button" className="btn btn--outline btn--small" onClick={() => patchEx(i, (e) => ({ ...e, sets: [...e.sets, { completed: false, reps: e.sets[e.sets.length - 1]?.reps, loadKg: e.sets[e.sets.length - 1]?.loadKg }] }))}>+ série</button>
              {ex.sets.length > 1 ? <button type="button" className="btn btn--outline btn--small" onClick={() => patchEx(i, (e) => ({ ...e, sets: e.sets.slice(0, -1) }))}>− série</button> : null}
            </div>
            <details className="details">
              <summary>Esforço, desconforto e notas</summary>
              <div className="stack" style={{ gap: 10 }}>
                <div className="diff" role="radiogroup" aria-label="Quão difícil foi?">
                  {([1, 2, 3, 4, 5] as Difficulty[]).map((d) => (
                    <button key={d} type="button" role="radio" aria-checked={ex.difficulty === d} className={`chip${ex.difficulty === d ? ' chip--selected' : ''}`} onClick={() => patchEx(i, (e) => ({ ...e, difficulty: e.difficulty === d ? undefined : d }))}>{DIFFICULTY_LABELS[d]}</button>
                  ))}
                </div>
                <label className="checkrow">
                  <input type="checkbox" checked={!!ex.discomfort?.present} onChange={(ev) => patchEx(i, (e) => ({ ...e, discomfort: { present: ev.target.checked, note: e.discomfort?.note } }))} />
                  <span>Senti dor ou desconforto neste exercício</span>
                </label>
                {ex.discomfort?.present ? (
                  <>
                    <div className="banner banner--warn" role="note"><Icon name="alert" size={18} /><span>Não force a dor. Pare, troque o exercício (botão ↻) e, se persistir ou for forte, procure um profissional de saúde.</span></div>
                    <input className="input" placeholder="Onde e como foi? (opcional)" maxLength={200} value={ex.discomfort.note ?? ''} onChange={(ev) => patchEx(i, (e) => ({ ...e, discomfort: { present: true, note: ev.target.value } }))} />
                  </>
                ) : null}
                <input className="input" placeholder="Nota (opcional)" maxLength={300} value={ex.notes ?? ''} onChange={(ev) => patchEx(i, (e) => ({ ...e, notes: ev.target.value }))} />
              </div>
            </details>
          </section>
        );
      })}

      {session.cardio ? (
        <section className="panel stack" aria-label="Cardio">
          <div className="ex__name">Cardio: {session.cardio.modality}</div>
          <div className="ex__meta">Previsto: {session.cardio.plannedMinutes} min</div>
          <div className="set" style={{ gridTemplateColumns: '1fr 48px' }}>
            <NumberField label="Minutos de cardio feitos" value={session.cardio.minutes} max={600} placeholder="minutos" onCommit={(v) => patch({ ...session, cardio: { ...session.cardio!, minutes: v } })} />
            <button type="button" className="set__ok" aria-pressed={session.cardio.completed} aria-label={`Cardio ${session.cardio.completed ? 'feito' : 'não feito'}`} onClick={() => patch({ ...session, cardio: { ...session.cardio!, completed: !session.cardio!.completed } })}>
              <Icon name="check" size={20} strokeWidth={2.6} />
            </button>
          </div>
        </section>
      ) : null}

      <label className="field">
        <span className="field__label">Anotações do treino (opcional)</span>
        <textarea className="input textarea" maxLength={500} value={session.notes ?? ''} onChange={(e) => patch({ ...session, notes: e.target.value })} />
      </label>

      <div className="btn-col">
        <button type="button" className="btn btn--primary" onClick={() => setFinishOpen(true)}>Finalizar treino</button>
        <button type="button" className="btn btn--danger" onClick={() => setAbandonOpen(true)}>Abandonar treino</button>
      </div>

      <BottomSheet open={finishOpen} title="Finalizar treino?" onClose={() => setFinishOpen(false)}>
        <p className="muted">
          {stats.doneSets}/{stats.totalSets} séries marcadas{session.cardio ? ` · cardio ${session.cardio.completed ? 'feito' : 'não feito'}` : ''}.
          {' '}Só treinos <strong>concluídos</strong> geram o check-in do dia.
        </p>
        {!progress ? <p className="banner banner--warn">Marque ao menos uma série para salvar este treino.</p> : null}
        <div className="btn-col">
          <button type="button" className="btn btn--primary" disabled={busy || !progress} onClick={() => void finish('completed')}>
            {fully ? 'Concluir treino' : 'Concluir mesmo assim'}
          </button>
          {!fully ? <button type="button" className="btn btn--soft" disabled={busy || !progress} onClick={() => void finish('partial')}>Salvar como parcial</button> : null}
          <button type="button" className="btn btn--outline" onClick={() => setFinishOpen(false)}>Continuar treinando</button>
        </div>
      </BottomSheet>

      <BottomSheet open={abandonOpen} title="Abandonar treino?" onClose={() => setAbandonOpen(false)}>
        <p className="muted">O treino não será concluído e não gera check-in. {progress ? 'As séries marcadas ficam no histórico como “Abandonado”.' : 'Como nada foi marcado, nada será guardado.'}</p>
        <div className="btn-col">
          <button type="button" className="btn btn--danger" disabled={busy} onClick={() => void abandon()}>Abandonar</button>
          <button type="button" className="btn btn--outline" onClick={() => setAbandonOpen(false)}>Voltar ao treino</button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!subEx} title="Trocar exercício" onClose={() => setSubIdx(null)}>
        <div className="list">
          {subEx?.alternatives.map((a) => (
            <button key={a.key} type="button" className="row-link" onClick={() => doSub(a.key)}>
              <span className="row-link__body"><span className="row-link__title">{a.name}</span><span className="row-link__sub" style={{ display: 'block' }}>{a.note ?? a.instructions ?? ''}</span></span>
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
