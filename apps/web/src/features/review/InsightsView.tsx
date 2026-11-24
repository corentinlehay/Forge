import { useMemo } from 'react';
import { crossInsights, formatInsightValue, type Insight } from '../../domain/insights';
import { Card } from '../../ui/Screen';
import type { LifeModel } from './useLifeData';

/** Liens entre tes données : des coïncidences à regarder, jamais des causes. */
export function InsightsView({ model }: { model: LifeModel }) {
  const r = useMemo(() => crossInsights(model.index, model.data, model.today), [model]);
  return (
    <>
      <p className="text-[15px] leading-snug text-cendre">
        Comparaisons sur tes {r.days} derniers jours. Elles montrent des coïncidences entre tes données, pas des causes : un lien observé peut avoir une autre explication.
      </p>
      {r.found.length === 0 && (
        <p className="rounded-[18px] bg-anthracite p-4 text-[15px] leading-snug">
          {r.flat.length ? 'Aucune différence nette entre tes données pour l’instant.' : 'Pas encore assez de données pour comparer.'} Les analyses s’affinent quand tu notes ton
          sommeil (check-in), ton humeur (journal Mind), tes séances et tes douleurs.
        </p>
      )}
      {r.found.map((i) => (
        <InsightCard key={i.id} insight={i} />
      ))}
      {r.flat.length > 0 && (
        <section aria-label="Sans différence nette" className="flex flex-col">
          <h2 className="mb-1 text-[17px] font-semibold">Sans différence nette</h2>
          <ul>
            {r.flat.map((f) => (
              <li key={f.id} className="border-b border-anthracite py-2.5 last:border-b-0">
                <p className="text-[15px]">{f.title}</p>
                <p className="text-[13px] leading-snug text-cendre">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {r.pending.length > 0 && (
        <section aria-label="En attente de données" className="flex flex-col">
          <h2 className="mb-1 text-[17px] font-semibold">En attente de données</h2>
          <ul>
            {r.pending.map((p) => (
              <li key={p.id} className="border-b border-anthracite py-2.5 last:border-b-0">
                <p className="text-[15px]">{p.title}</p>
                <p className="text-[13px] leading-snug text-cendre">{p.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-[12px] leading-snug text-cendre">
        Calculé sur ton iPhone, sans IA. Un écart n’est affiché qu’à partir d’un seuil (par exemple 0,4 point sur 5) et avec assez de jours de chaque côté.
      </p>
    </>
  );
}

function InsightCard({ insight: i }: { insight: Insight }) {
  return (
    <Card label={i.title}>
      <h2 className="text-[13px] text-cendre">{i.title}</h2>
      <p className="text-[15px] leading-snug">{i.text}</p>
      <div className="flex flex-col gap-2.5">
        <Bar group={i.a} unit={i.unit} other={i.b.value} tone="bg-citron" />
        <Bar group={i.b} unit={i.unit} other={i.a.value} tone="bg-cendre" />
      </div>
      {i.caveat && <p className="text-[13px] leading-snug text-cendre">{i.caveat}</p>}
    </Card>
  );
}

function Bar({ group, unit, other, tone }: { group: Insight['a']; unit: Insight['unit']; other: number; tone: string }) {
  const label = `${group.label} : ${formatInsightValue(group.value, unit)}, ${group.n} ${unit === 'pct' ? 'séances' : 'jours'}`;
  // Écart en % : barres de part et d'autre d'un zéro central ; échelles : longueur depuis zéro.
  const max = unit === 'scale5' ? 5 : unit === 'scale10' ? 10 : unit === 'hours' ? Math.max(9, group.value, other) : Math.max(10, Math.abs(group.value), Math.abs(other));
  const ratio = Math.min(Math.abs(group.value) / max, 1);
  return (
    <div className="flex flex-col gap-1" role="img" aria-label={label}>
      <div className="flex items-baseline justify-between gap-2 text-[13px]" aria-hidden="true">
        <span className="text-cendre">
          {group.label} <span className="text-[12px]">({group.n})</span>
        </span>
        <span className="font-semibold tabular-nums">{formatInsightValue(group.value, unit)}</span>
      </div>
      {unit === 'pct' ? (
        <div className="relative h-2 rounded-full bg-graphite" aria-hidden="true">
          <span className="absolute inset-y-0 left-1/2 w-px bg-cendre" />
          <span
            className={`absolute inset-y-0 rounded-full ${tone}`}
            style={group.value >= 0 ? { left: '50%', width: `${ratio * 50}%` } : { right: '50%', width: `${ratio * 50}%` }}
          />
        </div>
      ) : (
        <div className="h-2 overflow-hidden rounded-full bg-graphite" aria-hidden="true">
          <span className={`block h-full rounded-full ${tone}`} style={{ width: `${ratio * 100}%` }} />
        </div>
      )}
    </div>
  );
}
