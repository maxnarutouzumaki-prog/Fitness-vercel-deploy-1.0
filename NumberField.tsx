import { useEffect, useState } from 'react';

interface NumberFieldProps {
  value: number | undefined;
  onCommit: (value: number | undefined) => void;
  label: string;
  inputMode?: 'numeric' | 'decimal';
  min?: number;
  max?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Campo numérico para celular: aceita vírgula ou ponto, não perde o ponto enquanto se digita
 * e só confirma valores válidos.
 */
export function NumberField({
  value,
  onCommit,
  label,
  inputMode = 'numeric',
  min = 0,
  max = 9999,
  placeholder,
  disabled,
  className,
}: NumberFieldProps) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(value === undefined ? '' : String(value).replace('.', ','));
  }, [value, focused]);

  const handle = (raw: string) => {
    const cleaned = raw.replace(/[^\d.,]/g, '');
    setText(cleaned);
    if (cleaned === '') {
      onCommit(undefined);
      return;
    }
    const n = Number(cleaned.replace(',', '.'));
    if (Number.isFinite(n) && n >= min && n <= max) onCommit(inputMode === 'numeric' ? Math.round(n) : Math.round(n * 100) / 100);
  };

  return (
    <input
      className={`input input--small ${className ?? ''}`}
      type="text"
      inputMode={inputMode}
      aria-label={label}
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(event) => handle(event.target.value)}
    />
  );
}
