/**
 * Ce qu'il faut pour faire chaque exercice, et le schéma de mouvement qu'il travaille.
 * Sert à construire un programme avec le matériel disponible (questionnaire de départ).
 */

/** Matériel : « salle » regroupe machines et poulies ; « charge » = haltère ou kettlebell, au choix. */
export type Need = 'salle' | 'halteres' | 'banc' | 'barre' | 'traction' | 'kettlebell' | 'charge';

export type Pattern =
  | 'pousse-h'
  | 'pousse-v'
  | 'tirage-v'
  | 'tirage-h'
  | 'squat'
  | 'charniere'
  | 'fente'
  | 'iso-pectoraux'
  | 'iso-dos'
  | 'iso-epaules'
  | 'iso-arriere-epaules'
  | 'iso-biceps'
  | 'iso-triceps'
  | 'iso-quadriceps'
  | 'iso-ischios'
  | 'iso-fessiers'
  | 'iso-mollets'
  | 'iso-trapezes'
  | 'iso-lombaires'
  | 'iso-avant-bras'
  | 'iso-adducteurs'
  | 'abdos';

// prettier-ignore
export const TRAITS: Record<string, { pattern: Pattern; needs: Need[] }> = {
  // Pectoraux
  'barbell_bench_press_-_medium_grip': { pattern: 'pousse-h', needs: ['barre', 'banc'] },
  'barbell_incline_bench_press_-_medium_grip': { pattern: 'pousse-h', needs: ['barre', 'banc'] },
  dumbbell_bench_press: { pattern: 'pousse-h', needs: ['halteres', 'banc'] },
  incline_dumbbell_press: { pattern: 'pousse-h', needs: ['halteres', 'banc'] },
  machine_bench_press: { pattern: 'pousse-h', needs: ['salle'] },
  'dips_-_chest_version': { pattern: 'pousse-h', needs: ['salle'] },
  dumbbell_floor_press: { pattern: 'pousse-h', needs: ['halteres'] },
  'decline_push-up': { pattern: 'pousse-h', needs: [] },
  pushups: { pattern: 'pousse-h', needs: [] },
  cable_crossover: { pattern: 'iso-pectoraux', needs: ['salle'] },
  butterfly: { pattern: 'iso-pectoraux', needs: ['salle'] },
  dumbbell_flyes: { pattern: 'iso-pectoraux', needs: ['halteres', 'banc'] },
  // Dos
  pullups: { pattern: 'tirage-v', needs: ['traction'] },
  'chin-up': { pattern: 'tirage-v', needs: ['traction'] },
  'wide-grip_lat_pulldown': { pattern: 'tirage-v', needs: ['salle'] },
  bent_over_barbell_row: { pattern: 'tirage-h', needs: ['barre'] },
  'one-arm_dumbbell_row': { pattern: 'tirage-h', needs: ['halteres', 'banc'] },
  'bent_over_two-dumbbell_row': { pattern: 'tirage-h', needs: ['halteres'] },
  seated_cable_rows: { pattern: 'tirage-h', needs: ['salle'] },
  't-bar_row_with_handle': { pattern: 'tirage-h', needs: ['salle'] },
  inverted_row: { pattern: 'tirage-h', needs: ['salle'] },
  'straight-arm_pulldown': { pattern: 'iso-dos', needs: ['salle'] },
  // Trapèzes
  barbell_shrug: { pattern: 'iso-trapezes', needs: ['barre'] },
  dumbbell_shrug: { pattern: 'iso-trapezes', needs: ['halteres'] },
  // Lombaires
  barbell_deadlift: { pattern: 'charniere', needs: ['barre'] },
  good_morning: { pattern: 'charniere', needs: ['barre'] },
  hyperextensions_back_extensions: { pattern: 'iso-lombaires', needs: ['salle'] },
  superman: { pattern: 'iso-lombaires', needs: [] },
  // Épaules
  standing_military_press: { pattern: 'pousse-v', needs: ['barre'] },
  seated_dumbbell_press: { pattern: 'pousse-v', needs: ['halteres', 'banc'] },
  standing_dumbbell_press: { pattern: 'pousse-v', needs: ['halteres'] },
  arnold_dumbbell_press: { pattern: 'pousse-v', needs: ['halteres', 'banc'] },
  machine_shoulder_military_press: { pattern: 'pousse-v', needs: ['salle'] },
  side_lateral_raise: { pattern: 'iso-epaules', needs: ['halteres'] },
  cable_seated_lateral_raise: { pattern: 'iso-epaules', needs: ['salle'] },
  front_dumbbell_raise: { pattern: 'iso-epaules', needs: ['halteres'] },
  reverse_flyes: { pattern: 'iso-arriere-epaules', needs: ['halteres'] },
  face_pull: { pattern: 'iso-arriere-epaules', needs: ['salle'] },
  // Biceps
  barbell_curl: { pattern: 'iso-biceps', needs: ['barre'] },
  'ez-bar_curl': { pattern: 'iso-biceps', needs: ['barre'] },
  dumbbell_bicep_curl: { pattern: 'iso-biceps', needs: ['halteres'] },
  hammer_curls: { pattern: 'iso-biceps', needs: ['halteres'] },
  preacher_curl: { pattern: 'iso-biceps', needs: ['salle'] },
  concentration_curls: { pattern: 'iso-biceps', needs: ['halteres', 'banc'] },
  // Triceps
  triceps_pushdown: { pattern: 'iso-triceps', needs: ['salle'] },
  cable_rope_overhead_triceps_extension: { pattern: 'iso-triceps', needs: ['salle'] },
  lying_triceps_press: { pattern: 'iso-triceps', needs: ['barre', 'banc'] },
  standing_dumbbell_triceps_extension: { pattern: 'iso-triceps', needs: ['halteres'] },
  'close-grip_barbell_bench_press': { pattern: 'iso-triceps', needs: ['barre', 'banc'] },
  'dips_-_triceps_version': { pattern: 'iso-triceps', needs: ['salle'] },
  'push-ups_-_close_triceps_position': { pattern: 'iso-triceps', needs: [] },
  bench_dips: { pattern: 'iso-triceps', needs: ['banc'] },
  // Avant-bras
  'palms-down_wrist_curl_over_a_bench': { pattern: 'iso-avant-bras', needs: ['barre', 'banc'] },
  'palms-up_barbell_wrist_curl_over_a_bench': { pattern: 'iso-avant-bras', needs: ['barre', 'banc'] },
  // Abdominaux et obliques
  crunches: { pattern: 'abdos', needs: [] },
  cable_crunch: { pattern: 'abdos', needs: ['salle'] },
  hanging_leg_raise: { pattern: 'abdos', needs: ['traction'] },
  plank: { pattern: 'abdos', needs: [] },
  ab_roller: { pattern: 'abdos', needs: ['salle'] },
  dead_bug: { pattern: 'abdos', needs: [] },
  russian_twist: { pattern: 'abdos', needs: [] },
  side_bridge: { pattern: 'abdos', needs: [] },
  'oblique_crunches_-_on_the_floor': { pattern: 'abdos', needs: [] },
  // Fessiers
  barbell_hip_thrust: { pattern: 'iso-fessiers', needs: ['barre', 'banc'] },
  glute_kickback: { pattern: 'iso-fessiers', needs: [] },
  butt_lift_bridge: { pattern: 'iso-fessiers', needs: [] },
  single_leg_glute_bridge: { pattern: 'iso-fessiers', needs: [] },
  'one-arm_kettlebell_swings': { pattern: 'charniere', needs: ['kettlebell'] },
  // Quadriceps
  barbell_squat: { pattern: 'squat', needs: ['barre'] },
  front_barbell_squat: { pattern: 'squat', needs: ['barre'] },
  hack_squat: { pattern: 'squat', needs: ['salle'] },
  leg_press: { pattern: 'squat', needs: ['salle'] },
  goblet_squat: { pattern: 'squat', needs: ['charge'] },
  bodyweight_squat: { pattern: 'squat', needs: [] },
  barbell_lunge: { pattern: 'fente', needs: ['barre'] },
  dumbbell_lunges: { pattern: 'fente', needs: ['halteres'] },
  split_squat_with_dumbbells: { pattern: 'fente', needs: ['halteres', 'banc'] },
  dumbbell_step_ups: { pattern: 'fente', needs: ['halteres', 'banc'] },
  bodyweight_walking_lunge: { pattern: 'fente', needs: [] },
  leg_extensions: { pattern: 'iso-quadriceps', needs: ['salle'] },
  // Ischio-jambiers
  romanian_deadlift: { pattern: 'charniere', needs: ['barre'] },
  'stiff-legged_barbell_deadlift': { pattern: 'charniere', needs: ['barre'] },
  'stiff-legged_dumbbell_deadlift': { pattern: 'charniere', needs: ['halteres'] },
  sumo_deadlift: { pattern: 'charniere', needs: ['barre'] },
  lying_leg_curls: { pattern: 'iso-ischios', needs: ['salle'] },
  seated_leg_curl: { pattern: 'iso-ischios', needs: ['salle'] },
  // Adducteurs
  thigh_adductor: { pattern: 'iso-adducteurs', needs: ['salle'] },
  cable_hip_adduction: { pattern: 'iso-adducteurs', needs: ['salle'] },
  // Mollets
  standing_calf_raises: { pattern: 'iso-mollets', needs: ['salle'] },
  seated_calf_raise: { pattern: 'iso-mollets', needs: ['salle'] },
  standing_dumbbell_calf_raise: { pattern: 'iso-mollets', needs: ['halteres'] },
};

/** Le matériel disponible permet-il cet exercice ? En salle, tout est disponible. */
export function canDo(needs: readonly Need[], available: ReadonlySet<Need>, gym: boolean): boolean {
  if (gym) return true;
  return needs.every((n) => (n === 'charge' ? available.has('halteres') || available.has('kettlebell') : n !== 'salle' && available.has(n)));
}
