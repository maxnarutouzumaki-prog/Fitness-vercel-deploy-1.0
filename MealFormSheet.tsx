import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { Icon } from './Icon';
import { BALANCE_INTRO, MEAL_TYPES, MEAL_TYPE_LABELS, UNITS, buildMeal, defaultMealType, isValidTime, newFood, parseNumber, validateMeal } from '../domain/nutrition';
import type { FoodItem, MealType } from '../domain/nutrition';
import type { MealEntry } from '../domain/types';

export interface MealDraft {
  items: FoodItem[];
  source: MealEntry['source'];
  analysis?: MealEntry['analysis'];
  balance?: boolean;
  mealType?: MealType;
  corrected?: boolean;
  banner?: string;
}

interface Props {
  open: boolean;
  date: string;
  existing: MealEntry | null;
  draft: MealDraft | null;
  onClose: () => void;
  onSave: (meal: MealEntry) => Promise<void> | void;
}

const txt = (n: number | undefined) => (n === undefined ? '' : String(n).replace('.', ','));

function FoodEditor({ food, onChange, onRemove, index }: { food: FoodItem; onChange: (f: FoodItem) => void; onRemove: () => void; index: number }) {
  const num = (key: 'quantity' | 'kcal' | 'proteinG' | 'carbsG' | 'fatG', label: string) => (
    <label>
      {label}
      <input className="input input--small" inputMode="decimal" aria-label={`${label} do alimento ${index + 1}`} defaultValue={txt(food[key])} onChange={(e) => onChange({ ...food, [key]: parseNumber(e.target.value) })} />
    </label>
  );
  return (
    <div className="food-row" data-testid="food-row">
      <div className="btn-row" style={{ flexWrap: 'nowrap' }}>
        <input className="input" style={{ flex: 1 }} aria-label={`Nome do alimento ${index + 1}`} placeholder="Alimento (ex.: arroz)" maxLength={60} value={food.name} onChange={(e) => onChange({ ...food, name: e.target.value })} />
        <button type="button" className="icon-btn" aria-label={`Remover alimento ${index + 1}`} onClick={onRemove}><Icon name="trash" size={18} /></button>
      </div>
      <div className="food-row__grid">
        {num('quantity', 'Quantidade')}
        <label>
          Unidade
          <select className="select" aria-label={`Unidade do alimento ${index + 1}`} value={food.unit ?? ''} onChange={(e) => onChange({ ...food, unit: e.target.value || undefined })}>
            <option value="">–</option>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            {food.unit && !(UNITS as readonly string[]).includes(food.unit) ? <option value={food.unit}>{food.unit}</option> : null}
          </select>
        </label>
      </div>
      <div className="food-row__grid4">
        {num('kcal', 'kcal')}
        {num('proteinG', 'Prot. g')}
        {num('carbsG', 'Carb. g')}
        {num('fatG', 'Gord. g')}
      </div>
    </div>
  );
}

/** Cadastro/edição de refeição: vários alimentos; todos os valores numéricos são opcionais. */
export function MealFormSheet(props: Props) {
  // Monta o formulário do zero a cada abertura: o estado inicial nunca vem "velho" de outra refeição.
  if (!props.open) return null;
  return <MealFormInner {...props} />;
}

function initialState(date: string, existing: MealEntry | null, draft: MealDraft | null) {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const items: FoodItem[] = existing
    ? existing.items && existing.items.length > 0
      ? existing.items.map((i) => ({ ...i }))
      : [{ ...newFood(existing.name), kcal: existing.kcal }]
    : draft?.items && draft.items.length > 0
      ? draft.items.map((i) => ({ ...i }))
      : [newFood()];
  return {
    mealDate: existing?.date ?? date,
    time: existing?.time ?? hhmm,
    type: (existing?.mealType ?? draft?.mealType ?? defaultMealType(now.getHours())) as MealType,
    items,
    notes: existing?.notes ?? '',
    balance: existing ? !existing.plannedMeal : !!draft?.balance,
    json: JSON.stringify(items.map(({ id: _id, ...rest }) => rest)),
  };
}

