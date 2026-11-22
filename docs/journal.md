# Journal des versions

## Phase 1, en cours

### Fait
- Planche visuelle « Métal et mesure » : palette avec contrastes vérifiés, deux options de typographie, écrans Accueil, Poids et Séance.
- Socle technique : Vite, React 19, TypeScript strict, Tailwind 4, PWA (manifeste et service worker en mode « mise à jour proposée »).
- Base locale v1 (Dexie) : profil, pesées, réglages système ; identifiants UUID, horodatages, suppression logique.
- Logique du poids : une valeur par jour, poids tendance lissé (10 % par jour), rythme sur 14 jours, fourchette de prise en % du poids.
- Sauvegarde : export JSON versionné, validation complète avant import, modes « remplacer » et « fusionner », rappel au-delà de 7 jours.
- Stockage persistant demandé, détection de l'app installée.
- 34 tests unitaires.

### À faire
- Choix de la police (option A ou B), puis design system en composants.
- Écrans : installation guidée, onboarding, pesée, poids, sauvegarde.
- Mise en ligne : dépôt GitHub et Cloudflare.
