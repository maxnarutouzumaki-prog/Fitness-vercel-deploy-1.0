import { useEffect, useState } from 'react';
import { Card, Metric } from '../components/Card';
import { Icon } from '../components/Icon';
import { EmptyState } from '../components/ui';
import { formatDelta, formatValue, interpretChange } from '../domain/evolution';
import type { MetricKey } from '../domain/evolution';
import { INTENSITY_LABELS } from '../domain/types';
import { ManualCheckinSheet } from '../components/ManualCheckinSheet';
import { MANUAL_ACTIVITY_LABELS } from '../domain/checkins';
import { dayStatus, findDay } from '../domain/planning';
import { links } from '../router';
import { useData } from '../state/DataContext';
import { ROUTINE_STATUS_LABELS, routineStatusOn, routinesOn } from '../domain/routines';
import { dayTotals } from '../domain/nutrition';
import { emptySummary, loadHomeSummary } from '../services/homeSummary';
import type { HomeSummary } from '../services/homeSummary';
import { useApp } from '../state/AppContext';

const METRIC_UI: ReadonlyArray<{ key: MetricKey; label: string; unit: string }> = [
  { key: 'weightKg', label: 'Peso', unit: 'kg' },
  { key: 'leanMassKg', label: 'Massa magra', unit: 'kg' },
  { key: 'bodyFatPct', label: 'Gordura', unit: '%' },
];

