/**
 * Recettes FORGE : cuisine sportive et cuisine plaisir.
 * Chaque ingrédient est relié à un aliment de la table Ciqual 2025 (Anses) par son code :
 * les calories, macros et fibres sont calculées à partir de cette table, jamais saisies à la main.
 * Les prix ne sont pas fournis : chacun saisit les siens.
 */

export type Aisle = 'fruits-legumes' | 'viandes-poissons' | 'cremerie' | 'feculents' | 'conserves' | 'epicerie' | 'surgeles';

export const AISLE_LABELS: Record<Aisle, string> = {
  'fruits-legumes': 'Fruits et légumes',
  'viandes-poissons': 'Viandes et poissons',
  cremerie: 'Crèmerie et œufs',
  feculents: 'Pains, céréales et féculents',
  conserves: 'Conserves',
  epicerie: 'Épicerie',
  surgeles: 'Surgelés',
};

/** Allergènes réglementaires (les plus courants) et régimes. */
export type FoodTag = 'gluten' | 'lait' | 'oeuf' | 'poisson' | 'crustaces' | 'arachide' | 'fruits-a-coque' | 'soja' | 'moutarde' | 'sesame' | 'viande' | 'porc';

export type RecipeCategory = 'petit-dejeuner' | 'dejeuner' | 'diner' | 'collation' | 'dessert' | 'meal-prep' | 'economique' | 'plaisir';

export const CATEGORY_LABELS: Record<RecipeCategory | 'rapide' | 'proteine', string> = {
  'petit-dejeuner': 'Petit-déjeuner',
  dejeuner: 'Déjeuner',
  diner: 'Dîner',
  collation: 'Collation',
  dessert: 'Dessert',
  rapide: 'Repas rapide',
  'meal-prep': 'Meal prep',
  economique: 'Économique',
  plaisir: 'Cuisine plaisir',
  proteine: 'Riche en protéines',
};

export type Glyph = 'bol' | 'pancake' | 'poele' | 'tartine' | 'boite' | 'wok' | 'cocotte' | 'assiette' | 'salade' | 'pizza' | 'burger' | 'wrap' | 'quiche' | 'pates' | 'gratin' | 'verre' | 'billes' | 'mug' | 'verrine' | 'gateau';

/** Ingrédient d'une recette FORGE : [code Ciqual, nom affiché, grammes, rayon, unité facultative [singulier, pluriel, grammes par unité], ml ?]. */
export type BuiltinIngredient = [code: string, name: string, grams: number, aisle: Aisle, unit?: [string, string, number] | null, ml?: boolean];

export interface BuiltinRecipe {
  id: string;
  name: string;
  description: string;
  categories: RecipeCategory[];
  prepMin: number;
  cookMin: number;
  servings: number;
  difficulty: 1 | 2 | 3;
  glyph: Glyph;
  ingredients: BuiltinIngredient[];
  steps: string[];
  storage: string;
}

/** Allergènes et régimes par aliment Ciqual (à partir de la composition de l'aliment). */
// prettier-ignore
export const CIQUAL_TAGS: Record<string, FoodTag[]> = {
  '32140': ['gluten'], '9810': ['gluten'], '9863': ['gluten', 'oeuf'], '7110': ['gluten'], '7111': ['gluten'], '7262': ['gluten'], '7815': ['gluten'],
  '9436': ['gluten'], '7500': ['gluten'], '23414': ['gluten', 'lait'], '32004': ['gluten', 'fruits-a-coque'], '11104': ['soja', 'gluten'],
  '19644': ['lait'], '19041': ['lait'], '12118': ['lait'], '12115': ['lait'], '12120': ['lait'], '19590': ['lait'], '12066': ['lait'], '16400': ['lait'],
  '22000': ['oeuf'], '22002': ['oeuf'],
  '36017': ['viande'], '6250': ['viande'], '28900': ['viande', 'porc'], '28501': ['viande', 'porc'],
  '26036': ['poisson'], '26039': ['poisson'], '26043': ['poisson'],
  '15202': ['arachide'], '15000': ['fruits-a-coque'], '15005': ['fruits-a-coque'],
  '11013': ['moutarde'],
};

const egg: [string, string, number] = ['œuf', 'œufs', 50];
const garlic: [string, string, number] = ['gousse', 'gousses', 3];
const tbsp: [string, string, number] = ['c. à soupe', 'c. à soupe', 10];
const tsp: [string, string, number] = ['c. à café', 'c. à café', 2];

