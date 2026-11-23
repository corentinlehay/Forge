import { Link, useSearchParams } from 'react-router';
import { MIND_EXERCISE_BY_ID, MIND_EXERCISES, type MindCategory } from '../../data/mindExercises';
import { CATEGORY_INFO, CATEGORY_ORDER, FAMILY_LABELS, FAMILY_ORDER, formatDuration, routineSeconds } from '../../domain/mind';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { ExerciseRow, MindBack, useFavorites, useRoutines } from './mindShared';
import { useAudioCatalog } from '../../services/audioApi';
import { audioInCategory } from '../../domain/audio';
import { AudioShelf } from '../audio/AudioScreens';

type Filter = MindCategory | 'favoris' | 'tous';

/** Bibliothèque des exercices guidés, par famille, filtrable par catégorie ou favoris. */
export function LibraryScreen() {
  const [params, setParams] = useSearchParams();
  const asked = params.get('categorie');
  const filter: Filter = asked === 'favoris' ? 'favoris' : asked && (CATEGORY_ORDER as string[]).includes(asked) ? (asked as MindCategory) : 'tous';
  const { favorites } = useFavorites();
  const { items: audio } = useAudioCatalog();
  const list = MIND_EXERCISES.filter((e) => (filter === 'tous' ? true : filter === 'favoris' ? favorites.includes(e.id) : e.categories.includes(filter)));
  const chips: { value: Filter; label: string }[] = [
    { value: 'tous', label: 'Tous' },
    { value: 'favoris', label: 'Favoris' },
    ...CATEGORY_ORDER.map((c) => ({ value: c, label: CATEGORY_INFO[c].label })),
  ];

  return (
    <Screen withTabBar={false}>
      <MindBack />
      <div className="flex flex-col gap-1">
        <h1 className="font-metal text-[40px] leading-none">{filter === 'tous' ? 'Exercices' : filter === 'favoris' ? 'Favoris' : CATEGORY_INFO[filter].label}</h1>
        <p className="text-[15px] text-cendre">{filter !== 'tous' && filter !== 'favoris' ? CATEGORY_INFO[filter].blurb : 'Courts, sans matériel, guidés à l’écran.'}</p>
      </div>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]" role="group" aria-label="Filtrer">
        {chips.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-pressed={filter === c.value}
            onClick={() => setParams(c.value === 'tous' ? {} : { categorie: c.value }, { replace: true })}
            className={`h-10 shrink-0 rounded-full px-3.5 text-[14px] whitespace-nowrap ${filter === c.value ? 'bg-brume font-semibold text-noir' : 'bg-graphite text-craie'}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {filter !== 'tous' && filter !== 'favoris' && <AudioShelf title="Séances audio" items={audioInCategory(audio, filter)} />}
      {list.length === 0 && <p className="text-[15px] text-cendre">{filter === 'favoris' ? 'Touche l’étoile d’un exercice pour le retrouver ici.' : 'Aucun exercice.'}</p>}
      {FAMILY_ORDER.map((f) => {
        const items = list.filter((e) => e.family === f);
        if (!items.length) return null;
        return (
          <section key={f} aria-label={FAMILY_LABELS[f]} className="flex flex-col">
            <h2 className="mb-1 text-[13px] text-cendre">{FAMILY_LABELS[f]}</h2>
            <ul>
              {items.map((e) => (
                <ExerciseRow key={e.id} exercise={e} favorite={favorites.includes(e.id)} />
              ))}
            </ul>
          </section>
        );
      })}
    </Screen>
  );
}

const THEMES: { title: string; blurb: string; ids: string[] }[] = [
  { title: 'Avant l’effort', blurb: 'Arriver concentré et prêt', ids: ['pret-effort', 'seance-reussie', 'point-fixe'] },
  { title: 'Motivation', blurb: 'Revenir à tes raisons', ids: ['motivation', 'objectif'] },
  { title: 'Pression et concentration', blurb: 'Avant une barre lourde, un test, une compétition', ids: ['pression', 'distractions', 'compter-souffles'] },
  { title: 'Confiance', blurb: 'Rappeler ce dont tu es capable', ids: ['confiance', 'seance-reussie'] },
  { title: 'Frustration', blurb: 'Après une séance difficile', ids: ['seance-difficile', 'decompression'] },
  { title: 'Stagnation', blurb: 'Quand les charges ne bougent plus', ids: ['stagnation', 'objectif'] },
];

/** Préparation mentale du sportif : routines avant et après, thèmes de performance. */
export function PreparationScreen() {
  const { routines } = useRoutines();
  const { favorites } = useFavorites();
  return (
    <Screen withTabBar={false}>
      <MindBack />
      <div className="flex flex-col gap-1">
        <h1 className="font-metal text-[40px] leading-none">Mental du sportif</h1>
        <p className="text-[15px] text-cendre">Des routines courtes autour de tes séances, et des exercices pour les moments difficiles.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(['avant', 'apres'] as const).map((id) => (
          <Link
            key={id}
            to={`/mind/routine/${id}`}
            viewTransition
            className="flex min-h-[96px] flex-col justify-between rounded-[18px] bg-brume-voile p-3.5 outline-1 outline-brume/25 active:scale-[0.99]"
          >
            <span className="text-[17px] font-semibold leading-tight">{routines[id].title}</span>
            <span className="flex items-center justify-between text-[13px] text-cendre">
              {formatDuration(routineSeconds(routines[id]))}
              <Icon name="play" size={18} className="text-brume" />
            </span>
          </Link>
        ))}
      </div>
      <p className="-mt-2 text-[12px] text-cendre">Chaque routine se personnalise : exercices, ordre et durées.</p>
      {THEMES.map((t) => (
        <section key={t.title} aria-label={t.title} className="flex flex-col">
          <h2 className="text-[17px] font-semibold">{t.title}</h2>
          <p className="text-[13px] text-cendre">{t.blurb}</p>
          <ul>
            {t.ids
              .map((id) => MIND_EXERCISE_BY_ID.get(id))
              .filter((e) => e !== undefined)
              .map((e) => (
                <ExerciseRow key={e.id} exercise={e} favorite={favorites.includes(e.id)} />
              ))}
          </ul>
        </section>
      ))}
    </Screen>
  );
}

/** Raccourcis vers les routines autour d'une séance (écran Training et fin de séance). */
export function TrainingMindLinks({ only }: { only?: 'avant' | 'apres' }) {
  const { routines } = useRoutines();
  const ids = only ? [only] : (['avant', 'apres'] as const);
  return (
    <div className={`grid gap-2 ${ids.length > 1 ? 'grid-cols-2' : ''}`}>
      {ids.map((id) => (
        <Link
          key={id}
          to={`/mind/routine/${id}`}
          viewTransition
          className="flex min-h-14 items-center justify-between gap-2 rounded-[16px] border border-graphite px-3.5 py-2.5 active:scale-[0.99]"
        >
          <span className="min-w-0">
            <span className="block text-[15px] leading-tight">{id === 'avant' ? 'Mental avant' : 'Retour au calme'}</span>
            <span className="block text-[12px] text-cendre">{formatDuration(routineSeconds(routines[id]))}</span>
          </span>
          <Icon name="mind" size={20} className="shrink-0 text-brume" />
        </Link>
      ))}
    </div>
  );
}
