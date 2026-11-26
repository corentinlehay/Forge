# Journal des versions

## FORGE PROGRAMS, livraison 1 (version de test, branche `programmes-1`)

- **Audit validé** (phase 0) : https://claude.ai/artifact/24EFHzYVpamQstVjdLs9w9. Huit décisions cochées, avatar V1 en emblème.
- **Base Dexie v12 :**
    - nouvelle table `programVersions`, vide, qui servira aux versions (`programmes-2`) ;
    - programmes : statut, objectif et objectif secondaire, origine (manuel ou généré), durée du cycle, début et fin du cycle, version courante. Tous facultatifs ;
    - la migration ne réécrit aucun programme. Un programme d'avant tire son statut de `active` (actif ou en pause). Sa date de début reste inconnue tant que tu ne la donnes pas ;
    - tests : passage de v11 à v12 avec programmes, séances et journal PULSE intacts ; passage de v2 à la version actuelle toujours vert. Essai réel : une base créée par la production actuelle s'ouvre en v12 dans le navigateur, programme actif conservé.
- **Statuts :**
    - brouillon, actif, en pause, terminé, archivé ;
    - activer un programme met l'ancien en pause, jamais supprimé, et pose le début du cycle s'il manque ;
    - terminer pose la fin du cycle ; « Recommencer un cycle » repart d'aujourd'hui ;
    - un programme sans séance ne s'active pas ; le programme actif ne se supprime pas.
- **Écrans** (Training, Programmes) :
    - liste groupée par statut, archivés repliés ;
    - fiche programme : objectif, description, semaine du cycle avec une case par semaine, semaine type, séances, actions de statut, modifier, dupliquer en brouillon, supprimer ;
    - création en brouillon : nom, objectif, objectif secondaire, durée (sans durée, 4 à 16 semaines), description. La date de début se corrige ensuite.
- **Séances :** « Ajouter une séance » depuis une fiche range la séance dans ce programme, et l'éditeur y revient après l'enregistrement.
- **Programme généré par le questionnaire :** il porte désormais son objectif et l'origine « généré ».
- **Sauvegarde :** nouveaux champs et nouvelle table ; une sauvegarde plus ancienne reste importable.
- **Démo :** cycle de 8 semaines en cours (semaine 7) et un programme terminé.
- 10 nouveaux tests (336 pour l'app).

## Répartition sur 3 jours (branche `repartition-1`, en production le 25 novembre 2026)

- **Pourquoi :** sur 3 jours, FORGE ne proposait que du corps entier, avec des jambes à chaque séance. Certains préfèrent une séance jambes à part.
- **Questionnaire, écran « Ta semaine d'entraînement » :** avec 3 jours choisis, une question de plus.
    - « Corps entier à chaque séance » : chaque muscle 3 fois par semaine.
    - « Haut, bas, haut » : Haut du corps A, Bas du corps et épaules, Haut du corps B. Les jambes ne travaillent qu'une fois par semaine, et le choix le dit.
- **Séance « Bas du corps et épaules » :** squat, charnière, fente et ischios, avec une série d'élévations latérales (deux exercices d'épaules à partir de 75 min).
- **Jours :** la séance jambes se place entre les deux séances du haut, sauf si celles-ci tomberaient alors deux jours de suite (dimanche puis lundi) : la séance jambes passe alors en dernier.
- **Avertissement :** deux séances corps entier qui se suivent sont signalées dans le plan, avec le conseil de laisser un jour entre deux ou, sur 3 jours, de choisir « Haut, bas, haut ».
- **Sources :**
    - ACSM, position 2026 : travailler chaque grand groupe musculaire au moins deux fois par semaine ;
    - Grgic, Schoenfeld et Latella 2019, *J Sci Med Sport* 22(3):361-370 : à volume égal, la fréquence pèse peu ;
    - Garber et al. 2011 (ACSM), *Med Sci Sports Exerc* 43(7):1334-59 : 48 h entre deux séances des mêmes muscles.
