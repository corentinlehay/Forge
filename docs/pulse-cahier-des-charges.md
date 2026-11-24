FORGE PULSE — CAHIER DES CHARGES FONCTIONNEL

Version 1.0 — Spécifications de référence

1. VISION DU PRODUIT

FORGE PULSE est le moteur central d’adaptation quotidienne de FORGE.

Sa mission est d’analyser les données physiques, sportives, nutritionnelles et mentales de l’utilisateur pour lui proposer une organisation quotidienne cohérente avec son état réel et ses objectifs.

PULSE ne doit pas être un simple outil de notation.

Il doit :

* Observer l’état de l’utilisateur.
* Comprendre son contexte.
* Identifier les éventuels signaux de fatigue ou de progression.
* Formuler des recommandations personnalisées.
* Proposer des modifications aux programmes existants.
* Recueillir la validation de l’utilisateur.
* Mesurer les résultats des recommandations.
* Améliorer progressivement la pertinence de ses propositions.

PRINCIPE FONDAMENTAL : PULSE propose, l’utilisateur décide.

Aucune modification importante d’un programme, d’un objectif calorique ou d’une planification ne doit être appliquée sans validation explicite.

⸻

2. LES CINQ DIMENSIONS D’ANALYSE

PULSE doit analyser cinq dimensions complémentaires.

A. TRAINING

Données :

* Fréquence des entraînements.
* Nombre de séances réalisées.
* Volume d’entraînement.
* Charges utilisées.
* Répétitions et séries.
* RPE et RIR.
* Progression des performances.
* Records personnels.
* Groupes musculaires sollicités.
* Historique des séances.
* Fatigue musculaire déclarée.

Objectif : comprendre la charge d’entraînement récente, les performances et les besoins de récupération.

B. NUTRITION

Données :

* Calories consommées.
* Protéines.
* Glucides.
* Lipides.
* Hydratation lorsqu’elle est suivie.
* Régularité alimentaire.
* Écart entre objectifs et consommation.
* Évolution du poids moyen.
* Budget alimentaire.
* Repas prévus.

Objectif : déterminer si les apports alimentaires sont cohérents avec les objectifs et les besoins estimés.

C. SLEEP

Données :

* Durée du sommeil.
* Qualité ressentie.
* Horaires de coucher et de réveil.
* Régularité.
* Réveils nocturnes lorsqu’ils sont disponibles.
* Données de sommeil provenant d’appareils compatibles.

Objectif : identifier les tendances de récupération et les éventuels déficits de sommeil.

D. MIND

Données :

* Stress.
* Humeur.
* Motivation.
* Énergie mentale.
* Charge mentale.
* Ressenti émotionnel.
* Exercices de respiration réalisés.
* Séances audio écoutées.
* Préférences de récupération mentale.

Objectif : intégrer l’état psychologique déclaré dans les recommandations quotidiennes.

E. RECOVERY

Données :

* Fatigue générale.
* Fatigue musculaire.
* Douleurs déclarées.
* Mobilité.
* Sensation de récupération.
* Historique des sollicitations musculaires.
* Activités physiques complémentaires.

Objectif : identifier les situations dans lesquelles une adaptation de l’activité pourrait être pertinente.

⸻

3. FORGE PULSE SCORE

Créer un indicateur synthétique compris entre 0 et 100.

Ce score doit représenter un indicateur interne de préparation et de disponibilité du jour.

Il ne constitue pas :

* Un diagnostic médical.
* Une mesure physiologique certifiée.
* Une mesure exacte de la récupération.
* Une prédiction garantie de performance.

Présentation

Afficher :

* Score global.
* Évolution par rapport aux jours précédents.
* Cinq sous-indicateurs.
* Niveau de confiance des données.
* Principaux facteurs influençant le résultat.

Calcul du score

Créer un moteur de calcul explicable et documenté.

Utiliser initialement une pondération configurable des dimensions :

* Training : 25 %.
* Sleep : 25 %.
* Recovery : 20 %.
* Mind : 20 %.
* Nutrition : 10 %.

Ces pondérations constituent un point de départ expérimental, et non des coefficients médicalement validés.

Le calcul doit :

* Utiliser des règles explicites.
* Tenir compte de la fraîcheur des données.
* Tenir compte de leur fiabilité.
* Éviter les doubles comptages.
* Gérer les données manquantes.
* Ne pas pénaliser artificiellement l’utilisateur lorsqu’il ne renseigne pas une dimension.

