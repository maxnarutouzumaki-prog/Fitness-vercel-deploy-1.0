import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';

interface CardProps {
  id: string;
  title: string;
  subtitle?: string;
  icon: IconName;
  /** Lado da borda lateral na cor do tema (alterna entre os cartões). */
  side: 'left' | 'right';
  linkLabel?: string;
  linkHref?: string;
  children: ReactNode;
}

/** Cartão principal da tela Início. */
export function Card({ id, title, subtitle, icon, side, linkLabel, linkHref, children }: CardProps) {
  return (
    <section className={`card card--${side}`} aria-labelledby={`${id}-title`}>
      <header className="card__head">
        <span className="icon-badge">
          <Icon name={icon} size={24} />
        </span>
        <div className="card__titles">
          <h2 id={`${id}-title`} className="card__title">
            {title}
          </h2>
          {subtitle ? <p className="card__subtitle">{subtitle}</p> : null}
        </div>
      </header>
      {children}
      {linkLabel && linkHref ? (
        <a className="card__link" href={linkHref}>
          {linkLabel}
        </a>
      ) : null}
    </section>
  );
}

interface MetricProps {
  label: string;
  value?: string;
  /** Texto da variação (ex.: "−0,4 kg"). */
  delta?: string;
  tone?: 'favorable' | 'unfavorable' | 'neutral';
  direction?: 'up' | 'down';
}

export function Metric({ label, value, delta, tone = 'neutral', direction }: MetricProps) {
  const toneLabel =
    tone === 'favorable' ? 'variação favorável' : tone === 'unfavorable' ? 'variação desfavorável' : 'variação';
  return (
    <div className={`metric${value ? '' : ' metric--empty'}`}>
      <span className="metric__value">{value ?? '—'}</span>
      <span className="metric__label">{label}</span>
      {delta ? (
        <span className={`trend trend--${tone}`}>
          {direction ? <Icon name={direction === 'up' ? 'arrow-up' : 'arrow-down'} size={12} strokeWidth={2.4} /> : null}
          <span>{delta}</span>
          <span className="sr-only"> ({toneLabel})</span>
        </span>
      ) : null}
    </div>
  );
}