function MealFormInner({ date, existing, draft, onClose, onSave }: Props) {
  const init = useState(() => initialState(date, existing, draft))[0];
  const [mealDate, setMealDate] = useState(init.mealDate);
  const [time, setTime] = useState(init.time);
  const [type, setType] = useState<MealType>(init.type);
  const [items, setItems] = useState<FoodItem[]>(init.items);
  const [notes, setNotes] = useState(init.notes);
  const [balance, setBalance] = useState(init.balance);
  const [error, setError] = useState('');
  const initialJson = init.json;
  const open = true;

  const setItem = (i: number, f: FoodItem) => setItems((list) => list.map((x, k) => (k === i ? f : x)));

  const submit = async () => {
    const valid = validateMeal(items);
    if (!valid.ok) return setError(valid.reason);
    if (!isValidTime(time)) return setError('Horário inválido. Use o formato 08:30.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(mealDate)) return setError('Escolha uma data válida.');
    const changed = JSON.stringify(items.map(({ id: _id, ...rest }) => rest)) !== initialJson;
    const meal = buildMeal(
      {
        date: mealDate,
        time,
        mealType: type,
        items,
        notes,
        balance,
        source: existing?.source ?? draft?.source ?? 'manual',
        analysis: existing?.analysis ?? draft?.analysis,
        corrected: changed && (existing?.source === 'photo-ai' || draft?.source === 'photo-ai') ? true : undefined,
      },
      new Date().toISOString(),
      existing ?? undefined,
    );
    await onSave(meal);
  };

  return (
    <BottomSheet open={open} title={existing ? 'Editar refeição' : draft?.source === 'photo-ai' ? 'Revisar análise da foto' : balance ? 'Refeição fora do habitual' : 'Registrar refeição'} onClose={onClose}>
      <div className="stack">
        {draft?.banner ? <div className="banner" role="note"><Icon name="info" size={18} /><span>{draft.banner}</span></div> : null}
        {balance ? <p className="muted">{BALANCE_INTRO}</p> : null}
        <div className="chips" role="radiogroup" aria-label="Tipo de refeição">
          {MEAL_TYPES.map((t) => <button key={t} type="button" role="radio" aria-checked={type === t} className={`chip${type === t ? ' chip--selected' : ''}`} onClick={() => setType(t)}>{MEAL_TYPE_LABELS[t]}</button>)}
        </div>
        <div className="food-row__grid">
          <label className="field"><span className="field__label">Data</span><input className="input" type="date" value={mealDate} onChange={(e) => setMealDate(e.target.value)} /></label>
          <label className="field"><span className="field__label">Horário</span><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        </div>
        <p className="field__label">Alimentos</p>
        {items.map((f, i) => <FoodEditor key={f.id} food={f} index={i} onChange={(nf) => setItem(i, nf)} onRemove={() => setItems((l) => (l.length > 1 ? l.filter((x) => x.id !== f.id) : [newFood()]))} />)}
        <button type="button" className="btn btn--soft btn--small" onClick={() => setItems((l) => [...l, newFood()])}><Icon name="plus" size={16} /> Adicionar alimento</button>
        <p className="muted">Calorias e macros são opcionais. O total só soma o que você informar.</p>
        <label className="checkrow"><input type="checkbox" checked={balance} onChange={(e) => setBalance(e.target.checked)} /><span>Foi fora do habitual (equilíbrio alimentar)</span></label>
        <label className="field"><span className="field__label">Notas (opcional)</span><input className="input" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        {error ? <p role="alert" className="muted" style={{ color: 'var(--bad)' }}>{error}</p> : null}
        <div className="btn-col">
          <button type="button" className="btn btn--primary" data-testid="save-meal" onClick={() => void submit()}>Salvar refeição</button>
          <button type="button" className="btn btn--outline" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </BottomSheet>
  );
}