Si des données sont manquantes, recalculer le score à partir des dimensions suffisamment renseignées et afficher la couverture des données.

Exemple :
Score : 78/100.
Couverture : 4 dimensions sur 5.
Confiance : modérée.

Ne jamais afficher un score avec une précision artificielle.

Interprétation

Créer des niveaux de lecture configurables :

* 0 à 39 : disponibilité basse.
* 40 à 59 : disponibilité modérée.
* 60 à 79 : disponibilité satisfaisante.
* 80 à 100 : disponibilité élevée.

Ces seuils sont des conventions d’interface à tester et ajuster. Ils ne doivent pas être présentés comme des seuils médicaux ou physiologiques validés.

Le score ne doit jamais déterminer automatiquement l’annulation d’une séance.

⸻

4. ANALYSE CONTEXTUELLE

Le score ne suffit pas.

PULSE doit expliquer ce qui influence l’état du jour.

Exemple :

« Ton indicateur de disponibilité est en baisse par rapport à ta moyenne habituelle. Les principaux éléments observés sont un sommeil plus court et une fatigue musculaire déclarée plus élevée. »

Chaque analyse doit distinguer :

* Données observées.
* Informations déclarées.
* Estimations.
* Hypothèses.
* Informations manquantes.

PULSE doit comparer :

* Aujourd’hui et les jours précédents.
* La moyenne des 7 derniers jours.
* La moyenne des 30 derniers jours.
* Les tendances individuelles disponibles.

Il doit privilégier les évolutions personnelles plutôt que des comparaisons génériques avec d’autres utilisateurs.

⸻

5. CHECK-IN QUOTIDIEN

Créer un check-in rapide, idéalement réalisable en moins de 30 secondes.

Questions principales :

* Comment as-tu dormi ?
* Quel est ton niveau d’énergie ?
* Quel est ton niveau de stress ?
* Comment te sens-tu physiquement ?
* As-tu des douleurs inhabituelles ?

Utiliser des curseurs, des échelles visuelles et des sélections rapides.

Les données déjà disponibles doivent être préremplies.

L’utilisateur doit pouvoir :

* Ignorer une question.
* Corriger une réponse.
* Compléter le check-in plus tard.
* Consulter ses anciennes réponses.

Ne jamais bloquer l’accès à l’application en cas de check-in incomplet.

⸻

6. GÉNÉRATION DU PLAN QUOTIDIEN

À partir des données disponibles, PULSE doit générer une proposition de journée.

Le plan doit pouvoir contenir :

TRAINING

* Séance initialement prévue.
* Proposition de maintien ou d’adaptation.
* Volume recommandé.
* Intensité proposée.
* Exercices alternatifs si pertinents.
* Recommandations de récupération.

NUTRITION

* Objectif calorique actuel.
* Objectif protéique.
* Répartition alimentaire indicative.
* Suggestions de repas.
* Utilisation de FORGE KITCHEN.
* Respect du budget alimentaire.

Les objectifs nutritionnels ne doivent pas être modifiés automatiquement.

MIND

* Exercice de respiration.
* Séance audio recommandée.
* Protocole FORGE MIND.
* Préparation mentale.
* Exercice de décompression.

SLEEP

* Recommandation de routine du soir.
* Horaire de coucher indicatif.
* Séance de relaxation si pertinente.

RECOVERY

* Mobilité.
* Récupération active.
* Repos.
* Étirements adaptés.

Chaque recommandation doit avoir :

* Un objectif.
* Une justification.
* Une durée ou une quantité indicative.
* Un niveau de priorité.
* Un lien vers le module concerné.

⸻

7. MOTEUR DE RECOMMANDATION

Créer un système combinant :

1. Un moteur de règles déterministes.
2. Une analyse contextuelle.
3. Une couche d’intelligence artificielle pour formuler et personnaliser les recommandations.

Les règles de sécurité, les calculs et les contraintes doivent être contrôlés par le code de l’application, et non laissés à la seule interprétation de l’IA.

L’IA ne doit jamais inventer une donnée ou une séance disponible.

Elle doit pouvoir expliquer chaque recommandation en langage naturel.

Exemple :

« Je te propose de réduire légèrement le volume de ta séance aujourd’hui, car tu déclares une fatigue musculaire élevée après plusieurs entraînements rapprochés. Tu peux conserver ta séance si tu te sens bien pendant l’échauffement. »

