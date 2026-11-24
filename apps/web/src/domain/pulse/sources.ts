/** Sources des règles PULSE, vérifiées le 24 novembre 2026. Affichées sous les recommandations. */
export const PULSE_SOURCES = {
  sommeil: 'AASM et SRS (Watson et al., 2015), Sleep',
  sommeilPerf: 'Craven et al., 2022, Sports Medicine 52 : 2669-2690',
  cafeine: 'Drake et al., 2013, Journal of Clinical Sleep Medicine 9 : 1195-1200',
  sieste: 'Brooks et Lack, 2006, Sleep 29 : 831-840',
  vfc: 'Kiviniemi et al., 2007, Eur J Appl Physiol 101 : 743-751 ; Plews et al., 2013, Sports Medicine 43 : 773-781',
  surentrainement: 'Meeusen et al., 2013, consensus ECSS et ACSM, Med Sci Sports Exerc 45 : 186-205',
  charge: 'Impellizzeri et al., 2020, Int J Sports Physiol Perform 15 : 907-913',
  ressenti: 'Saw et al., 2016, British Journal of Sports Medicine 50 : 281-291',
  proteines: 'Morton et al., 2018, British Journal of Sports Medicine 52 : 376-384',
  douleurs: 'MSD Manuals (version grand public), Santé.fr, Haute Autorité de santé',
  proteinesRepas: 'Schoenfeld et Aragon, 2018, Journal of the International Society of Sports Nutrition 15 : 10',
  etirements: 'Herbert, de Noronha et Kamper, 2011, Cochrane Database of Systematic Reviews, CD004577',
} as const;

export type PulseSourceKey = keyof typeof PULSE_SOURCES;
