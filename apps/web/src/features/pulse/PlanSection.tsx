import { Link } from 'react-router';
import { PLAN_MODULE_LABELS, PLAN_MODULES, PRIORITY_LABELS, type PlanItem } from '../../domain/pulse/plan';
import { Icon } from '../../ui/Icon';

const PRIORITY_TONE: Record<PlanItem['priority'], string> = { haute: 'text-craie', moyenne: 'text-cendre', basse: 'text-cendre' };

function PlanRow({ item }: { item: PlanItem }) {
  const head = (
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="flex items-start justify-between gap-2">
        <span className="text-[15px] leading-snug font-semibold">{item.title}</span>
        {item.to && <Icon name="chevron" size={16} className="mt-1 shrink-0 text-cendre" />}
      </span>
      {item.detail && <span className="text-[13px] leading-snug">{item.detail}</span>}
      <span className="text-[13px] leading-snug">
        <span className="text-cendre">Objectif : </span>
        {item.goal}
        {item.amount ? <span className="text-cendre">. {item.amount.replace(/^./, (x) => x.toLocaleUpperCase('fr-FR'))}</span> : null}
      </span>
    </span>
  );
  return (
    <li className="flex flex-col gap-1.5 rounded-[16px] bg-anthracite p-3.5">
      {item.to ? (
        <Link to={item.to} viewTransition className="flex active:opacity-80">
          {head}
        </Link>
      ) : (
        <div className="flex">{head}</div>
      )}
      {item.pending && (
        <a href="#a-valider" className="self-start text-[13px] text-citron underline underline-offset-2">
          À valider plus bas
        </a>
      )}
      <details>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-1 text-[12px] [&::-webkit-details-marker]:hidden">
          <span className={`flex items-center gap-1 ${PRIORITY_TONE[item.priority]}`}>
            {item.priority === 'haute' && <Icon name="warning" size={12} className="text-braise" />}
            {PRIORITY_LABELS[item.priority]}
          </span>
          <span className="text-[13px] text-cendre underline underline-offset-2">Pourquoi ?</span>
        </summary>
        <div className="flex flex-col gap-1 pt-1 text-[13px] leading-snug">
          <p>{item.reason}</p>
          <p className="text-[12px] text-cendre">Données utilisées :</p>
          <ul className="flex list-disc flex-col gap-0.5 pl-4 text-[12px] text-cendre">
            {item.basis.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          {item.source && <p className="text-[12px] text-cendre">Source : {item.source}</p>}
        </div>
      </details>
    </li>
  );
}

/** Plan du jour par module : objectif, quantité, priorité, lien, et « Pourquoi ? » avec les données réellement utilisées. */
export function PlanSection({ plan }: { plan: PlanItem[] }) {
  if (!plan.length) return null;
  return (
    <section aria-label="Plan du jour" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[17px] font-semibold">Plan du jour</h2>
        <p className="text-[13px] leading-snug text-cendre">
          Tes recommandations, par module. Rien n’est appliqué sans ton accord, et tes objectifs nutritionnels ne changent jamais tout seuls.
        </p>
      </div>
      {PLAN_MODULES.map((m) => {
        const items = plan.filter((p) => p.module === m);
        if (!items.length) return null;
        return (
          <div key={m} className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold text-cendre">{PLAN_MODULE_LABELS[m]}</h3>
            <ul className="flex flex-col gap-2">
              {items.map((it) => (
                <PlanRow key={it.id} item={it} />
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
