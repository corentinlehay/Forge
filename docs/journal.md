# Journal des versions

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
