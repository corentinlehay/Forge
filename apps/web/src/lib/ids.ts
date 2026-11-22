/** Identifiant unique créé sur l'appareil (prêt pour une synchronisation future). */
export function newId(): string {
  return crypto.randomUUID();
}

/** Horodatage ISO 8601 en UTC. */
export function nowIso(now: Date = new Date()): string {
  return now.toISOString();
}
