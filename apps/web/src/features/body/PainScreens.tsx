import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { repos, usePains, useToday } from '../../db/hooks';
import { DataError } from '../../db/repositories/entities';
import type { Pain } from '../../db/types';
import { ALERT_TEXT, PAIN_ACTIVITIES, PAIN_FLAGS, PAIN_SOURCES, PAIN_ZONES, painLogsSorted, painStatus, upsertLog, zoneLabel, type PainView } from '../../domain/body';
import { formatDayMonth, formatDayShort } from '../../lib/format';
import { BarChart } from '../../ui/BarChart';
import { Button } from '../../ui/Button';
import { Chips } from '../../ui/Chips';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { Sheet } from '../../ui/Sheet';
import { TextArea } from '../../ui/TextArea';
import { useToast } from '../../ui/Toast';
import { HEAD, SILHOUETTE, VIEW_H, VIEW_W } from '../muscles/bodyShapes';
import { BodyBack } from './bodyShared';

/** Couleur d'un point selon l'intensité actuelle (0 à 10) : une seule teinte d'alerte, plus foncée quand ça fait plus mal. */
const intensityColor = (v: number | null) =>
  v === null ? 'var(--forge-neutral-mark)' : v >= 7 ? 'var(--forge-danger)' : v >= 4 ? 'var(--forge-danger-2)' : 'var(--forge-danger-1)';

/** Silhouette face et dos : toucher une zone pour noter ou retrouver une douleur. */
export function PainMap({ view, active, selected, onPick }: { view: PainView; active: Map<string, number | null>; selected: string | null; onPick: (zone: string) => void }) {
  const zones = PAIN_ZONES.filter((z) => z[view]);
  return (
    <svg viewBox={`-6 0 ${VIEW_W + 12} ${VIEW_H}`} className="mx-auto h-[380px] w-auto" role="group" aria-label={`Silhouette vue ${view === 'face' ? 'de face' : 'de dos'}`}>
      <g fill="var(--forge-body)" pointerEvents="none">
        <ellipse cx={HEAD.cx} cy={HEAD.cy} rx={HEAD.rx} ry={HEAD.ry} />
        {SILHOUETTE.map((d, i) => (
          <g key={i}>
            <path d={d} />
            <path d={d} transform={`translate(${VIEW_W} 0) scale(-1 1)`} />
          </g>
        ))}
      </g>
      {zones.map((z) => {
        const [x, y] = z[view]!;
        const has = active.has(z.key);
        const isSel = selected === z.key;
        return (
          <g
            key={z.key}
            onClick={() => onPick(z.key)}
            role="button"
            tabIndex={0}
            aria-label={`${z.label}${has ? ', douleur en cours' : ''}`}
            className="cursor-pointer"
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick(z.key)}
          >
            <circle cx={x} cy={y} r="11" fill="transparent" />
            {isSel && <circle cx={x} cy={y} r="9" fill="none" stroke="var(--forge-text)" strokeWidth="1.5" />}
            <circle
              cx={x}
              cy={y}
              r={has ? 6 : 3.5}
              fill={has ? intensityColor(active.get(z.key) ?? null) : 'var(--forge-neutral-mark)'}
              stroke={has ? 'var(--forge-bg)' : 'none'}
              strokeWidth="1.5"
            />
          </g>
        );
      })}
    </svg>
  );
}

function AlertBox({ pain, today }: { pain: Pain; today: string }) {
  const s = painStatus(pain, today);
  if (!s.alerts.length) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-[18px] border border-braise/60 bg-braise/10 p-4 text-[15px] leading-snug" role="note">
      {s.alerts.map((a) => (
        <p key={a} className="flex gap-2">
          <Icon name="warning" size={18} className="mt-0.5 shrink-0 text-braise" />
          {ALERT_TEXT[a]}
        </p>
      ))}
    </div>
  );
}

const statusLine = (pain: Pain, today: string) => {
  const s = painStatus(pain, today);
  const parts = [
    s.current !== null ? `${s.current}/10` : null,
    s.trend === 'mieux' ? 'en baisse' : s.trend === 'pire' ? 'en hausse' : s.trend === 'stable' ? 'stable' : null,
    pain.resolvedOn ? `${s.days} j` : `depuis ${s.days} j`,
  ];
  return parts.filter(Boolean).join(', ');
};

