import { useRouteError } from 'react-router';
import { Button } from '../ui/Button';
import { Screen } from '../ui/Screen';

/** Écran de secours si un écran plante : les données, elles, restent intactes en base. */
export function RouteError() {
  const error = useRouteError();
  const detail = error instanceof Error ? error.message : null;
  return (
    <Screen withTabBar={false}>
      <h1 className="font-metal pt-6 text-[40px]">Oups</h1>
      <p className="text-[17px] leading-snug">Cet écran a rencontré une erreur. Tes données ne sont pas touchées.</p>
      {detail && <p className="rounded-[14px] bg-anthracite p-3 text-[13px] text-cendre">{detail}</p>}
      <Button onClick={() => window.location.assign('/')}>Recharger l’app</Button>
    </Screen>
  );
}
