import type { Equipment, MuscleGroup } from './muscles';

/**
 * Bibliothèque d'exercices de FORGE.
 * Illustrations : Free Exercise DB (domaine public, licence Unlicense), deux images par exercice
 * (départ et fin du mouvement), converties dans public/exercices/<id>_0.webp et _1.webp.
 * Noms, muscles, matériel et consignes : rédigés en français pour FORGE.
 */
export interface LibraryExercise {
  id: string;
  name: string;
  muscle: MuscleGroup;
  secondary: MuscleGroup[];
  equipment: Equipment;
  kind: 'compound' | 'isolation';
  /** Repos conseillé entre les séries, en secondes. */
  rest: number;
  cues: string[];
}

type Row = [id: string, name: string, muscle: MuscleGroup, secondary: MuscleGroup[], equipment: Equipment, kind: 'c' | 'i', rest: number, cues: string[]];

// prettier-ignore
const rows: Row[] = [
  // Pectoraux
  ['dumbbell_floor_press', 'Développé au sol aux haltères', 'pectoraux', ['triceps', 'epaules'], 'halteres', 'c', 90, ['Allongé au sol, genoux fléchis.', 'Descends jusqu’à ce que les coudes touchent le sol, sans rebond.', 'Pousse en rapprochant légèrement les haltères.']],
  ['decline_push-up', 'Pompes pieds surélevés', 'pectoraux', ['epaules', 'triceps'], 'poids-du-corps', 'c', 90, ['Pieds sur une chaise ou un banc, corps gainé.', 'Descends la poitrine près du sol.', 'Plus les pieds sont hauts, plus le haut des pectoraux et les épaules travaillent.']],
  ['barbell_bench_press_-_medium_grip', 'Développé couché', 'pectoraux', ['epaules', 'triceps'], 'barre', 'c', 150, ['Omoplates serrées et basses, pieds ancrés au sol.', 'Descends la barre au bas des pectoraux, avant-bras verticaux.', 'Pousse en gardant les fesses sur le banc.']],
  ['barbell_incline_bench_press_-_medium_grip', 'Développé incliné à la barre', 'pectoraux', ['epaules', 'triceps'], 'barre', 'c', 150, ['Banc à 30 degrés environ.', 'Descends la barre vers le haut des pectoraux.', 'Garde les omoplates serrées pendant toute la série.']],
  ['dumbbell_bench_press', 'Développé couché aux haltères', 'pectoraux', ['epaules', 'triceps'], 'halteres', 'c', 120, ['Haltères à hauteur de poitrine, coudes à 45 degrés du buste.', 'Pousse en rapprochant légèrement les haltères en haut.', 'Contrôle la descente sur 2 secondes.']],
  ['incline_dumbbell_press', 'Développé incliné aux haltères', 'pectoraux', ['epaules', 'triceps'], 'halteres', 'c', 120, ['Banc à 30 degrés environ.', 'Coudes légèrement sous les épaules, pas à l’horizontale.', 'Étire en bas sans perdre la tension.']],
  ['machine_bench_press', 'Développé couché à la machine', 'pectoraux', ['epaules', 'triceps'], 'machine', 'c', 120, ['Règle le siège pour que les poignées arrivent à mi-poitrine.', 'Dos plaqué, omoplates serrées.', 'Pousse sans verrouiller brutalement les coudes.']],
  ['dips_-_chest_version', 'Dips, buste penché', 'pectoraux', ['triceps', 'epaules'], 'poids-du-corps', 'c', 120, ['Penche le buste vers l’avant, coudes légèrement écartés.', 'Descends jusqu’à sentir l’étirement des pectoraux, sans douleur à l’épaule.', 'Remonte sans balancer les jambes.']],
  ['cable_crossover', 'Écarté à la poulie vis-à-vis', 'pectoraux', ['epaules'], 'poulie', 'i', 75, ['Coudes légèrement fléchis et fixes.', 'Rapproche les mains devant toi en serrant les pectoraux.', 'Reviens lentement jusqu’à l’étirement.']],
  ['dumbbell_flyes', 'Écarté couché aux haltères', 'pectoraux', [], 'halteres', 'i', 75, ['Coudes légèrement fléchis, comme pour enlacer un arbre.', 'Descends jusqu’à l’étirement, pas plus bas que les épaules.', 'Remonte en contractant les pectoraux.']],
  ['butterfly', 'Pec deck (butterfly)', 'pectoraux', [], 'machine', 'i', 75, ['Poignées à hauteur de poitrine.', 'Ferme les bras en serrant les pectoraux une seconde.', 'Ouvre lentement sans lâcher la tension.']],
  ['pushups', 'Pompes', 'pectoraux', ['triceps', 'epaules', 'abdominaux'], 'poids-du-corps', 'c', 90, ['Corps gainé, de la tête aux talons.', 'Mains un peu plus larges que les épaules.', 'Poitrine près du sol, puis pousse fort.']],
  // Dos
  ['pullups', 'Tractions pronation', 'dos', ['biceps', 'avant-bras'], 'poids-du-corps', 'c', 150, ['Prise un peu plus large que les épaules, paumes vers l’avant.', 'Tire les coudes vers les hanches, poitrine vers la barre.', 'Redescends bras tendus sans te laisser tomber.']],
  ['chin-up', 'Tractions supination', 'dos', ['biceps', 'avant-bras'], 'poids-du-corps', 'c', 150, ['Paumes vers toi, mains largeur d’épaules.', 'Menton au-dessus de la barre sans balancer.', 'Descends lentement jusqu’aux bras tendus.']],
  ['wide-grip_lat_pulldown', 'Tirage vertical à la poulie', 'dos', ['biceps', 'epaules'], 'poulie', 'c', 120, ['Prise large, buste légèrement incliné en arrière.', 'Tire la barre vers le haut de la poitrine.', 'Remonte en contrôlant, épaules basses.']],
  ['bent_over_barbell_row', 'Rowing barre', 'dos', ['biceps', 'lombaires', 'epaules'], 'barre', 'c', 150, ['Buste penché à 45 degrés environ, dos plat.', 'Tire la barre vers le nombril, coudes le long du corps.', 'Pas d’élan avec le buste.']],
  ['one-arm_dumbbell_row', 'Rowing unilatéral à l’haltère', 'dos', ['biceps', 'epaules'], 'halteres', 'c', 90, ['Main et genou en appui sur le banc, dos plat.', 'Tire l’haltère vers la hanche.', 'Étire en bas sans tourner le buste.']],
  ['seated_cable_rows', 'Tirage horizontal à la poulie', 'dos', ['biceps', 'epaules'], 'poulie', 'c', 120, ['Buste droit, genoux légèrement fléchis.', 'Tire la poignée vers le ventre en serrant les omoplates.', 'Laisse les épaules avancer un peu au retour.']],
  ['t-bar_row_with_handle', 'Rowing T-bar', 'dos', ['biceps', 'lombaires'], 'barre', 'c', 150, ['Dos plat, genoux fléchis.', 'Tire la poignée vers la poitrine.', 'Garde la poitrine sortie pendant toute la série.']],
  ['inverted_row', 'Rowing inversé', 'dos', ['biceps', 'epaules'], 'poids-du-corps', 'c', 90, ['Corps gainé, talons au sol.', 'Tire la poitrine vers la barre.', 'Plus le corps est horizontal, plus c’est dur.']],
  ['straight-arm_pulldown', 'Pull-over à la poulie, bras tendus', 'dos', [], 'poulie', 'i', 75, ['Bras presque tendus, buste légèrement penché.', 'Ramène la barre vers les cuisses en serrant le dos.', 'Remonte jusqu’à hauteur des yeux.']],
  ['bent_over_two-dumbbell_row', 'Rowing buste penché aux haltères', 'dos', ['biceps', 'epaules'], 'halteres', 'c', 90, ['Buste penché, dos plat, genoux fléchis.', 'Tire les deux haltères vers les hanches.', 'Serre les omoplates en haut, sans élan.']],
  // Trapèzes
  ['barbell_shrug', 'Haussements d’épaules à la barre', 'trapezes', ['avant-bras'], 'barre', 'i', 75, ['Bras tendus, barre contre les cuisses.', 'Monte les épaules vers les oreilles, sans rouler.', 'Marque une pause en haut.']],
  ['dumbbell_shrug', 'Haussements d’épaules aux haltères', 'trapezes', ['avant-bras'], 'halteres', 'i', 75, ['Haltères le long du corps.', 'Monte les épaules droit vers le haut.', 'Redescends lentement.']],
  // Lombaires
  ['barbell_deadlift', 'Soulevé de terre', 'lombaires', ['fessiers', 'ischios', 'dos', 'avant-bras', 'trapezes'], 'barre', 'c', 180, ['Barre au-dessus du milieu du pied, dos plat.', 'Pousse le sol avec les jambes, barre collée aux jambes.', 'Verrouille en contractant les fessiers, sans te cambrer.']],
  ['hyperextensions_back_extensions', 'Extensions lombaires', 'lombaires', ['fessiers', 'ischios'], 'autre', 'i', 75, ['Hanches au bord du support.', 'Remonte jusqu’à l’alignement du corps, pas au-delà.', 'Mouvement lent et contrôlé.']],
  ['good_morning', 'Good morning', 'lombaires', ['ischios', 'fessiers'], 'barre', 'c', 120, ['Barre sur les trapèzes, genoux légèrement fléchis.', 'Bascule le buste en reculant les hanches, dos plat.', 'Remonte en poussant les hanches vers l’avant.']],
  ['superman', 'Superman', 'lombaires', ['fessiers'], 'poids-du-corps', 'i', 60, ['Allongé sur le ventre, bras tendus devant.', 'Décolle bras et jambes en serrant les fessiers.', 'Tiens 2 secondes en haut, regard vers le sol.']],
  // Épaules
  ['standing_military_press', 'Développé militaire debout', 'epaules', ['triceps', 'trapezes'], 'barre', 'c', 150, ['Fessiers et abdos serrés, pas de cambrure.', 'Pousse la barre droit au-dessus de la tête.', 'Passe la tête sous la barre en haut.']],
  ['seated_dumbbell_press', 'Développé épaules assis aux haltères', 'epaules', ['triceps'], 'halteres', 'c', 120, ['Dos contre le dossier.', 'Haltères à hauteur d’oreilles au départ.', 'Pousse sans claquer les haltères en haut.']],
  ['arnold_dumbbell_press', 'Développé Arnold', 'epaules', ['triceps'], 'halteres', 'c', 120, ['Départ paumes vers toi, haltères devant le visage.', 'Tourne les poignets en poussant vers le haut.', 'Redescends en inversant la rotation.']],
  ['machine_shoulder_military_press', 'Développé épaules à la machine', 'epaules', ['triceps'], 'machine', 'c', 120, ['Poignées à hauteur d’épaules au départ.', 'Dos plaqué contre le dossier.', 'Pousse sans verrouiller brutalement.']],
  ['side_lateral_raise', 'Élévations latérales', 'epaules', ['trapezes'], 'halteres', 'i', 60, ['Coudes légèrement fléchis.', 'Monte jusqu’à hauteur d’épaules, pas plus.', 'Pas d’élan : charge modérée, contrôle total.']],
  ['cable_seated_lateral_raise', 'Élévations latérales à la poulie', 'epaules', ['trapezes'], 'poulie', 'i', 60, ['Câble croisé devant le corps.', 'Monte le bras sur le côté jusqu’à l’horizontale.', 'Redescends lentement.']],
  ['front_dumbbell_raise', 'Élévations frontales', 'epaules', [], 'halteres', 'i', 60, ['Bras presque tendus.', 'Monte jusqu’à hauteur des yeux.', 'Garde le buste immobile.']],
  ['reverse_flyes', 'Oiseau aux haltères', 'epaules', ['dos', 'trapezes'], 'halteres', 'i', 60, ['Buste penché, dos plat.', 'Ouvre les bras sur les côtés, coudes légèrement fléchis.', 'Serre l’arrière des épaules en haut.']],
  ['face_pull', 'Face pull', 'epaules', ['trapezes', 'dos'], 'poulie', 'i', 60, ['Corde à hauteur du visage.', 'Tire vers le front en écartant les mains.', 'Finis coudes hauts, épaules en rotation externe.']],
  ['standing_dumbbell_press', 'Développé épaules debout aux haltères', 'epaules', ['triceps', 'trapezes'], 'halteres', 'c', 90, ['Debout, abdos et fessiers serrés.', 'Pousse les haltères au-dessus de la tête sans cambrer.', 'Redescends à hauteur d’oreilles.']],
  // Biceps
  ['barbell_curl', 'Curl à la barre', 'biceps', ['avant-bras'], 'barre', 'i', 75, ['Coudes collés au corps.', 'Monte sans balancer le buste.', 'Descends jusqu’aux bras tendus.']],
  ['ez-bar_curl', 'Curl à la barre EZ', 'biceps', ['avant-bras'], 'barre-ez', 'i', 75, ['Prise sur la partie inclinée de la barre.', 'Coudes fixes.', 'Descente contrôlée.']],
  ['dumbbell_bicep_curl', 'Curl aux haltères', 'biceps', ['avant-bras'], 'halteres', 'i', 75, ['Tourne les paumes vers le haut en montant.', 'Coudes immobiles.', 'Contracte une seconde en haut.']],
  ['hammer_curls', 'Curl marteau', 'biceps', ['avant-bras'], 'halteres', 'i', 75, ['Paumes face à face pendant tout le mouvement.', 'Coudes le long du corps.', 'Sans élan.']],
  ['preacher_curl', 'Curl au pupitre', 'biceps', [], 'barre-ez', 'i', 75, ['Aisselles calées en haut du pupitre.', 'Descends presque bras tendus, sans rebondir.', 'Monte en contractant.']],
  ['concentration_curls', 'Curl concentré', 'biceps', [], 'halteres', 'i', 60, ['Coude calé contre l’intérieur de la cuisse.', 'Monte lentement en tournant légèrement la paume.', 'Descends complètement.']],
  // Triceps
  ['triceps_pushdown', 'Extensions triceps à la poulie', 'triceps', [], 'poulie', 'i', 75, ['Coudes collés au corps.', 'Pousse jusqu’aux bras tendus.', 'Remonte sans décoller les coudes.']],
  ['cable_rope_overhead_triceps_extension', 'Extensions triceps au-dessus de la tête', 'triceps', [], 'poulie', 'i', 75, ['Dos à la poulie, corde derrière la tête.', 'Tends les bras vers l’avant et le haut.', 'Étire bien en bas.']],
  ['lying_triceps_press', 'Barre au front', 'triceps', [], 'barre-ez', 'i', 90, ['Bras verticaux au départ.', 'Descends la barre vers le front en ne pliant que les coudes.', 'Remonte en gardant les coudes serrés.']],
  ['close-grip_barbell_bench_press', 'Développé couché prise serrée', 'triceps', ['pectoraux', 'epaules'], 'barre', 'c', 120, ['Mains largeur d’épaules.', 'Coudes près du corps à la descente.', 'Pousse en verrouillant les triceps.']],
  ['dips_-_triceps_version', 'Dips, buste droit', 'triceps', ['pectoraux', 'epaules'], 'poids-du-corps', 'c', 120, ['Buste droit, coudes vers l’arrière.', 'Descends jusqu’à un angle de 90 degrés environ.', 'Remonte bras tendus.']],
  ['standing_dumbbell_triceps_extension', 'Extension triceps à l’haltère', 'triceps', [], 'halteres', 'i', 75, ['Haltère tenu à deux mains au-dessus de la tête.', 'Descends derrière la tête, coudes pointés vers le haut.', 'Remonte sans écarter les coudes.']],
  ['push-ups_-_close_triceps_position', 'Pompes prise serrée', 'triceps', ['pectoraux', 'epaules'], 'poids-du-corps', 'c', 75, ['Mains sous les épaules ou un peu plus serrées.', 'Coudes le long du corps à la descente.', 'Corps gainé de la tête aux talons.']],
  ['bench_dips', 'Dips sur banc', 'triceps', ['pectoraux', 'epaules'], 'poids-du-corps', 'i', 60, ['Mains sur le bord d’un banc ou d’une chaise stable.', 'Descends jusqu’à 90 degrés aux coudes, épaules basses.', 'Remonte bras tendus ; jambes pliées pour faciliter.']],
  // Avant-bras
  ['palms-down_wrist_curl_over_a_bench', 'Extension des poignets', 'avant-bras', [], 'barre', 'i', 60, ['Avant-bras posés sur le banc, paumes vers le bas.', 'Monte le dos des mains.', 'Petite amplitude, mouvement lent.']],
  ['palms-up_barbell_wrist_curl_over_a_bench', 'Flexion des poignets', 'avant-bras', [], 'barre', 'i', 60, ['Avant-bras posés, paumes vers le haut.', 'Enroule les poignets vers toi.', 'Laisse la barre rouler vers les doigts en descendant.']],
  // Abdominaux
  ['crunches', 'Crunch', 'abdominaux', [], 'poids-du-corps', 'i', 60, ['Bas du dos au sol.', 'Enroule le haut du buste en soufflant.', 'Ne tire pas sur la nuque.']],
  ['cable_crunch', 'Crunch à la poulie', 'abdominaux', [], 'poulie', 'i', 60, ['À genoux, corde près de la tête.', 'Enroule le buste vers le bas en contractant les abdos.', 'Les hanches restent fixes.']],
  ['hanging_leg_raise', 'Relevés de jambes suspendu', 'abdominaux', ['obliques'], 'poids-du-corps', 'i', 75, ['Suspendu, sans balancer.', 'Monte les jambes en enroulant le bassin.', 'Redescends lentement.']],
  ['plank', 'Gainage', 'abdominaux', ['lombaires', 'epaules'], 'poids-du-corps', 'i', 60, ['Coudes sous les épaules, corps aligné.', 'Serre fessiers et abdos.', 'Note la durée en secondes dans les répétitions.']],
  ['ab_roller', 'Roue abdominale', 'abdominaux', ['epaules', 'lombaires'], 'autre', 'c', 75, ['À genoux, dos légèrement arrondi.', 'Avance seulement tant que le bas du dos ne se creuse pas.', 'Reviens en contractant les abdos.']],
  ['dead_bug', 'Dead bug', 'abdominaux', ['obliques'], 'poids-du-corps', 'i', 60, ['Sur le dos, bras tendus vers le plafond, genoux à 90 degrés.', 'Allonge un bras et la jambe opposée sans décoller le bas du dos.', 'Reviens et alterne, lentement.']],
  // Obliques
  ['russian_twist', 'Rotations russes', 'obliques', ['abdominaux'], 'poids-du-corps', 'i', 60, ['Buste incliné, pieds au sol ou levés.', 'Tourne les épaules d’un côté à l’autre.', 'Garde le dos droit.']],
  ['side_bridge', 'Gainage latéral', 'obliques', ['abdominaux', 'epaules'], 'poids-du-corps', 'i', 60, ['Coude sous l’épaule, corps aligné.', 'Monte les hanches.', 'Note la durée en secondes dans les répétitions.']],
  ['oblique_crunches_-_on_the_floor', 'Crunch oblique', 'obliques', ['abdominaux'], 'poids-du-corps', 'i', 60, ['Allongé sur le côté, genoux fléchis.', 'Monte l’épaule vers la hanche.', 'Mouvement court et contrôlé.']],
  // Fessiers
  ['barbell_hip_thrust', 'Hip thrust', 'fessiers', ['ischios'], 'barre', 'c', 120, ['Haut du dos sur le banc, barre sur les hanches (avec protection).', 'Pousse les hanches jusqu’à l’alignement buste-cuisses.', 'Serre les fessiers une seconde en haut.']],
  ['glute_kickback', 'Kickback fessiers', 'fessiers', ['ischios'], 'poids-du-corps', 'i', 60, ['À quatre pattes, dos plat.', 'Pousse un talon vers le plafond.', 'Ne cambre pas le bas du dos.']],
  ['butt_lift_bridge', 'Pont fessier', 'fessiers', ['ischios'], 'poids-du-corps', 'i', 60, ['Sur le dos, pieds à plat près des fesses.', 'Monte les hanches en poussant dans les talons.', 'Serre les fessiers une seconde en haut.']],
  ['single_leg_glute_bridge', 'Pont fessier unilatéral', 'fessiers', ['ischios'], 'poids-du-corps', 'i', 60, ['Une jambe tendue en l’air, l’autre pied au sol.', 'Monte les hanches sans les laisser pencher.', 'Fais toutes les répétitions d’un côté puis de l’autre.']],
  ['one-arm_kettlebell_swings', 'Swing au kettlebell', 'fessiers', ['ischios', 'lombaires'], 'kettlebell', 'c', 90, ['Recule les hanches, dos plat, kettlebell entre les jambes.', 'Projette les hanches vers l’avant : ce sont elles qui lancent la charge.', 'Bras détendus, la charge monte à hauteur de poitrine.']],
  // Quadriceps
  ['barbell_squat', 'Squat', 'quadriceps', ['fessiers', 'ischios', 'lombaires'], 'barre', 'c', 180, ['Pieds largeur d’épaules, pointes légèrement ouvertes.', 'Descends en poussant les genoux dans l’axe des pieds.', 'Dos neutre, remonte en poussant le sol.']],
  ['front_barbell_squat', 'Squat avant', 'quadriceps', ['fessiers', 'abdominaux'], 'barre', 'c', 180, ['Barre sur l’avant des épaules, coudes hauts.', 'Buste le plus droit possible.', 'Descends aussi bas que la mobilité le permet.']],
  ['hack_squat', 'Hack squat', 'quadriceps', ['fessiers'], 'machine', 'c', 150, ['Dos plaqué contre le dossier.', 'Descends lentement, genoux dans l’axe des pieds.', 'Remonte sans verrouiller brutalement.']],
  ['leg_press', 'Presse à cuisses', 'quadriceps', ['fessiers', 'ischios'], 'machine', 'c', 150, ['Bas du dos plaqué, ne le laisse pas décoller.', 'Descends jusqu’à 90 degrés environ.', 'Ne verrouille pas les genoux en haut.']],
  ['goblet_squat', 'Goblet squat', 'quadriceps', ['fessiers', 'abdominaux'], 'kettlebell', 'c', 90, ['Charge tenue contre la poitrine.', 'Descends entre les talons, buste droit.', 'Coudes à l’intérieur des genoux en bas.']],
  ['barbell_lunge', 'Fentes à la barre', 'quadriceps', ['fessiers', 'ischios'], 'barre', 'c', 120, ['Grand pas en avant, buste droit.', 'Genou arrière vers le sol.', 'Pousse avec la jambe avant pour remonter.']],
  ['dumbbell_lunges', 'Fentes aux haltères', 'quadriceps', ['fessiers', 'ischios'], 'halteres', 'c', 90, ['Haltères le long du corps.', 'Genou avant au-dessus du pied.', 'Alterne les jambes ou fais une jambe puis l’autre.']],
  ['split_squat_with_dumbbells', 'Fentes bulgares', 'quadriceps', ['fessiers'], 'halteres', 'c', 90, ['Pied arrière posé sur un banc.', 'Descends à la verticale, buste légèrement penché.', 'Pousse avec le talon avant.']],
  ['dumbbell_step_ups', 'Montées sur banc', 'quadriceps', ['fessiers'], 'halteres', 'c', 90, ['Pied entier sur le banc.', 'Monte en poussant sur la jambe d’appui, sans élan.', 'Redescends lentement.']],
  ['leg_extensions', 'Leg extension', 'quadriceps', [], 'machine', 'i', 75, ['Genoux alignés avec l’axe de la machine.', 'Tends les jambes et marque une pause.', 'Redescends lentement.']],
  ['bodyweight_squat', 'Squat au poids du corps', 'quadriceps', ['fessiers'], 'poids-du-corps', 'c', 60, ['Pieds largeur d’épaules, bras devant pour l’équilibre.', 'Descends en gardant les talons au sol.', 'Remonte en poussant le sol, genoux dans l’axe des pieds.']],
  ['bodyweight_walking_lunge', 'Fentes marchées', 'quadriceps', ['fessiers', 'ischios'], 'poids-du-corps', 'c', 75, ['Grand pas en avant, buste droit.', 'Genou arrière près du sol.', 'Enchaîne en avançant l’autre jambe ; compte les répétitions par jambe.']],
  // Ischio-jambiers
  ['romanian_deadlift', 'Soulevé de terre roumain', 'ischios', ['fessiers', 'lombaires'], 'barre', 'c', 150, ['Genoux légèrement fléchis et fixes.', 'Recule les hanches, barre le long des cuisses.', 'Descends jusqu’à l’étirement des ischios, dos plat.']],
  ['stiff-legged_barbell_deadlift', 'Soulevé de terre jambes tendues', 'ischios', ['fessiers', 'lombaires'], 'barre', 'c', 150, ['Jambes presque tendues.', 'Bascule le buste en gardant le dos plat.', 'Remonte en serrant les fessiers.']],
  ['lying_leg_curls', 'Leg curl allongé', 'ischios', ['mollets'], 'machine', 'i', 75, ['Hanches plaquées contre le banc.', 'Ramène les talons vers les fesses.', 'Redescends lentement.']],
  ['seated_leg_curl', 'Leg curl assis', 'ischios', [], 'machine', 'i', 75, ['Genoux alignés avec l’axe de la machine.', 'Fléchis les jambes en contrôlant.', 'Remonte lentement.']],
  ['sumo_deadlift', 'Soulevé de terre sumo', 'ischios', ['fessiers', 'adducteurs', 'lombaires', 'quadriceps'], 'barre', 'c', 180, ['Pieds larges, pointes ouvertes, mains à l’intérieur des jambes.', 'Genoux poussés vers l’extérieur.', 'Dos plat, pousse le sol.']],
  ['stiff-legged_dumbbell_deadlift', 'Soulevé de terre jambes tendues aux haltères', 'ischios', ['fessiers', 'lombaires'], 'halteres', 'c', 90, ['Genoux légèrement fléchis, haltères devant les cuisses.', 'Recule les hanches en gardant le dos plat.', 'Remonte en serrant les fessiers.']],
  // Adducteurs
  ['thigh_adductor', 'Adducteurs à la machine', 'adducteurs', [], 'machine', 'i', 60, ['Dos contre le dossier.', 'Serre les jambes en contrôlant.', 'Reviens lentement à l’écart.']],
  ['cable_hip_adduction', 'Adduction à la poulie', 'adducteurs', [], 'poulie', 'i', 60, ['Sangle à la cheville, côté poulie.', 'Ramène la jambe devant l’autre.', 'Buste immobile.']],
  // Mollets
  ['standing_dumbbell_calf_raise', 'Mollets debout aux haltères', 'mollets', [], 'halteres', 'i', 60, ['Avant du pied sur une marche, haltères le long du corps.', 'Monte sur la pointe des pieds et marque une pause.', 'Descends jusqu’à l’étirement.']],
  ['standing_calf_raises', 'Mollets debout', 'mollets', [], 'machine', 'i', 60, ['Talons dans le vide, amplitude complète.', 'Monte sur la pointe des pieds et marque une pause.', 'Descends jusqu’à l’étirement.']],
  ['seated_calf_raise', 'Mollets assis', 'mollets', [], 'machine', 'i', 60, ['Genoux sous les appuis.', 'Monte sur la pointe des pieds.', 'Étire bien en bas.']],
];

export const EXERCISE_LIBRARY: LibraryExercise[] = rows.map(([id, name, muscle, secondary, equipment, kind, rest, cues]) => ({
  id,
  name,
  muscle,
  secondary,
  equipment,
  kind: kind === 'c' ? 'compound' : 'isolation',
  rest,
  cues,
}));

const byId = new Map(EXERCISE_LIBRARY.map((e) => [e.id, e]));

export function libraryExercise(id: string | null | undefined): LibraryExercise | undefined {
  return id ? byId.get(id) : undefined;
}

export function exerciseImages(id: string): [string, string] {
  return [`/exercices/${id}_0.webp`, `/exercices/${id}_1.webp`];
}
