# FORGE : consignes pour Claude

Application personnelle de Coz (musculation, nutrition, poids, récupération, coach IA). PWA local-first pour iPhone.
Coz travaille uniquement depuis son iPhone : il ne lance aucune commande, il valide les versions de test sur son téléphone.

- Dossier d'architecture : https://claude.ai/artifact/1Vtt7rULxvYFWAD1jFpXoD
- Planche visuelle : https://claude.ai/artifact/8pjbTLLq589DoYguuvgNE8
- Journal des versions : docs/journal.md

## Règles de travail

- Interface et textes en français, tutoiement, ton direct.
- `npm run check` (types, tests, build) doit passer avant tout envoi. Cloudflare relance la même commande et bloque la mise en ligne en cas d'échec.
- `main` = production. Le travail se fait sur une branche ; Cloudflare publie une version de test par branche ; fusion dans `main` après validation de Coz.
- Ne jamais casser une fonction qui marche : chaque changement de schéma Dexie passe par une nouvelle version testée, sans perte de données.
- Aucun bouton décoratif. Une fonction inachevée reste masquée. Toute simulation est signalée explicitement.
- Ne rien inventer sur Coz : les informations manquantes sont demandées dans l'app, au moment où elles servent.
- La clé API Claude ne doit jamais apparaître dans le code ni dans le chat : elle vit dans les secrets Cloudflare.
- Logique métier dans `apps/web/src/domain/` (fonctions pures, testées) ; accès aux données dans `apps/web/src/db/`.
- Mettre à jour docs/journal.md à chaque livraison.