export function HomeScreen() {
  const { profile } = useApp();
  const { plan, sessions, today, activeSession, streaks, checkins, routines, meals } = useData();
  const [sheet, setSheet] = useState(false);
  const [summary, setSummary] = useState<HomeSummary>(() => emptySummary());

  useEffect(() => {
    let cancelled = false;
    loadHomeSummary()
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        if (!cancelled) setSummary(emptySummary());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const name = profile?.name.trim();
  const todayDay = findDay(plan, today);
  const workout = todayDay && todayDay.kind !== 'rest' ? todayDay : null;
  const todayRoutines = routinesOn(routines, today);
  const nothingPlanned = !plan && routines.length === 0;
  const mealTotals = dayTotals(meals.filter((m) => m.date === today));
  const status = todayDay ? dayStatus(todayDay, sessions, today) : null;
  const ended = !!plan && today > plan.endDate;
  const todayCheckin = checkins.find((c) => c.date === today);
  const workoutSubtitle = activeSession
    ? `Em andamento: ${activeSession.title}`
    : todayRoutines.length > 0 && !workout
      ? todayRoutines.map((r) => r.name).join(' + ')
      : !plan && routines.length > 0
        ? 'Nenhuma ficha marcada para hoje'
        : !plan
      ? 'Vamos preparar seu primeiro treino'
      : ended
        ? 'Sua semana de treinos terminou'
        : todayDay?.kind === 'rest'
          ? 'Hoje é dia de descanso'
          : workout
            ? workout.title
            : 'Sem treino para hoje';
  const workoutHref = activeSession ? links.session(activeSession.id) : todayRoutines.length > 0 && !workout ? links.routineWeek : !plan && routines.length > 0 ? links.routineWeek : !plan ? links.workout : ended ? links.questionnaire : todayDay ? links.day(todayDay.date) : links.workout;
  const workoutLink = activeSession ? 'Continuar treino →' : todayRoutines.length > 0 && !workout ? 'Ver minha semana →' : !plan && routines.length > 0 ? 'Ver minha semana →' : !plan ? 'Escolher como treinar →' : ended ? 'Atualizar plano →' : status === 'done' ? 'Ver treino →' : workout ? 'Abrir treino →' : 'Ver semana →';

  return (
    <>
      <header className="home-header">
        <div>
          <h1 className="screen-title">{name ? `Olá, ${name}!` : 'Olá!'}</h1>
          <p className="screen-subtitle">Disciplina hoje, resultados amanhã.</p>
        </div>
        <a className="profile-btn" href="#/perfil" aria-label="Abrir perfil">
          <Icon name="user" size={22} />
        </a>
      </header>

      <div className="stack">
        <Card
          id="workout"
          title="Treino do dia"
          subtitle={workoutSubtitle}
          icon="dumbbell"
          side="left"
          linkLabel={workoutLink}
          linkHref={workoutHref}
        >
          {workout ? (
            <div className="metrics">
              <Metric label="Exercícios" value={String(workout.exercises.length)} />
              <Metric label="Duração" value={`${workout.estimatedMinutes} min`} />
              <Metric label="Intensidade" value={workout.intensity ? INTENSITY_LABELS[workout.intensity] : undefined} />
            </div>
          ) : null}
          {todayRoutines.length > 0 ? (
            <div className="list" data-testid="home-routines" style={{ marginTop: workout ? 12 : 0 }}>
              {todayRoutines.map((r) => {
                const st = routineStatusOn(r, today, today, sessions);
                return (
                  <a key={r.id} className="ex-row" style={{ textDecoration: 'none', color: 'inherit' }} href={links.routine(r.id)}>
                    <span className="ex-row__body"><span className="ex-row__title">{r.name}</span><span className="ex-row__sub" style={{ display: 'block' }}>{r.focus ? `${r.focus} · ` : ''}{r.exercises.length} exerc. · {ROUTINE_STATUS_LABELS[st]}</span></span>
                  </a>
                );
              })}
            </div>
          ) : null}
          {nothingPlanned ? (
            <div className="stack" style={{ gap: 8 }} data-testid="home-empty-workout">
              <p className="card__message">Nenhum treino cadastrado ainda. Escolha como começar:</p>
              <a className="btn btn--soft btn--block" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }} href={links.routineEdit('novo')}>Cadastrar minha ficha</a>
              <a className="btn btn--outline btn--block" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }} href={links.questionnaire}>Montar treino com IA</a>
            </div>
          ) : null}
          {status === 'done' ? <p className="card__message">Treino concluído hoje. Bom trabalho!</p> : null}
          {status === 'partial' ? <p className="card__message">Treino parcial salvo hoje.</p> : null}
          {todayDay?.kind === 'rest' && !activeSession ? <p className="card__message">Recuperar também faz parte do treino. Se quiser se mexer, faça um check-in manual.</p> : null}
        </Card>

        <Card
          id="checkin"
          title="Check-in de hoje"
          subtitle={streaks.current > 0 ? `${streaks.current} ${streaks.current === 1 ? 'dia seguido' : 'dias seguidos'}` : 'Sua constância diária'}
          icon="flame"
          side="right"
          linkLabel="Ver minha consistência →"
          linkHref={links.profileConsistency}
        >
          {todayCheckin ? (
            <p className="card__message" data-testid="checkin-done">
              Check-in feito hoje: {todayCheckin.sources.map((x) => (x.kind === 'workout' ? x.title : `${MANUAL_ACTIVITY_LABELS[x.activity]} (manual)`)).join(' · ')}.
            </p>
          ) : (
            <p className="card__message">
              {streaks.atRisk ? 'Sua sequência continua se você registrar hoje. ' : ''}O check-in nasce de treinos concluídos. Fez outra atividade? Registre abaixo.
            </p>
          )}
          <button type="button" className="btn btn--soft btn--block" style={{ marginTop: 12 }} onClick={() => setSheet(true)}>
            Fazer check-in
          </button>
        </Card>

        <Card
          id="meals"
          title="Refeições"
          subtitle="Resumo de hoje"
          icon="utensils"
          side="left"
          linkLabel={mealTotals.count === 0 ? 'Registrar refeição →' : 'Ver refeições →'}
          linkHref={links.meals}
        >
          <div className="metrics">
            <Metric label="Registradas" value={String(mealTotals.count)} />
            <Metric label="kcal" value={mealTotals.kcal !== null ? Math.round(mealTotals.kcal).toLocaleString('pt-BR') : undefined} />
            <Metric label="Proteína" value={mealTotals.proteinG !== null ? `${Math.round(mealTotals.proteinG)} g` : undefined} />
          </div>
          {mealTotals.count === 0 ? <p className="card__message">Nenhuma refeição registrada hoje. Registre manualmente ou por foto.</p> : null}
        </Card>

        <Card
          id="progress"
          title="Evolução"
          subtitle={summary.hasAnyMetric ? 'Última medição' : 'Acompanhe suas medidas'}
          icon="chart"
          side="right"
          linkLabel="Ver histórico →"
          linkHref="#/evolucao"
        >
          <div className="metrics">
            {METRIC_UI.map(({ key, label, unit }) => {
              const item = summary.metrics[key];
              const tone = interpretChange(key, item.delta, profile?.goal);
              return (
                <Metric
                  key={key}
                  label={label}
                  value={item.latest ? formatValue(item.latest.value, unit) : undefined}
                  delta={item.delta !== undefined ? formatDelta(item.delta, unit) : undefined}
                  tone={tone}
                  direction={item.delta !== undefined && item.delta !== 0 ? (item.delta > 0 ? 'up' : 'down') : undefined}
                />
              );
            })}
          </div>
          {!summary.hasAnyMetric ? (
            <p className="card__message">O registro de peso e medidas chega na próxima etapa. Nada é inventado aqui.</p>
          ) : null}
        </Card>

        {!profile?.goal ? (
          <EmptyState
            title="Quer personalizar sua experiência?"
            text="Escolha seu objetivo no Perfil. Ele ajuda a interpretar sua evolução."
          />
        ) : null}
      </div>
      <ManualCheckinSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}
