import { useState } from 'react';
import { Icon } from './Icon';
import { MONTH_NAMES, WEEKDAY_SHORT, monthGrid, parseISODate, shiftMonth } from '../domain/dates';
import type { ISODate } from '../domain/types';

interface CalendarProps {
  today: ISODate;
  active: ReadonlySet<ISODate>;
  selected: ISODate | null;
  onSelect: (date: ISODate) => void;
}

const HEAD = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Calendário mensal navegável (domingo primeiro). Dias com check-in usam a cor do tema. */
export function Calendar({ today, active, selected, onSelect }: CalendarProps) {
  const t = parseISODate(today);
  const [view, setView] = useState({ year: t.y, month: t.m });
  const weeks = monthGrid(view.year, view.month);
  const name = MONTH_NAMES[view.month - 1];
  const go = (delta: number) => setView((v) => shiftMonth(v.year, v.month, delta));

  return (
    <div className="cal">
      <div className="cal__head">
        <button type="button" className="icon-btn" aria-label="Mês anterior" onClick={() => go(-1)}>
          <Icon name="chevron-left" size={20} />
        </button>
        <span className="cal__title" aria-live="polite">{name} de {view.year}</span>
        <button type="button" className="icon-btn" aria-label="Próximo mês" onClick={() => go(1)}>
          <Icon name="chevron-right" size={20} />
        </button>
      </div>
      <div className="cal__grid" aria-hidden="true">
        {HEAD.map((h, i) => (
          <span key={i} className="cal__wd">{h}</span>
        ))}
      </div>
      <div className="cal__grid" role="grid" aria-label={`${name} de ${view.year}`}>
        {weeks.flat().map((date, i) => {
          if (!date) return <span key={`e${i}`} className="cal__cell cal__cell--empty" />;
          const isActive = active.has(date);
          const cls = ['cal__cell', isActive ? 'cal__cell--active' : '', date === today ? 'cal__cell--today' : '', date > today ? 'cal__cell--future' : '', date === selected ? 'cal__cell--selected' : '']
            .filter(Boolean)
            .join(' ');
          return (
            <button key={date} type="button" className={cls} data-date={date} data-active={isActive ? '1' : '0'} aria-pressed={date === selected} aria-label={`${parseISODate(date).d} de ${name}${isActive ? ', com atividade' : ''}`} onClick={() => onSelect(date)}>
              {parseISODate(date).d}
            </button>
          );
        })}
      </div>
      <div className="legend"><span><span className="legend__dot" />Dia ativo</span></div>
    </div>
  );
}
export { WEEKDAY_SHORT };
