import { useEffect, useState } from 'react';
import { MUSCLE_LABELS, type MuscleGroup } from '../../data/muscles';
import type { CatalogItem } from '../../domain/exerciseCatalog';

/** Vignette carrée : première image de l'exercice, ou l'initiale du groupe musculaire pour un exercice perso. */
export function ExerciseThumb({ item, size = 48 }: { item: Pick<CatalogItem, 'images' | 'muscle' | 'name'>; size?: number }) {
  const style = { width: size, height: size };
  if (item.images) {
    return <img src={item.images[0]} alt="" width={size} height={size} loading="lazy" decoding="async" style={style} className="shrink-0 rounded-[12px] bg-craie object-cover" />;
  }
  return (
    <span aria-hidden="true" style={style} className="font-metal flex shrink-0 items-center justify-center rounded-[12px] bg-graphite text-[18px] text-cendre">
      {(item.muscle ? MUSCLE_LABELS[item.muscle as MuscleGroup] : item.name).slice(0, 2)}
    </span>
  );
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Démonstration : départ et fin du mouvement en alternance.
 * Avec « Réduire les animations », les deux positions sont affichées côte à côte.
 */
export function ExerciseDemo({ images, name }: { images: [string, string]; name: string }) {
  const [frame, setFrame] = useState(0);
  const [still] = useState(reducedMotion);
  useEffect(() => {
    if (still) return;
    const timer = window.setInterval(() => setFrame((f) => 1 - f), 1100);
    return () => window.clearInterval(timer);
  }, [still]);

  if (still) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {images.map((src, i) => (
          <figure key={src} className="m-0 flex flex-col gap-1">
            <img src={src} alt={`${name}, ${i ? 'fin' : 'départ'} du mouvement`} className="aspect-[3/2] w-full rounded-[14px] bg-craie object-cover" />
            <figcaption className="text-[12px] text-cendre">{i ? 'Fin' : 'Départ'}</figcaption>
          </figure>
        ))}
      </div>
    );
  }
  return (
    <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[18px] bg-craie" role="img" aria-label={`${name} : départ et fin du mouvement, en alternance`}>
      {images.map((src, i) => (
        <img key={src} src={src} alt="" className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${frame === i ? 'opacity-100' : 'opacity-0'}`} />
      ))}
    </div>
  );
}
