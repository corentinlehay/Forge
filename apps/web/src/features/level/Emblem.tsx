import { useProfile } from '../../db/hooks';
import type { AvatarConfig, Specialization } from '../../db/types';
import { cleanInitials, DEFAULT_AVATAR, readAvatar } from '../../domain/level/avatar';
import { EMBLEM_VIEWBOX, emblemMarkup } from './emblemMarkup';

interface EmblemProps {
  config?: AvatarConfig | null;
  name: string | null;
  level: number;
  size?: number;
  /** Remplace le centre (le chiffre du niveau dans une annonce ou l'historique). */
  label?: string;
  specialization?: Specialization | null;
  /** Sans étoiles ni bandeau, pour les petites tailles. */
  bare?: boolean;
}

/** Initiales affichées : celles choisies, sinon la première lettre du prénom, sinon F. */
export function emblemText(config: AvatarConfig | null | undefined, name: string | null): string {
  return config?.initiales || cleanInitials(name ?? '').slice(0, 1) || 'F';
}

/** L'emblème FORGE LEVEL de l'utilisateur, dessiné d'après sa composition. */
export function Emblem({ config, name, level, size = 72, label, specialization, bare = false }: EmblemProps) {
  const c = config ?? DEFAULT_AVATAR;
  const markup = emblemMarkup(c, { text: emblemText(c, name), label, level, specialization, bare });
  return (
    <svg
      width={size}
      height={Math.round((size * EMBLEM_VIEWBOX.height) / EMBLEM_VIEWBOX.width)}
      viewBox={`0 0 ${EMBLEM_VIEWBOX.width} ${EMBLEM_VIEWBOX.height}`}
      role="img"
      aria-label={label ? `Niveau ${label}` : `Emblème, niveau ${level}`}
      className="shrink-0"
      // Le dessin est produit à partir du catalogue et de lettres filtrées (voir emblemMarkup).
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

/** L'emblème de l'utilisateur, d'après son profil. */
export function UserEmblem({ level, size, label, bare }: { level: number; size?: number; label?: string; bare?: boolean }) {
  const profile = useProfile();
  if (profile === undefined) return <span style={{ width: size, height: size }} className="inline-block shrink-0" />;
  return (
    <Emblem
      config={readAvatar(profile?.avatar)}
      name={profile?.firstName ?? null}
      level={level}
      size={size}
      label={label}
      specialization={profile?.specialization ?? null}
      bare={bare}
    />
  );
}