L’utilisateur doit pouvoir demander :
« Pourquoi me proposes-tu cela ? »

Le système doit répondre en s’appuyant sur les données réellement utilisées.

⸻

8. VALIDATION DES MODIFICATIONS

C’est une fonctionnalité fondamentale.

Aucune modification importante ne doit être appliquée sans validation.

Créer une interface de proposition avec :

* Situation actuelle.
* Modification proposée.
* Justification.
* Impact attendu.
* Possibilité de conserver le programme initial.

Actions possibles :

* Accepter.
* Refuser.
* Modifier.
* Reporter.
* Demander une explication.

Après validation :

* Mettre à jour le module concerné.
* Enregistrer la décision.
* Conserver une trace de l’ancienne configuration.
* Permettre de revenir en arrière lorsque cela est possible.

Les modifications doivent être traçables.

⸻

9. SOURCES DE DONNÉES ET CONNECTEURS

PULSE doit pouvoir exploiter toutes les sources compatibles.

Prévoir une architecture extensible avec un système de connecteurs.

Sources envisagées :

* Saisie manuelle.
* Apple Santé / HealthKit via une intégration iOS adaptée.
* Apple Watch lorsque les données sont accessibles.
* Balance connectée.
* Montre ou bracelet sportif compatible.
* Applications de suivi sportif.
* Données internes de FORGE.
* Sources nutritionnelles compatibles.

Pour chaque source :

* Vérifier les autorisations.
* Identifier la date de la mesure.
* Conserver la provenance.
* Identifier les unités.
* Détecter les données manquantes.
* Éviter les doublons.
* Gérer les erreurs de synchronisation.

Créer une architecture permettant d’ajouter de nouveaux connecteurs sans modifier le fonctionnement central de PULSE.

IMPORTANT :
Une application web ou PWA ne dispose pas automatiquement de tous les accès natifs à Apple Santé ou HealthKit. Prévoir une intégration iOS native ou une architecture compatible si nécessaire.

Ne jamais afficher une intégration comme fonctionnelle tant qu’elle n’a pas été réellement implémentée et testée.

Prévoir un mode manuel complet en cas d’absence de connecteur.

⸻

10. APPRENTISSAGE PERSONNEL

PULSE doit progressivement apprendre les habitudes de l’utilisateur.

Exploiter les données historiques pour identifier :

* Les horaires d’entraînement préférés.
* Les périodes de meilleure régularité.
* Les habitudes de sommeil.
* Les exercices mentaux appréciés.
* Les recommandations souvent acceptées.
* Les recommandations souvent refusées.
* Les tendances associées aux meilleures périodes de progression.

Ne pas considérer une recommandation acceptée comme une preuve qu’elle est efficace.

Comparer les ressentis et résultats sur plusieurs périodes.

Permettre à l’utilisateur de consulter et modifier les préférences apprises.

⸻

11. FORGE PULSE — INTERFACE PRINCIPALE

Créer une interface premium, sombre, adaptée à l’iPhone.

L’écran principal doit présenter :

1. Le score PULSE.
2. La tendance récente.
3. La couverture et la fiabilité des données.
4. Les cinq dimensions.
5. L’analyse du jour.
6. Les recommandations.
7. Le plan quotidien.
8. Les modifications en attente de validation.
9. Le bilan de la veille.

Créer des visualisations interactives.

Prévoir des accès rapides aux modules Training, Nutrition et Mind.

L’écran doit rester lisible, sans surcharge d’informations.

⸻

12. RETOUR D’EXPÉRIENCE QUOTIDIEN

Le soir, proposer un bilan rapide.

Questions :

* As-tu suivi le plan proposé ?
* Quelles modifications as-tu effectuées ?
* Comment s’est passée ta séance ?
* Comment as-tu vécu ta journée ?
* Les recommandations t’ont-elles été utiles ?

Enregistrer :

* Les recommandations proposées.
* Les recommandations acceptées.
* Les recommandations refusées.
* Les actions réalisées.
* Les résultats déclarés.

Ces données doivent alimenter l’amélioration du système.

⸻

13. HISTORIQUE ET ANALYSES

Créer un historique PULSE consultable par :

* Jour.
* Semaine.
* Mois.
* Période personnalisée.

Afficher :

