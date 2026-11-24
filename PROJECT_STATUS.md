# État du projet FORGE

Mis à jour le 24 novembre 2026, livraison PULSE 1. Le détail de chaque livraison est dans docs/journal.md.

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
| `mind-2` | Séances audio (stockage Cloudflare KV), lecteur complet, hors connexion, catégorie Hypnose, espace créateur privé |
| `progression-2` | Moyenne de poids sur 7 jours, mensurations, photos du corps, comparaison de dates, suivi des douleurs sur silhouette |
| `bilans-1` | Bilan de la semaine avec notes et historique, calendrier jour, semaine, mois, analyses croisées sans causalité, badges et régularité |
| `pulse-1` | PULSE 1 : Readiness Score expliqué et Nutrition Status séparé, règles de sécurité, recommandations Training, Nutrition, Mind, Recovery, séance allégée ou déplacée après validation, réglages |

Base de données locale : version 11. Serveur : relais Open Food Facts et séances audio (Workers KV `forge-audio`). Chaque changement de schéma a son test de migration sans perte.

## Audit FORGE PULSE (24 novembre 2026)

Document complet, avec l'architecture, les cinq scénarios et le plan : https://claude.ai/artifact/TYs77QWqYgYutAHa48vmH9. Le cahier des charges de PULSE n'a pas encore été reçu : l'audit part de la demande (score quotidien, moteur de décision, Apple Santé et Apple Watch, recommandations Training, Nutrition, Mind, Recovery).

- **Intégration sans refonte.** Le moteur lit l'index jour par jour de Bilans 1 et réutilise une quinzaine de fonctions testées (récupération estimée, sommeil, journal, douleurs et alertes, surcharge progressive, séance du jour, objectifs dynamiques, garde-fous du plan). Il ajoute `domain/pulse/`, `features/pulse/` et la base v11 (`healthDays`, `pulseDays`), sans modifier aucune table existante.
- **Apple Santé.** Aucun accès possible depuis une app web, ni API dans le cloud. Chemins réels : Raccourci iOS puis collage dans FORGE (sans serveur), app native Capacitor avec HealthKit (programme développeur Apple, compilation dans le cloud, revue App Store), ou API Oura et WHOOP (compte FORGE nécessaire). Garmin a suspendu les nouvelles demandes d'accès. L'Apple Watch passe uniquement par Apple Santé.
- **Données de santé.** Elles restent sur l'iPhone : pas d'hébergement serveur, donc pas de question HDS tant que rien n'est stocké en ligne.
- **Moteur.** Score sur 100 (Sommeil, Physiologie si montre, Ressenti, Charge, Mental) avec niveau de confiance ; nutrition hors du score mais dans les recommandations ; règles de sécurité et tendances prioritaires ; chaque modification proposée, jamais appliquée sans validation. Poids et seuils = exemples de conception, pas des seuils validés médicalement.
- **Décisions attendues.** Validation de l'architecture, des poids de départ et des cinq scénarios ; chemin Apple Santé ; mise en production de la pile avant PULSE ; envoi du cahier des charges ; modèle d'Apple Watch porté.

**Validé par Coz le 24 novembre 2026 :**
- l'architecture ;
- deux indicateurs séparés, Readiness Score et Nutrition Status, la nutrition ne pénalisant pas le Readiness Score ;
- les poids de départ comme base expérimentale, avec gestion des données manquantes, de la fiabilité des sources et des références personnelles, composantes explicables et seuils réglables ;
- le chemin Apple Santé : PULSE 1, puis Raccourci en PULSE 2, puis app native plus tard ;
- une architecture compatible avec un futur multi-utilisateur, sans fonctions commerciales pour l'instant ;
- les cinq scénarios comme tests de référence.

**Pile vérifiée avant PULSE 1 :** les dix versions de test sont intégrées dans bilans-1, et `npm run check` passe. Elles ne sont pas en production : on attend « mets en production ».

## Préparation multi-utilisateur (sans fonction commerciale)

