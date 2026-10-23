import { useMemo, useState } from 'react';
import { BottomSheet } from '../components/BottomSheet';
import { Icon } from '../components/Icon';
import { MealFormSheet } from '../components/MealFormSheet';
import type { MealDraft } from '../components/MealFormSheet';
import { PhotoPicker } from '../components/PhotoPicker';
import { EmptyState, ScreenHeader, Section } from '../components/ui';
import { addDays, formatLongDate } from '../domain/dates';
import { CONFIDENCE_LABELS, MEAL_PHOTO_DISCLAIMER, PHOTO_PRIVACY_NOTICE } from '../domain/mealAnalysis';
import type { AiMealIdea } from '../domain/mealAnalysis';
import { BALANCE_INTRO, HEALTH_NOTICE, MEAL_TYPE_LABELS, balanceTip, dayTotals, newFood, sortMeals, suggestLocal } from '../domain/nutrition';
import type { Budget, FoodItem } from '../domain/nutrition';
import type { ExerciseImage } from '../domain/customExercises';
import type { MealEntry } from '../domain/types';
import { analyzeMealPhoto, requestMealSuggestions } from '../services/mealAiClient';
import { useApp } from '../state/AppContext';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';

const fmt = (n: number | null, unit = '') => (n === null ? '–' : `${Math.round(n).toLocaleString('pt-BR')}${unit}`);

function macroText(m: MealEntry): string {
  const p = m.macros;
  const bits = [p?.proteinG !== undefined ? `P ${Math.round(p.proteinG)} g` : '', p?.carbsG !== undefined ? `C ${Math.round(p.carbsG)} g` : '', p?.fatG !== undefined ? `G ${Math.round(p.fatG)} g` : ''].filter(Boolean);
  return bits.join(' · ');
}

