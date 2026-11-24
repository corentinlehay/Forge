import { NavLink, useLocation } from 'react-router';
import { moduleOf, type ModuleKey } from '../app/modules';
import { markNavDirection } from '../lib/motion';
import { Icon, type IconName } from './Icon';

export const TABS: { to: string; label: string; icon: IconName; module: ModuleKey }[] = [
  { to: '/', label: 'Accueil', icon: 'home', module: 'accueil' },
  { to: '/training', label: 'Training', icon: 'training', module: 'training' },
  { to: '/nutrition', label: 'Nutrition', icon: 'nutrition', module: 'nutrition' },
  { to: '/mind', label: 'Mind', icon: 'mind', module: 'mind' },
  { to: '/progression', label: 'Progression', icon: 'progression', module: 'progression' },
];

/**
 * Barre d'onglets en bas sur iPhone ; barre latérale sur grand écran.
 * L'onglet actif prend la couleur de son espace (icône, libellé et trait), en plus du gras : la couleur n'est jamais seule.
 */
export function TabBar() {
  const { pathname } = useLocation();
  const current = TABS.findIndex((t) => t.module === moduleOf(pathname));
  return (
    <nav
      aria-label="Navigation principale"
      style={{ viewTransitionName: 'forge-tabbar' }}
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-graphite bg-noir/95 px-1.5 pt-2 pb-[max(env(safe-area-inset-bottom),10px)] backdrop-blur lg:inset-y-0 lg:right-auto lg:w-24 lg:grid-cols-1 lg:content-start lg:gap-2 lg:border-t-0 lg:border-r lg:pt-10"
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          viewTransition
          onClick={() => markNavDirection(current, TABS.indexOf(tab))}
          data-module={tab.module}
          className={({ isActive }) =>
            `relative flex min-h-11 flex-col items-center gap-[3px] text-[11px] transition-colors duration-200 lg:py-2 ${isActive ? 'font-semibold text-module' : 'text-cendre active:text-craie'}`
          }
        >
          {({ isActive }) => (
            <>
              <span
                aria-hidden="true"
                className={`absolute -top-2 h-[2px] w-6 rounded-full bg-module transition-opacity duration-200 lg:top-1/2 lg:-left-1.5 lg:h-6 lg:w-[2px] lg:-translate-y-1/2 ${isActive ? 'opacity-100' : 'opacity-0'}`}
              />
              <span className={isActive ? 'motion-pop' : ''}>
                <Icon name={tab.icon} />
              </span>
              {tab.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
