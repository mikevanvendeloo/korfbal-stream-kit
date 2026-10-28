import {ManualPart} from './manual';

export type HelpTopic = { part: ManualPart; chapter: string; section?: string };

/**
 * Which manual chapter explains the screen at a path, for the help button. The first matching rule
 * wins, so put specific paths before general ones. Chapter slugs are the manual file names without
 * their number (live/03-callsheet.md → 'callsheet').
 */
const RULES: Array<[RegExp, HelpTopic]> = [
  // LIVE
  [/^\/callsheet(\/|$)/, {part: 'live', chapter: 'callsheet'}],
  [/^\/show-caller(\/|$)/, {part: 'live', chapter: 'show-caller'}],
  [/^\/scoreboard(\/|$)/, {part: 'live', chapter: 'scorebord'}],
  [/^\/vmix(\/|$)/, {part: 'live', chapter: 'vmix'}],
  [/^\/interviews(\/|$)/, {part: 'live', chapter: 'interviews'}],
  [/^\/$/, {part: 'live', chapter: 'actieve-productie'}],

  // Beheer: per production tab
  [/^\/admin\/producties\/\d+\/beschikbaarheid/, {part: 'beheer', chapter: 'bezetting', section: 'beschikbaarheid'}],
  [/^\/admin\/producties\/\d+\/bezetting/, {part: 'beheer', chapter: 'bezetting'}],
  [/^\/admin\/producties\/\d+\/vmix-titels/, {part: 'beheer', chapter: 'interviews-en-titels'}],
  [/^\/admin\/producties\/\d+\/rapport/, {part: 'beheer', chapter: 'rapportages', section: 'productierapport'}],
  [/^\/admin\/producties\/\d+/, {part: 'beheer', chapter: 'draaiboek'}],
  [/^\/admin\/producties/, {part: 'beheer', chapter: 'producties'}],
  [/^\/admin\/stamgegevens\/(draaiboek-templates|segment-templates|standaardbezetting)/, {part: 'beheer', chapter: 'draaiboek-templates'}],
  [/^\/admin\/stamgegevens\/(vmix-|vmix$)/, {part: 'beheer', chapter: 'vmix'}],
  [/^\/admin\/stamgegevens\/(sponsors|sponsor-slides)/, {part: 'beheer', chapter: 'stamgegevens', section: 'sponsors'}],
  [/^\/admin\/stamgegevens\/(wedstrijdprogramma|handmatige-wedstrijden|clubs)/, {part: 'beheer', chapter: 'stamgegevens', section: 'competitie'}],
  [/^\/admin\/stamgegevens/, {part: 'beheer', chapter: 'stamgegevens', section: 'crew'}],
  [/^\/admin\/rapportages/, {part: 'beheer', chapter: 'rapportages'}],
  [/^\/admin\/instellingen/, {part: 'beheer', chapter: 'instellingen'}],
  [/^\/admin\/tools\/qr/, {part: 'beheer', chapter: 'aan-de-slag', section: 'qr-generator'}],
  [/^\/admin\/setup\/organisaties/, {part: 'beheer', chapter: 'organisaties', section: 'organisaties-beheren'}],
  [/^\/admin\/setup\/organisatie/, {part: 'beheer', chapter: 'organisaties', section: 'organisatie'}],
  [/^\/admin/, {part: 'beheer', chapter: 'aan-de-slag'}],
];

export function helpTopicFor(pathname: string): HelpTopic {
  return RULES.find(([re]) => re.test(pathname))?.[1] ?? {part: 'live', chapter: 'aan-de-slag'};
}

/** Where the manual for a topic lives: LIVE's manual in LIVE, Beheer's under /admin. */
export function manualPath(topic: HelpTopic): string {
  const base = topic.part === 'live' ? '/handleiding' : '/admin/handleiding';
  return `${base}/${topic.chapter}${topic.section ? `#${topic.section}` : ''}`;
}
