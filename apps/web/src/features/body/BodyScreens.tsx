import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { repos, useBodyPhotos, useMeasurements, useToday, useWeighIns } from '../../db/hooks';
import type { BodyPhoto, Measurement, PhotoPose } from '../../db/types';
import { compareDates, MEASURE_INFO, MEASURE_KEYS, measureSeries, measureSummaries, weightAverage, type MeasureKey } from '../../domain/body';
import { formatDayShort, formatNumber } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { LineChart } from '../../ui/LineChart';
import { Screen } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { WeightPanel } from '../weight/WeightScreen';
import { BodyBack, BodyImage, MeasurementForm, PhotoPrivacyToggle, POSE_LABELS, prepareBodyPhoto, savePhotoOutside, usePhotosVisible } from './bodyShared';

const signed = (v: number, unit: string) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${formatNumber(Math.abs(v), 1)} ${unit}`;
const POSES: PhotoPose[] = ['face', 'profil', 'dos'];

/** Vue Corps de Progression : poids (avec moyenne sur 7 jours), mensurations, photos, comparaison. */
export function BodyPanel() {
  const weighIns = useWeighIns();
  const measurements = useMeasurements();
  const photos = useBodyPhotos();
  const today = useToday();
  const [visible, setVisible] = usePhotosVisible();
  const [adding, setAdding] = useState(false);
  const avg = weighIns ? weightAverage(weighIns, today) : null;
  const summaries = useMemo(() => (measurements ? measureSummaries(measurements) : []), [measurements]);
  const known = summaries.filter((s) => s.latest);
  const lastPhotos = useMemo(() => {
    if (!photos?.length) return [];
    const date = photos[0]!.date;
    return POSES.map((p) => photos.find((ph) => ph.date === date && ph.pose === p)).filter((p): p is BodyPhoto => Boolean(p));
  }, [photos]);

  return (
    <>
      {avg && (
        <p className="-mb-2 rounded-[16px] bg-anthracite px-4 py-3 text-[15px]">
          Moyenne des 7 derniers jours : <span className="font-semibold">{formatNumber(avg.kg, 1)} kg</span>{' '}
          <span className="text-cendre">
            ({avg.count} pesée{avg.count > 1 ? 's' : ''})
          </span>
        </p>
      )}
      <WeightPanel />

      <section aria-label="Mensurations" className="flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[17px] font-semibold">Mensurations</h2>
          <Button size="small" variant="secondary" onClick={() => setAdding(true)}>
            Mesurer
          </Button>
        </div>
        {known.length === 0 ? (
          <p className="text-[15px] text-cendre">Taille, poitrine, bras, cuisse, hanches : quelques centimètres disent souvent plus que la balance.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-2">
            {known.map((s) => (
              <div key={s.key} className="rounded-[14px] bg-graphite/60 p-3">
                <dt className="text-[12px] text-cendre">{MEASURE_INFO[s.key].label}</dt>
                <dd className="font-metal text-[24px] leading-tight">{formatNumber(s.latest!.value, 1)} cm</dd>
                <dd className="text-[12px] text-cendre">
                  {s.sinceFirst !== null
                    ? `${signed(s.sinceFirst, 'cm')} depuis le ${formatDayShort(s.firstDate!).toLocaleLowerCase('fr-FR')}`
                    : `le ${formatDayShort(s.latest!.date).toLocaleLowerCase('fr-FR')}`}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {known.length > 0 && (
          <Link to="/progression/mensurations" viewTransition className="flex min-h-11 items-center justify-between text-[15px] text-citron">
            Évolution et historique
            <Icon name="chevron" size={18} />
          </Link>
        )}
      </section>

      <section aria-label="Photos" className="flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[17px] font-semibold">Photos</h2>
          {lastPhotos.length > 0 && <PhotoPrivacyToggle visible={visible} setVisible={setVisible} />}
        </div>
        {lastPhotos.length > 0 ? (
          <>
            <p className="text-[13px] text-cendre">Dernières photos, {formatDayShort(photos![0]!.date).toLocaleLowerCase('fr-FR')}</p>
            <div className="grid grid-cols-3 gap-2">
              {lastPhotos.map((p) => (
                <BodyImage key={p.id} src={p.dataUrl} visible={visible} alt={`Photo ${POSE_LABELS[p.pose].toLocaleLowerCase('fr-FR')}`} className="aspect-[3/4] rounded-[12px]" />
              ))}
            </div>
          </>
        ) : (
          <p className="text-[15px] text-cendre">
            Une photo de face, de profil et de dos toutes les quelques semaines, dans la même lumière : c’est le meilleur moyen de voir le changement.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Link to="/progression/photos" viewTransition className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-graphite px-4 text-[15px]">
            <Icon name="camera" size={18} />
            {photos?.length ? 'Toutes les photos' : 'Ajouter'}
          </Link>
          <Link to="/progression/comparer" viewTransition className="flex min-h-11 items-center justify-center rounded-full bg-graphite px-4 text-[15px]">
            Comparer
          </Link>
        </div>
        <p className="text-[12px] leading-snug text-cendre">
          Les photos restent sur ton iPhone : elles ne sont ni envoyées, ni dans la sauvegarde. Elles ne mesurent ni le muscle ni la graisse.
        </p>
      </section>

      <Sheet open={adding} title="Mensurations" onClose={() => setAdding(false)}>
        {adding && <MeasurementForm existing={null} date={today} onDone={() => setAdding(false)} />}
      </Sheet>
    </>
  );
}

/** Évolution de chaque mesure et historique modifiable. */
export function MeasurementsScreen() {
  const measurements = useMeasurements();
  const today = useToday();
  const [key, setKey] = useState<MeasureKey>('waistCm');
  const [editing, setEditing] = useState<Measurement | 'new' | null>(null);
  if (!measurements)
    return (
      <Screen withTabBar={false}>
        <BodyBack />
      </Screen>
    );
  const series = measureSeries(measurements, key);
  const available = MEASURE_KEYS.filter((k) => measureSeries(measurements, k).length > 0);

  return (
    <Screen withTabBar={false}>
      <BodyBack />
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-metal text-[36px] leading-none">Mensurations</h1>
        <Button size="small" onClick={() => setEditing('new')}>
          Mesurer
        </Button>
      </div>
      {available.length > 0 && (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]" role="group" aria-label="Mesure">
          {available.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={key === k}
              onClick={() => setKey(k)}
              className={`h-10 shrink-0 rounded-full px-3.5 text-[14px] ${key === k ? 'bg-citron font-semibold text-noir' : 'bg-graphite text-craie'}`}
            >
              {MEASURE_INFO[k].short}
            </button>
          ))}
        </div>
      )}
      {series.length > 0 ? (
        <section aria-label="Évolution" className="rounded-[22px] bg-anthracite p-4">
          <LineChart points={series} unit="cm" title={MEASURE_INFO[key].label} />
          {series.length === 1 && <p className="mt-2 text-[13px] text-cendre">Une seule mesure pour l’instant : la courbe se dessine à la suivante.</p>}
        </section>
      ) : (
        <p className="text-[15px] text-cendre">{available.length ? 'Pas encore de valeur pour cette mesure.' : 'Aucune mensuration. Ajoute la première avec « Mesurer ».'}</p>
      )}
      {measurements.length > 0 && (
        <section aria-label="Historique" className="flex flex-col">
          <h2 className="mb-1 text-[17px] font-semibold">Historique</h2>
          <ul>
            {[...measurements].reverse().map((m) => (
              <li key={m.id} className="border-b border-anthracite last:border-b-0">
                <button type="button" onClick={() => setEditing(m)} className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left">
                  <span className="text-[15px]">{formatDayShort(m.date)}</span>
                  <span className="text-right text-[13px] text-cendre">
                    {MEASURE_KEYS.filter((k) => typeof m[k] === 'number')
                      .map((k) => `${MEASURE_INFO[k].short} ${formatNumber(m[k] as number, 1)}`)
                      .join(', ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Sheet open={editing !== null} title="Mensurations" onClose={() => setEditing(null)}>
        {editing !== null && <MeasurementForm existing={editing === 'new' ? null : editing} date={today} onDone={() => setEditing(null)} />}
      </Sheet>
    </Screen>
  );
}

/** Galerie des photos du corps, par date ; ajout, enregistrement dans Photos, suppression. */
export function PhotosScreen() {
  const photos = useBodyPhotos();
  const today = useToday();
  const toast = useToast();
  const [visible, setVisible] = usePhotosVisible();
  const [pose, setPose] = useState<PhotoPose>('face');
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<BodyPhoto | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const byDate = useMemo(() => {
    const map = new Map<string, BodyPhoto[]>();
    for (const p of photos ?? []) map.set(p.date, [...(map.get(p.date) ?? []), p]);
    return [...map.entries()];
  }, [photos]);

  const add = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const img = await prepareBodyPhoto(file);
      await repos.bodyPhotos.add({ date, pose, ...img });
      toast.show(`Photo ${POSE_LABELS[pose].toLocaleLowerCase('fr-FR')} ajoutée`);
      setPose(pose === 'face' ? 'profil' : pose === 'profil' ? 'dos' : 'face');
    } catch {
      toast.show('Image illisible : choisis une photo JPEG ou PNG.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <Screen withTabBar={false}>
      <BodyBack />
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-metal text-[36px] leading-none">Photos</h1>
        {(photos?.length ?? 0) > 0 && <PhotoPrivacyToggle visible={visible} setVisible={setVisible} />}
      </div>
      <section aria-label="Ajouter une photo" className="flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px]">
        <Segmented label="Pose" value={pose} onChange={setPose} options={POSES.map((p) => ({ value: p, label: POSE_LABELS[p] }))} />
        <label className="flex items-center justify-between gap-3 text-[15px]">
          Date
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} className="h-11 rounded-[12px] bg-graphite px-3 text-[15px]" />
        </label>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void add(e.target.files?.[0])} />
        <Button disabled={busy} onClick={() => input.current?.click()}>
          <Icon name="camera" size={18} />
          {busy ? 'Ajout…' : `Prendre ou choisir : ${POSE_LABELS[pose].toLocaleLowerCase('fr-FR')}`}
        </Button>
        <p className="text-[12px] leading-snug text-cendre">Même endroit, même lumière, même heure (le matin), même tenue : les comparaisons seront honnêtes.</p>
      </section>
      {byDate.length === 0 && <p className="text-[15px] text-cendre">Aucune photo pour l’instant.</p>}
      {byDate.map(([d, list]) => (
        <section key={d} aria-label={formatDayShort(d)} className="flex flex-col gap-2">
          <h2 className="text-[15px] font-semibold">{formatDayShort(d)}</h2>
          <div className="grid grid-cols-3 gap-2">
            {list.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setOpen(p)}
                aria-label={`Ouvrir la photo ${POSE_LABELS[p.pose].toLocaleLowerCase('fr-FR')}`}
                className="flex flex-col gap-1 text-left"
              >
                <BodyImage src={p.dataUrl} visible={visible} alt="" className="aspect-[3/4] w-full rounded-[12px]" />
                <span className="text-[12px] text-cendre">{POSE_LABELS[p.pose]}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      <p className="text-[12px] leading-snug text-cendre">
        Les photos restent sur ton iPhone : FORGE ne les envoie nulle part et ne les met pas dans la sauvegarde. Pour en garder une copie, ouvre-la et touche « Enregistrer dans
        Photos ».
      </p>

      <Sheet open={open !== null} title={open ? `${POSE_LABELS[open.pose]}, ${formatDayShort(open.date).toLocaleLowerCase('fr-FR')}` : ''} onClose={() => setOpen(null)}>
        {open && (
          <div className="flex flex-col gap-3 pb-1">
            <img
              src={open.dataUrl}
              alt={`Photo ${POSE_LABELS[open.pose].toLocaleLowerCase('fr-FR')} du ${formatDayShort(open.date).toLocaleLowerCase('fr-FR')}`}
              className="max-h-[60vh] w-full rounded-[16px] object-contain"
            />
            <Button variant="secondary" onClick={() => void savePhotoOutside(open.dataUrl, `forge-${open.date}-${open.pose}.jpg`).catch(() => {})}>
              Enregistrer dans Photos
            </Button>
            <Button
              variant="quiet"
              className="self-center text-braise!"
              onClick={() =>
                void repos.bodyPhotos.remove(open.id).then(() => {
                  setOpen(null);
                  toast.show('Photo supprimée');
                })
              }
            >
              Supprimer la photo
            </Button>
          </div>
        )}
      </Sheet>
    </Screen>
  );
}

/** Comparaison de deux dates : photos côte à côte, poids moyen sur 7 jours, mensurations. */
export function CompareScreen() {
  const photos = useBodyPhotos();
  const measurements = useMeasurements();
  const weighIns = useWeighIns();
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const [visible, setVisible] = usePhotosVisible();
  const [pose, setPose] = useState<PhotoPose>('face');
  const dates = useMemo(() => [...new Set([...(photos ?? []).map((p) => p.date), ...(measurements ?? []).map((m) => m.date)])].sort(), [photos, measurements]);
  const a = params.get('a') ?? dates[0] ?? today;
  const b = params.get('b') ?? dates.at(-1) ?? today;
  const set = (k: 'a' | 'b', v: string) => setParams({ a, b, [k]: v || today }, { replace: true });
  if (!photos || !measurements || !weighIns)
    return (
      <Screen withTabBar={false}>
        <BodyBack />
      </Screen>
    );
  const cmp = compareDates(weighIns, measurements, a, b);
  const photoAt = (d: string) => photos.find((p) => p.date === d && p.pose === pose);

  return (
    <Screen withTabBar={false}>
      <BodyBack />
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-metal text-[36px] leading-none">Comparer</h1>
        {photos.length > 0 && <PhotoPrivacyToggle visible={visible} setVisible={setVisible} />}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(['a', 'b'] as const).map((k) => (
          <label key={k} className="flex flex-col gap-1 text-[13px] text-cendre">
            {k === 'a' ? 'Avant' : 'Après'}
            <input
              type="date"
              value={k === 'a' ? a : b}
              max={today}
              onChange={(e) => set(k, e.target.value)}
              className="h-11 rounded-[12px] bg-anthracite px-3 text-[15px] text-craie"
            />
          </label>
        ))}
      </div>
      {dates.length > 1 && (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]" role="group" aria-label="Dates enregistrées">
          {dates.map((d) => (
            <button key={d} type="button" onClick={() => set(d < b ? 'a' : 'b', d)} className="h-9 shrink-0 rounded-full bg-graphite px-3 text-[13px]">
              {formatDayShort(d)}
            </button>
          ))}
        </div>
      )}

      {photos.length > 0 && (
        <section aria-label="Photos" className="flex flex-col gap-2">
          <Segmented label="Pose" value={pose} onChange={setPose} options={POSES.map((p) => ({ value: p, label: POSE_LABELS[p] }))} />
          <div className="grid grid-cols-2 gap-2">
            {[a, b].map((d, i) => {
              const p = photoAt(d);
              return p ? (
                <BodyImage key={i} src={p.dataUrl} visible={visible} alt={`${POSE_LABELS[pose]}, ${formatDayShort(d)}`} className="aspect-[3/4] rounded-[14px]" />
              ) : (
                <span key={i} className="flex aspect-[3/4] items-center justify-center rounded-[14px] border border-dashed border-graphite p-3 text-center text-[13px] text-cendre">
                  Pas de photo {POSE_LABELS[pose].toLocaleLowerCase('fr-FR')} ce jour-là
                </span>
              );
            })}
          </div>
        </section>
      )}

      <section aria-label="Chiffres" className="flex flex-col rounded-[22px] bg-anthracite p-4">
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-x-3 gap-y-2 text-[15px]">
          <span className="text-[12px] text-cendre" />
          <span className="text-right text-[12px] text-cendre">Avant</span>
          <span className="text-right text-[12px] text-cendre">Après</span>
          <span className="text-right text-[12px] text-cendre">Écart</span>
          <span>Poids (moy. 7 j)</span>
          <span className="text-right tabular-nums">{cmp.weight[0] !== null ? formatNumber(cmp.weight[0], 1) : '–'}</span>
          <span className="text-right tabular-nums">{cmp.weight[1] !== null ? formatNumber(cmp.weight[1], 1) : '–'}</span>
          <span className="text-right tabular-nums">
            {cmp.weight[0] !== null && cmp.weight[1] !== null ? signed(Math.round((cmp.weight[1] - cmp.weight[0]) * 10) / 10, 'kg') : '–'}
          </span>
          {cmp.measures
            .filter((m) => m.a !== null || m.b !== null)
            .map((m) => (
              <span key={m.key} className="contents">
                <span>{MEASURE_INFO[m.key].short}</span>
                <span className="text-right tabular-nums">{m.a !== null ? formatNumber(m.a, 1) : '–'}</span>
                <span className="text-right tabular-nums">{m.b !== null ? formatNumber(m.b, 1) : '–'}</span>
                <span className="text-right tabular-nums">{m.delta !== null ? signed(m.delta, 'cm') : '–'}</span>
              </span>
            ))}
        </div>
        <p className="mt-3 text-[12px] leading-snug text-cendre">
          Poids : moyenne des pesées des 7 jours jusqu’à chaque date. Mensurations : dernière mesure connue à chaque date (45 jours au plus). Les photos ne mesurent ni le muscle ni
          la graisse.
        </p>
      </section>
    </Screen>
  );
}
