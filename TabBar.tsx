import { Icon } from './Icon';
import type { IconName } from './Icon';
import type { TabKey } from '../router';

const TABS: ReadonlyArray<{ key: TabKey; label: string; icon: IconName }> = [
  { key: 'inicio', label: 'Início', icon: 'home' },
  { key: 'treino', label: 'Treino', icon: 'dumbbell' },
  { key: 'refeicoes', label: 'Refeições', icon: 'utensils' },
  { key: 'evolucao', label: 'Evolução', icon: 'chart' },
  { key: 'perfil', label: 'Perfil', icon: 'user' },
];

export function TabBar({ active }: { active: TabKey }) {
  return (
    <nav className="tabbar" aria-label="Navegação principal">
      <ul className="tabbar__list">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <li key={tab.key} className="tabbar__item">
              <a
                className={`tab${isActive ? ' tab--active' : ''}`}
                href={`#/${tab.key}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon name={tab.icon} size={24} strokeWidth={isActive ? 2.2 : 1.8} />
                <span className="tab__label">{tab.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
