# État du projet FORGE

Mis à jour le 24 novembre 2026, audit FORGE PULSE (aucun code modifié). Le détail de chaque livraison est dans docs/journal.md.

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

Base de données locale : version 10. Serveur : relais Open Food Facts et séances audio (Workers KV `forge-audio`). Chaque changement de schéma a son test de migration sans perte.

## Audit FORGE PULSE (24 novembre 2026)

Document complet, avec l'architecture, les cinq scénarios et le plan : https://claude.ai/artifact/TYs77QWqYgYutAHa48vmH9. Le cahier des charges de PULSE n'a pas encore été reçu : l'audit part de la demande (score quotidien, moteur de décision, Apple Santé et Apple Watch, recommandations Training, Nutrition, Mind, Recovery).

- **Intégration sans refonte.** Le moteur lit l'index jour par jour de Bilans 1 et réutilise une quinzaine de fonctions testées (récupération estimée, sommeil, journal, douleurs et alertes, surcharge progressive, séance du jour, objectifs dynamiques, garde-fous du plan). Il ajoute `domain/pulse/`, `features/pulse/` et la base v11 (`healthDays`, `pulseDays`), sans modifier aucune table existante.
- **Apple Santé.** Aucun accès possible depuis une app web, ni API dans le cloud. Chemins réels : Raccourci iOS puis collage dans FORGE (sans serveur), app native Capacitor avec HealthKit (programme développeur Apple, compilation dans le cloud, revue App Store), ou API Oura et WHOOP (compte FORGE nécessaire). Garmin a suspendu les nouvelles demandes d'accès. L'Apple Watch passe uniquement par Apple Santé.
- **Données de santé.** Elles restent sur l'iPhone : pas d'hébergement serveur, donc pas de question HDS tant que rien n'est stocké en ligne.
- **Moteur.** Score sur 100 (Sommeil, Physiologie si montre, Ressenti, Charge, Mental) avec niveau de confiance ; nutrition hors du score mais dans les recommandations ; règles de sécurité et tendances prioritaires ; chaque modification proposée, jamais appliquée sans validation. Poids et seuils = exemples de conception, pas des seuils validés médicalement.
- **Décisions attendues.** Validation de l'architecture, des poids de départ et des cinq scénarios ; chemin Apple Santé ; mise en production de la pile avant PULSE ; envoi du cahier des charges ; modèle d'Apple Watch porté.

## Reste à faire

1. **Valider l'audit PULSE** (liste des décisions dans le document).
2. **Mise en production de la pile actuelle**, recommandée avant PULSE 1 pour ne pas empiler davantage.
3. **Tes séances audio.** Le code d'administration est en place (Secrets Store du compte, secret `ADMIN_CODE`) : il reste à ajouter tes enregistrements depuis l'espace créateur.
4. **PULSE 1 : moteur sur les données FORGE.** Score du matin, mode du jour, recommandations dans les quatre espaces, séance allégée ou déplacée après validation, règles de sécurité, base v11, cinq scénarios en tests.
5. **PULSE 2 : Apple Santé par Raccourci.** Raccourci prêt à installer, bouton « Importer depuis Santé », composante Physiologie après 14 jours de données.
6. **PULSE 3 : PULSE dans les Bilans.** Score dans le bilan et le calendrier, semaine de décharge proposée, réglage de la sensibilité, notification du matin en option.
7. **IA transversale (dont PULSE 4).** Coach Claude avec le contexte de tous les modules, explication du score sans décision ni levée de garde-fou, mémoire et préférences modifiables, recommandations limitées aux contenus qui existent, données transmises réduites au nécessaire, plafond de coût par utilisateur. Nécessite ta clé API dans les secrets Cloudflare.
8. **Compte et paiement.** Modèle à décider, compte léger, prestataire de paiement, pages légales ; avec la décision app native ou API Oura et WHOOP.

## Problèmes et limites techniques connus

- **Apple Santé et Apple Watch.** Une app web n'a aucun accès à Apple Santé : import par Raccourci iOS (PULSE 2) ou app native à décider. Pas de calcul en arrière-plan : le score PULSE se calculera à l'ouverture.
- **Photos du corps.** Gardées sur l'iPhone seulement, hors sauvegarde (vie privée et poids du fichier) : les enregistrer dans Photos pour en garder une copie.
- **Données sur un seul appareil.** Tout est stocké sur l'iPhone (IndexedDB). Pas de synchronisation entre appareils : la sauvegarde manuelle (fichier) est la seule copie. Un compte ou une synchronisation viendra avec le paiement.
- **Sons sur iPhone.** Les repères sonores (repos, exercices Mind) passent par Web Audio : muets en mode silencieux et quand l'app est en arrière-plan.
- **Écran allumé.** Le maintien de l'écran pendant une séance ou un exercice dépend de la version d'iOS ; sinon le minuteur reste juste au retour dans l'app.
- **Audio en arrière-plan.** iOS limite la lecture en arrière-plan des apps web installées ; la lecture écran verrouillé et le minuteur d'arrêt pendant le verrouillage sont à vérifier sur ton iPhone.
- **Stockage audio limité.** KV gratuit : 1 Go (une quarantaine de séances de 20 min) et 1 000 écritures par jour (un fichier de 50 Mo en utilise environ 30). Au-delà, passer à R2 (carte bancaire demandée par Cloudflare, gratuit jusqu'à 10 Go).
- **Calcul serveur limité.** L'offre gratuite de Cloudflare accorde 10 ms de calcul par requête : les fichiers sont envoyés par morceaux de 2 Mio pour rester dessous.
- **Production en retard.** Dix versions de test attendent une validation : plus l'écart grandit, plus la mise en production sera grosse. La mise à jour depuis la production garde les données (testé à chaque livraison).
- **Mise en forme du code.** Pas de configuration Prettier dans le dépôt ; quelques anciens fichiers ne suivent pas le format du reste.
