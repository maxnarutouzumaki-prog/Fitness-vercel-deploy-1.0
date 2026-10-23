import { useMemo, useState } from 'react';
import { Calendar } from '../components/Calendar';
import { Icon } from '../components/Icon';
import { MANUAL_ACTIVITY_LABELS } from '../domain/checkins';
import { formatLongDate, formatTime, formatMinutes } from '../domain/dates';
import { links } from '../router';
import { useData } from '../state/DataContext';

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

export function Consistency() {
  const { checkins, streaks, today } = useData();
  const [selected, setSelected] = useState<string | null>(null);
  const active = useMemo(() => new Set(checkins.map((c) => c.date)), [checkins]);
  const byDate = useMemo(() => new Map(checkins.map((c) => [c.date, c])), [checkins]);
  const recent = useMemo(() => [...checkins].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5), [checkins]);
  const sel = selected ? byDate.get(selected) : undefined;

  return (
    <div className="stack">
      <div className="grid-3">
        <div className="stat"><span className="stat__value" data-testid="streak-current">{streaks.current}</span><span className="stat__label">{plural(streaks.current, 'dia seguido', 'dias seguidos')}</span></div>
        <div className="stat"><span className="stat__value" data-testid="streak-best">{streaks.best}</span><span className="stat__label">recorde</span></div>
        <div className="stat"><span className="stat__value" data-testid="streak-total">{streaks.total}</span><span className="stat__label">dias ativos</span></div>
      </div>
      {streaks.atRisk ? <p className="muted">Sua sequência continua se você fizer o check-in hoje.</p> : null}
      {streaks.total === 0 ? <p className="muted">Ainda não há dias ativos. Conclua um treino ou faça um check-in manual para começar. Nada é registrado retroativamente.</p> : null}

      <Calendar today={today} active={active} selected={selected} onSelect={setSelected} />

      {selected ? (
        <div className="day-detail" role="status" data-testid="day-detail">
          <strong>{formatLongDate(selected)}</strong>
          {sel ? (
            sel.sources.map((s) =>
              s.kind === 'workout' ? (
                <a key={s.sessionId} href={links.session(s.sessionId)} className="small">Treino concluído: {s.title} · {formatTime(s.at)}</a>
              ) : (
                <span key={s.id} className="small">Manual: {MANUAL_ACTIVITY_LABELS[s.activity]}{s.minutes ? ` · ${formatMinutes(s.minutes)}` : ''}{s.note ? ` · ${s.note}` : ''}</span>
              ),
            )
          ) : (
            <span className="muted">{selected > today ? 'Dia ainda não chegou.' : 'Sem atividade registrada neste dia.'}</span>
          )}
        </div>
      ) : null}

      {recent.length > 0 ? (
        <div className="stack" style={{ gap: 8 }}>
          <h3 className="h3">Atividade recente</h3>
          {recent.map((c) => (
            <button key={c.id} type="button" className="row-link" onClick={() => setSelected(c.date)}>
              <Icon name="check-circle" size={20} />
              <span className="row-link__body">
                <span className="row-link__title">{formatLongDate(c.date)}</span>
                <span className="row-link__sub" style={{ display: 'block' }}>{c.sources.map((s) => (s.kind === 'workout' ? s.title : MANUAL_ACTIVITY_LABELS[s.activity])).join(' · ')}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
