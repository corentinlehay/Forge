import { useState } from 'react';
import { Link } from 'react-router';
import { repos } from '../../db/hooks';
import { DataError } from '../../db/repositories/entities';
import type { Measurement, PhotoPose } from '../../db/types';
import { MEASURE_INFO, MEASURE_KEYS, type MeasureKey } from '../../domain/body';
import { parseDecimal } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/Toast';

export const POSE_LABELS: Record<PhotoPose, string> = { face: 'De face', profil: 'De profil', dos: 'De dos' };
const VISIBLE_KEY = 'forge.bodyPhotosVisible';

export function BodyBack({ to = '/progression', label = 'Progression' }: { to?: string; label?: string }) {
  return (
    <Link to={to} viewTransition className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
      <Icon name="back" size={20} />
      {label}
    </Link>
  );
}

/** Photos floutées par défaut (quelqu'un peut regarder l'écran) ; le choix est gardé sur l'appareil. */
export function usePhotosVisible(): [boolean, (v: boolean) => void] {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(VISIBLE_KEY) === 'oui';
    } catch {
      return false;
    }
  });
  return [
    visible,
    (v: boolean) => {
      setVisible(v);
      try {
        localStorage.setItem(VISIBLE_KEY, v ? 'oui' : 'non');
      } catch {
        /* choix gardé pour cette visite */
      }
    },
  ];
}

export function PhotoPrivacyToggle({ visible, setVisible }: { visible: boolean; setVisible: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => setVisible(!visible)} aria-pressed={visible} className="flex min-h-11 items-center gap-1.5 px-1 text-[15px] text-citron">
      <Icon name={visible ? 'eye-off' : 'eye'} size={18} />
      {visible ? 'Flouter' : 'Afficher'}
    </button>
  );
}

export function BodyImage({ src, visible, alt, className = '' }: { src: string; visible: boolean; alt: string; className?: string }) {
  return (
    <span className={`relative block overflow-hidden bg-graphite ${className}`}>
      <img src={src} alt={visible ? alt : ''} className={`h-full w-full object-cover transition-[filter] duration-200 ${visible ? '' : 'blur-xl'}`} />
      {!visible && <span className="absolute inset-0 flex items-center justify-center text-[12px] text-craie/80">Masquée</span>}
    </span>
  );
}

/** Lit une image choisie et la réduit à 1 080 px de côté au plus, en JPEG. */
export async function prepareBodyPhoto(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image illisible.'));
      el.src = url;
    });
    const scale = Math.min(1, 1080 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.82), width: canvas.width, height: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Enregistre une photo hors de FORGE (feuille de partage de l'iPhone : « Enregistrer l'image »). */
export async function savePhotoOutside(dataUrl: string, name: string): Promise<'partage' | 'telechargement'> {
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], name, { type: 'image/jpeg' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] });
    return 'partage';
  }
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  a.click();
  return 'telechargement';
}

const cmText = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v).replace('.', ','));

/** Saisie ou modification des mensurations d'une date. */
export function MeasurementForm({ existing, date, onDone }: { existing: Measurement | null; date: string; onDone: () => void }) {
  const toast = useToast();
  const [day, setDay] = useState(existing?.date ?? date);
  const [values, setValues] = useState<Record<MeasureKey, string>>(() => Object.fromEntries(MEASURE_KEYS.map((k) => [k, cmText(existing?.[k])])) as Record<MeasureKey, string>);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);

  const save = async () => {
    setError(null);
    const parsed: Partial<Record<MeasureKey, number | null>> = {};
    for (const k of MEASURE_KEYS) {
      const raw = values[k].trim();
      if (!raw) {
        parsed[k] = null;
        continue;
      }
      const v = parseDecimal(raw);
      if (v === null) return setError(`${MEASURE_INFO[k].label} : nombre attendu, en centimètres.`);
      parsed[k] = Math.round(v * 10) / 10;
    }
    if (MEASURE_KEYS.every((k) => parsed[k] === null)) return setError('Renseigne au moins une mesure.');
    try {
      // Une seule fiche par date : une nouvelle saisie le même jour complète celle qui existe.
      const sameDay = existing ?? (await repos.measurements.listActive()).find((m) => m.date === day);
      if (sameDay) {
        const kept = existing ? parsed : Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== null));
        await repos.measurements.update(sameDay.id, { date: day, ...kept });
      } else await repos.measurements.add({ date: day, ...parsed });
      toast.show('Mensurations enregistrées');
      onDone();
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'Enregistrement impossible.');
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-1">
      <Field label="Date" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        {MEASURE_KEYS.map((k) => (
          <Field
            key={k}
            label={MEASURE_INFO[k].short}
            suffix="cm"
            inputMode="decimal"
            value={values[k]}
            onChange={(e) => setValues((s) => ({ ...s, [k]: e.target.value }))}
            maxLength={6}
            placeholder="–"
          />
        ))}
      </div>
      <button type="button" onClick={() => setHelp((h) => !h)} aria-expanded={help} className="self-start py-1 text-[15px] text-citron">
        Comment mesurer
      </button>
      {help && (
        <ul className="flex flex-col gap-1.5 text-[13px] leading-snug text-cendre">
          <li>Ruban souple, le matin, avant de manger, au même endroit à chaque fois.</li>
          {MEASURE_KEYS.map((k) => (
            <li key={k}>
              <span className="text-craie">{MEASURE_INFO[k].short} :</span> {MEASURE_INFO[k].how}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
      <Button onClick={() => void save()}>Enregistrer</Button>
      {existing && (
        <Button
          variant="quiet"
          className="self-center text-braise!"
          onClick={() =>
            void repos.measurements.remove(existing.id).then(() => {
              toast.show('Mensurations supprimées');
              onDone();
            })
          }
        >
          Supprimer ces mesures
        </Button>
      )}
    </div>
  );
}