/** Vue Douleurs de Progression : silhouette, douleurs en cours et passées. */
export function PainsPanel() {
  const pains = usePains();
  const today = useToday();
  const navigate = useNavigate();
  const [view, setView] = useState<PainView>('face');
  const [creating, setCreating] = useState<string | null>(null);
  const activeList = (pains ?? []).filter((p) => !p.resolvedOn);
  const past = (pains ?? []).filter((p) => p.resolvedOn);
  const active = useMemo(() => new Map(activeList.map((p) => [p.zone, painStatus(p, today).current])), [activeList, today]);

  const pick = (zone: string) => {
    const existing = activeList.find((p) => p.zone === zone);
    if (existing) void navigate(`/progression/douleur/${existing.id}`, { viewTransition: true });
    else setCreating(zone);
  };

  return (
    <>
      <section aria-label="Silhouette" className="flex flex-col gap-2 rounded-[22px] bg-anthracite p-4">
        <Segmented
          label="Vue"
          value={view}
          onChange={setView}
          options={[
            { value: 'face', label: 'De face' },
            { value: 'dos', label: 'De dos' },
          ]}
        />
        <PainMap view={view} active={active} selected={null} onPick={pick} />
        <p className="text-center text-[13px] text-cendre">
          Touche l’endroit qui fait mal pour le noter. {view === 'face' ? 'Ta droite est à gauche de l’écran.' : 'Ta droite est à droite de l’écran.'}
        </p>
      </section>

      <section aria-label="Douleurs en cours" className="flex flex-col">
        <h2 className="mb-1 text-[17px] font-semibold">En cours</h2>
        {activeList.length === 0 ? (
          <p className="text-[15px] text-cendre">Aucune douleur en cours.</p>
        ) : (
          <ul>
            {activeList.map((p) => {
              const s = painStatus(p, today);
              return (
                <li key={p.id} className="border-b border-anthracite last:border-b-0">
                  <Link to={`/progression/douleur/${p.id}`} viewTransition className="flex min-h-16 items-center gap-3 py-2.5">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: intensityColor(s.current) }} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px]">{zoneLabel(p.zone)}</span>
                      <span className="block text-[13px] text-cendre">{statusLine(p, today)}</span>
                    </span>
                    {s.alerts.length > 0 && <Icon name="warning" size={18} className="shrink-0 text-braise" aria-label="Avis médical conseillé" />}
                    <Icon name="chevron" size={18} className="shrink-0 text-cendre" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section aria-label="Douleurs passées" className="flex flex-col">
          <h2 className="mb-1 text-[17px] font-semibold">Passées</h2>
          <ul>
            {past.map((p) => (
              <li key={p.id} className="border-b border-anthracite last:border-b-0">
                <Link to={`/progression/douleur/${p.id}`} viewTransition className="flex min-h-14 items-center justify-between gap-3 py-2">
                  <span>
                    <span className="block text-[15px]">{zoneLabel(p.zone)}</span>
                    <span className="block text-[12px] text-cendre">
                      Du {formatDayShort(p.startedOn).toLocaleLowerCase('fr-FR')} au {formatDayShort(p.resolvedOn!).toLocaleLowerCase('fr-FR')}
                    </span>
                  </span>
                  <Icon name="chevron" size={18} className="text-cendre" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-[12px] leading-snug text-cendre">
        FORGE ne pose aucun diagnostic : ce suivi t’aide à décrire ta douleur à un professionnel de santé. Repères pour les signes d’alerte : {PAIN_SOURCES}.
      </p>

      <Sheet open={creating !== null} title={creating ? zoneLabel(creating) : ''} onClose={() => setCreating(null)}>
        {creating && (
          <NewPainForm
            zone={creating}
            today={today}
            onDone={(id) => {
              setCreating(null);
              if (id) void navigate(`/progression/douleur/${id}`, { viewTransition: true });
            }}
          />
        )}
      </Sheet>
    </>
  );
}

function IntensityPicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[15px]">Intensité, de 0 (rien) à 10 (insupportable)</legend>
      <div className="grid grid-cols-6 gap-1.5">
        {Array.from({ length: 11 }, (_, v) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            aria-label={`Intensité ${v} sur 10`}
            onClick={() => onChange(v)}
            className={`h-11 rounded-[12px] text-[15px] tabular-nums ${value === v ? `font-semibold ${v >= 7 ? 'text-noir' : 'text-craie'}` : 'bg-graphite text-craie'}`}
            style={value === v ? { background: intensityColor(v) } : undefined}
          >
            {v}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function FlagChecks({ flags, setFlags }: { flags: string[]; setFlags: (f: string[]) => void }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-[15px]">Tu remarques aussi (facultatif)</legend>
      {PAIN_FLAGS.map((f) => (
        <label key={f.key} className="flex min-h-11 items-center gap-3 text-[15px]">
          <input
            type="checkbox"
            checked={flags.includes(f.key)}
            onChange={(e) => setFlags(e.target.checked ? [...flags, f.key] : flags.filter((x) => x !== f.key))}
            className="h-5 w-5 shrink-0 accent-[var(--forge-danger)]"
          />
          {f.label}
        </label>
      ))}
    </fieldset>
  );
}

function NewPainForm({ zone, today, onDone }: { zone: string; today: string; onDone: (id: string | null) => void }) {
  const [startedOn, setStartedOn] = useState(today);
  const [intensity, setIntensity] = useState<number | null>(null);
  const [activities, setActivities] = useState<string[]>([]);
  const [other, setOther] = useState('');
  const [flags, setFlags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const save = async () => {
    if (intensity === null) return setError('Choisis l’intensité.');
    const acts = [
      ...activities,
      ...other
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
    ].slice(0, 10);
    try {
      const rec = await repos.pains.add({
        zone,
        startedOn,
        resolvedOn: null,
        activities: acts,
        note: note.trim(),
        logs: [{ date: today, intensity, ...(flags.length ? { flags } : {}) }],
      });
      toast.show('Douleur notée');
      onDone(rec.id);
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'Enregistrement impossible.');
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-1">
      {zone === 'poitrine' && <p className="rounded-[14px] border border-braise/60 bg-braise/10 p-3 text-[14px] leading-snug">{ALERT_TEXT.poitrine}</p>}
      <IntensityPicker value={intensity} onChange={setIntensity} />
      <Field label="Depuis le" type="date" value={startedOn} max={today} onChange={(e) => setStartedOn(e.target.value || today)} />
      <Chips
        label="Activités associées"
        options={PAIN_ACTIVITIES.map((a) => ({ value: a, label: a }))}
        selected={activities}
        onToggle={(a) => setActivities((l) => (l.includes(a) ? l.filter((x) => x !== a) : [...l, a]))}
      />
      <Field label="Autre activité (facultatif)" value={other} onChange={(e) => setOther(e.target.value)} maxLength={80} placeholder="Ex. squat, padel" />
      <FlagChecks flags={flags} setFlags={setFlags} />
      <TextArea
        label="Commentaire (facultatif)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={1000}
        rows={2}
        placeholder="Comment c’est arrivé, ce qui soulage…"
      />
      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
      <Button onClick={() => void save()}>Enregistrer</Button>
    </div>
  );
}

/** Fiche d'une douleur : alertes, évolution, journal du jour, fin ou reprise, suppression. */
export function PainDetailScreen() {
  const { id = '' } = useParams();
  const pains = usePains();
  const today = useToday();
  const toast = useToast();
  const navigate = useNavigate();
  const [logging, setLogging] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const pain = pains?.find((p) => p.id === id);
  if (!pains)
    return (
      <Screen withTabBar={false}>
        <BodyBack to="/progression?vue=douleurs" />
      </Screen>
    );
  if (!pain) {
    return (
      <Screen withTabBar={false}>
        <BodyBack to="/progression?vue=douleurs" />
        <p className="text-[15px] text-cendre">Cette douleur n’existe plus.</p>
      </Screen>
    );
  }
  const s = painStatus(pain, today);
  const logs = painLogsSorted(pain);

  return (
    <Screen withTabBar={false}>
      <BodyBack to="/progression?vue=douleurs" />
      <div className="flex flex-col gap-1">
        <h1 className="font-metal text-[34px] leading-none">{zoneLabel(pain.zone)}</h1>
        <p className="text-[15px] text-cendre">
          {pain.resolvedOn
            ? `Du ${formatDayShort(pain.startedOn).toLocaleLowerCase('fr-FR')} au ${formatDayShort(pain.resolvedOn).toLocaleLowerCase('fr-FR')}`
            : `Depuis le ${formatDayShort(pain.startedOn).toLocaleLowerCase('fr-FR')}, ${s.days} jour${s.days > 1 ? 's' : ''}`}
          {s.current !== null ? `, dernière intensité ${s.current}/10` : ''}
        </p>
      </div>
      <AlertBox pain={pain} today={today} />
      {!pain.resolvedOn && (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setLogging(true)}>Noter aujourd’hui</Button>
          <Button
            variant="secondary"
            onClick={() =>
              void repos.pains
                .update(pain.id, { resolvedOn: today, logs: upsertLog(pain.logs, { date: today, intensity: 0 }) })
                .then(() => toast.show('Bonne nouvelle : douleur passée'))
            }
          >
            Elle est passée
          </Button>
        </div>
      )}
      {pain.resolvedOn && (
        <Button variant="secondary" onClick={() => void repos.pains.update(pain.id, { resolvedOn: null }).then(() => toast.show('Douleur à nouveau suivie'))}>
          Elle est revenue
        </Button>
      )}

      {logs.length > 1 && (
        <section aria-label="Évolution" className="rounded-[22px] bg-anthracite p-4">
          <BarChart
            title="Intensité"
            bars={logs.map((l) => ({ key: l.date, label: String(Number(l.date.slice(8, 10))), value: l.intensity, detail: `${formatDayMonth(l.date)} : ${l.intensity}/10` }))}
            height={110}
          />
          <p className="mt-2 text-[13px] text-cendre">
            {s.trend === 'mieux' ? 'Elle diminue depuis le début.' : s.trend === 'pire' ? 'Elle augmente depuis le début.' : 'Pas de changement net depuis le début.'}
          </p>
        </section>
      )}

      {(pain.activities.length > 0 || pain.note) && (
        <dl className="flex flex-col gap-2 rounded-[18px] bg-anthracite p-4 text-[15px]">
          {pain.activities.length > 0 && (
            <div>
              <dt className="text-[13px] text-cendre">Activités associées</dt>
              <dd>{pain.activities.join(', ')}</dd>
            </div>
          )}
          {pain.note && (
            <div>
              <dt className="text-[13px] text-cendre">Commentaire</dt>
              <dd className="whitespace-pre-line">{pain.note}</dd>
            </div>
          )}
        </dl>
      )}

      <section aria-label="Journal" className="flex flex-col">
        <h2 className="mb-1 text-[17px] font-semibold">Journal</h2>
        <ul>
          {[...logs].reverse().map((l) => (
            <li key={l.date} className="flex flex-col gap-0.5 border-b border-anthracite py-2.5 last:border-b-0">
              <span className="flex justify-between text-[15px]">
                <span>{formatDayShort(l.date)}</span>
                <span className="tabular-nums" style={{ color: intensityColor(l.intensity) }}>
                  {l.intensity}/10
                </span>
              </span>
              {(l.flags?.length ?? 0) > 0 && <span className="text-[13px] text-braise">{l.flags!.map((f) => PAIN_FLAGS.find((x) => x.key === f)?.label ?? f).join(', ')}</span>}
              {l.note && <span className="text-[13px] text-cendre">{l.note}</span>}
            </li>
          ))}
        </ul>
      </section>

      {confirm ? (
        <div className="flex flex-col gap-2 rounded-[18px] border border-braise/50 p-4">
          <p className="text-[15px]">Supprimer cette douleur et son journal ?</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="danger"
              onClick={() =>
                void repos.pains.remove(pain.id).then(() => {
                  toast.show('Douleur supprimée');
                  void navigate('/progression?vue=douleurs', { replace: true });
                })
              }
            >
              Supprimer
            </Button>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="quiet" className="self-center text-braise!" onClick={() => setConfirm(true)}>
          Supprimer
        </Button>
      )}

      <Sheet open={logging} title={`${zoneLabel(pain.zone)}, aujourd’hui`} onClose={() => setLogging(false)}>
        {logging && <LogForm pain={pain} today={today} onDone={() => setLogging(false)} />}
      </Sheet>
    </Screen>
  );
}

function LogForm({ pain, today, onDone }: { pain: Pain; today: string; onDone: () => void }) {
  const existing = pain.logs.find((l) => l.date === today);
  const [intensity, setIntensity] = useState<number | null>(existing?.intensity ?? null);
  const [flags, setFlags] = useState<string[]>(existing?.flags ?? []);
  const [note, setNote] = useState(existing?.note ?? '');
  const toast = useToast();
  return (
    <div className="flex flex-col gap-4 pb-1">
      <IntensityPicker value={intensity} onChange={setIntensity} />
      <FlagChecks flags={flags} setFlags={setFlags} />
      <TextArea label="Note (facultatif)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} />
      <Button
        disabled={intensity === null}
        onClick={() =>
          void repos.pains
            .update(pain.id, {
              logs: upsertLog(pain.logs, { date: today, intensity: intensity!, ...(flags.length ? { flags } : {}), ...(note.trim() ? { note: note.trim() } : {}) }),
            })
            .then(() => {
              toast.show('Noté');
              onDone();
            })
        }
      >
        Enregistrer
      </Button>
    </div>
  );
}
