/**
 * Exercices guidés FORGE MIND : courts, sans matériel, écrits pour être suivis à l'écran.
 * Repères généraux de bien-être et de préparation mentale, jamais un soin ni un traitement.
 */

export type MindFamily = 'respiration' | 'ancrage' | 'relaxation' | 'visualisation' | 'concentration';
export type MindCategory = 'apaiser' | 'dormir' | 'concentrer' | 'depasser' | 'recuperer' | 'recul' | 'confiance';

export interface BreathPhase {
  label: string;
  seconds: number;
  motion: 'in' | 'out' | 'hold';
  hint?: string;
}

export interface GuidedStep {
  text: string;
  seconds: number;
  /** Relaxation progressive : phase de contraction ou de relâchement. */
  cue?: 'tension' | 'relache';
}

export type MindPlayer =
  | { kind: 'breath'; intro: string[]; phases: BreathPhase[] }
  | { kind: 'steps'; steps: GuidedStep[] }
  | { kind: 'grounding'; stages: { count: number; prompt: string; hint: string }[] }
  | { kind: 'focus'; mode: 'count' | 'label'; intro: string[]; labels?: string[] };

export interface MindExercise {
  id: string;
  title: string;
  family: MindFamily;
  categories: MindCategory[];
  presentation: string;
  goal: string;
  position: string;
  /** Durée par défaut, en minutes. */
  minutes: number;
  /** Durée réglable (respiration, attention), en minutes. */
  range?: [number, number];
  player: MindPlayer;
  source?: string;
  caution?: string;
}

const s = (text: string, seconds: number, cue?: GuidedStep['cue']): GuidedStep => (cue ? { text, seconds, cue } : { text, seconds });

/** Relaxation progressive : contraction 5 s, relâchement 20 s, groupe par groupe. */
const pmr = (groups: [string, string][]): GuidedStep[] => [
  s('Installe-toi assis ou allongé. Laisse les bras reposer et respire tranquillement.', 20),
  ...groups.flatMap(([tense, release]) => [s(tense, 5, 'tension'), s(release, 20, 'relache')]),
  s('Fais le tour de ton corps : remarque la lourdeur et la chaleur. Reste ainsi quelques respirations.', 30),
];

