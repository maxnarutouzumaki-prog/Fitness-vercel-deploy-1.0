import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="screen-header">
      <div>
        <h1 className="screen-title">{title}</h1>
        {subtitle ? <p className="screen-subtitle">{subtitle}</p> : null}
      </div>
    </header>
  );
}

/** Bloco de seção com título pequeno e conteúdo em cartão. */
export function Section({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section className="section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="section__title">
        {title}
      </h2>
      <div className="panel">{children}</div>
    </section>
  );
}

/** Estado inicial: texto claro sobre o que acontece quando houver dados. */
export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      <p className="empty__text">{text}</p>
    </div>
  );
}

interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function Switch({ label, checked, onChange }: SwitchProps) {
  return (
    <div className="switch-row">
      <span id="switch-label" className="switch-row__label">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby="switch-label"
        className="switch"
        onClick={() => onChange(!checked)}
      >
        <span className="switch__thumb" />
      </button>
    </div>
  );
}

export function PrivacyNote({ children }: { children: ReactNode }) {
  return (
    <p className="note">
      <Icon name="lock" size={16} />
      <span>{children}</span>
    </p>
  );
}
