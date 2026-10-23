import { useMemo, useState } from 'react';
import { Choice, StepperField } from '../components/Fields';
import { Icon } from '../components/Icon';
import { BottomSheet } from '../components/BottomSheet';
import { WEEKDAY_NAMES } from '../domain/dates';
import {
  CARDIO_LABELS,
  EQUIPMENT_IDS,
  EQUIPMENT_LABELS,
  EXPERIENCE_LABELS,
  PLACE_LABELS,
  canGeneratePlan,
  defaultQuestionnaire,
} from '../domain/training';
import type { CardioPreference, EquipmentId, LimitationLevel, Questionnaire } from '../domain/training';
import { GOAL_LABELS } from '../domain/types';
import type { Experience, Goal, TrainingPlace } from '../domain/types';
import { links, navigate } from '../router';
import { generatePlan } from '../services/planService';
import { useApp } from '../state/AppContext';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { FALLBACK_MESSAGES } from '../domain/training';

const STEPS = 6;

const toOptions = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

export function QuestionnaireScreen() {
  const { profile, updateProfile } = useApp();
  const { plan, sessions, activeSession, savePlan } = useData();
  const toast = useToast();
  const [q, setQ] = useState<Questionnaire>(() => profile?.questionnaire ?? defaultQuestionnaire(profile?.goal));
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState<null | 'gemini' | 'local'>(null);
  const [confirmReplace, setConfirmReplace] = useState<null | 'gemini' | 'local'>(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Questionnaire>(key: K, value: Questionnaire[K]) => setQ((prev) => ({ ...prev, [key]: value }));
  const gate = useMemo(() => canGeneratePlan(q), [q]);
  const isEdit = !!profile?.questionnaire;

  const save = async () => {
    await updateProfile({ questionnaire: { ...q, completedAt: new Date().toISOString() }, goal: q.goal, experience: q.experience, place: q.place });
  };

  const saveOnly = async () => {
    await save();
    toast.show('Respostas salvas');
    navigate(links.workout);
  };

  const run = async (mode: 'gemini' | 'local') => {
    setConfirmReplace(null);
    if (!gate.ok) return;
    setBusy(mode);
    setError(null);
    try {
      await save();
      const next = await generatePlan({ questionnaire: q, sessions, mode });
      await savePlan(next);
      toast.show(
        next.source === 'gemini'
          ? 'Plano gerado com o Gemini'
          : `Plano gerado pelo gerador local. ${next.fallbackReason ? FALLBACK_MESSAGES[next.fallbackReason] : ''}`.trim(),
      );
      navigate(links.workout);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível gerar o plano.');
    } finally {
      setBusy(null);
    }
  };

  const request = (mode: 'gemini' | 'local') => {
    if (activeSession) {
      setError('Há um treino em andamento. Termine ou abandone esse treino antes de gerar um novo plano.');
      return;
    }
    if (plan) setConfirmReplace(mode);
    else void run(mode);
  };

  const toggleEquipment = (id: EquipmentId) =>
    set('equipment', q.equipment.includes(id) ? q.equipment.filter((x) => x !== id) : [...q.equipment, id]);
  const toggleDay = (d: number) =>
    set('preferredDays', q.preferredDays.includes(d) ? q.preferredDays.filter((x) => x !== d) : [...q.preferredDays, d].sort());

  return (
    <div className="stack">
      <div>
        <button type="button" className="back-link" onClick={() => (window.history.length > 1 ? window.history.back() : navigate(links.workout))}>
          <Icon name="chevron-left" size={18} /> Voltar
        </button>
        <h1 className="screen-title">{isEdit ? 'Suas respostas' : 'Vamos montar seu treino'}</h1>
        <p className="screen-subtitle">
          Pergunta {Math.min(step + 1, STEPS)} de {STEPS}. Você pode mudar tudo depois no Perfil.
        </p>
      </div>
      <div className="progress" aria-hidden="true">
        {Array.from({ length: STEPS }, (_, i) => (
          <span key={i} className={`progress__dot${i <= step ? ' progress__dot--on' : ''}`} />
        ))}
      </div>

      <section className="panel stack" aria-live="polite">
        {step === 0 && (
          <>
            <Choice<Goal> label="Qual é o seu objetivo principal?" value={q.goal} options={toOptions(GOAL_LABELS)} onChange={(v) => set('goal', v)} />
            <Choice<Experience>
              label="Qual é o seu nível?"
              value={q.experience}
              options={toOptions(EXPERIENCE_LABELS)}
              onChange={(v) => set('experience', v)}
              hint="Na dúvida, escolha o nível mais baixo. Dá para evoluir depois."
            />
          </>
        )}
        {step === 1 && (
          <>
            <Choice<TrainingPlace> label="Onde você vai treinar?" value={q.place} options={toOptions(PLACE_LABELS)} onChange={(v) => set('place', v)} />
            {q.place !== 'gym' ? (
              <div className="field">
                <span className="field__label" id="eq-label">
                  O que você tem em casa?
                </span>
                <div className="chips" role="group" aria-labelledby="eq-label">
                  {EQUIPMENT_IDS.map((id) => {
                    const on = q.equipment.includes(id);
                    return (
                      <button key={id} type="button" aria-pressed={on} className={`chip${on ? ' chip--selected' : ''}`} onClick={() => toggleEquipment(id)}>
                        {EQUIPMENT_LABELS[id]}
                      </button>
                    );
                  })}
                </div>
                <p className="field__hint">Sem nenhum item marcado, o treino usa só o peso do corpo.</p>
              </div>
            ) : (
              <p className="muted">Na academia, o plano assume os equipamentos comuns de musculação.</p>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <StepperField label="Quantos dias por semana você consegue treinar?" value={q.daysPerWeek} min={1} max={6} unit={q.daysPerWeek === 1 ? 'dia' : 'dias'} hint="Pense no que é realista, não no ideal." onChange={(v) => set('daysPerWeek', v)} />
            <StepperField label="Quanto tempo por treino?" value={q.minutesPerSession} min={15} max={120} step={5} unit="min" onChange={(v) => set('minutesPerSession', v)} />
          </>
        )}
        {step === 3 && (
          <>
            <label className="field">
              <span className="field__label">Exercícios que você gosta (opcional)</span>
              <input className="input" value={q.likes} maxLength={300} placeholder="Ex.: agachamento, remada" onChange={(e) => set('likes', e.target.value)} />
            </label>
            <label className="field">
              <span className="field__label">Exercícios que prefere evitar (opcional)</span>
              <input className="input" value={q.avoid} maxLength={300} placeholder="Ex.: burpee, corrida" onChange={(e) => set('avoid', e.target.value)} />
            </label>
            <Choice<LimitationLevel>
              label="Você tem dor ou limitação?"
              value={q.limitationLevel}
              options={[
                { value: 'none', label: 'Nenhuma' },
                { value: 'mild', label: 'Leve' },
                { value: 'significant', label: 'Forte ou condição de saúde' },
              ]}
              onChange={(v) => set('limitationLevel', v)}
            />
            {q.limitationLevel !== 'none' ? (
              <label className="field">
                <span className="field__label">Conte rapidamente (sem dados sensíveis desnecessários)</span>
                <textarea className="input textarea" value={q.limitations} maxLength={300} placeholder="Ex.: desconforto no joelho direito ao agachar fundo" onChange={(e) => set('limitations', e.target.value)} />
              </label>
            ) : null}
            {q.limitationLevel === 'significant' ? (
              <div className="banner banner--warn" role="note">
                <Icon name="alert" size={20} />
                <div>
                  <p>Este app não faz diagnóstico e não substitui profissional de saúde. Com dor forte ou condição de saúde, procure um médico ou profissional de educação física antes de treinar.</p>
                  <label className="checkrow" style={{ marginTop: 10 }}>
                    <input type="checkbox" checked={q.clearedByProfessional} onChange={(e) => set('clearedByProfessional', e.target.checked)} />
                    <span>Já fui orientado(a) por um profissional e posso treinar.</span>
                  </label>
                </div>
              </div>
            ) : null}
          </>
        )}
        {step === 4 && (
          <>
            <Choice<CardioPreference> label="Como é sua relação com cardio?" value={q.cardio} options={toOptions(CARDIO_LABELS)} onChange={(v) => set('cardio', v)} />
            <div className="field">
              <span className="field__label" id="days-label">
                Dias preferidos (opcional)
              </span>
              <div className="chips" role="group" aria-labelledby="days-label">
                {WEEKDAY_NAMES.map((name, i) => {
                  const on = q.preferredDays.includes(i);
                  return (
                    <button key={name} type="button" aria-pressed={on} className={`chip${on ? ' chip--selected' : ''}`} onClick={() => toggleDay(i)}>
                      {name.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
              <p className="field__hint">Sem dias marcados, o app distribui para você descansar entre grupos musculares.</p>
            </div>
            <label className="field">
              <span className="field__label">Algo sobre sua rotina? (opcional)</span>
              <input className="input" value={q.organization} maxLength={300} placeholder="Ex.: prefiro treinos curtos de manhã" onChange={(e) => set('organization', e.target.value)} />
            </label>
          </>
        )}
        {step === 5 && (
          <>
            <h2 className="h3">Resumo e envio</h2>
            <ul className="list muted" style={{ listStyle: 'none', padding: 0 }}>
              <li>Objetivo: {GOAL_LABELS[q.goal]} · Nível: {EXPERIENCE_LABELS[q.experience]}</li>
              <li>
                {PLACE_LABELS[q.place]} · {q.daysPerWeek} dia(s) por semana · {q.minutesPerSession} min
              </li>
              <li>Cardio: {CARDIO_LABELS[q.cardio]}</li>
              {q.limitationLevel !== 'none' ? <li>Limitação informada: {q.limitationLevel === 'mild' ? 'leve' : 'forte'}</li> : null}
            </ul>
            <div className="banner" role="note">
              <Icon name="info" size={20} />
              <p>
                <strong>O que vai para o Gemini:</strong> só estas respostas e um resumo dos seus últimos treinos (data, nome e músculos). Seu nome, fotos e medidas <strong>não</strong> são enviados. Se não houver internet ou o Gemini falhar, o app monta um plano básico no próprio aparelho e avisa você.
              </p>
            </div>
            {!gate.ok ? (
              <div className="banner banner--warn" role="alert">
                <Icon name="alert" size={20} />
                <p>{gate.reason}</p>
              </div>
            ) : null}
            {error ? (
              <div className="banner banner--warn" role="alert">
                <Icon name="alert" size={20} />
                <p>{error}</p>
              </div>
            ) : null}
          </>
        )}
      </section>

      {step < STEPS - 1 ? (
        <div className="btn-row">
          {step > 0 ? (
            <button type="button" className="btn btn--outline" onClick={() => setStep(step - 1)}>
              Voltar
            </button>
          ) : null}
          <button type="button" className="btn btn--primary" onClick={() => setStep(step + 1)}>
            Continuar
          </button>
        </div>
      ) : (
        <div className="btn-col">
          <button type="button" className="btn btn--primary" disabled={!gate.ok || !!busy} onClick={() => request('gemini')}>
            {busy === 'gemini' ? 'Gerando com o Gemini…' : 'Gerar com Gemini'}
          </button>
          <button type="button" className="btn btn--outline" disabled={!gate.ok || !!busy} onClick={() => request('local')}>
            {busy === 'local' ? 'Gerando…' : 'Gerar sem IA'}
          </button>
          <button type="button" className="btn btn--ghost" disabled={!!busy} onClick={() => void saveOnly()}>
            Só salvar as respostas
          </button>
          <button type="button" className="btn btn--ghost" disabled={!!busy} onClick={() => setStep(step - 1)}>
            Voltar
          </button>
          {busy === 'gemini' ? <p className="muted">Pode levar até meio minuto. Não feche o app.</p> : null}
        </div>
      )}

      <BottomSheet open={confirmReplace !== null} title="Substituir o plano atual?" onClose={() => setConfirmReplace(null)}>
        <p className="muted">
          Um novo plano começa hoje e substitui o atual. Seus treinos já feitos, o histórico e os check-ins continuam salvos.
        </p>
        <div className="btn-col">
          <button type="button" className="btn btn--primary" onClick={() => confirmReplace && void run(confirmReplace)}>
            Gerar novo plano
          </button>
          <button type="button" className="btn btn--outline" onClick={() => setConfirmReplace(null)}>
            Manter o plano atual
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