* Évolution du score.
* Évolution des sous-indicateurs.
* Tendances du sommeil.
* Évolution du stress.
* Charge d’entraînement.
* Fréquence des recommandations.
* Taux d’acceptation.
* Ressenti après application des recommandations.

Permettre de comparer différentes périodes.

Ne pas affirmer qu’une habitude est la cause d’une amélioration sans éléments suffisants.

⸻

14. SÉCURITÉ ET LIMITES

PULSE est un outil de coaching et de suivi du bien-être.

Il ne remplace pas un médecin, un kinésithérapeute, un diététicien ou un psychologue.

Il ne doit pas :

* Diagnostiquer une pathologie.
* Déterminer la cause d’une douleur.
* Garantir une récupération.
* Recommander de s’entraîner malgré des symptômes préoccupants.
* Modifier un traitement.
* Imposer une restriction alimentaire.
* Présenter une estimation comme une mesure certaine.

Les douleurs inhabituelles ou les symptômes préoccupants doivent conduire à une recommandation de recours à un professionnel de santé.

Les données personnelles doivent être protégées.

Les clés API ne doivent jamais être exposées dans le code client.

⸻

15. ARCHITECTURE TECHNIQUE

Avant de développer, analyser l’architecture existante de FORGE.

Ne pas reconstruire l’application.

Créer des services séparés pour :

* Collecte des données.
* Normalisation.
* Calcul du score.
* Analyse contextuelle.
* Génération des recommandations.
* Validation des modifications.
* Historique.
* Connecteurs externes.

Séparer les calculs déterministes de l’intelligence artificielle.

Les données doivent rester persistantes.

Prévoir :

* Gestion des erreurs.
* Gestion des données manquantes.
* Synchronisation.
* Tests unitaires.
* Tests d’intégration.
* Journalisation.
* Gestion des versions des algorithmes.

Créer une documentation technique expliquant le calcul du score et les règles de décision.

⸻

16. PHASES DE DÉVELOPPEMENT

Développer PULSE progressivement.

V1 — FONDATIONS

* Collecte des données.
* Check-in quotidien.
* Score initial.
* Analyse des cinq dimensions.
* Historique.

V2 — RECOMMANDATIONS

* Plan quotidien.
* Suggestions Training.
* Suggestions Nutrition.
* Suggestions Mind.
* Validation des modifications.

V3 — CONNECTEURS

* Apple Santé si l’architecture le permet.
* Appareils compatibles.
* Sources externes.
* Synchronisation et dédoublonnage.

V4 — APPRENTISSAGE

* Tendances personnelles.
* Historique des décisions.
* Analyse des résultats.
* Personnalisation progressive.

V5 — OPTIMISATION

* Amélioration de l’algorithme.
* Tests sur plusieurs profils.
* Optimisation de l’expérience iPhone.
* Préparation à une utilisation multi-utilisateur.

⸻

17. TESTS ET VALIDATION

Créer des scénarios de test réels.

Exemples :

* Utilisateur ayant mal dormi mais sans fatigue musculaire.
* Utilisateur très stressé mais physiquement disponible.
* Utilisateur avec données de sommeil manquantes.
* Utilisateur ayant réalisé plusieurs séances rapprochées.
* Utilisateur déclarant une douleur inhabituelle.
* Utilisateur ayant refusé plusieurs recommandations.
* Utilisateur ayant des données contradictoires entre deux appareils.

Vérifier que :

* Le score reste cohérent.
* Les données manquantes sont correctement gérées.
* Les recommandations sont explicables.
* Les modifications attendent une validation.
* Les données ne sont jamais inventées.
* Les connecteurs ne produisent pas de doublons.
* Les recommandations ne remplacent jamais un avis médical.

⸻

18. LIVRABLE ATTENDU

Développer FORGE PULSE dans le projet existant.

À la fin :

* Présenter l’architecture.
* Documenter le calcul du score.
* Présenter les règles de recommandation.
* Lister les connecteurs réellement opérationnels.
* Identifier les fonctionnalités simulées ou non terminées.
* Fournir les résultats des tests.
* Mettre à jour PROJECT_STATUS.md.

Ne pas déclarer une fonctionnalité terminée si elle n’est pas réellement opérationnelle.

L’objectif est de créer un moteur d’accompagnement intelligent, explicable, évolutif et fiable.

FORGE PULSE doit aider l’utilisateur à prendre de meilleures décisions quotidiennes tout en conservant le contrôle de sa progression.