- Moteur PULSE en fonctions pures : il reçoit les données d'une personne et ne garde aucun état global.
- Données et réglages PULSE dans la base locale de la personne (table `pulseDays`, réglage `pulseSettings`), compris dans la sauvegarde. Rien n'est gardé dans le navigateur hors de la base.
- Chaque ligne porte son identifiant, ses dates de création et de modification, et sa suppression logique : la synchronisation et la séparation par compte restent possibles (une base par compte).
- Aucune donnée de santé sur un serveur.

## Reste à faire

1. **Tester PULSE 1** sur la version de test (`pulse-1`). PULSE 2 ne commence qu'après ta validation explicite.
2. **Mise en production de la pile actuelle**, recommandée avant PULSE 1 pour ne pas empiler davantage.
3. **Tes séances audio.** Le code d'administration est en place (Secrets Store du compte, secret `ADMIN_CODE`) : il reste à ajouter tes enregistrements depuis l'espace créateur.
4. **PULSE 2 : Apple Santé par Raccourci.** Raccourci prêt à installer, bouton « Importer depuis Santé », composante Physiologie après 14 jours de données.
5. **PULSE 3 : PULSE dans les Bilans.** Score dans le bilan et le calendrier, semaine de décharge proposée, réglage de la sensibilité, notification du matin en option.
6. **IA transversale (dont PULSE 4).** Coach Claude avec le contexte de tous les modules, explication du score sans décision ni levée de garde-fou, mémoire et préférences modifiables, recommandations limitées aux contenus qui existent, données transmises réduites au nécessaire, plafond de coût par utilisateur. Nécessite ta clé API dans les secrets Cloudflare.
7. **Compte et paiement.** Modèle à décider, compte léger, prestataire de paiement, pages légales ; avec la décision app native ou API Oura et WHOOP.

## Problèmes et limites techniques connus

- **PULSE sans montre pour l'instant.** La composante Physiologie attend l'import Apple Santé (PULSE 2) : la confiance reste au plus « moyenne », et son poids est réparti sur les autres composantes.
- **Séance déplacée.** Elle est reproposée le lendemain dans PULSE, mais le programme et le calendrier ne changent pas.
- **Apple Santé et Apple Watch.** Une app web n'a aucun accès à Apple Santé : import par Raccourci iOS (PULSE 2) ou app native à décider. Pas de calcul en arrière-plan : le score PULSE se calculera à l'ouverture.
- **Photos du corps.** Gardées sur l'iPhone seulement, hors sauvegarde (vie privée et poids du fichier) : les enregistrer dans Photos pour en garder une copie.
- **Données sur un seul appareil.** Tout est stocké sur l'iPhone (IndexedDB). Pas de synchronisation entre appareils : la sauvegarde manuelle (fichier) est la seule copie. Un compte ou une synchronisation viendra avec le paiement.
- **Sons sur iPhone.** Les repères sonores (repos, exercices Mind) passent par Web Audio : muets en mode silencieux et quand l'app est en arrière-plan.
- **Écran allumé.** Le maintien de l'écran pendant une séance ou un exercice dépend de la version d'iOS ; sinon le minuteur reste juste au retour dans l'app.
- **Audio en arrière-plan.** iOS limite la lecture en arrière-plan des apps web installées ; la lecture écran verrouillé et le minuteur d'arrêt pendant le verrouillage sont à vérifier sur ton iPhone.
- **Stockage audio limité.** KV gratuit : 1 Go (une quarantaine de séances de 20 min) et 1 000 écritures par jour (un fichier de 50 Mo en utilise environ 30). Au-delà, passer à R2 (carte bancaire demandée par Cloudflare, gratuit jusqu'à 10 Go).
- **Calcul serveur limité.** L'offre gratuite de Cloudflare accorde 10 ms de calcul par requête : les fichiers sont envoyés par morceaux de 2 Mio pour rester dessous.
- **Production en retard.** Onze versions de test attendent une validation : plus l'écart grandit, plus la mise en production sera grosse. La mise à jour depuis la production garde les données (testé à chaque livraison).
- **Mise en forme du code.** Pas de configuration Prettier dans le dépôt ; quelques anciens fichiers ne suivent pas le format du reste.
