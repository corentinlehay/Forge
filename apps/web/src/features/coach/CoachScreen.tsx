import { Link } from 'react-router';
import { Icon } from '../../ui/Icon';
import { Card, Screen } from '../../ui/Screen';
import { useDashboardData } from '../dashboard/useDashboardData';

const LINK_LABELS = { '/nutrition': 'Nutrition', '/training': 'Training', '/progression': 'Progression', '/coach': 'Coach' } as const;

const watched = [
  'Ton rythme de poids par rapport à ta fourchette (après 14 jours de pesées)',
  'Les nuits de moins de 6 h 30, surtout avant une séance',
  'Les protéines à partir de 17 h, les calories à partir de 20 h',
  'Les records battus ces deux derniers jours',
  'La régularité des séances par rapport au programme',
  'Les pesées manquantes depuis 3 jours ou plus',
];

/** Coach : l'analyse du jour en entier. Règles locales, signalées comme telles ; l'IA arrive en Phase 5. */
export function CoachScreen() {
  const data = useDashboardData();
  const brief = data?.brief;

  return (
    <Screen>
      <div className="flex flex-col gap-2">
        <h1 className="font-metal text-[40px]">Coach IA</h1>
        <p className="text-[15px] leading-snug text-cendre">L’analyse du jour, à partir de tes données enregistrées.</p>
      </div>

      <p className="flex items-start gap-2.5 rounded-[18px] border border-graphite p-3.5 text-[13px] leading-snug text-cendre">
        <Icon name="info" size={18} className="mt-0.5 shrink-0" />
        Pour l’instant, cette analyse vient de règles simples calculées sur ton appareil, sans IA. Le coach conversationnel (Claude) arrivera en Phase 5, avec une connexion sécurisée.
      </p>

      {brief && (
        <>
          <Card label="Résumé du jour">
            <h2 className="text-[13px] text-cendre">Résumé du jour</h2>
            {brief.enoughData ? (
              <ul className="flex flex-col gap-2">
                {brief.summary.map((line) => (
                  <li key={line} className="text-[15px] leading-snug">
                    {line}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[15px] leading-snug text-cendre">Rien d’enregistré aujourd’hui. Une pesée, un check-in ou un repas suffisent pour démarrer l’analyse.</p>
            )}
          </Card>

          <section aria-label="Observations" className="flex flex-col gap-3">
            <h2 className="text-[17px] font-semibold">Observations</h2>
            {brief.findings.length === 0 && <p className="text-[15px] text-cendre">Rien à signaler pour l’instant.</p>}
            {brief.findings.map((f) => (
              <article key={f.id} className="flex flex-col gap-2.5 rounded-[18px] bg-anthracite p-4">
                <p className="flex items-start gap-2 text-[15px] leading-snug">
                  <Icon
                    name={f.tone === 'good' ? 'check' : 'warning'}
                    size={18}
                    className={`mt-0.5 shrink-0 ${f.tone === 'good' ? 'text-citron' : f.tone === 'alert' ? 'text-braise' : 'text-cendre'}`}
                  />
                  {f.observation}
                </p>
                {f.recommendation && <p className="border-l-2 border-citron pl-3 text-[15px] leading-snug">{f.recommendation}</p>}
                <Link to={f.link} viewTransition className="-ml-1 flex min-h-11 items-center gap-1 self-start px-1 text-[13px] font-semibold text-cendre">
                  Voir {LINK_LABELS[f.link]}
                  <Icon name="chevron" size={14} />
                </Link>
              </article>
            ))}
          </section>
        </>
      )}

      <section aria-label="Ce que l’analyse surveille" className="flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold">Ce que l’analyse surveille</h2>
        <ul className="flex flex-col gap-2">
          {watched.map((w) => (
            <li key={w} className="flex gap-2.5 text-[15px] leading-snug text-cendre">
              <span aria-hidden="true" className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-graphite" />
              {w}
            </li>
          ))}
        </ul>
        <p className="text-[13px] text-cendre">Aucune règle n’invente de chiffre : sans données, rien n’est affiché.</p>
      </section>
    </Screen>
  );
}
