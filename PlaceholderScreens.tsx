import { useEffect, useState } from 'react';
import { EmptyState, ScreenHeader, Section } from '../components/ui';
import { bodyMetricsRepo } from '../data/repositories';
import { useData } from '../state/DataContext';
import { sessionStats } from '../domain/session';
import { formatMinutes } from '../domain/dates';
import { links } from '../router';
import { addDays } from '../domain/dates';
import { dayTotals } from '../domain/nutrition';

function SoonList({ items }: { items: string[] }) {
  return (
    <ul className="soon-list">
      {items.map((text) => (
        <li key={text} className="soon-list__item">
          <span>{text}</span>
          <span className="badge">Em breve</span>
        </li>
      ))}
    </ul>
  );
}

export function ProgressScreen() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    bodyMetricsRepo
      .all()
      .then((entries) => {
        if (!cancelled) setCount(entries.length);
      })
      .catch(() => {
        if (!cancelled) setCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { sessions, streaks, meals, today } = useData();
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  const mealDays = last7.map((d) => ({ d, t: dayTotals(meals.filter((m) => m.date === d)) })).filter((x) => x.t.count > 0);
  const kcalDays = mealDays.filter((x) => x.t.kcal !== null);
  const avgKcal = kcalDays.length >= 3 ? Math.round(kcalDays.reduce((n, x) => n + (x.t.kcal ?? 0), 0) / kcalDays.length) : null;
  const done = sessions.filter((x) => x.status === 'completed' || x.status === 'partial');
  const totalMin = Math.round(done.reduce((n, x) => n + x.activeMs, 0) / 60000);
  const totalSets = done.reduce((n, x) => n + sessionStats(x).doneSets, 0);
  return (
    <>
      <ScreenHeader title="Evolução" subtitle="Peso, medidas e consistência" />
      <div className="stack">
        <Section id="p-training" title="Treinos">
          {done.length < 2 ? (
            <EmptyState
              title={done.length === 0 ? 'Ainda sem treinos registrados' : 'Falta pouco para comparar'}
              text="Gráficos e comparações só aparecem quando há dados reais suficientes (a partir de 2 treinos). Nada é inventado aqui."
            />
          ) : null}
          {done.length > 0 ? (
            <div className="grid-3">
              <div className="stat"><span className="stat__value">{done.length}</span><span className="stat__label">treinos</span></div>
              <div className="stat"><span className="stat__value">{totalSets}</span><span className="stat__label">séries</span></div>
              <div className="stat"><span className="stat__value" style={{ fontSize: 18 }}>{formatMinutes(totalMin)}</span><span className="stat__label">tempo ativo</span></div>
            </div>
          ) : null}
          <p className="muted" style={{ marginTop: 12 }}>Sequência atual: {streaks.current} · recorde: {streaks.best} · dias ativos: {streaks.total}</p>
          <a className="back-link" style={{ marginTop: 8 }} href={links.history}>Ver histórico de treinos →</a>
        </Section>
        <Section id="p-food" title="Alimentação (últimos 7 dias)">
          {mealDays.length === 0 ? (
            <EmptyState title="Ainda sem refeições registradas" text="Registre suas refeições para ver aqui os dias com registro. Nada é estimado sem dados." />
          ) : (
            <p className="muted">Dias com refeições registradas: {mealDays.length} de 7.{avgKcal !== null ? ` Média nos dias com calorias informadas: ${avgKcal.toLocaleString('pt-BR')} kcal (estimativa).` : ' Dados insuficientes para uma média: são necessários 3 dias com calorias informadas.'}</p>
          )}
          <a className="back-link" style={{ marginTop: 8 }} href={links.meals}>Consultar refeições por data →</a>
        </Section>
        <Section id="p-history" title="Histórico">
          <EmptyState
            title={count ? `${count} registro(s) salvo(s)` : 'Ainda sem registros'}
            text="O registro de peso, medidas e composição corporal chega na próxima etapa."
          />
        </Section>
        <Section id="p-soon" title="O que vem por aí">
          <SoonList
            items={[
              'Peso, medidas e composição corporal',
              'Desempenho nos exercícios',
              'Fotos de progresso (totalmente opcionais, só no seu aparelho)',
            ]}
          />
        </Section>
      </div>
    </>
  );
}

export { SoonList };
