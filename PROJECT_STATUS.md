# État du projet FORGE

Mis à jour le 24 novembre 2026, livraison Bilans 1. Le détail de chaque livraison est dans docs/journal.md.

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

## Reste à faire (prompt FORGE MIND et suite)

1. **Tes séances audio.** Le code d'administration est en place (Secrets Store du compte, secret `ADMIN_CODE`) : il reste à ajouter tes enregistrements depuis l'espace créateur.
2. **IA transversale.** Coach Claude avec le contexte de tous les modules, mémoire et préférences modifiables, recommandations limitées aux contenus qui existent, données transmises réduites au nécessaire, plafond de coût par utilisateur. Nécessite ta clé API dans les secrets Cloudflare.
3. **Compte et paiement.** Modèle à décider, compte léger, prestataire de paiement, pages légales.

## Problèmes et limites techniques connus

- **Photos du corps.** Gardées sur l'iPhone seulement, hors sauvegarde (vie privée et poids du fichier) : les enregistrer dans Photos pour en garder une copie.
- **Données sur un seul appareil.** Tout est stocké sur l'iPhone (IndexedDB). Pas de synchronisation entre appareils : la sauvegarde manuelle (fichier) est la seule copie. Un compte ou une synchronisation viendra avec le paiement.
- **Sons sur iPhone.** Les repères sonores (repos, exercices Mind) passent par Web Audio : muets en mode silencieux et quand l'app est en arrière-plan.
- **Écran allumé.** Le maintien de l'écran pendant une séance ou un exercice dépend de la version d'iOS ; sinon le minuteur reste juste au retour dans l'app.
- **Audio en arrière-plan.** iOS limite la lecture en arrière-plan des apps web installées ; la lecture écran verrouillé et le minuteur d'arrêt pendant le verrouillage sont à vérifier sur ton iPhone.
- **Stockage audio limité.** KV gratuit : 1 Go (une quarantaine de séances de 20 min) et 1 000 écritures par jour (un fichier de 50 Mo en utilise environ 30). Au-delà, passer à R2 (carte bancaire demandée par Cloudflare, gratuit jusqu'à 10 Go).
- **Calcul serveur limité.** L'offre gratuite de Cloudflare accorde 10 ms de calcul par requête : les fichiers sont envoyés par morceaux de 2 Mio pour rester dessous.
- **Production en retard.** Dix versions de test attendent une validation : plus l'écart grandit, plus la mise en production sera grosse. La mise à jour depuis la production garde les données (testé à chaque livraison).
- **Mise en forme du code.** Pas de configuration Prettier dans le dépôt ; quelques anciens fichiers ne suivent pas le format du reste.
