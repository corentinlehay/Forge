# FORGE PULSE : documentation technique

Version des règles : **2** (PULSE 1.1). Le journal PULSE garde la version utilisée chaque jour (`engineVersion`).

Toutes les valeurs ci-dessous sont des choix de conception, réglables dans Réglages PULSE. Ce ne sont pas des seuils validés médicalement, et PULSE ne donne jamais d'avis médical.

## Architecture

| Couche | Fichiers | Rôle |
|---|---|---|
| Réglages | `domain/pulse/settings.ts` | Poids, niveaux de lecture, seuils de la proposition de séance, sommeil, charge, nutrition. `resolveSettings` borne chaque valeur et garde les seuils dans l'ordre. |
| Score | `domain/pulse/readiness.ts` | Les cinq dimensions, la fusion des sources de mesure, la couverture, la confiance et le niveau. |
| Nutrition | `domain/pulse/nutrition.ts` | Nutrition Status, indicateur séparé qui ne change jamais le score. |
| Règles | `domain/pulse/rules.ts` | Sécurité, tendance et nutrition. Elles passent avant le score. |
| Historique | `domain/pulse/history.ts` | Série des scores recalculés, évolution, résumé d'une période, taux d'acceptation. |
| Analyse | `domain/pulse/analysis.ts` | Principaux facteurs et analyse du jour (observé, déclaré, estimé, hypothèse, manquant). |
| Moteur | `domain/pulse/pulse.ts` | `computePulse` assemble le tout. `pulseSnapshot` donne la ligne du journal. |
| Données | `db/` | Table `pulseDays` (journal), réglage `pulseSettings` dans `meta`. Tout est dans la sauvegarde. |
| Écrans | `features/pulse/` | Carte de l'accueil, écran PULSE, historique, réglages. |

Le moteur est fait de fonctions pures : il reçoit les données d'une personne et une date, et rend toujours le même résultat pour les mêmes données. Il ne garde aucun état et ne lit rien hors de ses paramètres. Il est donc prêt pour plusieurs utilisateurs et pour une synchronisation, sans rien changer.

## Les cinq dimensions

