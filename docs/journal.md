# Journal des versions

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
- Table Ciqual 2025 (Anses) embarquée : 3 323 aliments de base, recherche hors ligne, cru ou cuit lu dans le nom. Fichiers officiels téléchargés sur Zenodo, sommes de contrôle vérifiées, conversion reproductible (scripts/build-ciqual.py). Valeurs « traces » ou sous le seuil comptées à 0, valeurs absentes laissées inconnues, 161 aliments sans valeurs essentielles écartés. Source citée dans l'app (licence CC BY 4.0).
- 114 tests. Parcours vérifié au format iPhone : recherche Open Food Facts simulée, vrai code-barres lu par une caméra simulée, modification de quantité, produit introuvable vers aliment perso, repas habituel, boissons, recherche Ciqual hors connexion.

### À vérifier sur ton iPhone
- Recherche et scan avec le vrai Open Food Facts (impossible depuis mon environnement).
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
