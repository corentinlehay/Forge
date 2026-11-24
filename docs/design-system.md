# FORGE SIGNATURE : système de design

Direction artistique de FORGE depuis la version `signature-1`. Toutes les couleurs vivent dans `apps/web/src/design/tokens.css` : changer une valeur là la change dans toute l'app.

## Principes

- **Sobre :** 80 à 85 % de noir, gris et blanc ; 10 à 15 % de couleurs d'espace ; le reste en contraste et détails.
- **Le vert FORGE pour l'action :** logo, bouton principal de chaque écran (même dans Nutrition, Mind et Progression), PULSE, validation, sélection, focus.
- **La couleur de l'espace pour la donnée :** graphiques, jauges, barres, icônes, onglet actif, petits accents, liens discrets.
- **La couleur n'est jamais seule :** un libellé, une icône, une position ou le gras l'accompagnent toujours.
- **Une alerte n'emprunte jamais une couleur d'espace :** la sécurité et la douleur utilisent le rouge d'alerte.

## Jetons

| Rôle | Variable | Valeur |
|---|---|---|
| Fond | `--forge-bg` | #08090B |
| Surface des cartes | `--forge-surface` | #181A1E |
| Surface secondaire | `--forge-surface-secondary` | #292C32 |
| Texte principal | `--forge-text` | #F4F4EF |
| Texte secondaire | `--forge-text-secondary` | #A0A3AA |
| Vert électrique (marque) | `--forge-accent` | #D5FA45 |
| Accueil et PULSE, Training | `--forge-home`, `--forge-training` | vert de marque |
| Nutrition et Kitchen | `--forge-nutrition` | #F5AD55 |
| Mind | `--forge-mind` | #A99AF5 |
| Progression | `--forge-progression` | #69BDEB |
| Alerte, sécurité, douleur | `--forge-danger` | #FF5A5F |
| Bordure | `--forge-border` | surface secondaire |
| Focus | `--forge-focus` | vert de marque |
| Graphiques | `--forge-chart-grid`, `--forge-chart-axis` | surface secondaire, texte secondaire |
| Échelles | `--forge-training-1` à `-3`, `--forge-danger-1` et `-2` | mélanges vers la surface |
| Couleur de l'espace affiché | `--forge-module` | selon `data-module` |

Les noms Tailwind historiques restent valides et pointent vers ces jetons :

- `noir`, `anthracite`, `graphite` pour les fonds ;
- `craie`, `cendre` pour les textes ;
- `citron` pour le vert de marque, `braise` pour l'alerte, `brume` pour Mind.

S'y ajoutent `training`, `nutrition`, `mind`, `progression`, et `module` pour la couleur de l'espace affiché.

## Couleur d'espace

- L'app pose `data-module` sur la coquille selon l'adresse (`app/modules.ts`) : accueil, training, nutrition, mind, progression.
- Les utilitaires `text-module`, `bg-module`, `bg-module-voile`, la jauge (`Ring`), la barre (`Meter`) et les graphiques (`BarChart`, `LineChart`, courbe du poids, courbe d'un exercice) prennent cette couleur.
- Une carte qui parle d'un autre espace porte son propre `data-module`, via `LinkCard module="nutrition"` par exemple. Sur l'accueil, la carte Nutrition est donc orange et la carte Physique bleue.

## Contrastes vérifiés (WCAG)

| Paire | Rapport |
|---|---|
| Texte principal sur surface | 15,8:1 |
| Texte secondaire sur surface | 6,9:1 |
| Texte secondaire sur surface secondaire | 5,5:1 |
| Texte de fond sur vert | 16,7:1 |
| Nutrition sur surface | 9,1:1 |
| Mind sur surface | 7,2:1 |
| Progression sur surface | 8,4:1 |
| Alerte sur surface | 5,7:1 |
| Alerte sur surface secondaire | 4,6:1 |

## Points de vigilance

- **Mind et Progression sont proches.** L'écart perçu entre le violet et le bleu est de 11,6 (sous 15) ; pour un daltonien deutéranope, il tombe à 4,2. Ces deux couleurs ne doivent jamais être côte à côte sans libellé ni position fixe, comme dans le calendrier des bilans où chaque espace a sa place et sa légende.
- **L'orange Nutrition et le rouge d'alerte** restent distincts (écart 18,3). L'ancienne braise orangée (#FF6A3D) était trop proche du nouvel orange.

## FORGE MOTION : le mouvement

Chaque animation a une fonction : confirmer une action, guider vers la suite, montrer un changement. Rien ne bouge en permanence, et une donnée n'est jamais modifiée pour animer : un score ou un total apparaît directement à sa vraie valeur, sans compteur qui fait défiler de faux chiffres.

### Jetons (`design/tokens.css`, et `lib/motion.ts` côté code)

| Jeton | Valeur | Usage |
|---|---|---|
| `--forge-duration-press` | 110 ms | Appui |
| `--forge-duration-fast` | 180 ms | Sortie d'écran, fondu |
| `--forge-duration-base` | 260 ms | Entrée d'écran, apparition, changement de valeur |
| `--forge-duration-slow` | 420 ms | Barres de graphique |
| `--forge-duration-fill` | 700 ms | Jauges qui se remplissent |
| `--forge-duration-draw` | 800 ms | Tracé d'une courbe |
| `--forge-stagger` | 40 ms | Décalage entre les éléments d'une liste |
| `--forge-ease-standard` / `-enter` / `-exit` / `-spring` | courbes | Mouvement, arrivée, départ, rebond léger |

### Utilitaires

- `motion-press` : l'élément s'enfonce à 97 % pendant l'appui (boutons, puces, pavé, onglets).
- `motion-rise` : apparition en montant, décalée selon `--i`.
- `motion-pop` : réponse d'une validation (coche, badge record, onglet choisi).
- `motion-grow` et `motion-grow-x` : barres et jauges qui se remplissent depuis leur base.
- `motion-draw` : tracé d'une courbe ; il faut `pathLength={1}` sur le chemin.
- `motion-attention` : un halo unique sur ce qui attend une action (proposition PULSE, exercice suivant).
- `motion-value-up` et `motion-value-down` : la nouvelle valeur arrive par le haut si elle monte, par le bas si elle baisse. Le composant `LiveValue` les applique tout seul.

### Navigation

- Fondu court entre deux écrans (API View Transitions, prise en charge par Safari sur iPhone).
- Entre deux onglets, glissement de 24 px dans le sens de la barre.
- La barre d'onglets et le bandeau de démonstration ne bougent pas.

### Retour haptique (`services/haptics.ts`)

- **Où il se déclenche :**
    - validation d'une série et record ;
    - aliment ajouté, repas prévu marqué mangé, pesée ;
    - check-in, bilan du soir, décision PULSE ;
    - fin d'une pratique Mind.
- **Comment, selon l'appareil :**
    - Android : l'API de vibration ;
    - iPhone (Safari, iOS 18 et plus) : le retour natif d'un interrupteur système, seulement pendant un geste ;
    - ailleurs, rien.

### Accessibilité et performance

- **Moins de mouvement sur l'iPhone :** toutes les animations et transitions passent à 1 ms, sans délai, les transitions d'écran sont coupées et le défilement automatique devient instantané. Tout reste visible tout de suite.
- **Seulement transform et opacity** pour ce qui bouge (jauges et barres comprises, via `scale`). Les tracés de courbe utilisent stroke-dashoffset.
- **Mesuré au format iPhone,** avec un processeur 4 fois plus lent : même fluidité qu'avant l'ajout du mouvement (environ 21 ms par image en moyenne, autant d'images lentes).
