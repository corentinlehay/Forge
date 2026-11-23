import { NavLink } from 'react-router';
import { Icon, type IconName } from './Icon';

export const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Accueil', icon: 'home' },
  { to: '/training', label: 'Training', icon: 'training' },
  { to: '/nutrition', label: 'Nutrition', icon: 'nutrition' },
  { to: '/mind', label: 'Mind', icon: 'mind' },
  { to: '/progression', label: 'Progression', icon: 'progression' },
];

/** Barre d'onglets en bas sur iPhone ; barre latérale sur grand écran. */
export function TabBar() {
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-graphite bg-noir/95 px-1.5 pt-2 pb-[max(env(safe-area-inset-bottom),10px)] backdrop-blur lg:inset-y-0 lg:right-auto lg:w-24 lg:grid-cols-1 lg:content-start lg:gap-2 lg:border-t-0 lg:border-r lg:pt-10"
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          viewTransition
          className={({ isActive }) => `flex min-h-11 flex-col items-center gap-[3px] text-[11px] lg:py-2 ${isActive ? 'font-semibold text-craie' : 'text-cendre'}`}
        >
          <Icon name={tab.icon} />
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
