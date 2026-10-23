import { useState } from 'react';
import { Icon } from '../components/Icon';
import { EmptyState } from '../components/ui';
import { MANUAL_ACTIVITY_LABELS } from '../domain/checkins';
import { formatLongDate, formatMinutes } from '../domain/dates';
import { formatKg } from '../domain/format';
import { sessionStats } from '../domain/session';
import { SESSION_STATUS_LABELS } from '../domain/training';
import { links } from '../router';
import { useData } from '../state/DataContext';

export function HistoryScreen() {
  const { sessions, checkins } = useData();
  const [open, setOpen] = useState<string | null>(null);
  const list = sessions.filter((s) => s.status !== 'in-progress').sort((a, b) => (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt));
  const manual = checkins
    .flatMap((c) => c.sources.filter((s) => s.kind === 'manual').map((s) => ({ date: c.date, s })))
    .sort((a, b) => b.date.localeCompare(a.date));
  const done = list.filter((s) => s.status === 'completed' || s.status === 'partial');

  return (
    <div className="stack">
      <div>
        <a className="back-link" href={links.workout}><Icon name="chevron-left" size={18} /> Treino</a>
        <h1 className="screen-title">Histórico</h1>
        <p className="screen-subtitle">Tudo fica salvo neste aparelho.</p>
      </div>
      {list.length === 0 && manual.length === 0 ? (
        <EmptyState title="Ainda não há treinos no histórico" text="Quando você concluir ou salvar um treino, ele aparece aqui, com séries, cargas e anotações." />
      ) : null}
      {list.length > 0 ? (
        <section className="panel stack" aria-label="Treinos">
          <h2 className="h3">Treinos ({list.length})</h2>
          {list.map((s) => {
            const st = sessionStats(s);
            const expanded = open === s.id;
            return (
              <div key={s.id} className="stack" style={{ gap: 6 }}>
                <button type="button" className="row-link" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : s.id)}>
                  <span className="row-link__body">
                    <span className="row-link__title">{s.title}</span>
                    <span className="row-link__sub" style={{ display: 'block' }}>{formatLongDate(s.date)} · {formatMinutes(Math.round(s.activeMs / 60000))} · {st.doneSets}/{st.totalSets} séries</span>
                  </span>
                  <span className={`pill${s.status === 'completed' ? ' pill--accent' : ''}`}>{SESSION_STATUS_LABELS[s.status]}</span>
                </button>
                {expanded ? (
                  <div className="day-detail">
                    {s.exercises.map((e) => (
                      <div key={e.planExerciseId}>
                        <strong>{e.name}</strong>
                        <div className="muted">{e.sets.filter((x) => x.completed).map((x) => `${x.reps ?? '–'}×${formatKg(x.loadKg)}`).join(' · ') || 'sem séries marcadas'}</div>
                        {e.notes ? <div className="muted">Nota: {e.notes}</div> : null}
                        {e.discomfort?.present ? <div className="muted">Desconforto relatado{e.discomfort.note ? `: ${e.discomfort.note}` : ''}</div> : null}
                      </div>
                    ))}
                    {s.cardio ? <div className="muted">Cardio ({s.cardio.modality}): {s.cardio.completed ? `${s.cardio.minutes ?? 0} min` : 'não feito'}</div> : null}
                    {s.notes ? <div className="muted">Anotações: {s.notes}</div> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      ) : null}
      {manual.length > 0 ? (
        <section className="panel stack" aria-label="Atividades manuais">
          <h2 className="h3">Atividades registradas manualmente</h2>
          {manual.map(({ date, s }) =>
            s.kind === 'manual' ? (
              <div key={s.id} className="kv">
                <span>{MANUAL_ACTIVITY_LABELS[s.activity]}{s.minutes ? ` · ${s.minutes} min` : ''}{s.note ? ` · ${s.note}` : ''}</span>
                <span className="muted">{formatLongDate(date)}</span>
              </div>
            ) : null,
          )}
        </section>
      ) : null}
      {done.length >= 2 ? null : list.length > 0 ? <p className="muted">Gráficos de evolução só aparecem quando há dados suficientes (a partir de 2 treinos).</p> : null}
    </div>
  );
}
