import { TabBar } from './components/TabBar';
import { useRoute } from './router';
import { HomeScreen } from './screens/HomeScreen';
import { Onboarding } from './screens/Onboarding';
import { MealsScreen } from './screens/MealsScreen';
import { ProgressScreen } from './screens/PlaceholderScreens';
import { ProfileScreen } from './screens/ProfileScreen';
import { QuestionnaireScreen } from './screens/QuestionnaireScreen';
import { WorkoutRouter } from './screens/WorkoutRouter';
import { useApp } from './state/AppContext';

export default function App() {
  const { status, profile, storageError } = useApp();
  const route = useRoute();

  if (status === 'loading') return <div className="boot" aria-busy="true" />;
  if (!profile?.onboardingDone) return <Onboarding />;

  return (
    <div className="app-shell">
      <main className="screen" id="main">
        {storageError ? (
          <p className="notice" role="status">
            Não foi possível usar o armazenamento deste navegador. Suas alterações podem não ser salvas (isso acontece em
            abas privadas).
          </p>
        ) : null}
        {route.key === 'inicio' && <HomeScreen />}
        {route.key === 'treino' && <WorkoutRouter params={route.params} />}
        {route.key === 'questionario' && <QuestionnaireScreen />}
        {route.key === 'refeicoes' && <MealsScreen />}
        {route.key === 'evolucao' && <ProgressScreen />}
        {route.key === 'perfil' && <ProfileScreen key="perfil" />}
      </main>
      <TabBar active={route.tab} />
    </div>
  );
}
