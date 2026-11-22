import { Icon } from '../../ui/Icon';

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

const iosSteps = [
  { title: 'Ouvre le menu de partage', detail: 'Touche le bouton Partager (le carré avec une flèche). Avec la barre compacte de Safari, il se trouve dans le menu •••.' },
  { title: 'Choisis « Sur l’écran d’accueil »', detail: 'Fais défiler la liste ou touche « Afficher plus » si l’option n’apparaît pas.' },
  { title: 'Garde « Ouvrir en tant qu’app web » activé', detail: 'Puis touche « Ajouter ».' },
  { title: 'Ouvre FORGE depuis l’écran d’accueil', detail: 'L’app s’ouvre en plein écran et fonctionne sans réseau.' },
];

/** Étapes d'installation sur iPhone (Safari), ou indication pour ordinateur. */
export function InstallGuide() {
  if (!isIos()) {
    return (
      <p className="text-[15px] leading-snug text-cendre">
        Sur ordinateur, Chrome et Edge proposent d’installer FORGE depuis la barre d’adresse (icône d’installation). Tu peux aussi l’utiliser
        directement dans le navigateur.
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-4">
      {iosSteps.map((step, i) => (
        <li key={step.title} className="flex gap-3.5">
          <span aria-hidden="true" className="font-metal flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-graphite text-[20px]">
            {i + 1}
          </span>
          <div className="flex flex-col gap-0.5 pt-1">
            <p className="text-[15px] font-semibold">{step.title}</p>
            <p className="text-[13px] leading-snug text-cendre">{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function InstallWhy() {
  return (
    <p className="flex items-start gap-2.5 text-[13px] leading-snug text-cendre">
      <Icon name="phone" size={18} className="mt-0.5 shrink-0" />
      Installée, l’app a son propre stockage, séparé de Safari : ce que tu saisis dans un onglet n’apparaîtra pas dans l’app. Installe-la avant de
      commencer.
    </p>
  );
}
