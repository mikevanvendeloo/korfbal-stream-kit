/**
 * All Beheer URLs in one place. The path segments follow the menu: Producties, Stamgegevens (with the
 * draaiboek templates) and Rapportages; setup/ holds the organization pages (organization menu and gear menu), tools/ the tools (gear menu). Link through these helpers instead of writing paths by hand.
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

  callSheetTemplates: `${ADMIN}/stamgegevens/draaiboek-templates`,
  callSheetTemplate: (id: number | string) => `${ADMIN}/stamgegevens/draaiboek-templates/${id}`,

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

  qr: `${ADMIN}/tools/qr`,
  /** All organizations (list, create, edit, (de)activate) */
  organizations: `${ADMIN}/setup/organisaties`,
  /** The chosen organization: logo, match import, API keys */
  organization: `${ADMIN}/setup/organisatie`,
};

export const REPORT_TABS = [
  {tab: 'dagbezetting', label: 'Dagbezetting'},
  {tab: 'posities', label: 'Positieoverzicht'},
  {tab: 'interviews', label: 'Interviews'},
  {tab: 'entertainment', label: 'Entertainmentrollen'},
  {tab: 'crew', label: 'Crewrollen'},
  {tab: 'tijdsanalyse', label: 'Tijdsanalyse'},
] as const;

export type ReportTab = typeof REPORT_TABS[number]['tab'];