export function MealsScreen() {
  const { meals, saveMeal, deleteMeal, today } = useData();
  const { profile } = useApp();
  const toast = useToast();
  const [date, setDate] = useState(today);
  const [form, setForm] = useState<{ existing: MealEntry | null; draft: MealDraft | null } | null>(null);
  const [confirm, setConfirm] = useState<MealEntry | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [tipFor, setTipFor] = useState<string | null>(null);

  const dayMeals = useMemo(() => sortMeals(meals.filter((m) => m.date === date)), [meals, date]);
  const totals = useMemo(() => dayTotals(dayMeals), [dayMeals]);
  const hasBalance = dayMeals.some((m) => !m.plannedMeal);
  const label = date === today ? 'Hoje' : date === addDays(today, -1) ? 'Ontem' : formatLongDate(date);

  const onSave = async (meal: MealEntry) => {
    const isNew = !meals.some((m) => m.id === meal.id);
    await saveMeal(meal);
    setDate(meal.date);
    setForm(null);
    toast.show(isNew ? 'Refeição salva' : 'Refeição atualizada');
    if (!meal.plannedMeal) setTipFor(meal.id);
  };

  return (
    <>
      <ScreenHeader title="Refeições" subtitle="Sua alimentação, sem julgamentos" />
      <div className="stack">
        <div className="date-nav" role="group" aria-label="Escolher dia">
          <button type="button" className="icon-btn" aria-label="Dia anterior" onClick={() => setDate(addDays(date, -1))}><Icon name="chevron-left" size={20} /></button>
          <span className="date-nav__label" data-testid="meal-date">{label}</span>
          <button type="button" className="icon-btn" aria-label="Próximo dia" onClick={() => setDate(addDays(date, 1))}><Icon name="chevron-right" size={20} /></button>
        </div>
        {date !== today ? <button type="button" className="btn btn--outline btn--small" onClick={() => setDate(today)}>Voltar para hoje</button> : null}

        <Section id="m-summary" title="Resumo do dia">
          <div className="grid-3">
            <div className="stat"><span className="stat__value" data-testid="tot-count">{totals.count}</span><span className="stat__label">refeições</span></div>
            <div className="stat"><span className="stat__value" data-testid="tot-kcal">{fmt(totals.kcal)}</span><span className="stat__label">kcal</span></div>
            <div className="stat"><span className="stat__value">{fmt(totals.proteinG, ' g')}</span><span className="stat__label">proteína</span></div>
            <div className="stat"><span className="stat__value">{fmt(totals.carbsG, ' g')}</span><span className="stat__label">carboidrato</span></div>
            <div className="stat"><span className="stat__value">{fmt(totals.fatG, ' g')}</span><span className="stat__label">gordura</span></div>
          </div>
          {totals.count === 0 ? <p className="muted" style={{ marginTop: 10 }}>Nenhuma refeição neste dia. Registre a primeira abaixo, manualmente ou por foto.</p> : null}
          {totals.withoutKcal > 0 && totals.count > 0 ? <p className="muted" style={{ marginTop: 10 }}>{totals.withoutKcal} refeição(ões) sem calorias informadas não entram nos totais. Valores são estimativas e opcionais.</p> : null}
        </Section>

        <div className="btn-col">
          <button type="button" className="btn btn--primary" data-testid="add-meal" onClick={() => setForm({ existing: null, draft: null })}><Icon name="plus" size={16} /> Registrar refeição</button>
          <button type="button" className="btn btn--soft" data-testid="photo-meal" onClick={() => setPhotoOpen(true)}><Icon name="camera" size={16} /> Analisar foto da refeição (IA)</button>
        </div>

        <Section id="m-list" title="Refeições do dia">
          {dayMeals.length === 0 ? <EmptyState title="Sem registros" text="Nada foi registrado neste dia." /> : (
            <div className="list">
              {dayMeals.map((m) => (
                <article key={m.id} className="meal-card" data-testid="meal-card">
                  <div className="meal-card__head">
                    <div>
                      <div className="meal-card__title">{MEAL_TYPE_LABELS[m.mealType ?? 'snack']} · {m.time ?? ''}</div>
                      <div className="muted">{m.kcal !== undefined ? `${Math.round(m.kcal)} kcal` : 'kcal não informadas'}{macroText(m) ? ` · ${macroText(m)}` : ''}</div>
                    </div>
                    <span className="ex-row__actions">
                      <button type="button" className="icon-btn" aria-label={`Editar ${m.name}`} onClick={() => setForm({ existing: m, draft: null })}><Icon name="edit" size={18} /></button>
                      <button type="button" className="icon-btn" aria-label={`Excluir ${m.name}`} onClick={() => setConfirm(m)}><Icon name="trash" size={18} /></button>
                    </span>
                  </div>
                  <ul className="meal-card__items">
                    {(m.items && m.items.length > 0 ? m.items : [{ id: 'legacy', name: m.name, quantity: undefined, unit: undefined }]).map((i) => <li key={i.id}>{i.name}{i.quantity !== undefined ? ` · ${String(i.quantity).replace('.', ',')} ${i.unit ?? ''}` : ''}</li>)}
                  </ul>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {m.analysis ? <span className="ai-tag">Estimativa da IA{m.userCorrected ? ' · corrigida por você' : ''}</span> : null}
                    {!m.plannedMeal ? <span className="pill">Fora do habitual</span> : null}
                  </div>
                  {m.notes ? <p className="muted">{m.notes}</p> : null}
                </article>
              ))}
            </div>
          )}
        </Section>

        <Section id="m-balance" title="Equilíbrio alimentar">
          <p className="muted">{BALANCE_INTRO}</p>
          {hasBalance || tipFor ? <p className="hint" data-testid="balance-tip">{balanceTip(tipFor ?? dayMeals.find((m) => !m.plannedMeal)?.id ?? date)}</p> : null}
          <button type="button" className="btn btn--outline btn--block" style={{ marginTop: 12 }} data-testid="add-balance" onClick={() => setForm({ existing: null, draft: { items: [newFood()], source: 'manual', balance: true } })}>Registrar refeição fora do habitual</button>
        </Section>

        <Suggestions goalLabel={profile?.goal ?? ''} onUse={(title, items) => setForm({ existing: null, draft: { items: items.map((n) => newFood(n)), source: 'manual', banner: `Ideia: ${title}. Ajuste como quiser antes de salvar.` } })} />
      </div>

      <MealFormSheet open={!!form} date={date} existing={form?.existing ?? null} draft={form?.draft ?? null} onClose={() => setForm(null)} onSave={onSave} />
      <PhotoSheet open={photoOpen} onClose={() => setPhotoOpen(false)} onResult={(draft) => { setPhotoOpen(false); setForm({ existing: null, draft }); }} />
      <BottomSheet open={!!confirm} title="Excluir refeição?" onClose={() => setConfirm(null)}>
        <p className="muted">“{confirm?.name}” será removida e os totais do dia serão recalculados.</p>
        <div className="btn-col">
          <button type="button" className="btn btn--danger" data-testid="confirm-delete-meal" onClick={async () => { if (confirm) await deleteMeal(confirm.id); setConfirm(null); toast.show('Refeição excluída'); }}>Excluir</button>
          <button type="button" className="btn btn--outline" onClick={() => setConfirm(null)}>Cancelar</button>
        </div>
      </BottomSheet>
    </>
  );
}

