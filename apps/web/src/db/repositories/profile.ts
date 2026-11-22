import type { ForgeDB } from '../schema';
import type { GainRate, Profile } from '../types';
import { nowIso } from '../../lib/ids';

/**
 * Fourchette de départ : 0,25 à 0,5 % du poids par semaine (Iraki et al., 2019,
 * pratiquant non avancé). Elle est modifiable à tout moment dans les réglages.
 */
export const DEFAULT_GAIN_RATE: GainRate = { lowPctPerWeek: 0.25, highPctPerWeek: 0.5 };

export class ProfileError extends Error {}

type ProfilePatch = Partial<Omit<Profile, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>;

function validate(patch: ProfilePatch): void {
  if (patch.heightCm !== undefined && (patch.heightCm < 100 || patch.heightCm > 250)) {
    throw new ProfileError('La taille doit être comprise entre 100 et 250 cm.');
  }
  if (patch.gainRate) {
    const { lowPctPerWeek, highPctPerWeek } = patch.gainRate;
    if (lowPctPerWeek < 0 || highPctPerWeek > 2 || lowPctPerWeek >= highPctPerWeek) {
      throw new ProfileError('Fourchette de prise invalide : le bas doit être inférieur au haut, entre 0 et 2 % par semaine.');
    }
  }
}

export function createProfileRepo(db: ForgeDB) {
  return {
    /** Le profil existant, ou un profil vide avec la fourchette par défaut (non enregistré). */
    async get(): Promise<Profile> {
      const existing = await db.profile.get('me');
      if (existing) return existing;
      const stamp = nowIso(new Date(0));
      return { id: 'me', createdAt: stamp, updatedAt: stamp, deletedAt: null, gainRate: { ...DEFAULT_GAIN_RATE } };
    },

    async update(patch: ProfilePatch, now: Date = new Date()): Promise<Profile> {
      validate(patch);
      const stamp = nowIso(now);
      const existing = await db.profile.get('me');
      const next: Profile = existing
        ? { ...existing, ...patch, updatedAt: stamp }
        : { id: 'me', createdAt: stamp, updatedAt: stamp, deletedAt: null, gainRate: { ...DEFAULT_GAIN_RATE }, ...patch };
      await db.profile.put(next);
      return next;
    },
  };
}