export const MIND_EXERCISES: MindExercise[] = [
  // Respiration
  {
    id: 'coherence',
    title: 'Cohérence cardiaque',
    family: 'respiration',
    categories: ['apaiser', 'concentrer', 'recuperer'],
    presentation: 'Six respirations par minute : 5 secondes pour inspirer, 5 pour expirer. Un rythme simple, à suivre des yeux.',
    goal: 'Ralentir le souffle pour retrouver du calme et de la clarté.',
    position: 'Assis, le dos droit',
    minutes: 5,
    range: [1, 10],
    player: {
      kind: 'breath',
      intro: [
        'Assieds-toi le dos droit, les pieds à plat.',
        'Respire par le nez si tu peux, sans forcer l’amplitude.',
        'Suis le cercle : il grandit quand tu inspires, il se réduit quand tu expires.',
      ],
      phases: [
        { label: 'Inspire', seconds: 5, motion: 'in' },
        { label: 'Expire', seconds: 5, motion: 'out' },
      ],
    },
    source: 'Respiration à environ 6 cycles par minute (Lehrer et Gevirtz, 2014).',
  },
  {
    id: 'respiration-lente',
    title: 'Respiration lente 4-6',
    family: 'respiration',
    categories: ['apaiser', 'dormir'],
    presentation: 'Une expiration plus longue que l’inspiration : 4 secondes pour inspirer, 6 pour expirer.',
    goal: 'Faire redescendre la tension, le soir ou après une journée chargée.',
    position: 'Assis ou allongé',
    minutes: 4,
    range: [2, 10],
    player: {
      kind: 'breath',
      intro: [
        'Installe-toi assis ou allongé.',
        'Inspire doucement par le nez, expire lentement, comme pour faire vaciller une bougie sans l’éteindre.',
        'Si le rythme est inconfortable, raccourcis : le confort passe avant le compte.',
      ],
      phases: [
        { label: 'Inspire', seconds: 4, motion: 'in' },
        { label: 'Expire', seconds: 6, motion: 'out' },
      ],
    },
  },
  {
    id: 'abdominale',
    title: 'Respiration abdominale',
    family: 'respiration',
    categories: ['dormir', 'apaiser', 'recuperer'],
    presentation: 'Une main sur la poitrine, l’autre sur le ventre : c’est la main du ventre qui bouge.',
    goal: 'Retrouver une respiration ample et posée.',
    position: 'Allongé ou assis',
    minutes: 3,
    range: [2, 8],
    player: {
      kind: 'breath',
      intro: [
        'Allonge-toi ou assieds-toi confortablement.',
        'Pose une main sur ta poitrine et l’autre sur ton ventre.',
        'Quand tu inspires, laisse le ventre se soulever ; la poitrine reste presque immobile.',
      ],
      phases: [
        { label: 'Inspire', seconds: 4, motion: 'in', hint: 'Le ventre se soulève' },
        { label: 'Expire', seconds: 6, motion: 'out', hint: 'Le ventre redescend' },
      ],
    },
  },
  {
    id: 'soupir',
    title: 'Soupir physiologique',
    family: 'respiration',
    categories: ['apaiser', 'recul', 'depasser'],
    presentation: 'Deux inspirations par le nez, la seconde plus courte pour remplir à fond, puis une longue expiration par la bouche.',
    goal: 'Relâcher la pression rapidement, en quelques cycles.',
    position: 'Assis ou debout',
    minutes: 3,
    range: [1, 5],
    player: {
      kind: 'breath',
      intro: [
        'Assieds-toi ou reste debout, les épaules basses.',
        'Inspire par le nez, puis ajoute une petite inspiration pour remplir à fond.',
        'Expire longuement par la bouche, sans forcer.',
      ],
      phases: [
        { label: 'Inspire', seconds: 2.5, motion: 'in' },
        { label: 'Encore un peu', seconds: 1, motion: 'in', hint: 'Petite inspiration en plus' },
        { label: 'Expire', seconds: 6, motion: 'out', hint: 'Longuement, par la bouche' },
      ],
    },
    source: 'Respiration en soupirs cycliques (Balban et al., 2023).',
    caution: 'Si tu as la tête qui tourne, reprends une respiration normale.',
  },
  {
    id: 'respiration-carree',
    title: 'Respiration carrée',
    family: 'respiration',
    categories: ['concentrer', 'depasser'],
    presentation: 'Quatre temps égaux : inspire, retiens, expire, retiens. Un rythme qui occupe l’esprit et pose le souffle.',
    goal: 'Rester calme et concentré avant un effort ou un moment de pression.',
    position: 'Assis ou debout',
    minutes: 2,
    range: [1, 6],
    player: {
      kind: 'breath',
      intro: [
        'Redresse-toi, les épaules relâchées.',
        'Chaque temps dure 4 secondes : inspire, garde l’air, expire, reste poumons vides.',
        'Retiens sans forcer ; si c’est inconfortable, raccourcis les pauses.',
      ],
      phases: [
        { label: 'Inspire', seconds: 4, motion: 'in' },
        { label: 'Retiens', seconds: 4, motion: 'hold' },
        { label: 'Expire', seconds: 4, motion: 'out' },
        { label: 'Retiens', seconds: 4, motion: 'hold', hint: 'Poumons vides' },
      ],
    },
    caution: 'En cas de problème cardiaque ou respiratoire, ou pendant une grossesse, préfère la cohérence cardiaque, sans pause.',
  },
  {
    id: 'retour-calme',
    title: 'Retour au calme',
    family: 'respiration',
    categories: ['recuperer', 'apaiser'],
    presentation: 'Juste après l’effort, laisser le souffle et le cœur redescendre, sans rien forcer.',
    goal: 'Passer du mode effort au mode récupération.',
    position: 'Debout ou en marchant lentement',
    minutes: 3,
    player: {
      kind: 'steps',
      steps: [
        s('Marche lentement ou reste debout, les bras le long du corps. Laisse ton souffle se calmer de lui-même.', 30),
        s('Inspire par le nez, expire longuement par la bouche. Allonge un peu chaque expiration.', 40),
        s('Relâche les épaules à chaque expiration. Laisse les mains devenir lourdes.', 30),
        s('Sens ton cœur ralentir peu à peu. Tu n’as rien à forcer.', 30),
        s('Respire maintenant à ton rythme naturel, calme et régulier.', 30),
        s('Termine en notant une chose réussie pendant ta séance.', 20),
      ],
    },
  },

  // Ancrage
  {
    id: 'cinq-sens',
    title: 'Les cinq sens',
    family: 'ancrage',
    categories: ['apaiser', 'recul'],
    presentation: 'Nommer ce que tu perçois, sens par sens : 5 choses que tu vois, 4 que tu touches, 3 que tu entends, 2 odeurs, 1 goût.',
    goal: 'Sortir d’une spirale de pensées en revenant à l’instant.',
    position: 'Où tu veux',
    minutes: 3,
    player: {
      kind: 'grounding',
      stages: [
        { count: 5, prompt: 'choses que tu vois', hint: 'Nomme-les, même à voix basse : une couleur, un objet, une lumière.' },
        { count: 4, prompt: 'choses que tu peux toucher', hint: 'Le tissu de tes vêtements, le sol sous tes pieds, la température de l’air.' },
        { count: 3, prompt: 'sons que tu entends', hint: 'Proches ou lointains, même très discrets.' },
        { count: 2, prompt: 'odeurs que tu perçois', hint: 'Si rien ne vient, pense à deux odeurs que tu aimes.' },
        { count: 1, prompt: 'goût dans ta bouche', hint: 'Ou une gorgée d’eau, en prenant le temps de la sentir.' },
      ],
    },
  },
  {
    id: 'ancrage-corporel',
    title: 'Ancrage corporel',
    family: 'ancrage',
    categories: ['apaiser', 'depasser', 'confiance'],
    presentation: 'Sentir tes appuis et ton poids pour retrouver de la stabilité, dans le corps comme dans la tête.',
    goal: 'Te sentir stable et présent avant un moment important.',
    position: 'Debout ou assis',
    minutes: 3,
    player: {
      kind: 'steps',
      steps: [
        s('Pose tes deux pieds bien à plat. Sens leur contact avec le sol.', 30),
        s('Déplace ton poids un peu vers l’avant, un peu vers l’arrière, puis trouve le centre.', 30),
        s('Sens tes points d’appui : talons, plante des pieds, assise si tu es assis.', 30),
        s('Inspire en sentant ta colonne s’allonger, expire en laissant ton poids descendre dans le sol.', 40),
        s('Remarque que tu es stable, ici, maintenant.', 25),
        s('Garde cette sensation d’appui pour la suite de ta journée ou de ta séance.', 25),
      ],
    },
  },
  {
    id: 'recentrage',
    title: 'Recentrage en une minute',
    family: 'ancrage',
    categories: ['recul', 'concentrer', 'apaiser'],
    presentation: 'Quatre temps : t’arrêter, respirer, observer, repartir. À glisser n’importe où dans la journée.',
    goal: 'Couper le pilote automatique et choisir ta prochaine action.',
    position: 'Où tu veux',
    minutes: 1,
    player: {
      kind: 'steps',
      steps: [
        s('Arrête-toi. Pose ce que tu fais.', 10),
        s('Prends une inspiration lente, puis une longue expiration.', 15),
        s('Observe ce qui se passe dans ton corps, tes pensées, tes émotions. Juste le constater.', 20),
        s('Choisis la prochaine action, une seule, et reprends.', 15),
      ],
    },
  },
  {
    id: 'moment-present',
    title: 'Retour au moment présent',
    family: 'ancrage',
    categories: ['recul', 'apaiser'],
    presentation: 'Le souffle, les sons, les pensées qui passent, le corps : quatre portes pour revenir ici.',
    goal: 'Prendre de la distance avec les pensées qui tournent en boucle.',
    position: 'Assis',
    minutes: 4,
    player: {
      kind: 'steps',
      steps: [
        s('Installe-toi et laisse tes yeux se fermer ou se poser sur un point.', 30),
        s('Porte ton attention sur ta respiration, sans la modifier : l’air qui entre, l’air qui sort.', 45),
        s('Élargis ton attention aux sons autour de toi. Laisse-les venir et repartir.', 40),
        s('Quand une pensée arrive, remarque-la, puis laisse-la passer comme un nuage.', 45),
        s('Reviens au contact de ton corps : le poids, la chaleur, les appuis.', 40),
        s('Prends une inspiration plus profonde et reviens doucement à ce qui t’entoure.', 20),
      ],
    },
  },
  {
    id: 'seance-difficile',
    title: 'Après une séance difficile',
    family: 'ancrage',
    categories: ['recuperer', 'recul', 'confiance'],
    presentation: 'Accueillir la frustration, remettre la séance à sa place et en tirer un seul ajustement.',
    goal: 'Ne pas laisser une mauvaise séance peser sur les suivantes.',
    position: 'Assis',
    minutes: 4,
    player: {
      kind: 'steps',
      steps: [
        s('Assieds-toi. Prends trois respirations lentes avant de juger quoi que ce soit.', 30),
        s('Nomme ce que tu ressens : déception, frustration, fatigue. C’est normal après une séance difficile.', 35),
        s('Remets la séance à sa place : une séance parmi des dizaines. Une seule ne définit pas ta progression.', 35),
        s('Cherche ce qui l’explique peut-être : sommeil, alimentation, stress, charge des jours précédents.', 40),
        s('Retiens une chose que tu as bien faite malgré tout.', 30),
        s('Choisis un ajustement pour la prochaine fois, un seul.', 30),
        s('Expire longuement et laisse cette séance derrière toi.', 20),
      ],
    },
  },
  {
    id: 'stagnation',
    title: 'Traverser une stagnation',
    family: 'ancrage',
    categories: ['recul', 'confiance', 'depasser'],
    presentation: 'Prendre du recul sur une période où les chiffres ne bougent plus, et choisir une piste à tester.',
    goal: 'Garder confiance et transformer le plateau en expérience.',
    position: 'Assis',
    minutes: 4,
    player: {
      kind: 'steps',
      steps: [
        s('Installe-toi. Une stagnation fait partie de toute progression : elle ne veut pas dire que tu régresses.', 35),
        s('Regarde plus loin en arrière : où en étais-tu il y a trois mois, il y a six mois ?', 40),
        s('Remarque ce qui a progressé ailleurs : technique, régularité, sommeil, énergie.', 40),
        s('Cherche ce qui pourrait débloquer : plus de récupération, un autre exercice, des objectifs plus précis.', 45),
        s('Choisis une piste à tester pendant deux à quatre semaines, puis tu feras le point.', 40),
        s('Rappelle-toi pourquoi tu t’entraînes. Garde cette raison en tête cette semaine.', 30),
      ],
    },
  },

  // Relaxation
  {
    id: 'jacobson',
    title: 'Relaxation musculaire progressive',
    family: 'relaxation',
    categories: ['dormir', 'recuperer', 'apaiser'],
    presentation: 'Contracter un groupe de muscles 5 secondes, puis le relâcher d’un coup et sentir la différence. Des mains jusqu’aux pieds.',
    goal: 'Relâcher les tensions physiques que tu ne remarques plus.',
    position: 'Assis ou allongé',
    minutes: 4,
    player: {
      kind: 'steps',
      steps: pmr([
        ['Serre les poings et contracte les avant-bras.', 'Relâche d’un coup. Sens les mains s’ouvrir et devenir lourdes.'],
        ['Plie les coudes et contracte les bras.', 'Relâche. Laisse les bras retomber, détendus.'],
        ['Monte les épaules vers les oreilles.', 'Relâche. Laisse les épaules descendre, loin des oreilles.'],
        ['Plisse le front et ferme fort les yeux.', 'Relâche. Le front s’élargit, les paupières se posent.'],
        ['Rentre le ventre et contracte les abdominaux.', 'Relâche. Le ventre se libère et suit ta respiration.'],
        ['Tends les jambes et serre les cuisses.', 'Relâche. Les jambes deviennent lourdes.'],
        ['Tire les pointes de pieds vers toi, mollets contractés.', 'Relâche. Les pieds se posent, les mollets se détendent.'],
      ]),
    },
    source: 'D’après la relaxation progressive de Jacobson, en version courte.',
    caution: 'Contracte sans douleur, à environ la moitié de ta force. Passe une zone blessée ou douloureuse.',
  },
  {
    id: 'detente-corporelle',
    title: 'Détente corporelle express',
    family: 'relaxation',
    categories: ['apaiser', 'dormir'],
    presentation: 'Un tour rapide des zones qui se crispent sans qu’on s’en rende compte : mâchoire, front, épaules, mains, ventre, jambes.',
    goal: 'Relâcher le corps en moins de trois minutes.',
    position: 'Assis ou allongé',
    minutes: 3,
    player: {
      kind: 'steps',
      steps: [
        s('Desserre la mâchoire, laisse la langue se poser.', 20),
        s('Relâche le front et le tour des yeux.', 20),
        s('Laisse les épaules descendre, loin des oreilles.', 20),
        s('Ouvre les mains, laisse les doigts se détendre.', 20),
        s('Relâche le ventre : il peut bouger librement avec le souffle.', 25),
        s('Laisse les jambes devenir lourdes, les pieds se poser.', 25),
        s('Fais le tour une dernière fois : là où il reste une tension, expire vers elle.', 30),
      ],
    },
  },
  {
    id: 'scan-corporel',
    title: 'Scan corporel',
    family: 'relaxation',
    categories: ['dormir', 'recuperer', 'recul'],
    presentation: 'Parcourir ton corps des pieds à la tête, en observant les sensations sans chercher à les changer.',
    goal: 'Te détendre en profondeur, idéal avant de dormir.',
    position: 'Allongé',
    minutes: 9,
    player: {
      kind: 'steps',
      steps: [
        s('Allonge-toi sur le dos, les bras le long du corps. Ferme les yeux si tu le souhaites.', 40),
        s('Sens ton corps posé : le poids de la tête, du dos, des jambes. Laisse le support te porter.', 40),
        s('Porte ton attention sur tes pieds : orteils, plante, talons. Observe, sans rien changer.', 40),
        s('Remonte vers les chevilles, les mollets, les genoux. Remarque la chaleur, le contact, ou l’absence de sensation.', 45),
        s('Les cuisses, puis le bassin. Laisse-les lourds et posés.', 40),
        s('Le ventre et le bas du dos. Sens le ventre monter et descendre avec le souffle.', 50),
        s('La poitrine et le haut du dos. Remarque le mouvement de la respiration.', 40),
        s('Les mains, les bras, jusqu’aux épaules. Laisse-les se relâcher.', 45),
        s('La nuque et la gorge. Laisse la tête s’alourdir.', 45),
        s('Le visage : la mâchoire, les joues, les yeux, le front. Tout peut se détendre.', 40),
        s('Sens maintenant ton corps en entier, d’un seul bloc, qui respire.', 45),
        s('Reste ainsi, ou laisse venir le sommeil si c’est le soir.', 30),
      ],
    },
    source: 'Inspiré du scan corporel des programmes de pleine conscience (MBSR).',
  },
  {
    id: 'decompression',
    title: 'Décompression après l’effort',
    family: 'relaxation',
    categories: ['recuperer', 'apaiser', 'recul'],
    presentation: 'Cinq minutes pour relâcher les muscles travaillés, refaire le point sur ta séance et passer à la suite.',
    goal: 'Récupérer physiquement et mentalement après l’entraînement.',
    position: 'Allongé ou assis',
    minutes: 5,
    player: {
      kind: 'steps',
      steps: [
        s('Allonge-toi ou assieds-toi. C’est fini : ton corps peut relâcher.', 30),
        s('Laisse ta respiration ralentir. Expire un peu plus longtemps que tu n’inspires.', 45),
        s('Passe en revue les muscles que tu as travaillés. Sens la chaleur, la lourdeur, sans les juger.', 50),
        s('À chaque expiration, imagine ces muscles se relâcher un peu plus.', 45),
        s('Repense à ta séance : un moment où tu as bien travaillé.', 40),
        s('Remarque aussi ce qui était difficile, et laisse-le là, avec la séance.', 40),
        s('Pense à ce qui va aider ta récupération : boire, manger, dormir.', 30),
        s('Prends une grande inspiration, étire-toi, et reprends ta journée.', 20),
      ],
    },
  },

  // Visualisation
  {
    id: 'lieu-calme',
    title: 'Ton lieu de calme',
    family: 'visualisation',
    categories: ['apaiser', 'dormir', 'recul'],
    presentation: 'Imaginer un lieu où tu te sens bien, avec tous tes sens, et repartir avec un détail qui t’y ramène.',
    goal: 'Créer un refuge intérieur où revenir quand la tension monte.',
    position: 'Assis ou allongé',
    minutes: 5,
    player: {
      kind: 'steps',
      steps: [
        s('Installe-toi et ferme les yeux si tu le souhaites. Prends trois respirations lentes.', 40),
        s('Laisse venir un lieu où tu te sens bien, réel ou imaginaire. Le premier qui se présente convient.', 40),
        s('Regarde autour de toi : les couleurs, la lumière, les formes.', 40),
        s('Écoute les sons de ce lieu, proches et lointains.', 35),
        s('Sens la température, l’air sur ta peau, le sol sous tes pieds.', 35),
        s('Remarque comme ton corps se détend ici. Ce calme t’appartient.', 45),
        s('Choisis un détail de ce lieu à garder en mémoire : il te permettra d’y revenir.', 40),
        s('Prends une inspiration plus profonde, bouge doucement les mains et les pieds, et ouvre les yeux quand tu es prêt.', 30),
      ],
    },
  },
  {
    id: 'seance-reussie',
    title: 'Visualiser une séance réussie',
    family: 'visualisation',
    categories: ['depasser', 'concentrer', 'confiance'],
    presentation: 'Vivre ta séance en pensée, à vitesse réelle, avec les sensations du geste : la répétition mentale que pratiquent les sportifs.',
    goal: 'Arriver à l’entraînement concentré et sûr de ton geste.',
    position: 'Assis ou debout',
    minutes: 4,
    player: {
      kind: 'steps',
      steps: [
        s('Ferme les yeux. Imagine-toi à l’endroit où tu t’entraînes, dans ta tenue.', 30),
        s('Vois la salle comme elle est vraiment : la lumière, le matériel, les bruits.', 30),
        s('Choisis ton premier exercice. Sens la charge dans tes mains, son poids, sa texture.', 30),
        s('Fais une série en pensée, à vitesse réelle : ta position, ta respiration, chaque répétition propre.', 45),
        s('Sens l’effort sur les dernières répétitions, et ta capacité à le tenir.', 30),
        s('Termine la série. Repose la charge avec contrôle. Remarque ta satisfaction.', 25),
        s('Choisis un mot qui résume la séance que tu veux faire : « solide », « précis », « calme ».', 20),
        s('Ouvre les yeux en gardant ce mot avec toi.', 15),
      ],
    },
    source: 'Imagerie motrice selon le modèle PETTLEP (Holmes et Collins, 2001).',
  },
  {
    id: 'objectif',
    title: 'Visualiser un objectif',
    family: 'visualisation',
    categories: ['depasser', 'confiance', 'recul'],
    presentation: 'Imaginer l’objectif atteint, puis l’obstacle le plus probable, et préparer ta réponse : « si… alors je… ».',
    goal: 'Transformer une envie en plan concret.',
    position: 'Assis',
    minutes: 5,
    player: {
      kind: 'steps',
      steps: [
        s('Pense à un objectif qui compte pour toi ces prochaines semaines. Formule-le en une phrase.', 40),
        s('Imagine le moment où il est atteint : où es-tu, que ressens-tu, qu’est-ce qui a changé ?', 50),
        s('Repère maintenant l’obstacle principal qui pourrait t’arrêter. Le plus probable, en toi ou autour de toi.', 45),
        s('Prépare ta réponse : « si cet obstacle arrive, alors je… ». Une action simple.', 50),
        s('Imagine-toi appliquer ce plan au moment où l’obstacle se présente.', 40),
        s('Choisis la première petite action, faisable dès aujourd’hui ou demain.', 35),
        s('Ouvre les yeux. Tu peux noter ton plan dans ton journal.', 15),
      ],
    },
    source: 'Contraste mental et intentions de mise en œuvre (Oettingen, 2014 ; Gollwitzer, 1999).',
  },
  {
    id: 'confiance',
    title: 'Renforcer la confiance',
    family: 'visualisation',
    categories: ['confiance', 'depasser'],
    presentation: 'Revivre une réussite passée, retrouver ce qu’elle t’a fait ressentir et l’associer à un geste discret.',
    goal: 'Avoir sous la main un rappel de ce dont tu es capable.',
    position: 'Assis',
    minutes: 5,
    player: {
      kind: 'steps',
      steps: [
        s('Installe-toi et laisse ta respiration se poser.', 30),
        s('Rappelle-toi un moment où tu as réussi quelque chose de difficile, en sport ou ailleurs.', 40),
        s('Revis-le : où étais-tu, qu’as-tu vu, entendu ? Comment te tenais-tu ?', 45),
        s('Retrouve ce que tu ressentais dans ton corps à ce moment-là. Laisse cette sensation grandir.', 45),
        s('Remarque les qualités que tu as montrées : persévérance, courage, calme.', 40),
        s('Associe cette sensation à un geste discret, par exemple poser une main sur ta poitrine ou serrer doucement le poing.', 30),
        s('Ces qualités sont à toi. Tu peux les rappeler avec ce geste, avant un effort ou un moment important.', 30),
        s('Reviens doucement, prêt pour la suite.', 15),
      ],
    },
  },
  {
    id: 'motivation',
    title: 'Retrouver la motivation',
    family: 'visualisation',
    categories: ['depasser', 'confiance'],
    presentation: 'Revenir à tes raisons profondes, te projeter, puis choisir le plus petit pas possible pour aujourd’hui.',
    goal: 'Relancer l’envie quand elle baisse.',
    position: 'Où tu veux',
    minutes: 3,
    player: {
      kind: 'steps',
      steps: [
        s('Pense à la raison profonde pour laquelle tu t’entraînes : santé, énergie, confiance, plaisir.', 35),
        s('Imagine-toi dans un an, si tu gardes le cap. Qu’est-ce qui a changé dans ta vie de tous les jours ?', 45),
        s('Pense à la plus petite action qui te rapproche de ça aujourd’hui.', 30),
        s('Rends-la plus facile encore : prépare ta tenue, bloque un créneau, choisis ta première série.', 30),
        s('Imagine-toi la faire, et la satisfaction juste après.', 30),
        s('Engage-toi sur ce petit pas. Le reste suivra.', 15),
      ],
    },
  },

  // Concentration
  {
    id: 'compter-souffles',
    title: 'Compter ses respirations',
    family: 'concentration',
    categories: ['concentrer', 'apaiser'],
    presentation: 'Compter tes expirations de 1 à 10, puis recommencer. Si tu perds le compte, tu repars à 1, sans te juger.',
    goal: 'Entraîner l’attention à revenir, encore et encore.',
    position: 'Assis',
    minutes: 3,
    range: [1, 10],
    player: {
      kind: 'focus',
      mode: 'count',
      intro: [
        'Touche l’écran à chaque expiration.',
        'Si tu t’aperçois que tu as décroché, touche « J’ai décroché » : le compte repart à 1.',
        'Remarquer qu’on a décroché, c’est déjà l’exercice.',
      ],
    },
  },
  {
    id: 'distractions',
    title: 'Gérer les distractions',
    family: 'concentration',
    categories: ['concentrer', 'recul'],
    presentation: 'Garder l’attention sur ton souffle. Quand quelque chose t’en écarte, le nommer d’un geste, puis revenir.',
    goal: 'Repérer ce qui te distrait le plus, et apprendre à le laisser passer.',
    position: 'Assis',
    minutes: 3,
    range: [2, 10],
    player: {
      kind: 'focus',
      mode: 'label',
      intro: [
        'Pose ton attention sur ta respiration.',
        'Quand tu remarques une distraction, touche ce que c’est : pensée, son, sensation ou émotion.',
        'Puis reviens au souffle. À la fin, tu verras ce qui t’a le plus distrait.',
      ],
      labels: ['Pensée', 'Son', 'Sensation', 'Émotion'],
    },
  },
  {
    id: 'point-fixe',
    title: 'Focalisation sur un point',
    family: 'concentration',
    categories: ['concentrer', 'depasser'],
    presentation: 'Poser le regard sur un point et y ramener ton attention chaque fois qu’elle s’échappe.',
    goal: 'Rassembler ton attention en deux minutes.',
    position: 'Assis ou debout',
    minutes: 2,
    player: {
      kind: 'steps',
      steps: [
        s('Choisis un point devant toi, à hauteur des yeux : une marque, un objet.', 15),
        s('Pose ton regard dessus, sans le fixer durement. Respire normalement.', 25),
        s('Quand ton regard ou ton esprit s’échappe, ramène-le simplement au point.', 30),
        s('Remarque les détails du point : la forme, la couleur, les contours.', 25),
        s('Élargis maintenant ta vision à tout ce qui l’entoure, sans bouger les yeux.', 15),
        s('Reviens au point une dernière fois, puis relâche ton regard.', 10),
      ],
    },
  },
  {
    id: 'pret-effort',
    title: 'Prêt pour l’effort',
    family: 'concentration',
    categories: ['depasser', 'concentrer', 'confiance'],
    presentation: 'Deux minutes avant la première série : souffle, image du geste, un point technique et un mot d’énergie.',
    goal: 'Démarrer ta séance concentré et engagé.',
    position: 'Debout',
    minutes: 2,
    player: {
      kind: 'steps',
      steps: [
        s('Debout, les pieds ancrés. Trois respirations : inspire 4 secondes, expire 4 secondes.', 25),
        s('Pense au premier exercice. Vois-toi faire la première série, propre et contrôlée.', 30),
        s('Choisis un point technique, un seul : « gainage », « pousser le sol », « tempo ».', 20),
        s('Choisis ton mot d’énergie : « allez », « solide », « maintenant ». Dis-le intérieurement.', 20),
        s('Monte un peu l’énergie : redresse-toi, inspire franchement, serre les poings une seconde.', 15),
        s('Tu es prêt. Va chercher ta première série.', 10),
      ],
    },
    source: 'Discours interne motivationnel (Hatzigeorgiadis et al., 2011).',
  },
  {
    id: 'pression',
    title: 'Gérer la pression',
    family: 'concentration',
    categories: ['depasser', 'apaiser', 'confiance'],
    presentation: 'Reconnaître ce que la pression fait dans le corps, la voir comme une préparation et revenir à ce que tu contrôles.',
    goal: 'Rester efficace quand l’enjeu monte : record, test, compétition.',
    position: 'Debout ou assis',
    minutes: 3,
    player: {
      kind: 'steps',
      steps: [
        s('Remarque ce que la pression fait dans ton corps : cœur rapide, mains moites, ventre noué.', 25),
        s('Deux soupirs : double inspiration par le nez, longue expiration par la bouche.', 20),
        s('Dis-toi : « mon corps se prépare ». Cette activation peut t’aider à performer.', 25),
        s('Ramène ton attention sur ce que tu contrôles : ta préparation, ton geste, ta respiration.', 30),
        s('Laisse de côté ce que tu ne contrôles pas : le regard des autres, le résultat.', 25),
        s('Choisis une consigne simple pour le premier essai, et un mot d’énergie.', 25),
        s('Inspire, expire. Vas-y.', 10),
      ],
    },
    source: 'Réévaluer le stress comme une ressource (Jamieson et al., 2012).',
  },
];

export const MIND_EXERCISE_BY_ID = new Map(MIND_EXERCISES.map((e) => [e.id, e]));