/** Foto da refeição: aviso antes de enviar, envio só ao tocar em "Analisar", e revisão obrigatória. */
function PhotoSheet({ open, onClose, onResult }: { open: boolean; onClose: () => void; onResult: (d: MealDraft) => void }) {
  const [image, setImage] = useState<ExerciseImage | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ message: string; ai: boolean } | null>(null);

  const close = () => { setImage(null); setNote(''); setProblem(null); setBusy(false); onClose(); };

  const analyze = async () => {
    if (!image) return;
    setBusy(true);
    setProblem(null);
    const res = await analyzeMealPhoto(image.dataUrl, note);
    setBusy(false);
    if (!res.ok) {
      setProblem({ message: res.message, ai: res.kind === 'ai-unavailable' });
      return;
    }
    const draft: MealDraft = {
      items: res.result.items as FoodItem[],
      source: 'photo-ai',
      analysis: { by: 'gemini', model: res.model, at: new Date().toISOString(), confidence: res.result.confidence },
      banner: `${MEAL_PHOTO_DISCLAIMER} ${CONFIDENCE_LABELS[res.result.confidence]}.${res.result.note ? ` ${res.result.note}` : ''}`,
    };
    setImage(null);
    setNote('');
    onResult(draft);
  };

  return (
    <BottomSheet open={open} title="Foto da refeição" onClose={close}>
      <div className="stack">
        <div className="banner" role="note"><Icon name="lock" size={18} /><span>{PHOTO_PRIVACY_NOTICE}</span></div>
        <p className="muted">{MEAL_PHOTO_DISCLAIMER}</p>
        <PhotoPicker label="Foto da refeição" preview={image?.dataUrl ?? null} onPick={(i) => { setImage(i); setProblem(null); }} onClear={() => setImage(null)} maxDim={1024} targetBytes={300_000} />
        {image ? (
          <>
            <label className="field"><span className="field__label">Algo que ajude a identificar? (opcional)</span><input className="input" maxLength={200} value={note} placeholder="Ex.: arroz integral, sem óleo" onChange={(e) => setNote(e.target.value)} /></label>
            <button type="button" className="btn btn--primary" disabled={busy} data-testid="analyze-photo" onClick={() => void analyze()}>{busy ? 'Analisando…' : 'Analisar com IA'}</button>
          </>
        ) : null}
        {problem ? (
          <div className="banner banner--warn" role="alert" data-testid="photo-problem">
            <Icon name="alert" size={18} />
            <span>{problem.message} {problem.ai ? 'A análise por foto não está disponível agora, mas você pode registrar a refeição manualmente.' : 'Tente uma foto mais nítida e bem iluminada, ou registre manualmente.'}</span>
          </div>
        ) : null}
        <button type="button" className="btn btn--outline" data-testid="photo-manual" onClick={() => onResult({ items: [newFood()], source: 'manual' })}>Registrar manualmente</button>
      </div>
    </BottomSheet>
  );
}

