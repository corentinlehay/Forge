import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { useEffortScale, useExercises, usePrograms, useProgramVersions, useWorkouts } from '../../db/hooks';
import type { ProgramVersion, Workout } from '../../db/types';
import { effortText } from '../../domain/effort';
import { buildCatalog, catalogItem } from '../../domain/exerciseCatalog';
import { formatRest } from '../../domain/workoutFlow';
import { toLocalDateKey } from '../../lib/dates';
import { countLabel, formatDayMonthLong, formatDayShort, formatNumber } from '../../lib/format';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { BackLink } from './ProgramsScreen';

const DAY_SHORT = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const dayOf = (iso: string) => formatDayMonthLong(toLocalDateKey(new Date(iso)));
const linesOf = (v: ProgramVersion) => v.changeSummary.split('\n').filter(Boolean);
/** « 1 autre séance », « 5 autres séances ». */
const others = (n: number, word: string) => `${n} autre${n > 1 ? 's' : ''} ${word}${n > 1 ? 's' : ''}`;
const followedBy = (v: ProgramVersion, workouts: readonly Workout[]) => workouts.filter((w) => !w.deletedAt && w.programVersionId === v.id);

/** Historique des versions d'un programme, de la plus récente à la plus ancienne. */
export function ProgramVersionsScreen() {
  const { id = '' } = useParams();
  const programs = usePrograms();
  const versions = useProgramVersions(id);
  const workouts = useWorkouts();
  const program = programs?.find((p) => p.id === id);
  const back = <BackLink to={`/training/programmes/${id}`} label="Programme" />;
  if (!programs || !versions || !workouts) return <Screen withTabBar={false}>{back}</Screen>;
  if (!program)
    return (
      <Screen withTabBar={false}>
        <BackLink to="/training/programmes" label="Programmes" />
        <p className="text-[17px]">Ce programme n’existe plus.</p>
      </Screen>
    );
  const current = versions.find((v) => v.id === program.currentVersionId) ?? versions.at(-1);

  return (
    <Screen withTabBar={false}>
      {back}
      <div className="flex flex-col gap-1">
        <h1 className="font-metal text-[40px] leading-[0.95]">Versions</h1>
        <p className="text-[15px] text-cendre">{program.name}</p>
      </div>
      <p className="text-[15px] leading-snug text-cendre">
        Une nouvelle version naît quand tu modifies le programme après l’avoir suivi. Les séances déjà faites gardent la version qu’elles ont suivie.
      </p>
      {versions.length === 0 && <p className="text-[17px]">Pas encore de version : elle sera créée à ta première modification ou ta première séance.</p>}
      <ol className="flex flex-col gap-2">
        {[...versions].reverse().map((v) => {
          const lines = linesOf(v);
          const done = followedBy(v, workouts).length;
          return (
            <li key={v.id}>
              <Link
                to={`/training/programmes/${program.id}/versions/${v.id}`}
                viewTransition
                className="flex flex-col gap-1.5 rounded-[18px] bg-anthracite px-4 py-3 active:scale-[0.99]"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-[17px] font-semibold">Version {v.version}</span>
                  <span className="flex items-center gap-2 text-cendre">
                    {v.id === current?.id && <span className="rounded-full bg-citron px-2.5 py-0.5 text-[12px] font-semibold text-noir">Actuelle</span>}
                    <Icon name="chevron" size={16} />
                  </span>
                </span>
                <span className="text-[13px] text-cendre">
                  {dayOf(v.createdAt)}, {done ? `suivie par ${countLabel(done, 'séance')}` : 'pas encore suivie'}
                </span>
                <span className="flex flex-col gap-0.5 text-[14px] leading-snug">
                  {lines.slice(0, 3).map((l) => (
                    <span key={l}>{l}</span>
                  ))}
                  {lines.length > 3 && <span className="text-cendre">et {others(lines.length - 3, 'changement')}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </Screen>
  );
}

/** Une version : ce qui a changé, et le programme tel qu'il était (en lecture seule). */
export function ProgramVersionScreen() {
  const { id = '', versionId = '' } = useParams();
  const programs = usePrograms();
  const versions = useProgramVersions(id);
  const workouts = useWorkouts();
  const exercises = useExercises();
  const scale = useEffortScale();
  const catalog = useMemo(() => buildCatalog(exercises ?? []), [exercises]);
  const back = <BackLink to={`/training/programmes/${id}/versions`} label="Versions" />;
  if (!programs || !versions || !workouts || !exercises) return <Screen withTabBar={false}>{back}</Screen>;
  const program = programs.find((p) => p.id === id);
  const version = versions.find((v) => v.id === versionId);
  if (!program || !version)
    return (
      <Screen withTabBar={false}>
        {back}
        <p className="text-[17px]">Cette version n’existe plus.</p>
      </Screen>
    );
  const nameOf = (exerciseId: string) => catalogItem(catalog, exerciseId)?.name ?? exercises.find((e) => e.id === exerciseId)?.name ?? 'Exercice';
  const snap = version.snapshot;
  const done = followedBy(version, workouts).sort((a, b) => b.date.localeCompare(a.date));
  const isCurrent = version.id === (program.currentVersionId ?? versions.at(-1)?.id);

  return (
    <Screen withTabBar={false}>
      {back}
      <div className="flex flex-col gap-1">
        {isCurrent && <span className="self-start rounded-full bg-citron px-2.5 py-0.5 text-[12px] font-semibold text-noir">Actuelle</span>}
        <h1 className="font-metal text-[40px] leading-[0.95]">Version {version.version}</h1>
        <p className="text-[15px] text-cendre">
          {snap.name}, {dayOf(version.createdAt)}
        </p>
      </div>

      <section aria-label="Ce qui a changé" className="flex flex-col gap-2 rounded-[18px] bg-anthracite p-4">
        <h2 className="text-[13px] text-cendre">{version.version === 1 ? 'Point de départ' : `Par rapport à la version ${version.version - 1}`}</h2>
        <ul className="flex flex-col gap-1.5">
          {linesOf(version).map((l) => (
            <li key={l} className="text-[15px] leading-snug">
              {l}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Séances de cette version" className="flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold">Séances de cette version</h2>
        {snap.sessions.length === 0 && <p className="text-[15px] text-cendre">Aucune séance dans cette version.</p>}
        {snap.sessions.map((s) => (
          <div key={s.templateId} className="flex flex-col gap-2 rounded-[18px] bg-anthracite p-4">
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-[17px] font-semibold">{s.name}</span>
              <span className="text-[13px] text-cendre">{s.weekdays.length ? s.weekdays.map((d) => DAY_SHORT[d - 1]).join(', ') : 'sans jour fixe'}</span>
            </p>
            {s.warmup && <p className="text-[13px] leading-snug text-cendre">Échauffement : {s.warmup}</p>}
            <ol className="flex flex-col gap-1.5">
              {s.exercises.map((e, i) => (
                <li key={`${e.exerciseId}-${i}`} className="flex flex-col">
                  <span className="text-[15px]">
                    {i + 1}. {nameOf(e.exerciseId)}
                  </span>
                  <span className="text-[13px] text-cendre">
                    {[
                      `${e.sets} × ${e.reps || 'libre'}`,
                      e.rir !== null && e.rir !== undefined ? effortText(e.rir, scale) : null,
                      e.restSec ? `repos ${formatRest(e.restSec)}` : null,
                      e.startWeightKg !== undefined && e.startWeightKg !== null ? `départ ${formatNumber(e.startWeightKg, e.startWeightKg % 1 ? 1 : 0)} kg` : null,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                  {e.notes && <span className="text-[13px] leading-snug text-craie/90">{e.notes}</span>}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>

      <section aria-label="Séances faites avec cette version" className="flex flex-col gap-1">
        <h2 className="text-[17px] font-semibold">Séances faites avec cette version</h2>
        {done.length === 0 ? (
          <p className="text-[15px] text-cendre">Aucune pour l’instant.</p>
        ) : (
          <ul>
            {done.slice(0, 8).map((w) => (
              <li key={w.id} className="border-b border-anthracite last:border-b-0">
                <Link to={`/training/seance/${w.id}`} viewTransition className="flex min-h-11 items-center justify-between gap-3 py-2">
                  <span className="text-[15px]">{w.name}</span>
                  <span className="flex items-center gap-2 text-[13px] text-cendre">
                    {formatDayShort(w.date)}
                    <Icon name="chevron" size={16} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {done.length > 8 && <p className="text-[13px] text-cendre">et {others(done.length - 8, 'séance')}</p>}
      </section>
    </Screen>
  );
}
