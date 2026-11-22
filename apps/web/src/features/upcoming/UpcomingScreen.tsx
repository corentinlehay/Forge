import { Screen } from '../../ui/Screen';

export type UpcomingModule = 'training' | 'nutrition' | 'coach';

const content: Record<UpcomingModule, { title: string; phase: string; intro: string; items: string[] }> = {
  training: {
    title: 'Training',
    phase: 'Phase 2',
    intro: 'Tes séances, prêtes à lancer, avec la performance de la dernière fois sous les yeux.',
    items: [
      'Bibliothèque d’exercices en français et ton split de 5 séances',
      'Séance en cours : série validée d’un geste, cible « à battre », minuteur de repos',
      'Records en direct, courbes par exercice, volume par muscle',
      'Reprise automatique si l’app se ferme en pleine séance',
    ],
  },
  nutrition: {
    title: 'Nutrition',
    phase: 'Phase 3',
    intro: 'Un aliment ajouté en trois gestes, des jauges qui se remplissent aussitôt.',
    items: [
      'Cibles calories et macros calées sur ton rythme de prise',
      'Table Ciqual hors ligne, scanner de codes-barres et Open Food Facts',
      'Journal par repas, favoris, récents et repas types',
    ],
  },
  coach: {
    title: 'Coach',
    phase: 'Phase 5',
    intro: 'Un coach IA qui lit tes vrais chiffres et ne modifie rien sans ta validation.',
    items: [
      'Questions libres sur ton entraînement, ta nutrition et ton poids',
      'Propositions d’ajustement à accepter ou refuser',
      'Résumé du jour et bilan de la semaine',
    ],
  },
};

/** Espace pas encore construit : il est signalé comme tel, sans faux bouton. */
export function UpcomingScreen({ module }: { module: UpcomingModule }) {
  const c = content[module];
  return (
    <Screen>
      <div className="flex flex-col gap-2">
        <h1 className="font-metal text-[40px]">{c.title}</h1>
        <p className="text-[15px] text-cendre">Arrive avec la {c.phase}, après validation de la précédente.</p>
      </div>
      <div className="flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px]">
        <p className="text-[17px] leading-snug">{c.intro}</p>
        <ul className="flex flex-col gap-2.5">
          {c.items.map((item) => (
            <li key={item} className="flex gap-2.5 text-[15px] leading-snug text-cendre">
              <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-graphite" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </Screen>
  );
}
