import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { toLocalDateKey } from '../lib/dates';
import { getDb } from './schema';
import { createMetaRepo } from './repositories/meta';
import { createProfileRepo } from './repositories/profile';
import { createWeighInRepo } from './repositories/weighIns';
import type { Profile, WeighIn } from './types';

/**
 * Lectures réactives : chaque écran se met à jour dès qu'une donnée change en base.
 * `undefined` = encore en chargement.
 */

export const repos = {
  get weighIns() {
    return createWeighInRepo(getDb());
  },
  get profile() {
    return createProfileRepo(getDb());
  },
  get meta() {
    return createMetaRepo(getDb());
  },
};

export function useWeighIns(): WeighIn[] | undefined {
  return useLiveQuery(() => repos.weighIns.listActive(), []);
}

export function useProfile(): Profile | undefined {
  return useLiveQuery(() => repos.profile.get(), []);
}

/** Valeur d'un réglage : `null` si absente, `undefined` pendant le chargement. */
export function useMeta<T>(key: string): T | null | undefined {
  return useLiveQuery(() => repos.meta.get<T>(key), [key]);
}

/** Le jour local, mis à jour au retour dans l'app et à minuit. */
export function useToday(): string {
  const [today, setToday] = useState(() => toLocalDateKey(new Date()));
  useEffect(() => {
    const refresh = () => setToday(toLocalDateKey(new Date()));
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return today;
}
