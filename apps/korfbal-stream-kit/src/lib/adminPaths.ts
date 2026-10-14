/**
 * All Beheer URLs in one place. The path segments follow the menu: Producties, Draaiboeken,
 * Stamgegevens, Rapportages and Overig. Link through these helpers instead of writing paths by hand.
 */
export const ADMIN = '/admin';

export type ProductionTab = 'beschikbaarheid' | 'bezetting' | 'vmix-titels' | 'rapport';

export const adminPaths = {
  home: ADMIN,
  settings: `${ADMIN}/instellingen`,
  about: `${ADMIN}/over`,

  productions: `${ADMIN}/producties`,
  /** The production's Draaiboek tab, or one of its other tabs. */
  production: (id: number | string, tab?: ProductionTab) => `${ADMIN}/producties/${id}${tab ? `/${tab}` : ''}`,
  callSheets: (id: number | string) => `${ADMIN}/producties/${id}/callsheets`,
  callSheet: (id: number | string, callSheetId: number | string) => `${ADMIN}/producties/${id}/callsheets/${callSheetId}`,
  crewReport: (id: number | string) => `${ADMIN}/producties/${id}/rapport/crew`,
  timingReport: (id: number | string) => `${ADMIN}/producties/${id}/rapport/tijdsanalyse`,

  callSheetTemplates: `${ADMIN}/draaiboeken/templates`,
  callSheetTemplate: (id: number | string) => `${ADMIN}/draaiboeken/templates/${id}`,
  segmentTemplates: `${ADMIN}/draaiboeken/segment-templates`,
  segmentDefaults: `${ADMIN}/draaiboeken/standaardbezetting`,

  persons: `${ADMIN}/stamgegevens/personen`,
  positions: `${ADMIN}/stamgegevens/posities`,
  skills: `${ADMIN}/stamgegevens/skills`,
  matchSchedule: `${ADMIN}/stamgegevens/wedstrijdprogramma`,
  manualMatches: `${ADMIN}/stamgegevens/handmatige-wedstrijden`,
  clubs: `${ADMIN}/stamgegevens/clubs`,
  sponsors: `${ADMIN}/stamgegevens/sponsors`,
  sponsorSlides: `${ADMIN}/stamgegevens/sponsor-slides`,
  vmixConnection: `${ADMIN}/stamgegevens/vmix-koppeling`,
  vmixTitleTemplates: `${ADMIN}/stamgegevens/vmix-titel-templates`,
  vmixDatasources: `${ADMIN}/stamgegevens/vmix-datasources`,

  report: (tab: ReportTab) => `${ADMIN}/rapportages/${tab}`,

  qr: `${ADMIN}/overig/qr`,
};

export const REPORT_TABS = [
  {tab: 'dagbezetting', label: 'Dagbezetting'},
  {tab: 'posities', label: 'Positieoverzicht'},
  {tab: 'interviews', label: 'Interviews'},
  {tab: 'crew', label: 'Crewrollen'},
  {tab: 'tijdsanalyse', label: 'Tijdsanalyse'},
] as const;

export type ReportTab = typeof REPORT_TABS[number]['tab'];