| Dimension | Poids de départ | Source | Calcul |
|---|---|---|---|
| Sommeil | 30 | Nuit mesurée par une source (PULSE 2), sinon check-in | Durée : 100 à la cible et au-delà, 60 à une heure de moins, 30 à deux heures, 10 à trois heures et plus. Avec la qualité ressentie : 70 % durée, 30 % qualité. Heures de coucher irrégulières sur 7 jours (écart type de plus de 60 min) : −10. |
| Physiologie | 25 | Montre ou bague (PULSE 2) | VFC : 85 dans la zone habituelle ou au-dessus, 35 en dessous, 20 en dessous depuis 3 jours. Fréquence au repos : 85 jusqu'à +2 au-dessus de la référence, 55 jusqu'à +5, 25 au-delà. Référence : 14 valeurs au moins sur les 28 jours précédents, zone = moyenne ± max(écart type, 5 %). |
| Ressenti | 25 | Check-in | Moyenne des réponses données : énergie, fatigue inversée, courbatures inversées. |
| Charge | 10 | Séances enregistrées | Séries des 7 derniers jours rapportées à la moyenne hebdomadaire des 28 derniers (aujourd'hui exclu). 80 sous 0,8 ; 90 jusqu'à 1,3 ; 60 jusqu'à 1,5 ; 30 au-delà. Il faut une séance à J−28 ou avant. |
| Mental | 10 | Journal Mind du jour, sinon de la veille | Moyenne de l'humeur et du stress inversé. |

Le stress du check-in est la même donnée que le stress du journal Mind : le check-in l'écrit dans le journal du jour, sans le compter deux fois.

## Score

- **Score** = moyenne pondérée des dimensions renseignées. Le poids d'une dimension sans donnée est réparti sur les autres : une dimension non renseignée ne pénalise pas.
- Pas de score sans Sommeil ni Ressenti : il faut au moins l'un des deux.
- **Couverture** : nombre de dimensions renseignées sur celles dont le poids réglé dépasse 0 (« 4 dimensions sur 5 »).
- **Confiance** : haute si les dimensions renseignées portent au moins 90 % du poids, moyenne à partir de 60 %, basse en dessous. Elle baisse d'un cran quand deux sources de mesure se contredisent le jour même.
- **Précision** : avec une confiance basse, le score s'affiche arrondi à 5 et précédé de « ≈ ».
- **Niveaux de lecture** : 0 à 39 disponibilité basse, 40 à 59 modérée, 60 à 79 satisfaisante, 80 à 100 élevée. Les seuils sont réglables.

## Fraîcheur et fiabilité

- Chaque dimension indique le jour de la donnée utilisée : aujourd'hui, hier (journal Mind de la veille), ou la dernière séance pour la charge.
- Ordre de fiabilité pour le sommeil : une nuit mesurée passe avant la durée déclarée. Si elles diffèrent de plus d'une heure, l'écart est signalé.
- **Plusieurs appareils** (`mergeHealth`) : une seule valeur par jour et par mesure, jamais deux, jamais une moyenne. PULSE garde la source la plus régulière (le plus de jours enregistrés, puis l'ordre alphabétique). Il signale une contradiction au-delà d'un écart d'une heure pour le sommeil, de 20 % pour la VFC et de 5 battements pour la fréquence au repos.

## Évolution

- Les scores passés sont recalculés à partir des données de chaque jour, avec les règles et réglages actuels. La série reste cohérente même les jours où l'app n'a pas été ouverte.
- **Hier**, **moyenne sur 7 jours** et **moyenne sur 30 jours**, le jour exclu. Une moyenne sur 7 jours demande 3 scores, une moyenne sur 30 jours en demande 7.
- Le score est dit stable tant que l'écart à la moyenne sur 7 jours reste sous 5 points. Sans cette moyenne, la comparaison se fait avec celle sur 30 jours.

## Analyse du jour

- **Principaux facteurs** : trois dimensions au plus. Une dimension compte si elle s'écarte d'au moins 10 points de sa moyenne sur 7 jours, si elle est sous 50, ou, sans moyenne, si elle atteint 85. Elles sont classées par écart × poids.
- Chaque information porte sa nature :
    - **Observé** : mesuré par un appareil, ou calculé d'après les séances enregistrées ;
    - **Déclaré** : check-in, journal Mind ;
    - **Estimé** : le score, son niveau, ses moyennes ;
    - **Hypothèse** : deux au plus, toujours au conditionnel, jamais présentées comme des causes ;
    - **Manquant** : chaque dimension sans donnée, et pourquoi.
- Hypothèses possibles :
    - nuit et ressenti sous 60 : la nuit peut expliquer une partie de la fatigue ;
    - charge au-dessus du seuil élevé et ressenti sous 60 : la charge peut peser ;
    - stress de 4 ou 5 la veille et sommeil sous 60 : le stress peut avoir joué sur la nuit ;
    - mental sous 50, ressenti et sommeil à 70 ou plus : c'est surtout la tête qui est chargée.

## Proposition de séance

La proposition est séparée du niveau de lecture. Elle a ses propres seuils, réglables, et le score ne décide jamais seul d'annuler une séance.

| Score (après les règles) | Proposition | Choix proposés |
|---|---|---|
| 75 et plus | Progression possible : séance telle quelle, surcharge progressive suggérée (deux pistes au plus) | aucun, la séance reste prévue |
| 55 à 74 | Séance prévue, sans chercher de record | aucun |
| 40 à 54 | Version allégée : une série de moins par exercice (une au moins), 2 répétitions en réserve de plus (5 au plus), aucune hausse de charge proposée | Démarrer la version allégée, Garder la séance prévue, Déplacer à demain |
| moins de 40 | Récupération active : 30 min d'activité facile et 10 min de mobilité | Faire la récupération active, Garder la séance prévue, Déplacer à demain |

« Garder la séance prévue » reste toujours proposé quand le score suggère d'alléger ou de remplacer. Seules les règles de sécurité retirent la séance : douleur dans la poitrine, ou douleur avec signe d'alerte qui sollicite la zone. Même dans ces cas, rien n'est bloqué dans Training.

Après trois « Garder » en 7 jours, PULSE ne change ni le score ni la proposition : il suggère d'ajuster les seuils dans les réglages.

## Règles (elles passent avant le score)

| Règle | Déclencheur | Effet |
|---|---|---|
| Moins de 18 ans | Date de naissance | Aucun plan, ni entraînement ni objectif nutritionnel |
| Douleur dans la poitrine | Zone poitrine suivie | Aucun entraînement, rappel du 15 |
| Douleur avec signe d'alerte | Gonflement, fièvre, engourdissement, appui impossible, choc, intensité 7 ou plus | Séance suspendue si elle sollicite la zone, avis médical |
| Douleur suivie | Autre signe ou intensité 4 ou plus | Adapter les mouvements, journal de la douleur |
| Douleur inhabituelle signalée | « Oui » au check-in, aucune douleur située aujourd'hui | Au plus la version allégée, invitation à situer la douleur, sans rien deviner de la zone |
| Nuit courte | Moins de 5 h | Au plus la version allégée |
| Fatigue qui s'installe | VFC basse 3 jours, ou fatigue et courbatures à 4 ou plus 3 jours de suite, avec une charge au-dessus du seuil élevé | Récupération active, décharge suggérée |
| Moral au plus bas | Humeur 1 sur 5 | Rappel du 3114, du 15 et du 112 |
| Apport très bas | Sous 75 % de l'objectif 3 jours ou plus | Revenir à l'objectif |
| Poids déjà bas | IMC sous 18,5 avec un objectif de perte | Aucun déficit |

## Check-in

- Cinq questions : la nuit (durée, et en option coucher, réveil, réveils et qualité), l'énergie, le stress, l'état physique (fatigue et courbatures) et une douleur inhabituelle.
- Chaque question peut être passée, et un second appui efface une réponse. Il suffit d'une réponse pour enregistrer.
- Ce qui existe déjà est prérempli : le check-in du jour, le stress du journal Mind et les douleurs déjà suivies.
- « Plus tard » ferme sans rien enregistrer. Le check-in se complète ou se corrige à tout moment, et rien n'est bloqué s'il reste incomplet.

## Journal et historique

- `pulseDays` : une ligne par jour, réécrite seulement si le résultat change. Elle garde le score, la confiance, le niveau, la couverture, les dimensions, le Nutrition Status, les règles, la séance prévue, la proposition et ton choix (`alleger`, `remplacer`, `garder`, `deplacer`). Les lignes de PULSE 1 restent lisibles : leur proposition se déduit du mode et de la séance prévue.
- Historique par jour, semaine, mois ou période choisie (180 jours au plus). Il compare chaque période à la précédente de même durée : score, dimensions, sommeil, stress, séries par semaine, propositions et taux d'acceptation.
- Le taux d'acceptation est la part des propositions acceptées (version allégée, récupération active ou report) parmi celles qui ont reçu une réponse.
- Une comparaison décrit un écart, sans jamais dire ce qui l'a causé.

## Ce qui n'est pas encore là

- **Connecteurs (PULSE 2)** : aucune source de mesure n'est branchée. La dimension Physiologie reste vide et la confiance plafonne à « moyenne ».
- **Plan du jour, validation avec retour en arrière, bilan du soir (PULSE 1.2)** : le ressenti après une recommandation viendra avec le bilan du soir.
- **Apprentissage personnel (PULSE 3)** et **couche IA** : PULSE n'apprend rien de tes choix pour l'instant.

## Tests

`domain/pulse/pulse.test.ts` contient :

- les cinq scénarios de référence de l'audit ;
- les 7 cas du cahier :
    - mal dormi sans fatigue musculaire ;
    - très stressé mais physiquement disponible ;
    - sommeil manquant ;
    - séances rapprochées ;
    - douleur inhabituelle ;
    - propositions refusées ;
    - deux appareils contradictoires ;
- les tests des données manquantes, des réglages, des niveaux, de l'évolution, de l'analyse, de la sécurité, de la version allégée et du journal.

`services/backup.test.ts` vérifie qu'un check-in incomplet et le journal v2 passent par la sauvegarde sans perte.