// prettier-ignore
export const BUILTIN_RECIPES: BuiltinRecipe[] = [
  {
    id: 'overnight-oats', name: 'Overnight oats au fromage blanc', description: 'Avoine, fromage blanc et fruits préparés la veille : un petit-déjeuner prêt en sortant du lit.',
    categories: ['petit-dejeuner', 'meal-prep', 'economique'], prepMin: 5, cookMin: 0, servings: 1, difficulty: 1, glyph: 'bol',
    ingredients: [['32140', 'Flocons d’avoine', 60, 'feculents'], ['19644', 'Fromage blanc 0 %', 150, 'cremerie'], ['19041', 'Lait demi-écrémé', 100, 'cremerie', null, true], ['13005', 'Banane', 60, 'fruits-legumes'], ['13028', 'Myrtilles', 50, 'fruits-legumes'], ['31008', 'Miel', 10, 'epicerie', tsp]],
    steps: ['Mélange les flocons d’avoine, le fromage blanc et le lait dans un bocal.', 'Ferme et laisse au réfrigérateur toute la nuit.', 'Le matin, ajoute la banane en rondelles, les myrtilles et le miel.'],
    storage: 'Jusqu’à 2 jours au réfrigérateur dans un bocal fermé. Ajoute les fruits au moment de manger.',
  },
  {
    id: 'pancakes-banane', name: 'Pancakes banane et fromage blanc', description: 'Moelleux, sans farine blanche, avec des framboises. Le goût du week-end, les macros d’un sportif.',
    categories: ['petit-dejeuner', 'plaisir'], prepMin: 10, cookMin: 10, servings: 2, difficulty: 1, glyph: 'pancake',
    ingredients: [['32140', 'Flocons d’avoine', 80, 'feculents'], ['22000', 'Œufs', 100, 'cremerie', egg], ['19644', 'Fromage blanc 0 %', 150, 'cremerie'], ['13005', 'Banane', 120, 'fruits-legumes', ['banane', 'bananes', 120]], ['11046', 'Levure chimique', 4, 'epicerie'], ['17130', 'Huile de colza', 5, 'epicerie'], ['13015', 'Framboises', 80, 'fruits-legumes']],
    steps: ['Mixe les flocons d’avoine, les œufs, le fromage blanc, la banane et la levure jusqu’à obtenir une pâte lisse.', 'Chauffe une poêle légèrement huilée à feu moyen.', 'Verse de petites louches de pâte et cuis 2 minutes par face, jusqu’à ce que des bulles se forment.', 'Sers avec les framboises.'],
    storage: '2 jours au réfrigérateur ; 30 secondes au micro-ondes pour les réchauffer. Se congèlent bien, séparés par du papier cuisson.',
  },
  {
    id: 'omelette-jambon', name: 'Omelette jambon-fromage, pain complet', description: 'Le classique rapide et rassasiant, avec des tomates cerises pour la fraîcheur.',
    categories: ['petit-dejeuner', 'dejeuner', 'economique'], prepMin: 5, cookMin: 5, servings: 1, difficulty: 1, glyph: 'poele',
    ingredients: [['22000', 'Œufs', 150, 'cremerie', egg], ['28900', 'Jambon cuit', 50, 'viandes-poissons', ['tranche', 'tranches', 40]], ['12118', 'Emmental râpé', 20, 'cremerie'], ['17270', 'Huile d’olive', 3, 'epicerie'], ['7110', 'Pain complet', 60, 'feculents'], ['20172', 'Tomates cerises', 80, 'fruits-legumes']],
    steps: ['Bats les œufs avec une pincée de sel et de poivre.', 'Verse dans une poêle huilée chaude, à feu moyen.', 'Quand le dessous prend, ajoute le jambon en lanières et l’emmental, puis replie l’omelette.', 'Sers avec le pain et les tomates cerises.'],
    storage: 'À manger tout de suite.',
  },
  {
    id: 'tartines-avocat-oeufs', name: 'Tartines avocat et œufs mollets', description: 'Pain complet, avocat écrasé au citron et œufs au jaune coulant.',
    categories: ['petit-dejeuner', 'dejeuner'], prepMin: 8, cookMin: 6, servings: 1, difficulty: 1, glyph: 'tartine',
    ingredients: [['7110', 'Pain complet', 80, 'feculents', ['tranche', 'tranches', 40]], ['13004', 'Avocat', 70, 'fruits-legumes', ['demi-avocat', 'demi-avocats', 70]], ['22000', 'Œufs', 100, 'cremerie', egg], ['2007', 'Jus de citron', 5, 'fruits-legumes'], ['20172', 'Tomates cerises', 60, 'fruits-legumes']],
    steps: ['Plonge les œufs dans l’eau bouillante 6 minutes, puis dans l’eau froide ; écale-les.', 'Fais griller le pain.', 'Écrase l’avocat avec le jus de citron, sel et poivre, et étale-le sur les tartines.', 'Coupe les œufs en deux par-dessus, ajoute les tomates cerises.'],
    storage: 'À manger tout de suite (l’avocat noircit).',
  },
  {
    id: 'bowl-fromage-blanc', name: 'Bowl fromage blanc, muesli et fraises', description: 'Frais, croquant et riche en protéines, en deux minutes.',
    categories: ['petit-dejeuner', 'collation'], prepMin: 3, cookMin: 0, servings: 1, difficulty: 1, glyph: 'bol',
    ingredients: [['19644', 'Fromage blanc 0 %', 200, 'cremerie'], ['32004', 'Muesli', 40, 'feculents'], ['13014', 'Fraises', 100, 'fruits-legumes'], ['15000', 'Amandes', 15, 'epicerie'], ['31008', 'Miel', 10, 'epicerie', tsp]],
    steps: ['Verse le fromage blanc dans un bol.', 'Ajoute le muesli, les fraises coupées et les amandes concassées.', 'Termine par le miel.'],
    storage: 'À manger tout de suite pour garder le croquant.',
  },
  {
    id: 'poulet-riz-brocolis', name: 'Poulet, riz et brocolis', description: 'Le meal prep de référence : quatre boîtes prêtes pour la semaine, poulet au paprika et citron.',
    categories: ['dejeuner', 'diner', 'meal-prep', 'economique'], prepMin: 10, cookMin: 25, servings: 4, difficulty: 1, glyph: 'boite',
    ingredients: [['36017', 'Filets de poulet', 600, 'viandes-poissons'], ['9119', 'Riz basmati (cru)', 300, 'feculents'], ['20057', 'Brocolis', 600, 'fruits-legumes'], ['17270', 'Huile d’olive', 20, 'epicerie', tbsp], ['11000', 'Ail', 6, 'fruits-legumes', garlic], ['11049', 'Paprika', 4, 'epicerie', tsp], ['2007', 'Jus de citron', 15, 'fruits-legumes']],
    steps: ['Cuis le riz dans l’eau bouillante salée selon le paquet, puis égoutte.', 'Coupe le poulet en dés, mélange avec l’huile, l’ail haché, le paprika, sel et poivre.', 'Saisis le poulet 8 à 10 minutes à la poêle, jusqu’à ce qu’il soit bien cuit à cœur.', 'Cuis les brocolis à la vapeur 6 à 8 minutes : ils doivent rester verts et un peu fermes.', 'Répartis dans quatre boîtes et arrose de jus de citron.'],
    storage: '3 jours au réfrigérateur en boîtes hermétiques, 2 mois au congélateur. Laisse refroidir avant de fermer les boîtes.',
  },
  {
    id: 'poke-saumon', name: 'Poke bowl au saumon', description: 'Riz, saumon, avocat, mangue et crudités, sauce soja : l’esprit poke à la maison.',
    categories: ['dejeuner', 'diner', 'plaisir'], prepMin: 15, cookMin: 12, servings: 2, difficulty: 2, glyph: 'bol',
    ingredients: [['9119', 'Riz basmati (cru)', 140, 'feculents'], ['26036', 'Saumon très frais', 250, 'viandes-poissons'], ['13004', 'Avocat', 140, 'fruits-legumes', ['avocat', 'avocats', 140]], ['20019', 'Concombre', 150, 'fruits-legumes'], ['20009', 'Carotte', 100, 'fruits-legumes'], ['13025', 'Mangue', 100, 'fruits-legumes'], ['11104', 'Sauce soja', 20, 'epicerie', tbsp]],
    steps: ['Cuis le riz, puis laisse-le tiédir.', 'Coupe le saumon en cubes, l’avocat, la mangue et le concombre en dés ; râpe la carotte.', 'Dresse le riz dans deux bols, dispose le reste par-dessus.', 'Arrose de sauce soja au moment de servir.'],
    storage: 'Saumon cru : choisis-le très frais, « à consommer cru », garde-le au froid et mange le bowl le jour même. Sinon, saisis le saumon 3 minutes par face.',
  },
  {
    id: 'boeuf-patate-douce', name: 'Bœuf haché, patate douce rôtie et haricots verts', description: 'Une assiette complète et colorée, cuite au four pendant que tu prépares le reste.',
    categories: ['diner', 'meal-prep'], prepMin: 10, cookMin: 30, servings: 2, difficulty: 1, glyph: 'assiette',
    ingredients: [['6250', 'Bœuf haché 5 %', 300, 'viandes-poissons'], ['4101', 'Patate douce', 400, 'fruits-legumes'], ['20061', 'Haricots verts', 300, 'fruits-legumes'], ['17270', 'Huile d’olive', 10, 'epicerie', tbsp], ['11049', 'Paprika', 2, 'epicerie', tsp]],
    steps: ['Préchauffe le four à 200 °C.', 'Coupe la patate douce en cubes, mélange avec l’huile, le paprika et du sel ; enfourne 25 à 30 minutes.', 'Cuis les haricots verts 8 minutes à la vapeur ou à l’eau.', 'Fais dorer le bœuf haché à la poêle 6 à 8 minutes en l’émiettant ; sale et poivre.'],
    storage: '3 jours au réfrigérateur.',
  },
  {
    id: 'wok-poulet-nouilles', name: 'Wok de poulet aux nouilles', description: 'Poulet, légumes croquants et nouilles sautées au gingembre et à la sauce soja.',
    categories: ['diner', 'plaisir'], prepMin: 15, cookMin: 10, servings: 2, difficulty: 2, glyph: 'wok',
    ingredients: [['9863', 'Nouilles aux œufs', 140, 'feculents'], ['36017', 'Filets de poulet', 300, 'viandes-poissons'], ['20087', 'Poivron rouge', 150, 'fruits-legumes'], ['20009', 'Carotte', 100, 'fruits-legumes'], ['20034', 'Oignon', 80, 'fruits-legumes'], ['11074', 'Gingembre frais', 10, 'fruits-legumes'], ['11104', 'Sauce soja', 30, 'epicerie', tbsp], ['17130', 'Huile de colza', 10, 'epicerie', tbsp]],
    steps: ['Cuis les nouilles selon le paquet, égoutte-les.', 'Émince le poulet, le poivron, l’oignon ; coupe la carotte en bâtonnets, râpe le gingembre.', 'Saisis le poulet dans l’huile très chaude 5 minutes, puis ajoute les légumes 3 minutes.', 'Ajoute les nouilles, le gingembre et la sauce soja ; saute 2 minutes en remuant.'],
    storage: '2 jours au réfrigérateur.',
  },
  {
    id: 'chili-con-carne', name: 'Chili con carne', description: 'Le plat mijoté qui nourrit toute la semaine : bœuf, haricots rouges, épices et riz.',
    categories: ['diner', 'meal-prep', 'plaisir', 'economique'], prepMin: 15, cookMin: 40, servings: 4, difficulty: 1, glyph: 'cocotte',
    ingredients: [['6250', 'Bœuf haché 5 %', 500, 'viandes-poissons'], ['20524', 'Haricots rouges (égouttés)', 400, 'conserves'], ['20137', 'Tomates pelées', 800, 'conserves'], ['20034', 'Oignon', 150, 'fruits-legumes'], ['20087', 'Poivron rouge', 150, 'fruits-legumes'], ['11000', 'Ail', 6, 'fruits-legumes', garlic], ['11042', 'Cumin', 4, 'epicerie', tsp], ['11049', 'Paprika', 4, 'epicerie', tsp], ['17270', 'Huile d’olive', 10, 'epicerie', tbsp], ['9119', 'Riz basmati (cru)', 240, 'feculents']],
    steps: ['Fais revenir l’oignon et le poivron émincés dans l’huile 5 minutes.', 'Ajoute le bœuf et l’ail, fais dorer en émiettant.', 'Ajoute les épices, les tomates et les haricots rouges ; laisse mijoter 30 minutes à feu doux.', 'Pendant ce temps, cuis le riz. Rectifie l’assaisonnement et sers.'],
    storage: '4 jours au réfrigérateur, 3 mois au congélateur. Encore meilleur le lendemain.',
  },
  {
    id: 'dahl-lentilles', name: 'Dahl de lentilles corail', description: 'Lentilles fondantes au lait de coco et au curry : végétarien, économique, réconfortant.',
    categories: ['dejeuner', 'diner', 'meal-prep', 'economique'], prepMin: 10, cookMin: 25, servings: 4, difficulty: 1, glyph: 'cocotte',
    ingredients: [['20535', 'Lentilles corail (sèches)', 300, 'feculents'], ['18041', 'Lait de coco', 200, 'conserves', null, true], ['20137', 'Tomates pelées', 400, 'conserves'], ['20034', 'Oignon', 150, 'fruits-legumes'], ['11000', 'Ail', 6, 'fruits-legumes', garlic], ['11074', 'Gingembre frais', 10, 'fruits-legumes'], ['11005', 'Curry', 8, 'epicerie', tsp], ['17130', 'Huile de colza', 10, 'epicerie', tbsp], ['9119', 'Riz basmati (cru)', 240, 'feculents']],
    steps: ['Fais revenir l’oignon, l’ail et le gingembre hachés dans l’huile 3 minutes.', 'Ajoute le curry, puis les lentilles rincées, les tomates, le lait de coco et 500 ml d’eau.', 'Laisse mijoter 20 minutes en remuant : les lentilles doivent fondre.', 'Cuis le riz pendant ce temps et sers ensemble.'],
    storage: '4 jours au réfrigérateur, 3 mois au congélateur. Ajoute un peu d’eau en réchauffant.',
  },
  {
    id: 'pates-thon-tomate', name: 'Pâtes au thon et à la tomate', description: 'Le dîner express du placard : pâtes, thon, sauce tomate et parmesan.',
    categories: ['dejeuner', 'diner', 'economique'], prepMin: 5, cookMin: 12, servings: 2, difficulty: 1, glyph: 'pates',
    ingredients: [['9810', 'Pâtes sèches', 180, 'feculents'], ['26039', 'Thon au naturel (égoutté)', 200, 'conserves'], ['20260', 'Coulis de tomate', 300, 'conserves'], ['20034', 'Oignon', 80, 'fruits-legumes'], ['17270', 'Huile d’olive', 10, 'epicerie', tbsp], ['11033', 'Basilic frais', 5, 'fruits-legumes'], ['12120', 'Parmesan', 20, 'cremerie']],
    steps: ['Cuis les pâtes dans l’eau bouillante salée.', 'Fais revenir l’oignon émincé dans l’huile, ajoute le coulis et laisse frémir 5 minutes.', 'Ajoute le thon émietté, puis les pâtes égouttées ; mélange.', 'Sers avec le basilic et le parmesan.'],
    storage: '2 jours au réfrigérateur.',
  },
  {
    id: 'salade-quinoa', name: 'Salade de quinoa, pois chiches et feta', description: 'Une salade complète qui tient au corps et voyage bien dans une boîte.',
    categories: ['dejeuner', 'meal-prep'], prepMin: 15, cookMin: 15, servings: 2, difficulty: 1, glyph: 'salade',
    ingredients: [['9340', 'Quinoa (cru)', 120, 'feculents'], ['20532', 'Pois chiches (égouttés)', 240, 'conserves'], ['12066', 'Feta', 80, 'cremerie'], ['20019', 'Concombre', 150, 'fruits-legumes'], ['20172', 'Tomates cerises', 150, 'fruits-legumes'], ['20238', 'Oignon rouge', 40, 'fruits-legumes'], ['17270', 'Huile d’olive', 15, 'epicerie', tbsp], ['2007', 'Jus de citron', 15, 'fruits-legumes'], ['11014', 'Persil', 5, 'fruits-legumes']],
    steps: ['Rince le quinoa, cuis-le 12 à 15 minutes dans deux fois son volume d’eau, puis laisse refroidir.', 'Coupe le concombre, les tomates et l’oignon rouge ; rince les pois chiches.', 'Mélange le tout avec l’huile, le citron, le persil, sel et poivre.', 'Émiette la feta par-dessus.'],
    storage: '3 jours au réfrigérateur ; assaisonne au dernier moment si tu prépares à l’avance.',
  },
  {
    id: 'curry-poulet-coco', name: 'Curry de poulet au lait de coco', description: 'Doux, parfumé et généreux, avec des épinards et du riz basmati.',
    categories: ['diner', 'plaisir', 'meal-prep'], prepMin: 15, cookMin: 25, servings: 3, difficulty: 1, glyph: 'cocotte',
    ingredients: [['36017', 'Filets de poulet', 450, 'viandes-poissons'], ['18041', 'Lait de coco', 200, 'conserves', null, true], ['20137', 'Tomates pelées', 200, 'conserves'], ['20034', 'Oignon', 100, 'fruits-legumes'], ['20059', 'Épinards', 150, 'fruits-legumes'], ['11005', 'Curry', 10, 'epicerie', tsp], ['17130', 'Huile de colza', 10, 'epicerie', tbsp], ['9119', 'Riz basmati (cru)', 210, 'feculents']],
    steps: ['Fais revenir l’oignon émincé dans l’huile, puis le poulet en morceaux 5 minutes.', 'Ajoute le curry, les tomates et le lait de coco ; laisse mijoter 15 minutes.', 'Ajoute les épinards 2 minutes avant la fin.', 'Sers avec le riz cuit.'],
    storage: '3 jours au réfrigérateur, 2 mois au congélateur.',
  },
  {
    id: 'pizza-fromage-blanc', name: 'Pizza maison, pâte au fromage blanc', description: 'Une pâte sans levée, prête en 5 minutes, garnie jambon, champignons et mozzarella.',
    categories: ['diner', 'plaisir'], prepMin: 20, cookMin: 15, servings: 2, difficulty: 2, glyph: 'pizza',
    ingredients: [['9436', 'Farine de blé', 150, 'feculents'], ['19644', 'Fromage blanc 0 %', 150, 'cremerie'], ['11046', 'Levure chimique', 6, 'epicerie'], ['11058', 'Sel', 2, 'epicerie'], ['20260', 'Coulis de tomate', 100, 'conserves'], ['19590', 'Mozzarella', 125, 'cremerie', ['boule', 'boules', 125]], ['28900', 'Jambon cuit', 80, 'viandes-poissons', ['tranche', 'tranches', 40]], ['20056', 'Champignons de Paris', 100, 'fruits-legumes'], ['11060', 'Herbes de Provence', 2, 'epicerie'], ['17270', 'Huile d’olive', 5, 'epicerie']],
    steps: ['Préchauffe le four à 230 °C.', 'Mélange la farine, la levure et le sel, puis le fromage blanc ; pétris 2 minutes jusqu’à une boule souple.', 'Étale la pâte finement sur une plaque recouverte de papier cuisson.', 'Étale le coulis, ajoute le jambon, les champignons émincés, la mozzarella, les herbes et un filet d’huile.', 'Enfourne 12 à 15 minutes, jusqu’à ce que les bords soient dorés.'],
    storage: '2 jours au réfrigérateur ; se réchauffe à la poêle pour garder le croustillant.',
  },
  {
    id: 'burger-maison', name: 'Burger maison et potatoes au four', description: 'Bœuf 5 %, pain complet, emmental fondu et pommes de terre rôties au paprika.',
    categories: ['diner', 'plaisir'], prepMin: 15, cookMin: 30, servings: 2, difficulty: 2, glyph: 'burger',
    ingredients: [['7262', 'Pains à burger complets', 160, 'feculents', ['pain', 'pains', 80]], ['6250', 'Bœuf haché 5 %', 250, 'viandes-poissons'], ['12115', 'Emmental en tranches', 40, 'cremerie'], ['20385', 'Tomate', 100, 'fruits-legumes'], ['20238', 'Oignon rouge', 30, 'fruits-legumes'], ['11004', 'Cornichons', 20, 'epicerie'], ['11008', 'Ketchup', 20, 'epicerie', tbsp], ['11013', 'Moutarde', 10, 'epicerie', tsp], ['4008', 'Pommes de terre', 400, 'fruits-legumes'], ['17270', 'Huile d’olive', 10, 'epicerie', tbsp], ['11049', 'Paprika', 2, 'epicerie', tsp]],
    steps: ['Préchauffe le four à 210 °C. Coupe les pommes de terre en quartiers, mélange avec l’huile, le paprika et du sel ; enfourne 30 minutes en les retournant à mi-cuisson.', 'Forme deux steaks avec le bœuf, sale et poivre.', 'Cuis les steaks 3 à 4 minutes par face ; pose l’emmental dessus la dernière minute.', 'Toaste les pains, garnis de ketchup, moutarde, steak, tomate, oignon et cornichons.'],
    storage: 'À manger tout de suite. Les steaks crus se gardent 1 jour au réfrigérateur.',
  },
  {
    id: 'wraps-poulet', name: 'Wraps de poulet croustillant', description: 'Poulet pané au four, crudités et sauce fromage blanc-moutarde dans une galette de blé.',
    categories: ['dejeuner', 'plaisir'], prepMin: 15, cookMin: 15, servings: 2, difficulty: 2, glyph: 'wrap',
    ingredients: [['7815', 'Tortillas de blé', 120, 'feculents', ['galette', 'galettes', 60]], ['36017', 'Filets de poulet', 250, 'viandes-poissons'], ['7500', 'Chapelure', 30, 'epicerie'], ['22000', 'Œuf', 50, 'cremerie', egg], ['19644', 'Fromage blanc 0 %', 60, 'cremerie'], ['11013', 'Moutarde', 5, 'epicerie', tsp], ['20385', 'Tomate', 100, 'fruits-legumes'], ['20019', 'Concombre', 80, 'fruits-legumes'], ['17130', 'Huile de colza', 10, 'epicerie', tbsp]],
    steps: ['Préchauffe le four à 210 °C.', 'Coupe le poulet en lanières, trempe-les dans l’œuf battu puis dans la chapelure.', 'Dispose sur une plaque, arrose d’huile et enfourne 15 minutes en retournant à mi-cuisson.', 'Mélange le fromage blanc et la moutarde ; tartine les galettes, ajoute le poulet, la tomate et le concombre, puis roule.'],
    storage: 'Poulet pané : 2 jours au réfrigérateur. Monte les wraps au dernier moment.',
  },
  {
    id: 'quiche-thon-poireaux', name: 'Quiche au thon et aux poireaux', description: 'Une quiche plus légère grâce au lait et au fromage blanc, riche en protéines.',
    categories: ['diner', 'plaisir', 'meal-prep'], prepMin: 15, cookMin: 35, servings: 4, difficulty: 2, glyph: 'quiche',
    ingredients: [['23414', 'Pâte brisée', 230, 'cremerie', ['pâte', 'pâtes', 230]], ['26039', 'Thon au naturel (égoutté)', 200, 'conserves'], ['20039', 'Poireaux', 300, 'fruits-legumes'], ['22000', 'Œufs', 150, 'cremerie', egg], ['19041', 'Lait demi-écrémé', 200, 'cremerie', null, true], ['19644', 'Fromage blanc 0 %', 100, 'cremerie'], ['12118', 'Emmental râpé', 40, 'cremerie']],
    steps: ['Préchauffe le four à 190 °C et étale la pâte dans un moule.', 'Émince les poireaux et fais-les fondre 8 minutes à la poêle avec un peu d’eau.', 'Bats les œufs avec le lait, le fromage blanc, sel et poivre.', 'Répartis les poireaux et le thon sur la pâte, verse l’appareil, parsème d’emmental.', 'Enfourne 35 minutes, jusqu’à ce que le dessus soit doré et pris.'],
    storage: '3 jours au réfrigérateur ; se mange chaude ou froide.',
  },
  {
    id: 'carbonara', name: 'Pâtes carbonara revisitées', description: 'La vraie texture crémeuse, avec des œufs et du parmesan, sans crème.',
    categories: ['diner', 'plaisir'], prepMin: 5, cookMin: 12, servings: 2, difficulty: 2, glyph: 'pates',
    ingredients: [['9810', 'Pâtes sèches', 180, 'feculents'], ['28501', 'Lardons', 100, 'viandes-poissons'], ['22000', 'Œufs', 100, 'cremerie', egg], ['22002', 'Jaune d’œuf', 20, 'cremerie', ['jaune', 'jaunes', 20]], ['12120', 'Parmesan', 30, 'cremerie'], ['11015', 'Poivre noir', 1, 'epicerie']],
    steps: ['Cuis les pâtes dans l’eau bouillante salée ; garde une louche d’eau de cuisson.', 'Fais dorer les lardons à sec dans une poêle.', 'Bats les œufs, le jaune, le parmesan et beaucoup de poivre.', 'Hors du feu, mélange les pâtes égouttées avec les lardons, puis l’appareil aux œufs et un peu d’eau de cuisson, jusqu’à une sauce crémeuse.'],
    storage: 'À manger tout de suite.',
  },
  {
    id: 'hachis-parmentier', name: 'Hachis parmentier', description: 'Le gratin réconfortant : purée maison et bœuf mijoté à la tomate.',
    categories: ['diner', 'plaisir', 'meal-prep'], prepMin: 20, cookMin: 50, servings: 4, difficulty: 2, glyph: 'gratin',
    ingredients: [['4008', 'Pommes de terre', 1000, 'fruits-legumes'], ['6250', 'Bœuf haché 5 %', 500, 'viandes-poissons'], ['20034', 'Oignon', 150, 'fruits-legumes'], ['20137', 'Tomates pelées', 200, 'conserves'], ['19041', 'Lait demi-écrémé', 150, 'cremerie', null, true], ['16400', 'Beurre', 15, 'cremerie'], ['12118', 'Emmental râpé', 50, 'cremerie']],
    steps: ['Cuis les pommes de terre épluchées 20 minutes à l’eau salée, puis écrase-les avec le lait chaud et le beurre.', 'Fais revenir l’oignon, ajoute le bœuf puis les tomates ; laisse cuire 10 minutes.', 'Préchauffe le four à 200 °C. Étale la viande dans un plat, recouvre de purée, parsème d’emmental.', 'Enfourne 20 minutes, jusqu’à ce que le dessus soit gratiné.'],
    storage: '3 jours au réfrigérateur, 3 mois au congélateur en portions.',
  },
  {
    id: 'croque-proteine', name: 'Croque-monsieur protéiné', description: 'Pain complet, jambon, emmental et fromage blanc à la place de la béchamel.',
    categories: ['diner', 'plaisir'], prepMin: 5, cookMin: 10, servings: 1, difficulty: 1, glyph: 'tartine',
    ingredients: [['7111', 'Pain de mie complet', 100, 'feculents', ['tranche', 'tranches', 25]], ['28900', 'Jambon cuit', 80, 'viandes-poissons', ['tranche', 'tranches', 40]], ['12115', 'Emmental en tranches', 30, 'cremerie'], ['19644', 'Fromage blanc 0 %', 30, 'cremerie']],
    steps: ['Préchauffe le four à 200 °C (ou un appareil à croque).', 'Tartine les tranches de fromage blanc, poivre.', 'Garnis de jambon et d’emmental, referme.', 'Cuis 8 à 10 minutes, jusqu’à ce que ce soit doré et fondant.'],
    storage: 'À manger tout de suite.',
  },
  {
    id: 'tortilla-pommes-de-terre', name: 'Tortilla de pommes de terre', description: 'L’omelette espagnole épaisse et fondante, à manger chaude ou froide.',
    categories: ['dejeuner', 'diner', 'economique', 'meal-prep'], prepMin: 15, cookMin: 30, servings: 3, difficulty: 2, glyph: 'poele',
    ingredients: [['4008', 'Pommes de terre', 500, 'fruits-legumes'], ['22000', 'Œufs', 300, 'cremerie', egg], ['20034', 'Oignon', 120, 'fruits-legumes'], ['17270', 'Huile d’olive', 20, 'epicerie', tbsp]],
    steps: ['Coupe les pommes de terre en fines rondelles et l’oignon en lamelles.', 'Fais-les cuire à feu doux dans l’huile, à couvert, 15 à 20 minutes, jusqu’à ce qu’ils soient tendres.', 'Bats les œufs avec du sel, ajoute les pommes de terre et l’oignon.', 'Remets dans la poêle 5 minutes à feu doux, retourne à l’aide d’une assiette et cuis encore 3 minutes.'],
    storage: '3 jours au réfrigérateur ; parfaite froide dans une boîte.',
  },
  {
    id: 'cabillaud-papillote', name: 'Cabillaud en papillote, riz et courgettes', description: 'Poisson fondant cuit à l’étouffée avec tomates, citron et herbes.',
    categories: ['diner'], prepMin: 10, cookMin: 20, servings: 2, difficulty: 1, glyph: 'assiette',
    ingredients: [['26043', 'Cabillaud', 300, 'viandes-poissons'], ['9119', 'Riz basmati (cru)', 140, 'feculents'], ['20020', 'Courgettes', 300, 'fruits-legumes'], ['20172', 'Tomates cerises', 150, 'fruits-legumes'], ['17270', 'Huile d’olive', 10, 'epicerie', tbsp], ['2007', 'Jus de citron', 10, 'fruits-legumes'], ['11060', 'Herbes de Provence', 2, 'epicerie']],
    steps: ['Préchauffe le four à 200 °C et cuis le riz.', 'Sur deux feuilles de papier cuisson, dispose les courgettes en fines rondelles, le cabillaud, les tomates coupées.', 'Arrose d’huile et de citron, ajoute les herbes, sel et poivre ; ferme les papillotes.', 'Enfourne 18 à 20 minutes. Sers avec le riz.'],
    storage: '1 jour au réfrigérateur.',
  },
  {
    id: 'fromage-blanc-miel-noix', name: 'Fromage blanc, miel et noix', description: 'La collation protéinée la plus simple, idéale le soir.',
    categories: ['collation', 'dessert', 'economique'], prepMin: 2, cookMin: 0, servings: 1, difficulty: 1, glyph: 'bol',
    ingredients: [['19644', 'Fromage blanc 0 %', 200, 'cremerie'], ['31008', 'Miel', 10, 'epicerie', tsp], ['15005', 'Noix', 15, 'epicerie']],
    steps: ['Verse le fromage blanc dans un bol.', 'Ajoute le miel et les noix concassées.'],
    storage: 'À manger tout de suite.',
  },
  {
    id: 'tartine-cacahuete-banane', name: 'Tartine beurre de cacahuète et banane', description: 'L’en-cas avant l’entraînement : glucides rapides et énergie durable.',
    categories: ['collation', 'petit-dejeuner'], prepMin: 3, cookMin: 0, servings: 1, difficulty: 1, glyph: 'tartine',
    ingredients: [['7110', 'Pain complet', 60, 'feculents', ['tranche', 'tranches', 30]], ['15202', 'Beurre de cacahuète', 20, 'epicerie', tbsp], ['13005', 'Banane', 100, 'fruits-legumes']],
    steps: ['Fais griller le pain si tu veux.', 'Tartine le beurre de cacahuète, ajoute la banane en rondelles.'],
    storage: 'À manger tout de suite.',
  },
  {
    id: 'energy-balls', name: 'Energy balls dattes, avoine et cacao', description: 'Douze bouchées sans cuisson à emporter dans le sac de sport.',
    categories: ['collation', 'meal-prep', 'dessert'], prepMin: 15, cookMin: 0, servings: 6, difficulty: 1, glyph: 'billes',
    ingredients: [['13011', 'Dattes', 150, 'epicerie'], ['32140', 'Flocons d’avoine', 80, 'feculents'], ['15202', 'Beurre de cacahuète', 40, 'epicerie', tbsp], ['18100', 'Cacao non sucré', 10, 'epicerie', tsp]],
    steps: ['Fais tremper les dattes dénoyautées 10 minutes dans l’eau chaude, puis égoutte.', 'Mixe tous les ingrédients jusqu’à une pâte collante.', 'Forme 12 boules avec les mains humides.', 'Laisse 30 minutes au réfrigérateur pour qu’elles se raffermissent.'],
    storage: '1 semaine au réfrigérateur dans une boîte, 2 mois au congélateur.',
  },
  {
    id: 'shake-banane-avoine', name: 'Shake banane, avoine et lait', description: 'Un verre rassasiant pour la prise de masse, sans poudre de protéines.',
    categories: ['collation', 'petit-dejeuner'], prepMin: 3, cookMin: 0, servings: 1, difficulty: 1, glyph: 'verre',
    ingredients: [['19041', 'Lait demi-écrémé', 300, 'cremerie', null, true], ['13005', 'Banane', 120, 'fruits-legumes', ['banane', 'bananes', 120]], ['32140', 'Flocons d’avoine', 40, 'feculents'], ['15202', 'Beurre de cacahuète', 15, 'epicerie', tbsp]],
    steps: ['Mets tout dans un blender.', 'Mixe 30 secondes jusqu’à une texture lisse.'],
    storage: 'À boire tout de suite, ou dans la journée au réfrigérateur.',
  },
  {
    id: 'mug-cake', name: 'Mug cake au chocolat', description: 'Un gâteau tout chaud en 90 secondes au micro-ondes.',
    categories: ['dessert', 'plaisir', 'collation'], prepMin: 3, cookMin: 2, servings: 1, difficulty: 1, glyph: 'mug',
    ingredients: [['22000', 'Œuf', 50, 'cremerie', egg], ['32140', 'Flocons d’avoine mixés', 30, 'feculents'], ['19644', 'Fromage blanc 0 %', 50, 'cremerie'], ['18100', 'Cacao non sucré', 10, 'epicerie', tsp], ['31008', 'Miel', 10, 'epicerie', tsp], ['11046', 'Levure chimique', 2, 'epicerie'], ['31074', 'Chocolat noir 70 %', 10, 'epicerie', ['carré', 'carrés', 5]]],
    steps: ['Mélange dans un grand mug l’œuf, le fromage blanc, le miel, l’avoine mixée, le cacao et la levure.', 'Enfonce les carrés de chocolat au centre.', 'Cuis 80 à 90 secondes au micro-ondes (800 W).', 'Laisse tiédir une minute avant de manger.'],
    storage: 'À manger tout de suite.',
  },
  {
    id: 'creme-chocolat', name: 'Crème chocolat au fromage blanc', description: 'Une crème dessert onctueuse et riche en protéines, sans cuisson.',
    categories: ['dessert', 'collation'], prepMin: 5, cookMin: 0, servings: 1, difficulty: 1, glyph: 'verrine',
    ingredients: [['19644', 'Fromage blanc 0 %', 200, 'cremerie'], ['18100', 'Cacao non sucré', 10, 'epicerie', tsp], ['31008', 'Miel', 15, 'epicerie', tsp], ['31074', 'Chocolat noir 70 %', 15, 'epicerie', ['carré', 'carrés', 5]]],
    steps: ['Fouette le fromage blanc avec le cacao et le miel.', 'Verse dans une verrine, râpe le chocolat noir par-dessus.', 'Laisse 15 minutes au frais si tu peux.'],
    storage: '2 jours au réfrigérateur, filmé.',
  },
  {
    id: 'crumble-pomme', name: 'Crumble pomme-avoine à la cannelle', description: 'Pommes fondantes et pâte croustillante à l’avoine : le dessert du dimanche.',
    categories: ['dessert', 'plaisir'], prepMin: 15, cookMin: 30, servings: 4, difficulty: 1, glyph: 'gratin',
    ingredients: [['13620', 'Pommes', 600, 'fruits-legumes', ['pomme', 'pommes', 150]], ['32140', 'Flocons d’avoine', 80, 'feculents'], ['9436', 'Farine de blé', 40, 'feculents'], ['16400', 'Beurre', 40, 'cremerie'], ['31017', 'Sucre roux', 30, 'epicerie', tbsp], ['11025', 'Cannelle', 2, 'epicerie', tsp]],
    steps: ['Préchauffe le four à 180 °C.', 'Coupe les pommes en dés et dispose-les dans un plat avec la cannelle.', 'Sable du bout des doigts l’avoine, la farine, le sucre et le beurre froid en dés.', 'Parsème sur les pommes et enfourne 30 minutes, jusqu’à ce que le dessus soit doré.'],
    storage: '3 jours au réfrigérateur ; se réchauffe 10 minutes au four.',
  },
  {
    id: 'cheesecake-leger', name: 'Cheesecake léger au fromage blanc', description: 'Une base avoine-miel et un appareil au fromage blanc citronné, cuit au four.',
    categories: ['dessert', 'plaisir'], prepMin: 20, cookMin: 45, servings: 6, difficulty: 3, glyph: 'gateau',
    ingredients: [['32140', 'Flocons d’avoine', 80, 'feculents'], ['16400', 'Beurre', 30, 'cremerie'], ['31008', 'Miel', 20, 'epicerie', tbsp], ['19644', 'Fromage blanc 0 %', 500, 'cremerie'], ['22000', 'Œufs', 150, 'cremerie', egg], ['31016', 'Sucre', 60, 'epicerie', tbsp], ['9436', 'Farine de blé', 20, 'feculents'], ['2007', 'Jus de citron', 15, 'fruits-legumes'], ['11098', 'Extrait de vanille', 5, 'epicerie', tsp]],
    steps: ['Préchauffe le four à 160 °C.', 'Mixe l’avoine, mélange avec le beurre fondu et le miel ; tasse au fond d’un moule de 20 cm et enfourne 10 minutes.', 'Fouette le fromage blanc, les œufs, le sucre, la farine, le citron et la vanille.', 'Verse sur la base et enfourne 35 minutes : le centre doit rester légèrement tremblotant.', 'Laisse refroidir puis au moins 4 heures au réfrigérateur.'],
    storage: '4 jours au réfrigérateur.',
  },
  {
    id: 'riz-au-lait', name: 'Riz au lait vanillé', description: 'Le dessert de grand-mère, crémeux et économique.',
    categories: ['dessert', 'economique', 'plaisir'], prepMin: 5, cookMin: 40, servings: 4, difficulty: 1, glyph: 'verrine',
    ingredients: [['9100', 'Riz rond (cru)', 100, 'feculents'], ['19041', 'Lait demi-écrémé', 1000, 'cremerie', null, true], ['31016', 'Sucre', 50, 'epicerie', tbsp], ['11098', 'Extrait de vanille', 5, 'epicerie', tsp]],
    steps: ['Porte le lait à frémissement avec la vanille.', 'Ajoute le riz et laisse cuire à feu très doux 35 à 40 minutes en remuant souvent.', 'Ajoute le sucre en fin de cuisson, quand le riz est fondant.', 'Verse dans des ramequins et laisse refroidir.'],
    storage: '3 jours au réfrigérateur.',
  },
];
