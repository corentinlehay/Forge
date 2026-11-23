# FORGE : consignes pour Claude

Application créée par Coz (musculation, nutrition, poids, récupération, coach IA). PWA local-first pour iPhone.
Ouverte à d'autres utilisateurs : chacun a ses données sur son appareil et construit son plan avec le questionnaire de départ. Vente prévue (modèle à décider) : compte léger, paiement et pages légales viendront dans une livraison dédiée ; le coût du coach IA par utilisateur devra être couvert et plafonné.
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
- Ne rien inventer sur l'utilisateur : les informations manquantes sont demandées dans l'app (questionnaire de départ ou au moment où elles servent).
- Conseils nutrition et entraînement : règles sourcées, repères généraux, jamais un avis médical ; pas de plan pour les moins de 18 ans, pas de déficit si le poids est déjà bas.
- La clé API Claude ne doit jamais apparaître dans le code ni dans le chat : elle vit dans les secrets Cloudflare.
- Logique métier dans `apps/web/src/domain/` (fonctions pures, testées) ; accès aux données dans `apps/web/src/db/`.
- Mettre à jour docs/journal.md à chaque livraison.