- **Sans réponse** (plan d'avant, sauvegarde ancienne) : corps entier, comme avant.
- 3 nouveaux tests (326 pour l'app).

## Volume d'une séance en grand (branche `volume-1`, en production le 25 novembre 2026)

- **Sur l'écran d'une séance :** les trois chiffres restent (séries, exercices, volume). Le bloc Volume porte une flèche et un léger fond vert : il se touche. Il n'est pas cliquable quand la séance n'a aucun kilo (poids du corps seul).
- **La vue plein écran :**
    - « Tu as déplacé », puis le total qui se compte ;
    - « Série après série » : une ligne par exercice, chaque série posée comme une brique quand le compteur l'atteint (largeur proportionnelle à son volume) ;
    - à la fin : badge record ou palier, phrase sur la séance, comparaisons, graphique des dernières séances du même type, phrase FORGE.
- **Ce que les phrases utilisent, seulement quand la donnée existe :**
    - record de volume, toutes séances ou même type de séance (même modèle du programme, sinon même nom) ;
    - palier d'une séance franchi pour la première fois (1 t, 2,5 t, 5 t, 7,5 t, 10 t…) ;
    - palier du total depuis la première séance (10 t, 25 t, 50 t, 100 t…) ;
    - écart avec la séance précédente du même type ; séance allégée par PULSE ;
    - première séance, ou première séance de ce type : la référence est posée.
- **Variété :** plusieurs formulations par situation et sept phrases FORGE. Le choix est stable pour une séance (même texte à chaque ouverture) et change d'une séance à l'autre.
- **Séance en cours :** « Tu as déjà déplacé », et ce qu'il reste pour égaler la séance précédente du même type. Pas de badge avant la fin.
- **Une ancienne séance** parle au passé de son record (« ce jour-là »).
- **Mouvement :** compteur et briques synchronisés, chiffre qui « encaisse » la fin, badges et textes qui arrivent ensuite. Toucher le chiffre affiche tout de suite le total. Avec « réduire les animations », tout est affiché d'emblée. Nouveaux utilitaires `motion-brick` et `motion-impact`.
- **Rien d'autre ne change :** calcul du volume identique (charge × répétitions), suivi des séries intact, autres écrans inchangés.
- 17 nouveaux tests (323 pour l'app).

## Zone « Épaules » renforcée (branche `epaules-1`, en production le 25 novembre 2026)

- **Pourquoi :** avec « Épaules » coché, le programme gardait le développé épaules assis, les élévations frontales, les écartés et le développé incliné. Trop pour quelqu'un qui a mal aux épaules.
- **Mouvements écartés :**
    - tous les développés au-dessus de la tête (barre, haltères, Arnold, machine) ;
    - tractions pronation et supination, extensions triceps au-dessus de la tête ;
    - dips (trois versions), écartés (poulie, machine, haltères), développés inclinés, pompes pieds surélevés, élévations frontales.
- **Gardés ou mis en avant :**
    - développé au sol aux haltères en premier, puis à la machine et aux haltères ;
    - tirage à la poulie devant la poitrine à la place des tractions ;
    - élévations latérales avec la consigne « jusqu'à hauteur d'épaule, pas au-dessus » ;
    - la place du développé au-dessus de la tête va à l'arrière de l'épaule (face pull, oiseau), que Kolber et al. 2010 conseillent de renforcer, plutôt qu'à une deuxième série d'élévations latérales.
- **Sources :**
    - Kolber et al. 2010, *J Strength Cond Res* 24(6):1696-1704 (développés au-dessus de la tête et derrière la nuque, dips, écartés, développé incliné, limiter la descente du développé, tirage devant la poitrine) ;
    - Kolber et al. 2014, *J Strength Cond Res* 28(4):1081-9 (élévations latérales au-dessus de 90°).
- **Conseils de matériel :** FORGE ne suggère plus un matériel que tu as déjà, ni un mouvement écarté pour tes zones. Exemple, haltères et barre de traction avec épaules à ménager : « un banc ou une barre » au lieu de « une barre de traction ou des haltères ».
- **Rien ne change pour un programme déjà adopté** : refaire le questionnaire (Réglages) donne le nouveau programme.
- 306 tests.

## Mise en production du 25 novembre 2026

- **Fusion dans `main`** de toute la pile validée par Coz : nutrition-1, training-1, depart-1, muscles-1, kitchen-1, budget-1, mind-1, mind-2, progression-2, bilans-1, pulse-1 (PULSE 1 et 1.1), pulse-1-2, signature-1 et motion-1.
- **Avant la fusion :**
    - `main` n'avait pas bougé (Interface V1) ;
    - la fusion se fait en avance rapide, sans conflit ;
    - `npm run check` passe sur l'état exact mis en production.
- **Nouveau test :** une base de la production précédente (version 2, avec profil, pesées, réglages, programme, séance, séries, check-in et journal) s'ouvre directement en version 11, sans perte.

## FORGE MOTION : mouvement et interactions (version de test, branche `motion-1`)

### Fait
- **Audit :**
    - existaient déjà : fondu entre écrans, feuilles qui montent, série « frappée », jauges qui se remplissent, cercle de respiration au rythme réel, appui des cartes ;
    - pas de retour à l'appui des boutons et des puces, barre de repos linéaire, courbes affichées d'un bloc, aucun retour haptique sur iPhone.
- **Système de mouvement centralisé** (`design/tokens.css`, `lib/motion.ts`, `docs/design-system.md`) : durées, courbes, décalage, utilitaires, et réduction des animations respectée partout.
- **Micro-interactions :**
    - appui sur les boutons, puces, échelles, pavé et onglets ;
    - le fond de l'option choisie glisse d'une option à l'autre dans les sélecteurs ;
    - l'icône de l'onglet choisi répond ;
    - le message de confirmation descend avec sa coche ;
    - le fond des feuilles apparaît en fondu.
- **Navigation :** glissement court dans le sens de la barre entre deux onglets ; la barre et le bandeau restent fixes.
- **PULSE :**
    - le score apparaît frappé puis arrive par le haut ou le bas quand il change, toujours à sa vraie valeur ;
    - l'anneau se remplit, les cinq dimensions et leurs barres apparaissent l'une après l'autre ;
    - les barres des 14 jours montent depuis leur base ;
    - les recommandations prioritaires ont un liseré vert, et un halo unique signale la proposition à valider.
- **Séance :**
    - compte à rebours circulaire au rythme réel du repos ;
    - retour haptique à la validation d'une série ;
    - badge record qui répond, avec un retour haptique ;
    - quand un exercice est fini, le suivant vient à l'écran et s'éclaire une fois.
- **Nutrition :**
    - anneaux et barres de macros qui se remplissent (par transformation, plus fluide) ;
    - calories, reste et eau qui arrivent par le haut ou le bas quand ils changent ;
    - retour haptique à l'ajout d'un aliment et pour un repas prévu marqué mangé.
- **Mind :**
    - étapes qui apparaissent en douceur ;
    - barres de progression (étapes et audio) fluides ;
    - coche de fin de pratique, avec un retour haptique ;
    - le cercle de respiration garde son rythme réel.
- **Progression :**
    - la courbe de poids et celle d'un exercice se tracent à l'affichage et à chaque changement de période ;
    - les points apparaissent en fondu ;
    - le meilleur point de la période est cerclé ;
    - en touchant un point, l'écart avec aujourd'hui s'affiche (« Jusqu'au 24 nov. : +0,4 kg »).
- **Accueil adaptatif** (`domain/homeFocus.ts`, testé) : PULSE reste en tête, et l'accueil dit pourquoi une carte passe devant.
    - Avant la séance et pendant : la séance d'abord.
    - Après la séance : récupération et bilan de la semaine.
    - Le soir, à partir de 19 h : nouvelle carte « Ce soir » (rituel du soir, sommeil).
    - Dans les 2 heures après une pesée : la carte Physique.
- **Retour haptique** quand la plateforme le permet : Android, ou iPhone avec iOS 18 et plus. Sinon rien, sans gêne.
- **Vérifications :**
    - 302 tests et compilation ;
    - parcours PULSE complet et accueil le soir ou après une pesée, au format iPhone ;
    - mode « réduire les animations » : tout visible tout de suite, courbe déjà tracée ;
    - fluidité mesurée avec un processeur 4 fois plus lent, équivalente à avant ;
    - vidéo avant/après de six interactions.
- Aucune logique métier, aucun calcul PULSE ni aucune donnée modifiés.

## FORGE SIGNATURE : identité visuelle (version de test, branche `signature-1`)

### Fait
- **Audit :**
    - l'ancienne palette était proche de la nouvelle ;
    - 7 composants avaient des couleurs écrites en dur (courbe, carte des muscles, silhouette des douleurs, couvertures audio, lecteur, respiration, visuel de recette) ;
    - deux conflits relevés : l'alerte orangée trop proche du nouvel orange Nutrition (écart 14,3), et le bleu Progression proche du violet Mind (écart 11,6).
- **Système de couleurs unique dans `design/tokens.css`** (`--forge-*`), décrit dans `docs/design-system.md` :
    - structure, marque, espaces, états, bordures, focus, graphiques, échelles ;
    - les noms historiques pointent vers ces jetons.
- **Palette officielle :**
    - fond #08090B, cartes #181A1E, surface secondaire #292C32 ;
    - textes #F4F4EF et #A0A3AA ;
    - vert électrique #D5FA45 ;
    - Nutrition #F5AD55, Mind #A99AF5, Progression #69BDEB.
- **Couleur par espace** (attribut `data-module` posé selon l'écran) : jauges, barres, graphiques, icônes et petits accents prennent la couleur de l'espace. Sur l'accueil, la carte Nutrition est orange et la carte Physique bleue.
- **Vert FORGE pour toutes les actions principales,** y compris dans Mind (boutons de lecture et d'enregistrement, auparavant en couleur Mind), ainsi que pour la sélection, la validation, le focus et les trophées.
- **Onglet actif dans la couleur de son espace :** icône, libellé, gras et un petit trait, pour que la couleur ne soit jamais seule.
- **Alerte et douleur en rouge #FF5A5F** (5,7:1 sur les cartes), distinct de l'orange Nutrition. La silhouette des douleurs passe d'une échelle vert, ambre, rouge à une seule teinte d'alerte, plus foncée quand l'intensité monte.
- Couvertures audio générées dans le violet Mind, chaque format avec sa lumière, au lieu de 7 teintes différentes.
- Visuels de recette dans l'orange Nutrition, au lieu du rouge d'alerte pour les plats chauds.
- Lueur du badge record adoucie ; boutons secondaires avec un état au survol ; transitions de l'onglet actif ; animations toujours coupées si l'iPhone demande moins de mouvement.
- Icône de l'app et couleur du navigateur aux nouvelles valeurs, même dessin.
- **Aucune logique, aucune donnée, aucune fonction modifiées.** 297 tests, compilation, parcours PULSE complet, avant et après au format iPhone sur les cinq espaces et des écrans secondaires (recettes, audio, douleurs, calendrier, PULSE).

## PULSE 1.2 : plan du jour, validation, bilan du soir (version de test, branche `pulse-1-2`)

### Fait
- **Plan du jour** en cinq modules : Training, Nutrition, Mind, Sommeil, Récupération.
    - Chaque élément a un objectif, une justification, une durée ou une quantité, une priorité et un lien vers le module.
    - Son « Pourquoi ? » liste les données réellement utilisées et la source.
- **Training :** volume en séries et intensité en répétitions en réserve, surcharge progressive les bons jours. Si une douleur avec signe d'alerte suspend la séance, le plan propose des exercices tirés de tes séances qui ne sollicitent pas la zone.
- **Nutrition :** objectif du jour sans aucun changement automatique, répartition indicative des protéines sur 4 repas (Schoenfeld et Aragon 2018), repas prévus au planning ou « Compose mon repas », budget en vigueur.
- **Mind :** respiration selon le stress, préparation mentale avant la séance, décompression après. Les durées viennent de tes routines.
- **Sommeil :** nouvelle rubrique avec une heure de coucher indicative, calculée depuis ton réveil habituel (3 réveils notés au moins). Sans réveils notés, elle est demandée et jamais inventée. S'y ajoutent le rituel du soir, la relaxation, la sieste et l'heure limite de caféine.
- **Récupération :** mobilité douce, étirements pour le confort seulement (Cochrane 2011 : ils n'évitent pas les courbatures), repos, journal de la douleur.
- **À valider :** situation actuelle, modification proposée, justification, impact attendu (volume, intensité, programme inchangé), « Pourquoi me proposes-tu cela ? ».
    - Actions : Accepter, Garder la séance prévue, Modifier (séries et répétitions en réserve, impact recalculé), Reporter à demain.
    - Une fois le choix fait, la proposition se replie et un bouton démarre la séance.
- **Une version allégée acceptée est appliquée par Training** quand la séance prévue démarre, depuis l'accueil, Training ou PULSE. Le programme n'est jamais modifié.
- **Retour en arrière :**
    - « Revenir sur ce choix » le jour même, tant que la séance n'est pas terminée ;
    - « Revenir à la séance prévue » depuis la séance en cours ;
    - chaque décision et chaque annulation restent tracées avec leur heure.
- **Bilan du soir**, à partir de 17 h, et bilan de la veille le lendemain : plan suivi, modifications, séance, journée, utilité des recommandations, ce qui a été fait, un mot libre. Toutes les réponses sont facultatives, et ce qui est déjà connu est prérempli (choix du jour, séance terminée, pratiques Mind).
- **Historique :**
    - décisions, plan proposé et bilan dans la vue Jour ;
    - carte « Bilans du soir » par période : plan suivi, utilité, ressenti moyen ;
    - ressenti selon ton choix, avec 3 bilans au moins de chaque côté et sans en tirer de cause.
- **Écran PULSE dans l'ordre du cahier :**
    - score avec la courbe des 14 derniers jours (barres à toucher), alertes, accès rapides Training, Nutrition et Mind ;
    - dimensions regroupées, analyse, plan du jour ;
    - À valider, bilans, Nutrition Status.
- La carte de l'accueil signale une proposition à valider.
- Aucun changement de schéma : champs facultatifs dans le journal PULSE (`plan`, `adjustment`, `decisions`, `review`), compris dans la sauvegarde.
- 296 tests (+16), dont la trace des décisions, les annulations, le plan, la proposition et le bilan.
- Parcours vérifié au format iPhone, en démo :
    - plan du jour, proposition, « Pourquoi ? » ;
    - modification, annulation, acceptation ;
    - séance démarrée depuis l'accueil avec la version allégée appliquée, puis retour à la séance prévue ;
    - report, historique du jour ;
    - bilan du soir (navigateur réglé sur un fuseau où il est 20 h) et sa trace dans l'historique.

## PULSE 1.1 : fondations du cahier des charges (version de test, branche `pulse-1`)

### Fait
- Lecture du score en 4 niveaux réglables : disponibilité basse (0 à 39), modérée (40 à 59), satisfaisante (60 à 79), élevée (80 à 100). Ce sont des conventions d'interface, présentées comme telles.
- Proposition de séance séparée du score, avec ses propres seuils. Elle garde toujours « Garder la séance prévue » quand elle suggère d'alléger ou de remplacer. Nouveau choix « Faire la récupération active ». Le score ne décide jamais seul d'annuler une séance ; seules les règles de sécurité retirent une séance, et rien n'est bloqué dans Training.
- Couverture affichée (« 4 dimensions sur 5 »), confiance, et score arrondi à 5 avec « ≈ » quand la confiance est basse.
- Fraîcheur de chaque dimension (aujourd'hui, hier, dernière séance) et sa nature (déclarée, mesurée, calculée).
- Évolution : hier, moyenne sur 7 jours et sur 30 jours, le jour exclu. Les scores passés sont recalculés à partir des données de chaque jour.
- Analyse du jour : une phrase de synthèse, les principaux facteurs (trois au plus) et le détail par nature : observé, déclaré, estimé, hypothèse (toujours au conditionnel), manquant.
- Plusieurs appareils : une seule valeur par jour et par mesure, la source la plus régulière retenue, l'écart signalé et la confiance abaissée. Prêt pour PULSE 2.
- Check-in unifié en cinq questions : nuit, énergie, stress, état physique, douleur inhabituelle.
    - Chaque question peut être passée, et un second appui efface une réponse.
    - Ce qui existe déjà est prérempli (stress du journal Mind, douleurs suivies).
    - « Plus tard » ferme sans rien enregistrer, et le check-in se complète ensuite depuis PULSE.
    - Le stress va dans le journal Mind du jour : une seule donnée, comptée une fois.
- Nouvelle règle « Douleur inhabituelle signalée » : au plus la version allégée, invitation à situer la douleur, sans rien deviner de la zone.
- Écran Historique PULSE : jour, semaine, mois ou période choisie (180 jours au plus), comparée à la période précédente.
    - On y voit l'indicateur, les cinq dimensions, le sommeil moyen, le stress moyen et les séries par semaine.
    - On y voit aussi les propositions et le taux d'acceptation.
    - Chaque comparaison décrit un écart, sans en donner la cause.
- Après trois « Garder » en 7 jours, PULSE suggère d'ajuster les seuils, sans changer ni le score ni la proposition.
- Écrans réorganisés dans l'ordre du cahier : score et évolution, couverture, cinq dimensions, analyse, séance, nutrition, Mind, récupération, Nutrition Status.
- Réglages : niveaux de lecture ajoutés, « Modes du jour » devenus « Proposition de séance ».
- Version de règles 2 enregistrée dans le journal, avec le niveau, la couverture et la proposition du jour. Les lignes de PULSE 1 restent lisibles.
- Aucun changement de schéma de la base (champs facultatifs seulement). La sauvegarde accepte les nouveaux champs, testée aller et retour.
- Documentation technique du calcul : `docs/pulse.md`.
- Correction trouvée au parcours : le check-in s'ouvrait parfois avant le chargement des réponses déjà enregistrées. Il attend maintenant ces réponses et ne peut plus les effacer par erreur.
- 280 tests, dont les 7 cas du cahier et les 5 scénarios de référence inchangés.
- Parcours vérifié au format iPhone, en démo et sur un compte vide :
    - carte de l'accueil et écran PULSE ;
    - check-in corrigé, avec une question passée, le stress et une douleur signalée ;
    - alerte et version allégée proposée, puis choix « Garder » enregistré ;
    - historique par semaine, mois, période et jour ;
    - réglages des niveaux ;
    - compte vide avec une seule réponse : score « ≈ 75 », 1 dimension sur 5, confiance basse.

## PULSE 1 : moteur de décision sur les données FORGE (version de test, branche `pulse-1`)

### Fait
- Deux indicateurs séparés :
    - **Readiness Score** sur 100, la disponibilité physique et mentale, en cinq composantes : Sommeil, Physiologie, Ressenti, Charge, Mental ;
    - **Nutrition Status**, la cohérence des apports des 3 derniers jours notés avec l'objectif en vigueur. Il ne change jamais le Readiness Score.
- Chaque composante est expliquée : sa note, son poids réel, sa source (déclarée, mesurée ou calculée) et le calcul en clair.
- Une donnée manquante n'est jamais inventée : son poids est réparti sur les autres composantes et le niveau de confiance (haute, moyenne, basse) le dit.
- Références personnelles :
    - pour la VFC et la fréquence cardiaque au repos, 14 jours minimum sur les 28 derniers, prêtes pour PULSE 2 ;
    - pour la charge, 4 semaines de séances avant d'en juger.
- Fiabilité des sources : un sommeil mesuré par une montre passe avant le sommeil déclaré.
- Modes du jour (Feu vert, Normal, Allégé, Récupération) fixés par le score. Les règles de sécurité et de tendance passent avant :
    - pas de plan avant 18 ans ;
    - douleur dans la poitrine : aucun entraînement ;
    - douleur avec signe d'alerte : séance suspendue si elle sollicite la zone ;
    - nuit de moins de 5 h : au plus Allégé ;
    - fatigue qui s'installe (VFC basse 3 jours, ou fatigue et courbatures fortes 3 jours, avec une charge en hausse) : Récupération ;
    - moral au plus bas : rappel du 3114 ;
    - apport très bas : retour à l'objectif ;
    - poids déjà bas : aucun déficit.
- Recommandations Training, Nutrition, Mind et Recovery, avec leur raison et leur source vérifiée (Watson 2015, Craven 2022, Drake 2013, Brooks et Lack 2006, Kiviniemi 2007, Plews 2013, Meeusen 2013, Impellizzeri 2020, Morton 2018). Les recommandations Mind ne pointent que vers des exercices et routines qui existent.
- Séance du jour en un geste, seulement si tu valides :
    - « Démarrer la version allégée » : une série de moins par exercice, 2 répétitions en réserve de plus, aucune hausse de charge proposée pendant la séance ;
    - « Garder la séance prévue » ;
    - « Déplacer à demain » : PULSE la propose le lendemain.
- Réglages PULSE : poids des composantes, seuils des modes, sommeil visé, nuit courte, seuils de charge, seuils du Nutrition Status. Ils sont bornés, gardés dans la base locale et la sauvegarde, avec « Revenir aux valeurs de départ ».
- Carte « PULSE du jour » en tête de l'accueil : score, mode, confiance, Nutrition Status, première recommandation ou alerte. Sans check-in, elle propose de le faire.
- Journal PULSE : une ligne par jour avec le résultat montré et ton choix, réécrite seulement si le résultat change. C'est le socle de l'historique de PULSE 3.
- Base locale v11 : table `pulseDays` (migration v10 vers v11 testée). Les séances peuvent porter une version allégée, comprise dans la sauvegarde.
- Préparé pour le multi-utilisateur sans rien en construire : moteur en fonctions pures, données et réglages dans la base de l'utilisateur, identifiants et dates de synchronisation sur chaque ligne, aucune donnée sur un serveur.
- Les cinq scénarios de l'audit sont des tests automatiques. Ils donnent les mêmes décisions, avec deux écarts d'arrondi corrigés dans l'audit : Sommeil 93 au lieu de 92, et scénario 4 à 82 au lieu de 80.
- 262 tests. Parcours vérifié au format iPhone : carte de l'accueil, écran PULSE, passage en Allégé par les réglages, séance allégée démarrée, choix gardé au journal, retour aux valeurs de départ, compte vide sans check-in.

## Bilans 1 : bilan de la semaine, calendrier, analyses croisées, badges (version de test, branche `bilans-1`)

### Fait
- Nouvel espace Bilans (Progression, ligne « Bilans et calendrier », ou carte « Ta semaine » de l'accueil), en quatre vues.
- Semaine : jours actifs, ce qui a avancé (records, séances, sommeil, pratiques Mind, protéines, humeur, douleur qui baisse, nouveaux badges), au plus trois pistes pour la suite (douleur avec signe d'alerte, sommeil sous 7 h avec sa source AASM et SRS, stress élevé, protéines ou calories loin de l'objectif en vigueur à cette date, semaine nettement plus légère que le programme, peu de pesées) et les chiffres de la semaine comparés à la précédente. Aucune remarque sur une semaine en cours non terminée, aucun reproche sur une semaine vide.
- Ton regard sur la semaine : ce qui a marché, ce que tu veux ajuster, ton intention ; l'intention s'affiche en tête de la semaine suivante. Historique de toutes les semaines depuis ta première donnée, avec flèches et liste.
- Calendrier jour, semaine et mois sur les quatre espaces (Training, Nutrition, Corps et récup, Mind), chaque élément menant à sa fiche. Les séances du programme et les repas du planning à venir apparaissent comme prévus ; un jour passé sans séance n'est jamais signalé. Couleurs des repères vérifiées (contraste, daltonismes) et toujours à la même place, avec légende.
- Analyses : sur 60 jours, deux groupes de jours comparés (sommeil et humeur, sommeil et stress, stress et nuit suivante, séance et humeur, séance et stress, pratique Mind et stress, sommeil et volume de séance, tension avant et après les pratiques, chaque douleur le lendemain d'une séance). Affichées seulement avec assez de jours de chaque côté et un écart net ; présentées comme des coïncidences, jamais comme des causes. Les liens sans différence et ceux en attente de données sont listés à part.
- Badges : 33 paliers cumulés (séances, records, tonnes, jours de repas, pesées, mensurations, check-ins, pratiques, minutes, journal, semaines actives), datés, qui ne se perdent jamais ; prochaine étape par famille ; régularité sur 12 semaines sans série à tenir ; records des 90 derniers jours.
- Base locale v10 : notes de semaine (migration v9 vers v10 testée, comprises dans la sauvegarde). La démo contient une note sur la semaine dernière.
- 231 tests. Parcours vérifié au format iPhone, en démo et sur un compte vide.

## Progression 2 : corps, photos, comparaisons et douleurs (version de test, branche `progression-2`)

### Fait
- Progression s'organise en quatre vues : Corps, Training, Douleurs, Bien-être (l'ancien lien vers la vue Poids ouvre Corps).
- Corps : la courbe de poids existante, plus la moyenne des pesées des 7 derniers jours.
- Mensurations (taille, poitrine, bras, cuisse, hanches, en cm, toutes facultatives) : dernière valeur et écart depuis la première, courbe par mesure, historique modifiable, conseils pour mesurer pareil à chaque fois. Une nouvelle saisie le même jour complète la fiche du jour.
- Photos du corps de face, de profil et de dos, réduites à 1 080 px et gardées sur l'iPhone seulement (ni envoyées, ni dans la sauvegarde) ; floutées par défaut, à afficher d'un geste ; « Enregistrer dans Photos » pour en garder une copie ; suppression.
- Comparer deux dates : photos côte à côte pour la même pose, poids moyen sur 7 jours à chaque date, mensurations et écarts. Rappel : les photos ne mesurent ni le muscle ni la graisse.
- Douleurs : silhouette de face et de dos à toucher (36 zones, droite et gauche), intensité de 0 à 10, date de début, activités associées, commentaire, journal jour par jour, courbe d'évolution, tendance, « Elle est passée » ou « Elle est revenue », historique des douleurs passées.
- Jamais de diagnostic. Alertes sourcées (MSD Manuals grand public, Santé.fr, HAS) : signes à surveiller (gonflement, fièvre, engourdissement, impossible de prendre appui, après un choc) → avis médical dans la journée ; intensité 7 ou plus ; douleur la nuit ou au repos ; plus de 14 jours sans amélioration nette → médecin ou kiné ; poitrine → rappel d'appeler le 15 ou le 112 si la douleur est brutale, serre ou irradie.
- Base locale v9 : mensurations, photos, douleurs (migration v8 vers v9 testée). Mensurations et douleurs sont dans la sauvegarde, pas les photos.
- Démo : mensurations toutes les deux semaines sur 12 semaines, une douleur au genou passée et une au bas du dos qui diminue.
- 213 tests. Parcours vérifié au format iPhone : moyenne 7 jours, saisie de mensurations, courbe, ajout de photos floutées puis affichées, comparaison, nouvelle douleur avec alertes, note du jour, fin de la douleur, vue de dos, alerte poitrine.

## Mind 2 : séances audio, lecteur, Hypnose et espace créateur (version de test, branche `mind-2`)

### Fait
- Stockage Cloudflare Workers KV (namespace `forge-audio`, inclus dans l'offre gratuite, sans carte) : catalogue, fichiers découpés en morceaux de 2 Mio, couvertures. Environ 1 Go disponible, soit une quarantaine de séances de 20 minutes ; passage à R2 possible plus tard.
- Lecture par plages d'octets (Safari en a besoin pour lire et avancer), fichiers versionnés : un fichier remplacé n'est jamais servi depuis un cache périmé.
- Espace créateur privé : cinq touchers sur la ligne de version dans Réglages, puis le code d'administration (secret Cloudflare `ADMIN_CODE`, jamais dans le code). Une fois le code saisi, une ligne « Espace créateur » apparaît dans Réglages sur cet appareil. Ajout depuis l'iPhone (MP3, M4A des Mémos vocaux, AAC, WAV, OGG, 95 Mo au plus) avec durée lue automatiquement, envoi morceau par morceau avec progression et nouvelles tentatives, titre, description, type, thèmes d'hypnose, catégories Mind, objectif, niveau, public, mots-clés, auteur affiché, couverture, brouillon ou publiée, ordre, remplacement du fichier, suppression. Les autres utilisateurs ne voient ni l'entrée ni rien à administrer.
- Lecteur pour toute l'app : mini-lecteur au-dessus des onglets, lecteur plein écran, lecture et pause, ±15 s, barre de progression, minuteur d'arrêt (5 à 60 min, fondu quand le volume se règle), volume quand l'appareil le permet (pas sur iPhone, où il suit les boutons), commandes sur l'écran verrouillé, reprise à la dernière position.
- Hors connexion : téléchargement de la séance sur l'iPhone, liste gardée de la dernière visite ; un téléchargement retiré ou remplacé par le créateur est effacé.
- Historique : une écoute d'au moins une minute devient une pratique Mind (comptée dans ta pratique et tes dernières pratiques), terminée au-delà de 95 %.
- Bibliothèque audio (reprendre, favoris, hors connexion, par type), fiche de séance clairement marquée « Séance originale de… », catégorie Hypnose par thèmes avec précautions (Inserm, 2015 ; La Revue du Praticien) : pas un soin, pas de résultat garanti, avis médical d'abord en cas de trouble psychotique, jamais en conduisant. Rien d'audio n'apparaît tant qu'aucune séance n'est publiée.
- Séances audio aussi dans l'accueil Mind, Sommeil (séances pour la nuit) et les catégories d'exercices.
- Base locale v8 : état d'écoute et téléchargements (migration v7 vers v8 testée ; l'état d'écoute est dans la sauvegarde, pas les fichiers téléchargés).
- 205 tests dans l'app, 14 pour le serveur. Parcours vérifié au format iPhone avec un vrai fichier de 10 min : code faux puis bon, envoi, publication, accueil Mind, Hypnose, fiche, lecture, +15 s, minuteur, mini-lecteur, historique après une minute, reprise à 3:20, téléchargement puis lecture hors connexion, dépublication, suppression.

### Code d'administration
- La production ne contenant encore que des fichiers statiques, Cloudflare n'y accepte pas de secret : le code vient du Secrets Store du compte (secret `ADMIN_CODE`, portée Workers), relié à la production et aux versions de test.

### À vérifier sur ton iPhone
- La lecture écran verrouillé et le minuteur d'arrêt pendant le verrouillage dépendent d'iOS.

## Mind 1 : espace FORGE MIND, exercices guidés, journal, sommeil (version de test, branche `mind-1`)

### Fait
- Onglet Mind à la place de l'onglet Coach ; le coach reste accessible partout par le bouton rond en haut d'Accueil, Training, Nutrition, Mind et Progression. Teinte « brume » plus apaisante pour Mind, dans le même univers sombre.
- Base locale v7 : journal émotionnel et pratiques Mind. Tables ajoutées ; le check-in du matin gagne des champs facultatifs. Migration v6 vers v7 testée, rien de modifié.
- Accueil Mind : salutation, état du jour en un geste (humeur, stress, énergie mentale, enregistrés dans le journal), recommandation selon l'heure, le journal, la nuit et l'entraînement (routine d'avant séance si une séance est prévue, retour au calme dans les 3 h après, cohérence cardiaque si stress noté à 4 ou 5, rituel le soir), trois autres exercices dans le même esprit, sept catégories, routines, pratique de la semaine, minutes sur 8 semaines, moyennes du journal, dernières pratiques.
- 26 exercices guidés sans matériel, en cinq familles (respiration, ancrage, relaxation, visualisation, concentration), chacun avec présentation, objectif, position, durée, consignes étape par étape, précautions et repère scientifique. Quatre déroulés interactifs : cercle qui suit la respiration, étapes minutées (relaxation progressive avec contracte et relâche), cinq sens à cocher, attention (compter ses expirations, noter ses distractions). Pause, étape suivante, repères sonores doux facultatifs, écran gardé allumé.
- Suivi : chaque pratique est enregistrée (durée réelle, terminée ou arrêtée après au moins une minute), avec la tension ressentie avant et après si tu la notes. Favoris.
- Routines avant l'entraînement (3 min), après (5 min) et du soir (6 min 30), personnalisables : exercices, ordre, durées, retour à l'origine. Raccourcis depuis Training et en fin de séance.
- Mental du sportif : avant l'effort, motivation, pression et concentration, confiance, frustration, stagnation.
- Journal émotionnel libre : humeur, stress, énergie mentale, motivation, charge mentale, récupération, émotions, commentaire ; n'importe quel jour ; évolution sur 30 jours et historique. Rien n'est obligatoire.
- Sommeil : check-in du matin enrichi (coucher, réveil avec calcul de la durée, réveils, qualité ressentie) ; moyennes sur 7 ou 30 jours, régularité des horaires, nuits sous 7 h (Watson et al., 2015), récupération au réveil, nuits avant une séance comparées aux autres (une observation, pas une cause), rituel du soir et repères de l'INSV.
- Précautions : repères de bien-être, pas un soin ; médecin si le mal-être dure ; 3114, 15 et 112.
- 200 tests. Parcours vérifié au format iPhone : respiration, relaxation menée au bout, cinq sens, attention, routine enchaînée, arrêt avant la fin, journal, check-in détaillé, favoris, routine personnalisée, coach depuis Training.

### Pas encore
- Séances audio, lecteur et catégorie Hypnose : faits dans Mind 2.
- Recommandations du coach IA à partir de Mind : livraison IA.

## Budget 1 : objectifs dynamiques et budget alimentaire (version de test, branche `budget-1`)

### Fait
- Base locale v6 : historique des objectifs (date, avant, après, origine, raison). Table ajoutée, rien de modifié ; migration v5 vers v6 testée. Chaque changement d'objectif est enregistré : questionnaire de départ, saisie à la main, proposition acceptée.
- Objectifs (Nutrition, « Objectifs ») : analyse sur 14 à 28 jours depuis le dernier changement, à partir du poids tendance (pesées lissées, jamais une pesée seule), des apports des jours notés en entier (jours incomplets écartés), de la dépense estimée et des séances. Il faut au moins 8 jours pesés et 10 jours notés sur 14 ; sinon l'écran dit ce qui manque.
- Proposition expliquée quand le poids sort de la fourchette visée : écart, calories correspondantes (environ 7 700 kcal par kilo, approximation de Wishnofsky, 1958, discutée par Hall, 2008), pas plafonné à 200 kcal, ajouté ou retiré sur les glucides (protéines inchangées, lipides au moins 20 % des calories). Jamais sous le métabolisme de base. « Accepter » enregistre les nouveaux objectifs ; « Refuser » écarte la proposition 7 jours. Rien ne change sans validation.
- Si l'objectif actuel n'est pas suivi (écart de plus de 150 kcal par jour dans le sens du problème), FORGE conseille d'abord de l'atteindre au lieu de le changer.
- Budget (Nutrition, « Budget ») : coût de ce qui a été mangé, jamais le prix des paquets achetés. Coût du jour et par repas, de la semaine, estimation mensuelle, coût de 100 g de protéines, part des calories dont le coût est connu, 14 derniers jours en barres avec le budget du jour. Budgets journalier et hebdomadaire facultatifs.
- Un aliment pesé garde son coût au moment de l'ajout ; changer un prix plus tard ne réécrit pas le passé.
- Mes prix : prix payé, quantité, prix au kilo ou au litre, quantité consommée et son coût sur 30 jours ; ajout depuis tes aliments ou la table Ciqual, modification, suppression.
- Pour dépenser moins : sources de protéines les moins chères parmi tes produits (au moins 20 % des calories venant des protéines), alternative moins chère au produit le plus coûteux consommé, recettes les moins chères par portion.
- Nutrition : raccourcis « Objectifs » (mis en avant quand un ajustement est proposé) et « Budget » (coût du jour).
- Démo : 4 semaines de repas, un plateau de poids sur les 4 dernières semaines (une proposition s'affiche) et quelques prix fictifs.
- 182 tests. Parcours vérifié au format iPhone : proposition acceptée puis historique, proposition refusée, objectifs modifiés à la main, prix ajoutés et supprimés, budgets, coût enregistré pour un aliment pesé.

### Pas encore
- Menus économiques générés : livraison 6 (IA).

## Kitchen 1 : recettes, Compose mon repas, planning et courses (version de test, branche `kitchen-1`)

### Fait
- Base locale v5 : recettes perso, photos de recettes, planning des repas, listes de courses, prix des ingrédients. Tables ajoutées, rien de modifié ; migration v4 vers v5 testée. Le journal garde, pour une recette mangée, la recette, les portions et le coût.
- 32 recettes FORGE, cuisine sportive et cuisine plaisir : petits-déjeuners, meal prep, bowls, plats mijotés, pizza, burger, wraps, quiche, carbonara, collations, desserts. Chaque ingrédient est relié à la table Ciqual 2025 (Anses) : calories, protéines, glucides, lipides et fibres sont calculés, jamais saisis. Un test vérifie chaque code Ciqual et la cohérence des valeurs.
- Bibliothèque : recherche par nom ou ingrédient, catégories (petit-déjeuner, déjeuner, dîner, collations, desserts, repas rapides, meal prep, économiques, plaisir, riches en protéines, favoris, mes recettes), filtres par calories, protéines, temps, difficulté et budget par portion.
- Fiche recette : visuel graphique FORGE ou ta photo, temps, difficulté, portions ajustables (quantités et valeurs recalculées), valeurs par portion et totales avec leur source, coût par portion (seulement quand tous les prix sont saisis, sinon « à renseigner »), ingrédients, étapes, conservation. Actions : « J’en mange » (ajout au journal), planifier, ajouter aux courses, favori, dupliquer, exporter.
- Recettes perso : création et modification avec ingrédients cherchés dans tes aliments, la table Ciqual ou Open Food Facts (ou sans valeurs), rayon, étapes, conservation ; valeurs recalculées en direct. Une recette FORGE se duplique pour être modifiée. Import et export d’une recette en fichier FORGE.
- Prix : tu saisis le prix payé et la quantité du paquet ; FORGE calcule le coût des quantités réellement utilisées (jamais le prix du paquet entier).
- Préférences : allergènes et exclusions, végétarien, aliments aimés (mis en avant) et détestés ou à éviter (recettes masquées, avec un lien pour les afficher), budget par portion et temps maximal. Les allergènes des ingrédients perso ou importés ne sont pas connus : l’app le dit et rappelle de vérifier les étiquettes.
- Compose mon repas : à partir des calories et protéines restantes du jour, du type de repas, du temps, du budget et des ingrédients à utiliser, FORGE propose les recettes et le nombre de portions (½ à 3) les plus proches. Ajout au journal en un geste.
- Planning de la semaine : repas prévus par jour, distincts du journal jusqu’à « J’ai mangé » ; calories prévues par jour ; liste de courses de la semaine en un geste.
- Listes de courses : ingrédients additionnés sans doublon, rangés par rayon, cases à cocher enregistrées, coût estimé (ou partiel avec le nombre d’articles sans prix).
- Nutrition : accès à Recettes et à Compose mon repas sous le bilan du jour.
- 167 tests. Parcours vérifié au format iPhone : bibliothèque, préférences (5 recettes masquées), catégories, fiche, portions, prix, j’en mange, planification, liste de courses cochée, Compose mon repas (750 kcal et 55 g de protéines), recette perso créée depuis la table Ciqual.

### Pas encore
- Génération de recettes et de menus par l’IA : livraison 6 (avec ta clé API).
- Budget journalier et hebdomadaire, suivi des dépenses : fait dans Budget 1.

## Training 2 : carte des muscles (version de test, branche `muscles-1`)

### Fait
- Carte anatomique dessinée pour FORGE, de face et de dos, avec les 15 groupes musculaires. Chaque muscle se touche ; sa couleur suit les séries de la période (0, moins de 5, 5 à 9, 10 à 20, plus de 20), avec légende. Liste des 15 muscles sous la carte, avec barre et repère à 10 séries.
- Comptage fractionné : une série compte 1 pour le muscle principal de l'exercice et 0,5 pour chaque muscle secondaire (méthode retenue par la méta-régression de Pelland et al., 2024). Repère affiché : 10 à 20 séries par semaine et par muscle (Schoenfeld et al., 2017).
- Périodes : semaine en cours, semaine précédente (choisie d'office quand la semaine en cours est vide), moyenne sur 4 semaines.
- Page de chaque muscle : séries de la semaine (directes et indirectes), fréquence (jours avec des séries directes), moyenne sur 4 semaines et statut, historique sur 12 semaines en barres, exercices qui l'ont travaillé cette semaine, records (1RM estimé sur un an) et tendance de chaque exercice qui le cible, exercices de la bibliothèque qui le ciblent ou le sollicitent.
- Exercices sans muscle principal : signalés avec un lien pour le préciser (ils ne sont pas comptés en attendant).
- Aperçu « Muscles » sur l'écran Training, avec mini-carte.
- 156 tests. Parcours vérifié au format iPhone sur les données de démo : carte, sélection d'un muscle, moyenne 4 semaines, page Dos.

## Départ 1 : questionnaire et plan de départ (version de test, branche `depart-1`)

FORGE s'ouvre à d'autres personnes : chacun a ses données sur son appareil et construit son plan. Le paiement viendra dans une livraison dédiée (modèle encore à décider).

### Fait
- Questionnaire de départ en 7 questions après l'accueil, facultatif (« Plus tard ») et relançable depuis Réglages, « Plan de départ » : objectif (prendre du muscle, perdre du gras, se recomposer, gagner en force, être en forme), sexe, date de naissance, taille, poids, activité hors sport, niveau et reprise après une pause, jours et durée des séances, salle ou maison avec le matériel, zones à ménager. Rien n'est enregistré avant « Adopter ce plan ».
- Plan nutritionnel calculé sans IA : métabolisme de base de Mifflin-St Jeor, activité quotidienne et heures d'entraînement ; prise de muscle +10 % et 0,25 à 0,5 % du poids par semaine (+5 % et 0,1 à 0,25 % pour un confirmé, Iraki et al., 2019) ; perte de gras −20 % et −0,5 à −1 % par semaine (Helms et al., 2014) ; recomposition et forme à l'équilibre ; force +5 %. Protéines 1,6 à 2 g par kg (Morton et al., 2018), calculées sur un poids plafonné à un IMC de 27 ; lipides 25 % des calories ; glucides le reste ; fibres 30 g (ANSES) ; boissons d'après l'EFSA. Le détail du calcul est affiché.
- Garde-fous : pas de plan pour les moins de 18 ans ; pas de déficit si le poids est déjà dans le bas de la norme ; calories jamais sous le métabolisme de base ; avertissement « pas un avis médical » (grossesse, maladie, traitement, trouble du comportement alimentaire).
- Programme généré : corps entier (1 à 3 jours), haut et bas du corps (4), hybride haut, bas, poussée, tirage, jambes (5), poussée, tirage, jambes (6). Exercices choisis par schéma de mouvement selon le matériel disponible, variés entre les séances A et B ; 4 à 7 exercices selon la durée ; séries, fourchettes de répétitions, repos et RIR selon l'objectif et le niveau. Zones à ménager : mouvements les plus exigeants écartés et listés. Messages si le matériel ne permet pas de travailler le dos ou l'arrière des cuisses.
- Bibliothèque : 15 exercices ajoutés pour la maison et le poids du corps (91 au total), avec matériel requis et schéma de mouvement pour chacun.
- Adoption : profil, objectifs nutritionnels, rythme de poids, pesée du jour et nouveau programme actif. Les anciens programmes restent dans « Programmes » ; depuis Réglages, on choisit ce que l'on remplace.
- Le rythme de poids visé accepte une perte (jusqu'à −2 % par semaine) ; l'Accueil affiche l'objectif choisi ; textes « prise de masse » rendus neutres.
- 153 tests. Parcours vérifiés au format iPhone : plan en salle pour la prise de muscle, refus pour un mineur puis « Plus tard », plan maison avec haltères pour une perte de gras et des genoux à ménager, depuis les réglages.

## Training 1 : séance en direct, programmes, bibliothèque, progression (version de test, branche `training-1`)

### Fait
- Base locale v4 : programmes ; repos et RIR visés par exercice ; RIR par série ; notes de séance et d'exercice ; fiche d'exercice (muscles, matériel, type, consignes, repos). Une table ajoutée, rien de supprimé. À la mise à jour, tes séances existantes sont rangées dans « Mon programme », actif. Migration v3 vers v4 testée, et vérifiée dans le navigateur : données créées avec la version en production, puis ouverture de la nouvelle version, sans perte.
- Bibliothèque de 76 exercices classés dans les 15 groupes musculaires (pectoraux à mollets) : nom français, deux photos (départ et fin du mouvement, en alternance), muscle principal et secondaires, matériel, type de mouvement, repos conseillé, consignes techniques rédigées pour FORGE. Photos : Free Exercise DB, domaine public, converties en WebP (2,6 Mo, disponibles hors ligne ; scripts/build-exercise-images.py).
- Exercices perso : création et modification (nom, muscles, matériel, type, repos, consignes). Un ancien exercice saisi au clavier qui porte le nom d'un exercice de la bibliothèque y est rattaché avec tout son historique ; les autres demandent leur muscle principal au moment de les ouvrir.
- Programmes : plusieurs programmes, un seul actif ; créer, renommer, dupliquer (avec ses séances), supprimer. Séances du programme sur une page dédiée : jours, exercices choisis dans la bibliothèque, séries, fourchette de répétitions, repos et RIR visés, ordre modifiable, duplication.
- Séance en direct : bouton fixe en bas de l'écran « Série 2 sur 4 : exercice » qui enchaîne les séries prévues, puis « Terminer la séance ». Saisie au pavé préremplie avec ta dernière série, RIR en un toucher (RPE affiché), objectif proposé appliqué seulement si tu le touches. Minuteur de repos lancé à chaque série (repos visé de la séance, sinon celui de l'exercice), −15 s, +15 s, Passer ; il survit à un rechargement ; signal sonore à la fin. Écran maintenu allumé pendant la séance quand l'iPhone le permet. Ajouter, retirer et réordonner les exercices, technique et consignes, note par exercice et note de séance. Chaque série est enregistrée immédiatement : une séance interrompue se reprend telle quelle.
- Surcharge progressive : objectif proposé par exercice selon la fourchette visée et le RIR (double progression : une répétition de plus sur chaque série jusqu'au haut de la fourchette, puis +2,5 kg, ou +1 kg sous 20 kg ; pas de hausse après une dernière série à l'échec). FORGE ne modifie jamais une charge de lui-même. Tendance par exercice : progression, stagnation, régression ou irrégularité (plus de 14 jours entre deux séances).
- Fiche d'exercice : records sur 30 jours, 90 jours, 1 an ou depuis toujours (meilleure charge, meilleures répétitions, 1RM estimé, meilleur volume), courbe tactile par séance (1RM estimé, charge max ou volume), historique détaillé. Les records de Progression mènent à la fiche.
- 140 tests. Parcours vérifiés au format iPhone : création de séance depuis la bibliothèque, séance en direct avec minuteur, rechargement en plein repos, notes, réordonnancement, exercice perso, programmes, fiche avec données de démo, mise à jour depuis la version en production.

### Limites connues
- Le signal sonore ne passe pas en mode silencieux, ni quand l'app est en arrière-plan : l'iPhone suspend alors les apps web. Le temps restant est juste au retour.
- La carte anatomique (volume et fréquence par muscle) arrive à la livraison 3 ; la génération de programme par IA à la livraison 6.

## Nutrition 1 : ajout d'aliments (version de test, branche `nutrition-1`)

### Fait
- Base locale v3 : aliments (perso, Open Food Facts, Ciqual), repas habituels, boissons. Tables ajoutées sans rien modifier ; migration v2 vers v3 testée.
- Écran « Ajouter » : recherche dans tes aliments (hors ligne) puis dans Open Food Facts (nom ou marque), onglets Récents, Favoris, Perso et Repas habituels.
- Scanner de codes-barres : caméra arrière, moteur de lecture embarqué (fonctionne sans réseau), saisie manuelle du code en secours. Produit introuvable : création d'un aliment perso avec ce code, reconnu au scan suivant.
- Quantités en grammes ou millilitres : pavé, portions rapides (portion du produit, 50 à 250 g), calcul en direct des calories, macros et fibres. Aucune ligne n'est enregistrée avant confirmation.
- Modification de la quantité d'une ligne du journal, valeurs recalculées ; favoris ; historique d'usage.
- Aliments perso à partir de l'étiquette (pour 100 g ou 100 ml, portion habituelle, cru ou cuit).
- Journal : copier le repas de la veille, copier un repas d'un autre jour sur aujourd'hui, enregistrer un repas comme repas habituel et l'ajouter d'un geste.
- Fibres (total minimum quand une valeur manque) et hydratation (+250, +500, +750 ml, détail et retrait), objectifs facultatifs avec repères sourcés. Fibres et boissons au tableau de bord.
- Open Food Facts : 10 recherches et 15 fiches par minute au plus, jamais de recherche à chaque frappe ; messages clairs hors connexion ou en cas de limite.
- Recherche par nom via un relais FORGE sur Cloudflare (/api/off/search, dossier apps/worker) : le moteur de recherche d'Open Food Facts n'autorise pas la lecture directe depuis une app web, Safari bloquait ses réponses (« Aucun produit trouvé »). Le relais n'enregistre rien et garde les résultats en cache une heure. Les fiches produit du scanner restent interrogées directement. Les fiches sans aucune valeur nutritionnelle sont écartées, les complètes passent en tête.
- Table Ciqual 2025 (Anses) embarquée : 3 323 aliments de base, recherche hors ligne, cru ou cuit lu dans le nom. Fichiers officiels téléchargés sur Zenodo, sommes de contrôle vérifiées, conversion reproductible (scripts/build-ciqual.py). Valeurs « traces » ou sous le seuil comptées à 0, valeurs absentes laissées inconnues, 161 aliments sans valeurs essentielles écartés. Source citée dans l'app (licence CC BY 4.0).
- 114 tests. Parcours vérifié au format iPhone : recherche Open Food Facts simulée, vrai code-barres lu par une caméra simulée, modification de quantité, produit introuvable vers aliment perso, repas habituel, boissons, recherche Ciqual hors connexion.

### Vérifié sur le vrai réseau
- Recherche « skyr » via le relais : 23 produits réels ; ajout au journal.
- Code-barres réel lu par la caméra simulée : fiche Open Food Facts réelle (Nutella, 539 kcal pour 100 g).

### À vérifier sur ton iPhone
- Autorisation de la caméra dans l'app installée.

## Interface V1 et tableau de bord (version de test, branche `dashboard-v1`)

### Fait
- Base locale v2 : journal alimentaire, exercices, programme, séances, séries, check-ins. Tables ajoutées sans rien modifier ; migration v1 vers v2 testée sur une base remplie, sans perte.
- Sauvegarde étendue à toutes les tables ; les sauvegardes v1 restent importables.
- Tableau de bord : séance du jour (à battre, commencer, reprendre, faite, repos), nutrition (anneau calories, restant, jauges protéines, glucides, lipides), physique (dernier poids, moyenne 7 jours, évolution, objectif de prise et statut), récupération estimée, semaine d'entraînement (séances, volume), dernière séance et records, analyse du jour. Raccourcis « Se peser » et « Check-in » tant qu'ils ne sont pas faits.
- Chaque carte mène à sa page : calories vers Nutrition, poids vers Progression, séance vers Training, analyse vers Coach IA. Tout se recalcule dès qu'une donnée change.
- Training : semaine en un coup d'œil, programme (séances, jours, exercices, séries et répétitions visées), séance en cours avec performance à battre, séries saisies au pavé, animation « frappe » à la validation, records en direct, reprise d'une séance interrompue, historique.
- Nutrition : jour par jour, objectifs du jour, ajout manuel d'aliments par repas (aliments récents en un geste), correction et suppression, calories sur 7 jours.
- Progression : Poids (inchangé), Entraînement (volume par semaine, records sur 90 jours, meilleures performances en 1RM estimé), Bien-être (moyennes sur 7 jours, sommeil sur 14 jours, historique des check-ins).
- Coach IA : résumé du jour, observations et recommandations calculées par des règles locales à partir des vraies données. L'écran dit clairement que ce n'est pas encore l'IA (Phase 5).
- Démonstration : 12 semaines de données fictives dans une base séparée (« forge-demo »), bandeau permanent, sortie qui supprime la démo et retrouve tes données intactes. Accessible depuis l'accueil de l'app et les réglages.
- Graphiques en barres tactiles, jauges animées, confirmations après chaque action, transitions entre écrans, états vides, chargements et erreurs.
- 92 tests. Parcours vérifiés au format iPhone (390 et 375 px), sur grand iPhone et sur ordinateur : toutes les cartes, ajout d'un aliment, séance complète avec record, check-in, programme, objectifs, entrée et sortie de la démo, sans erreur.

### Choix et limites assumés
- « Objectif physique » = fourchette de prise par semaine (pas de poids cible, décision validée).
- Objectifs nutritionnels saisis à la main ; le calcul automatique viendra avec le module Nutrition complet.
- Saisie des aliments manuelle ; Ciqual, scanner et Open Food Facts en Phase 3.
- Récupération estimée : repère calculé à partir du check-in, pas une mesure physiologique.

## Phase 1 : socle et poids (version de test, branche `phase-1`)

### Fait
- Planche visuelle « Métal et mesure » : palette avec contrastes vérifiés, écrans Accueil, Poids et Séance.
- Typographie retenue : option A, Archivo condensée pour les chiffres et les titres, embarquée dans l'app (fonctionne hors ligne). Texte courant en SF Pro.
- Socle technique : Vite, React 19, TypeScript strict, Tailwind 4, PWA.
- Base locale v1 (Dexie) : profil, pesées, réglages système ; identifiants UUID, horodatages, suppression logique. Aucun changement de schéma dans cette version.
- Logique du poids : une valeur par jour, poids tendance lissé (10 % par jour), rythme sur 14 jours, fourchette de prise en % du poids.
- Design system en composants : boutons, feuille, pavé numérique, sélecteur, statuts (icône et libellé), barre d'onglets (barre latérale sur ordinateur).
- Navigation des 5 espaces. Training, Nutrition et Coach sont signalés « à venir », avec leur phase et leur contenu.
- Onboarding : guide d'installation iPhone avant tout (stockage séparé de Safari), prénom facultatif, première pesée, restauration d'une sauvegarde possible dès l'accueil.
- Pesée en deux gestes : pavé numérique, moment (au réveil ou autre), jour et heure modifiables ; correction et suppression depuis l'historique.
- Écran Poids : poids tendance, rythme par semaine, statut par rapport à la fourchette, calibrage pendant les 14 premiers jours, graphique 1 mois / 3 mois / 1 an / tout avec lecture au doigt, historique des pesées.
- Accueil : pesée du jour, poids tendance et mini-courbe, rappel de sauvegarde au-delà de 7 jours, ce qui arrive ensuite.
- Réglages : prénom, rythme de prise visé, export (feuille de partage iOS, puis Fichiers ou iCloud Drive), import (fusionner ou remplacer, tout vérifié avant d'écrire), état de l'installation, du hors-ligne et du stockage protégé, effacement complet avec confirmation, numéro de version.
- PWA : icônes, mise à jour proposée par un bandeau, jamais imposée.
- Hébergement : adresse workers.dev et adresses de test par branche fixées dans la configuration.
- 62 tests unitaires. Parcours vérifié au format iPhone dans Chrome : installation, pesée, export, effacement, réimport (76 pesées sur 76 retrouvées), sans erreur.

### Choix techniques
- Graphique du poids dessiné en SVG plutôt qu'avec Recharts : plus léger et fidèle à la planche. Recharts reste prévu pour les graphiques plus riches.
- Animations en CSS pour l'instant ; la bibliothèque motion arrivera avec la « frappe » des séries (Phase 2).

### Recette sur ton iPhone
- Installer l'app depuis le lien de test, se peser, exporter, tout effacer, réimporter : tout doit revenir.

### À faire
- Fusion dans `main` après ta validation.
- Tests de parcours automatisés sur WebKit, le moteur de Safari.
