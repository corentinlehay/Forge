# FORGE

Application personnelle de musculation, nutrition, poids, récupération et coaching IA.
PWA local-first installée sur iPhone : les données vivent sur l'appareil, un backend réduit sert uniquement au coach.

Dossier d'architecture et plan de développement : https://claude.ai/artifact/1Vtt7rULxvYFWAD1jFpXoD
Planche visuelle : https://claude.ai/artifact/8pjbTLLq589DoYguuvgNE8

## Pile technique

React 19, TypeScript strict, Vite, Tailwind CSS 4, Dexie (IndexedDB), Zod, vite-plugin-pwa.
Tests : Vitest et fake-indexeddb. Hébergement : Cloudflare Workers (fichiers statiques, puis API).

## Commandes

```sh
npm install        # dépendances
npm run dev        # serveur de développement
npm test           # tests unitaires
npm run typecheck  # vérification des types
npm run build      # build de production dans apps/web/dist
npm run check      # les trois à la suite, obligatoire avant toute mise en ligne
```

## Organisation

```text
apps/web/src/
  app/        coquille, routes, onboarding, bandeau de mise à jour
  design/     tokens (couleurs, typographie, animations)
  ui/         composants du design system
  db/         schéma Dexie, migrations, accès aux données, lectures réactives
  domain/     logique métier pure et testée
  features/   un dossier par espace ou fonction (accueil, poids, réglages…)
  services/   sauvegarde, stockage, partage de fichiers
  lib/        dates, formats, identifiants
apps/web/assets-src/  source des icônes (build-icons.sh régénère les PNG)
docs/         journal des versions
```

## Règles

- Une donnée n'existe qu'à un endroit ; les indicateurs sont calculés, jamais saisis.
- Une montée de version du schéma ne détruit jamais de données, et chaque migration est testée.
- Aucun bouton décoratif ; une fonction inachevée reste masquée.
- `npm run check` doit passer avant chaque mise en ligne.
