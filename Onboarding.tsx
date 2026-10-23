import { useState } from 'react';
import type { FormEvent } from 'react';
import { GOAL_LABELS } from '../domain/types';
import type { Goal } from '../domain/types';
import { useApp } from '../state/AppContext';

const GOALS = Object.keys(GOAL_LABELS) as Goal[];

/** Fluxo inicial curto: nome e objetivo, ambos opcionais e editáveis depois no Perfil. */
export function Onboarding() {
  const { updateProfile } = useApp();
  const [step, setStep] = useState<0 | 1>(0);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState<Goal | undefined>(undefined);

  const finish = (withGoal: boolean) => {
    void updateProfile({ name: name.trim(), goal: withGoal ? goal : undefined, onboardingDone: true });
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      // Pede ao navegador para não apagar os dados locais. Pode ser ignorado.
      navigator.storage.persist().catch(() => undefined);
    }
  };

  const onSubmitName = (event: FormEvent) => {
    event.preventDefault();
    setStep(1);
  };

  return (
    <main className="onboarding">
      <div className="onboarding__body">
        <p className="onboarding__step">Passo {step + 1} de 2</p>

        {step === 0 ? (
          <form onSubmit={onSubmitName} className="onboarding__form">
            <h1 className="screen-title">Bem-vindo!</h1>
            <p className="screen-subtitle">Seu assistente pessoal de fitness. Vamos começar pelo seu nome.</p>
            <label className="field">
              <span className="field__label">Como quer ser chamado?</span>
              <input
                className="input"
                type="text"
                value={name}
                maxLength={40}
                autoComplete="given-name"
                autoFocus
                placeholder="Seu nome"
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <p className="field__hint">Seus dados ficam apenas neste aparelho. Sem conta nem login.</p>
            <div className="onboarding__actions">
              <button type="submit" className="btn btn--primary">
                Continuar
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setStep(1)}>
                Agora não
              </button>
            </div>
          </form>
        ) : (
          <div className="onboarding__form">
            <h1 className="screen-title">Qual é seu objetivo?</h1>
            <p className="screen-subtitle">Você pode mudar isso a qualquer momento no Perfil.</p>
            <div className="chips chips--stack" role="group" aria-label="Objetivo principal">
              {GOALS.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`chip${goal === g ? ' chip--selected' : ''}`}
                  aria-pressed={goal === g}
                  onClick={() => setGoal(goal === g ? undefined : g)}
                >
                  {GOAL_LABELS[g]}
                </button>
              ))}
            </div>
            <div className="onboarding__actions">
              <button type="button" className="btn btn--primary" onClick={() => finish(true)}>
                {goal ? 'Concluir' : 'Concluir sem escolher'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setStep(0)}>
                Voltar
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
