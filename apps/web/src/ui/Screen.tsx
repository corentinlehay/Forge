import type { ReactNode } from 'react';

/** Colonne de contenu : zones sûres de l'iPhone, place pour la barre d'onglets, largeur bornée sur ordinateur. */
export function Screen({ children, withTabBar = true }: { children: ReactNode; withTabBar?: boolean }) {
  return (
    <main
      className={`pt-safe mx-auto flex w-full max-w-[560px] flex-col gap-[18px] px-5 ${
        withTabBar ? 'pb-[calc(env(safe-area-inset-bottom)+112px+var(--player-offset,0px))] lg:pb-12' : 'pb-[calc(max(env(safe-area-inset-bottom),16px)+var(--player-offset,0px))]'
      }`}
    >
      {children}
    </main>
  );
}

export function Card({ children, className = '', label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <section aria-label={label} className={`flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px] ${className}`}>
      {children}
    </section>
  );
}
