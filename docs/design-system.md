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
