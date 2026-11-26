# État du projet FORGE

Mis à jour le 26 novembre 2026 : FORGE PROGRAMS, livraisons `programmes-1`, `programmes-2` et `generateur-1` en version de test (empilées).

## En production (branche `main`, depuis le 25 novembre 2026)

Base de données locale : version 11. Une base de la production précédente (version 2) passe directement en version 11, sans perte, ce qui est testé. Ce que la production contient, livraison par livraison :

| Branche | Contenu |
|---|---|
| Interface V1 | Pesée, poids lissé, check-in, accueil et tableau de bord, réglages, sauvegarde, installation sur iPhone |
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
| `motion-1` | FORGE MOTION : système de mouvement centralisé, transitions entre onglets, appui et sélection animés, score PULSE et dimensions qui apparaissent, compte à rebours circulaire, retour haptique, courbes tracées et meilleur point, écart avec aujourd'hui sur la courbe de poids, accueil adaptatif (séance, après séance, soir, après pesée) |
| `epaules-1` | Questionnaire, zone « Épaules » renforcée : plus aucun développé au-dessus de la tête, tractions, dips, écartés, développé incliné ni extension triceps au-dessus de la tête ; développé au sol, puis machine et haltères en premier ; consigne « élévations latérales jusqu'à hauteur d'épaule ». Conseils de matériel exacts (FORGE ne propose plus un matériel que tu as déjà) |
| `volume-1` | Volume d'une séance en grand : le bloc Volume se touche, une vue plein écran compte le total pendant que chaque série se pose, avec record, palier, comparaison avec la séance précédente du même type, total depuis la première séance, graphique des dernières séances et phrase FORGE. Rien n'est inventé : chaque phrase vient des séances enregistrées |
| `repartition-1` | Questionnaire, 3 jours par semaine : choix entre « Corps entier à chaque séance » et « Haut, bas, haut » (une séance jambes complète avec une ou deux séries d'épaules, deux séances haut du corps). Séances du haut jamais deux jours de suite. Avertissement quand deux séances corps entier se suivent |
| `signature-1` | FORGE SIGNATURE : nouvelle palette dans un système de couleurs unique (docs/design-system.md), couleur par espace pour les graphiques, indicateurs et l'onglet actif, vert FORGE pour toutes les actions principales, rouge d'alerte distinct de l'orange Nutrition, icône de l'app aux nouvelles couleurs |
| `pulse-1-2` | PULSE 1.2 : plan du jour par module avec « Pourquoi ? », rubrique Sommeil, proposition à valider (accepter, garder, modifier, reporter, revenir en arrière), version allégée appliquée par Training, bilan du soir, historique des décisions et des bilans |
| `pulse-1` | PULSE 1 et 1.1 : indicateur expliqué en 5 dimensions et lu en 4 niveaux, couverture, évolution sur 7 et 30 jours, analyse du jour, Nutrition Status séparé, règles de sécurité, proposition de séance qui garde toujours « Garder », check-in passable en 5 questions, historique par période, réglages |

Base de données locale : version 11. Serveur : relais Open Food Facts et séances audio (Workers KV `forge-audio`). Chaque changement de schéma a son test de migration sans perte.

## En attente de validation (version de test)

| Branche | Contenu |
|---|---|
| `programmes-1` | FORGE PROGRAMS, livraison 1 : base Dexie v12 (table des versions, table du journal d'activité encore vide, champs facultatifs des programmes, rien de réécrit), statuts brouillon, actif, pause, terminé, archivé, objectif et objectif secondaire, durée et début du cycle, description. Écrans plein format : liste par statut, fiche programme (semaine du cycle, semaine type, séances, actions), création et modification. Remplace la feuille « Programmes » de Training |
| `programmes-2` | FORGE PROGRAMS, livraison 2 (par-dessus `programmes-1`) : échauffement par séance, consigne et charge de départ par exercice, affichage RIR ou RPE (Réglages, Effort des séries). Versions : nouvelle version quand un programme déjà suivi est modifié, avec la liste des changements ; historique et détail de chaque version ; chaque séance retient la version suivie |
| `generateur-1` | FORGE PROGRAMS, livraison 3 (par-dessus `programmes-2`) : assistant « Générer avec FORGE » (Training, Programmes). Questions pré-remplies (objectif parmi 8 et secondaire, niveau avec l'historique, jours et durée de 30 à 90 min, poussée-tirage-jambes sur 3 jours, salle ou maison, machines ou poids libres, jusqu'à 3 priorités, séries plus lourdes ou plus légères, favoris, exercices à éviter, zones). Proposition : séances avec durée estimée, volume par muscle sur le repère de 10 à 20 séries, avertissements, « Pourquoi ces choix ». Valider et activer, ou enregistrer en brouillon. Date de naissance demandée si elle manque, rien sous 18 ans |

## Audit FORGE LEVEL et FORGE PROGRAMS (26 novembre 2026)

Phase 0 du cahier des charges « FORGE LEVEL & FORGE PROGRAMS » v1.0 : audit, conflits, architecture, données, règles LEVEL, moteur de génération, risques, découpage. Aucun code. Document complet : https://claude.ai/artifact/24EFHzYVpamQstVjdLs9w9

- **Constat :** une bonne moitié de PROGRAMS existe déjà (programmes multiples, un seul actif, séances modifiables, génération déterministe validée avant adoption, double progression, propositions PULSE qui n'écrasent jamais le programme).
- **Conflits principaux :**
    - tables du cahier en double avec `programs` et `workoutTemplates` ;
    - pas de `userId` (un utilisateur par appareil) ;
    - XP, badges et caractéristiques à calculer depuis les données plutôt qu'à stocker ;
    - Endurance et Mobilité sans aucune donnée source ;
    - volume aux haltères compté pour une main.
- **Migration prévue :** Dexie v12, une table `programVersions` et des champs facultatifs, sans perte.
- **Découpage :** environ onze versions de test, de `programmes-1` à `avatar-1`.
- **Décisions validées par Coz le 26 novembre :** les huit, avec l'emblème pour l'avatar V1.
- **Endurance et Mobilité (choisi le 26 novembre) :** un journal d'activité à remplir soi-même, cardio et mobilité en minutes. Table `activities` ajoutée dès la migration v12 de `programmes-1` ; écran de saisie dans `suivi-2`.

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

**Cahier des charges PULSE v1.0, reçu après PULSE 1 :** il est gardé dans `docs/pulse-cahier-des-charges.md`, et la comparaison détaillée est dans le document d'audit.
- **Ce qu'il confirme :** règles déterministes dans le code, propositions toujours validées, données manquantes gérées, aucun diagnostic.
- **Points tranchés par Coz :**
    - la nutrition reste un indicateur séparé, hors du score ;
    - les dimensions restent celles de PULSE 1 (Sommeil, Physiologie, Ressenti, Charge, Mental) ;
    - le score se lit avec les 4 niveaux du cahier, et la proposition de séance est séparée et garde toujours « Garder » ;
    - l'ordre est PULSE 1.1, puis 1.2, puis 2 (connecteurs).
- **Fait en PULSE 1.1 :**
    - niveaux de lecture réglables ;
    - couverture, fraîcheur et principaux facteurs ;
    - évolution sur 7 et 30 jours ;
    - analyse du jour (observé, déclaré, estimé, hypothèse, manquant) ;
    - check-in unifié et passable ;
    - écran d'historique avec comparaison de périodes et taux d'acceptation ;
    - fusion des sources contradictoires ;
    - documentation technique (`docs/pulse.md`) ;
    - les 7 cas de test du cahier.
- **Fait en PULSE 1.2 (V2 du cahier) :**
    - plan du jour avec objectif, justification, durée, priorité, lien et « Pourquoi ? » ;
    - rubrique Sommeil avec heure de coucher indicative ;
    - validation complète : accepter, refuser, modifier, reporter, expliquer, trace, retour en arrière ;
    - bilan du soir et ressenti selon le choix.
- **Reste du cahier après PULSE 1.2 :**
    - connecteurs (V3) ;
    - apprentissage personnel (V4) ;
    - couche IA pour formuler les recommandations et répondre à « Pourquoi ? » en langage naturel ;
    - séance audio recommandée dans le plan, une fois ton catalogue audio en place.
- **Connecteurs réellement opérationnels :** aucun, en dehors de la saisie manuelle et des données FORGE.

**Pile vérifiée avant PULSE 1 :** les dix versions de test sont intégrées dans bilans-1, et `npm run check` passe. Elles ne sont pas en production : on attend « mets en production ».

## Préparation multi-utilisateur (sans fonction commerciale)

- Moteur PULSE en fonctions pures : il reçoit les données d'une personne et ne garde aucun état global.
- Données et réglages PULSE dans la base locale de la personne (table `pulseDays`, réglage `pulseSettings`), compris dans la sauvegarde. Rien n'est gardé dans le navigateur hors de la base.
- Chaque ligne porte son identifiant, ses dates de création et de modification, et sa suppression logique : la synchronisation et la séparation par compte restent possibles (une base par compte).
- Aucune donnée de santé sur un serveur.

## Reste à faire

1. **Valider `programmes-1`, `programmes-2` et `generateur-1`**, puis mise en production des trois ; ensuite `generateur-2` (modifier une proposition, régénérer, comparer).
2. **Tes amis** : refaire le questionnaire (Réglages, Refaire le questionnaire) pour recevoir les nouveaux programmes (zone « Épaules » cochée ; « Haut, bas, haut » sur 3 jours).
3. **Vérifier la production sur ton iPhone** :
    - la mise à jour de l'app et la reprise de tes données ;
    - le retour haptique (iOS 18 et plus).
4. **Logo : choisir parmi les pistes proposées** (aucune modification du dessin sans ton accord).
5. **Tes séances audio.** Le code d'administration est en place (Secrets Store du compte, secret `ADMIN_CODE`) : il reste à ajouter tes enregistrements depuis l'espace créateur.
6. **PULSE 2 : connecteurs.** Raccourci Apple Santé prêt à installer, bouton « Importer depuis Santé », registre de connecteurs, provenance, dédoublonnage, données contradictoires. Seulement après ta validation explicite.
7. **PULSE 3 : apprentissage personnel.** Préférences apprises, consultables et modifiables, analyse des résultats des recommandations, semaine de décharge proposée, notification du matin en option.
8. **IA transversale (dont la couche IA de PULSE et le « Pourquoi ? »).** Coach Claude avec le contexte de tous les modules, explication du score sans décision ni levée de garde-fou, mémoire et préférences modifiables, recommandations limitées aux contenus qui existent, données transmises réduites au nécessaire, plafond de coût par utilisateur. Nécessite ta clé API dans les secrets Cloudflare.
9. **Compte et paiement.** Modèle à décider, compte léger, prestataire de paiement, pages légales ; avec la décision app native ou API Oura et WHOOP.

## Problèmes et limites techniques connus

- **PULSE sans montre pour l'instant.** La composante Physiologie attend l'import Apple Santé (PULSE 2) : la confiance reste au plus « moyenne », et son poids est réparti sur les autres composantes. La fusion de plusieurs appareils est prête et testée, mais aucune source n'est encore branchée.
- **Historique PULSE recalculé.** Les scores passés sont recalculés avec les réglages actuels : changer un réglage change aussi l'historique. Le score affiché chaque jour reste visible dans la vue Jour.
- **Séance déplacée.** Elle est reproposée le lendemain dans PULSE, mais le programme, le calendrier et la séance du jour de l'accueil et de Training ne changent pas.
- **Bilan du soir.** Il demande que PULSE ait été ouvert ce jour-là (pour connaître le plan proposé). Il s'ouvre à partir de 17 h et reste possible le lendemain.
- **Apple Santé et Apple Watch.** Une app web n'a aucun accès à Apple Santé : import par Raccourci iOS (PULSE 2) ou app native à décider. Pas de calcul en arrière-plan : le score PULSE se calculera à l'ouverture.
- **Photos du corps.** Gardées sur l'iPhone seulement, hors sauvegarde (vie privée et poids du fichier) : les enregistrer dans Photos pour en garder une copie.
- **Données sur un seul appareil.** Tout est stocké sur l'iPhone (IndexedDB). Pas de synchronisation entre appareils : la sauvegarde manuelle (fichier) est la seule copie. Un compte ou une synchronisation viendra avec le paiement.
- **Sons sur iPhone.** Les repères sonores (repos, exercices Mind) passent par Web Audio : muets en mode silencieux et quand l'app est en arrière-plan.
- **Écran allumé.** Le maintien de l'écran pendant une séance ou un exercice dépend de la version d'iOS ; sinon le minuteur reste juste au retour dans l'app.
- **Audio en arrière-plan.** iOS limite la lecture en arrière-plan des apps web installées ; la lecture écran verrouillé et le minuteur d'arrêt pendant le verrouillage sont à vérifier sur ton iPhone.
- **Stockage audio limité.** KV gratuit : 1 Go (une quarantaine de séances de 20 min) et 1 000 écritures par jour (un fichier de 50 Mo en utilise environ 30). Au-delà, passer à R2 (carte bancaire demandée par Cloudflare, gratuit jusqu'à 10 Go).
- **Calcul serveur limité.** L'offre gratuite de Cloudflare accorde 10 ms de calcul par requête : les fichiers sont envoyés par morceaux de 2 Mio pour rester dessous.
- **Bleu Progression et violet Mind proches.** Écart perçu 11,6 (sous le seuil de 15), 4,2 pour un daltonien deutéranope. Sans conséquence tant qu'ils ne sont pas côte à côte sans libellé ; seul le calendrier des bilans les montre ensemble, avec une place fixe et une légende. Un bleu plus cyan (#52CBD6) réglerait l'écart si tu le souhaites.
- **Planche visuelle (artefact) pas encore mise à jour** avec FORGE SIGNATURE ; la référence est docs/design-system.md.
- **Icône de l'app sur l'iPhone.** Elle ne change qu'en retirant puis en ajoutant de nouveau l'app à l'écran d'accueil ; l'écart de couleur est minime.
- **Retour haptique sur iPhone.** Il passe par l'interrupteur système de Safari (iOS 18 et plus), seulement pendant un geste. Il n'a pas pu être vérifié ici, faute d'iPhone : à confirmer sur ton téléphone. Sans effet sur les versions plus anciennes.
- **Accueil adaptatif.** L'ordre change selon l'heure, la séance et la pesée du jour ; PULSE reste toujours en tête et la barre d'onglets ne bouge pas.
- **Première mise à jour en production.** Elle saute de la base version 2 à la version 11 d'un coup, ce qui est testé. Par prudence, fais une sauvegarde (Réglages, Sauvegarde) depuis l'ancienne version, avant d'accepter la mise à jour proposée par l'app.
- **Mise en forme du code.** Pas de configuration Prettier dans le dépôt ; quelques anciens fichiers ne suivent pas le format du reste.
