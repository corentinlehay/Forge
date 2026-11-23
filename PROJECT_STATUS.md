# État du projet FORGE

Mis à jour le 23 novembre 2026, livraison Mind 1. Le détail de chaque livraison est dans docs/journal.md.

## En production (branche `main`)

- Interface V1 et tableau de bord : pesée, poids lissé, check-in, accueil, réglages, sauvegarde, installation sur iPhone.

## Terminé, en attente de validation (versions de test, branches empilées)

Chaque branche contient les précédentes. La mise en production se fait d'un bloc, sur ton « mets en production ».

| Branche | Contenu |
|---|---|
| `nutrition-1` | Ajout d'aliments (recherche, Open Food Facts, scanner, table Ciqual hors ligne), journal, fibres, hydratation |
| `training-1` | Séance en direct, programmes, bibliothèque de 91 exercices, surcharge progressive, minuteur de repos |
| `depart-1` | Questionnaire de départ, plan nutrition et entraînement calculé par règles sourcées |
| `muscles-1` | Carte des muscles face et dos, volume par muscle |
| `kitchen-1` | 32 recettes Ciqual, recettes perso, Compose mon repas, planning, listes de courses, prix |
| `budget-1` | Objectifs dynamiques (analyse, proposition, validation, historique), budget alimentaire |
| `mind-1` | Espace Mind, 26 exercices guidés interactifs, routines personnalisables, journal émotionnel, sommeil détaillé |

Base de données locale : version 7. Chaque changement de schéma a son test de migration sans perte.

## Reste à faire (prompt FORGE MIND et suite)

1. **Mind 2 : séances audio.** Bibliothèque, lecteur (lecture, ±15 s, progression, minuteur d'arrêt, reprise, arrière-plan si iOS le permet, écoute hors connexion), catégorie Hypnose avec précautions, espace d'administration privé pour tes contenus (stockage Cloudflare R2, code d'administration dans les secrets Cloudflare).
2. **Progression 2.** Mensurations (taille, poitrine, bras, cuisse), photos du corps protégées et comparaisons entre dates, suivi des douleurs sur silhouette sans diagnostic.
3. **Bilans.** Analyses croisées entre modules (corrélation, jamais causalité), bilan hebdomadaire avec historique, calendrier global jour, semaine, mois, motivation discrète (records, régularité, badges) sans culpabilisation.
4. **IA transversale.** Coach Claude avec le contexte de tous les modules, mémoire et préférences modifiables, recommandations limitées aux contenus qui existent, données transmises réduites au nécessaire, plafond de coût par utilisateur. Nécessite ta clé API dans les secrets Cloudflare.
5. **Compte et paiement.** Modèle à décider, compte léger, prestataire de paiement, pages légales.

## Problèmes et limites techniques connus

- **Données sur un seul appareil.** Tout est stocké sur l'iPhone (IndexedDB). Pas de synchronisation entre appareils : la sauvegarde manuelle (fichier) est la seule copie. Un compte ou une synchronisation viendra avec le paiement.
- **Sons sur iPhone.** Les repères sonores (repos, exercices Mind) passent par Web Audio : muets en mode silencieux et quand l'app est en arrière-plan.
- **Écran allumé.** Le maintien de l'écran pendant une séance ou un exercice dépend de la version d'iOS ; sinon le minuteur reste juste au retour dans l'app.
- **Audio en arrière-plan (Mind 2).** iOS limite la lecture en arrière-plan des apps web installées ; à vérifier sur ton iPhone pendant Mind 2.
- **Production en retard.** Sept versions de test attendent une validation : plus l'écart grandit, plus la mise en production sera grosse. La mise à jour depuis la production garde les données (testé à chaque livraison).
- **Mise en forme du code.** Pas de configuration Prettier dans le dépôt ; quelques anciens fichiers ne suivent pas le format du reste.
