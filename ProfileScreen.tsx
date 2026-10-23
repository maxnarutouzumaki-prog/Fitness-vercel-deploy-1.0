import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { PrivacyNote, ScreenHeader, Section, Switch } from '../components/ui';
import { THEMES } from '../domain/appearance';
import { GOAL_LABELS } from '../domain/types';
import type { Goal } from '../domain/types';
import { useApp } from '../state/AppContext';
import { SoonList } from './PlaceholderScreens';
import { Consistency } from './Consistency';
import { CARDIO_LABELS, EXPERIENCE_LABELS, PLACE_LABELS } from '../domain/training';
import { links, useRoute } from '../router';

const GOALS = Object.keys(GOAL_LABELS) as Goal[];

export function ProfileScreen() {
  const { profile, appearance, updateProfile, updateAppearance } = useApp();
  const [name, setName] = useState(profile?.name ?? '');
  const [saved, setSaved] = useState(false);
  const route = useRoute();
  useEffect(() => {
    if (route.params[0] === 'consistencia') document.getElementById('consistencia')?.scrollIntoView();
  }, [route.params]);

  // Salva o nome automaticamente, pouco depois de parar de digitar.
  useEffect(() => {
    if (name.trim() === (profile?.name ?? '')) return;
    setSaved(false);
    const timer = setTimeout(() => {
      updateProfile({ name: name.trim() }).then(() => setSaved(true));
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  return (
    <>
      <ScreenHeader title="Perfil" subtitle="Seus dados e preferências" />
      <div className="stack">
        <Section id="pf-personal" title="Dados pessoais">
          <label className="field">
            <span className="field__label">Nome</span>
            <input
              className="input"
              type="text"
              value={name}
              maxLength={40}
              autoComplete="given-name"
              placeholder="Como quer ser chamado?"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <p className="field__hint" role="status">
            {saved ? 'Salvo neste aparelho.' : 'Aparece na saudação da tela Início.'}
          </p>

          <div className="field">
            <span className="field__label" id="goal-label">
              Objetivo principal
            </span>
            <div className="chips" role="group" aria-labelledby="goal-label">
              {GOALS.map((goal) => {
                const selected = profile?.goal === goal;
                return (
                  <button
                    key={goal}
                    type="button"
                    className={`chip${selected ? ' chip--selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => updateProfile({ goal: selected ? undefined : goal })}
                  >
                    {GOAL_LABELS[goal]}
                  </button>
                );
              })}
            </div>
            <p className="field__hint">Toque de novo para remover. Usado para interpretar sua evolução.</p>
          </div>
        </Section>

        <section id="consistencia">
          <Section id="pf-consistency" title="Minha consistência">
            <Consistency />
          </Section>
        </section>

        <Section id="pf-training" title="Meu treino">
          {profile?.questionnaire ? (
            <>
              <p className="kv"><span>Objetivo</span><span>{GOAL_LABELS[profile.questionnaire.goal]}</span></p>
              <p className="kv"><span>Nível</span><span>{EXPERIENCE_LABELS[profile.questionnaire.experience]}</span></p>
              <p className="kv"><span>Local</span><span>{PLACE_LABELS[profile.questionnaire.place]}</span></p>
              <p className="kv"><span>Frequência</span><span>{profile.questionnaire.daysPerWeek} dias · {profile.questionnaire.minutesPerSession} min</span></p>
              <p className="kv"><span>Cardio</span><span>{CARDIO_LABELS[profile.questionnaire.cardio]}</span></p>
            </>
          ) : (
            <p className="muted">Você ainda não respondeu ao questionário de treino.</p>
          )}
          <a className="btn btn--soft btn--block" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none', marginTop: 12 }} href={links.questionnaire}>
            {profile?.questionnaire ? 'Editar respostas' : 'Responder questionário'}
          </a>
          <p className="muted" style={{ marginTop: 10 }}>Ao gerar um plano com o Gemini, só vão suas respostas e um resumo dos últimos treinos. Nome, fotos e medidas não são enviados.</p>
        </Section>

        <Section id="pf-appearance" title="Aparência">
          <div className="swatches" role="radiogroup" aria-label="Cor do tema">
            {THEMES.map((theme) => {
              const selected = appearance.theme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={theme.label}
                  title={theme.label}
                  data-swatch={theme.id}
                  className={`swatch${selected ? ' swatch--selected' : ''}`}
                  onClick={() => updateAppearance({ theme: theme.id })}
                >
                  {selected ? <Icon name="check" size={20} strokeWidth={2.6} /> : null}
                </button>
              );
            })}
          </div>
          <Switch
            label="Modo noite"
            checked={appearance.mode === 'dark'}
            onChange={(checked) => updateAppearance({ mode: checked ? 'dark' : 'light' })}
          />
        </Section>

        <Section id="pf-soon" title="Preferências e configurações">
          <SoonList
            items={[
              'Preferências alimentares',
              'Lembretes',
              'Exportar e restaurar dados',
              'Limpar dados locais',
            ]}
          />
        </Section>

        <Section id="pf-privacy" title="Privacidade e dados">
          <PrivacyNote>
            Tudo fica salvo somente neste aparelho. Não há conta, login nem sincronização. Quem abrir o mesmo link em
            outro celular usa seus próprios dados.
          </PrivacyNote>
          <p className="note-text">
            Os dados não são sincronizados entre aparelhos e ainda não há backup. Se você limpar os dados do navegador ou trocar de aparelho, as informações serão
            perdidas.
          </p>
        </Section>

        <Section id="pf-install" title="Instalar no iPhone">
          <ol className="steps">
            <li>
              Abra este link no <strong>Safari</strong>.
            </li>
            <li>
              Toque em <Icon name="share" size={16} /> <strong>Compartilhar</strong>.
            </li>
            <li>
              Escolha <strong>Adicionar à Tela de Início</strong>.
            </li>
          </ol>
          <p className="note-text">
            Instalado na Tela de Início, o app abre em tela cheia e o iOS mantém seus dados salvos com mais segurança.
          </p>
        </Section>
      </div>
    </>
  );
}
