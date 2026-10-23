import { Icon } from './Icon';

interface ChoiceProps<T extends string | number> {
  label: string;
  hint?: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

/** Escolha única em botões (bom para o dedo). */
export function Choice<T extends string | number>({ label, hint, value, options, onChange }: ChoiceProps<T>) {
  const id = `ch-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="field">
      <span className="field__label" id={id}>
        {label}
      </span>
      <div className="chips" role="radiogroup" aria-labelledby={id}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className={`chip${o.value === value ? ' chip--selected' : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  );
}

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
  onChange: (value: number) => void;
}

export function StepperField({ label, value, min, max, step = 1, unit, hint, onChange }: StepperProps) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="stepper">
        <button type="button" aria-label={`Diminuir ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
          <Icon name="minus" size={20} />
        </button>
        <span className="stepper__value" aria-live="polite">
          {value}
          {unit ? ` ${unit}` : ''}
        </span>
        <button type="button" aria-label={`Aumentar ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
          <Icon name="plus" size={20} />
        </button>
      </div>
      {hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  );
}