function Suggestions({ goalLabel, onUse }: { goalLabel: string; onUse: (title: string, items: string[]) => void }) {
  const [budget, setBudget] = useState<Budget>('low');
  const [vegetarian, setVegetarian] = useState(false);
  const [avoid, setAvoid] = useState('');
  const [prefs, setPrefs] = useState('');
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const [ai, setAi] = useState<{ ideas: AiMealIdea[]; note: string } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const local = useMemo(() => suggestLocal({ budget, vegetarian, avoid }).filter((m) => !ignored.has(m.id)), [budget, vegetarian, avoid, ignored]);

  const ask = async () => {
    setAiBusy(true);
    setAiError('');
    const res = await requestMealSuggestions({ goal: goalLabel, mealType: '', budget, vegetarian, preferences: prefs.slice(0, 200), avoid: avoid.slice(0, 200), healthCondition: false });
    setAiBusy(false);
    if (res.ok) setAi({ ideas: res.ideas, note: res.note });
    else setAiError(`${res.message} As ideias locais abaixo continuam disponíveis.`);
  };

  return (
    <Section id="m-ideas" title="Ideias acessíveis">
      <div className="stack">
        <div className="chips" role="radiogroup" aria-label="Orçamento">
          {([['low', 'Econômico'], ['medium', 'Moderado'], ['any', 'Sem limite']] as Array<[Budget, string]>).map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={budget === v} className={`chip${budget === v ? ' chip--selected' : ''}`} onClick={() => setBudget(v)}>{l}</button>)}
        </div>
        <label className="checkrow"><input type="checkbox" checked={vegetarian} onChange={(e) => setVegetarian(e.target.checked)} /><span>Sem carne</span></label>
        <label className="field"><span className="field__label">Prefiro (opcional)</span><input className="input" maxLength={200} value={prefs} onChange={(e) => setPrefs(e.target.value)} /></label>
        <label className="field"><span className="field__label">Evitar (opcional, separe por vírgula)</span><input className="input" maxLength={200} value={avoid} onChange={(e) => setAvoid(e.target.value)} /></label>
        {local.length === 0 ? <p className="muted">Nenhuma ideia com esses filtros. Tente afrouxar um deles.</p> : null}
        {local.map((m) => (
          <article key={m.id} className="meal-card">
            <div className="meal-card__title">{m.title} <span className="pill">{MEAL_TYPE_LABELS[m.mealType]}</span></div>
            <p className="muted">{m.items.join(', ')}. {m.note}</p>
            <div className="btn-row"><button type="button" className="btn btn--soft btn--small" onClick={() => onUse(m.title, m.items)}>Usar e editar</button><button type="button" className="btn btn--outline btn--small" onClick={() => setIgnored(new Set(ignored).add(m.id))}>Ignorar</button></div>
          </article>
        ))}
        <button type="button" className="btn btn--outline" disabled={aiBusy} data-testid="ask-ai-ideas" onClick={() => void ask()}>{aiBusy ? 'Pedindo ideias…' : 'Pedir mais ideias ao Gemini'}</button>
        {aiError ? <p className="muted" role="alert">{aiError}</p> : null}
        {ai ? (
          <div className="stack" data-testid="ai-ideas">
            {ai.ideas.filter((i) => !ignored.has(`ai:${i.title}`)).map((i) => (
              <article key={i.title} className="meal-card">
                <div className="meal-card__title">{i.title} <span className="ai-tag">Sugestão da IA</span></div>
                <p className="muted">{i.items.join(', ')}.{i.swap ? ` Troca: ${i.swap}.` : ''}{i.note ? ` ${i.note}` : ''}</p>
                <div className="btn-row"><button type="button" className="btn btn--soft btn--small" onClick={() => onUse(i.title, i.items)}>Usar e editar</button><button type="button" className="btn btn--outline btn--small" onClick={() => setIgnored(new Set(ignored).add(`ai:${i.title}`))}>Ignorar</button></div>
              </article>
            ))}
            {ai.note ? <p className="muted">{ai.note}</p> : null}
          </div>
        ) : null}
        <p className="muted">Ideias gerais, sem promessa de resultado. {HEALTH_NOTICE}</p>
      </div>
    </Section>
  );
}
