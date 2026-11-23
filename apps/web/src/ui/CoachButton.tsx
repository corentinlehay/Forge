import { Link } from 'react-router';
import { Icon } from './Icon';

/** Accès au coach depuis l'en-tête des grands écrans : le coach n'est plus un onglet, il est partout. */
export function CoachButton() {
  return (
    <Link to="/coach" viewTransition aria-label="Coach" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-graphite text-craie active:scale-95">
      <Icon name="coach" size={20} />
    </Link>
  );
}
