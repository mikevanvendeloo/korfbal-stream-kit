/**
 * Parser for the statistics PC's "Tweede Scherm klassiek" page: nested TABLE/TR/TD with FONT, windows-1252.
 * Dependency-free on purpose. A row holds the home half (cells with BGCOLOR #FFFF80) and the away half
 * (#FF8080) side by side; cells without a colour are spacers, cells with #FFFFFF belong to the title rows.
 */

export type Ratio = {goals: number; attempts: number};
export type ReboundRatio = {won: number; total: number};

export type PlayerStats = {
  name: string;
  afstand: Ratio;
  doorloop: Ratio;
  kortSchot: Ratio;
  vrijeBal: Ratio;
  strafworp: Ratio;
  totaal: Ratio;
  rebound: ReboundRatio;
  aangeef: number;
};

export type PercentageRow = {
  afstand: number | null;
  doorloop: number | null;
  kortSchot: number | null;
  vrijeBal: number | null;
  strafworp: number | null;
  totaal: number | null;
  rebound: number | null;
  aangeef: number | null;
};

export type StatsVak = {
  balls: number | null;
  possessionTime: string | null;
  /** The column headers of the two "POG." rows ("0".."7", "7+"): the number of passes before the attempt. */
  attemptLabels: string[];
  attemptsEndingInTurnover: number[];
  attemptsEndingInGoal: number[];
  players: PlayerStats[];
  total: PlayerStats | null;
  percentages: PercentageRow | null;
};

export type StatsTeam = {
  name: string;
  score: number | null;
  substitutions: number | null;
  vakken: StatsVak[];
  teamTotal: PlayerStats | null;
  teamPercentages: PercentageRow | null;
};

export type TweedeScherm = {
  title: string | null;
  date: string | null; // ISO date YYYY-MM-DD
  clock: string | null; // 00:55:11
  home: StatsTeam;
  away: StatsTeam;
};

const HOME_COLOR = 'FFFF80';
const AWAY_COLOR = 'FF8080';

type Cell = {color: string | null; text: string};

const ENTITIES: Record<string, string> = {nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'"};

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const MAX_ROWS = 2000;
const MAX_CELLS_PER_ROW = 60;
const MAX_CELL_TEXT = 300;
const MAX_ATTRS = 500;
const CLOSING = ['</td', '</tr', '</table'];

/** Text of an HTML fragment without its tags, in one linear pass (no regex that can backtrack). */
function stripTags(html: string): string {
  const lastGt = html.lastIndexOf('>');
  let out = '';
  let i = 0;
  while (i < html.length && out.length < MAX_CELL_TEXT * 4) {
    const lt = html.indexOf('<', i);
    if (lt === -1 || lt > lastGt) {
      // No tag can close any more: the rest is text
      out += html.slice(i);
      break;
    }
    out += html.slice(i, lt);
    i = html.indexOf('>', lt) + 1;
  }
  return out;
}

function parseCell(raw: string): Cell {
  const open = raw.indexOf('>');
  const attrs = (open === -1 ? raw : raw.slice(0, open)).slice(0, MAX_ATTRS);
  let body = open === -1 ? '' : raw.slice(open + 1);
  const lower = body.toLowerCase();
  const end = Math.min(...CLOSING.map((t) => {
    const at = lower.indexOf(t);
    return at === -1 ? body.length : at;
  }));
  body = body.slice(0, end);
  const text = decodeEntities(stripTags(body)).replace(/\s+/g, ' ').trim().slice(0, MAX_CELL_TEXT);
  const color = (attrs.match(/BGCOLOR\s*=\s*"?#?([0-9a-f]{6})/i) || [])[1]?.toUpperCase() ?? null;
  return {color, text};
}

function parseRows(html: string): Cell[][] {
  return html
    .split(/<TR\b/i)
    .slice(1, MAX_ROWS + 1)
    .map((row) => row.split(/<TD\b/i).slice(1, MAX_CELLS_PER_ROW + 1).map(parseCell));
}

function int(s: string | undefined): number | null {
  const m = (s ?? '').match(/-?\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function ratio(s: string | undefined): Ratio {
  const m = (s ?? '').match(/(\d+)\s*\/\s*(\d+)/);
  return m ? {goals: +m[1], attempts: +m[2]} : {goals: 0, attempts: 0};
}

function percent(s: string | undefined): number | null {
  const m = (s ?? '').match(/-?\d+(?:[.,]\d+)?/);
  return m ? parseFloat(m[0].replace(',', '.')) : null;
}

function statsOf(name: string, c: string[]): PlayerStats {
  const reb = ratio(c[6]);
  return {
    name,
    afstand: ratio(c[0]),
    doorloop: ratio(c[1]),
    kortSchot: ratio(c[2]),
    vrijeBal: ratio(c[3]),
    strafworp: ratio(c[4]),
    totaal: ratio(c[5]),
    rebound: {won: reb.goals, total: reb.attempts},
    aangeef: int(c[7]) ?? 0,
  };
}

function percentagesOf(c: string[]): PercentageRow {
  return {
    afstand: percent(c[0]),
    doorloop: percent(c[1]),
    kortSchot: percent(c[2]),
    vrijeBal: percent(c[3]),
    strafworp: percent(c[4]),
    totaal: percent(c[5]),
    rebound: percent(c[6]),
    aangeef: percent(c[7]),
  };
}

function emptyTeam(): StatsTeam {
  return {name: '', score: null, substitutions: null, vakken: [], teamTotal: null, teamPercentages: null};
}

function emptyVak(): StatsVak {
  return {balls: null, possessionTime: null, attemptLabels: [], attemptsEndingInTurnover: [], attemptsEndingInGoal: [], players: [], total: null, percentages: null};
}

function feedHalf(team: StatsTeam, cells: string[]): void {
  const label = (cells[0] ?? '').trim();
  if (!label || /^speler$/i.test(label)) return;
  const rest = cells.slice(1);
  const upper = label.toUpperCase();
  let vak = team.vakken[team.vakken.length - 1];
  if (upper.startsWith('BALLEN:')) {
    vak = emptyVak();
    vak.balls = int(label.match(/BALLEN:\s*(\d+)/i)?.[1]);
    vak.possessionTime = label.match(/Tijd:\s*(\d+:\d+(?::\d+)?)/i)?.[1] ?? null;
    vak.attemptLabels = rest;
    team.vakken.push(vak);
    return;
  }
  if (upper === 'TEAM TOTAAL') return void (team.teamTotal = statsOf(label, rest));
  if (upper === 'TEAM PERCENTAGE') return void (team.teamPercentages = percentagesOf(rest));
  if (!vak) return;
  if (upper.startsWith('POG. EINDE BALVERLIES')) return void (vak.attemptsEndingInTurnover = rest.map((v) => int(v) ?? 0));
  if (upper.startsWith('POG. EINDE GOAL')) return void (vak.attemptsEndingInGoal = rest.map((v) => int(v) ?? 0));
  if (upper === 'VAKTOTAAL') return void (vak.total = statsOf(label, rest));
  if (upper === 'VAK PERCENTAGE') return void (vak.percentages = percentagesOf(rest));
  if (rest.length >= 8 && /\d\s*\/\s*\d/.test(rest[0])) vak.players.push(statsOf(label, rest));
}

export function parseTweedeScherm(html: string): TweedeScherm {
  const rows = parseRows(html);
  const home = emptyTeam();
  const away = emptyTeam();
  let title: string | null = null;
  let date: string | null = null;
  let clock: string | null = null;

  for (const cells of rows) {
    const title0 = cells.filter((c) => c.color === 'FFFFFF' && c.text);
    if (title0.length) {
      for (const c of title0) {
        const m = c.text.match(/^(.*) op (\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) {
          title = m[1];
          date = `${m[4]}-${m[3]}-${m[2]}`;
        }
        const st = c.text.match(/^Stand:\s*(\d+)\s*-\s*(\d+)/i);
        if (st) {
          home.score = +st[1];
          away.score = +st[2];
        }
        const t = c.text.match(/^TIJD:\s*(\d+:\d+:\d+)/i);
        if (t) clock = t[1];
      }
      continue;
    }
    // The team names row is the only row with a "Wissels:" cell
    const homeCells = cells.filter((c) => c.color === HOME_COLOR).map((c) => c.text);
    const awayCells = cells.filter((c) => c.color === AWAY_COLOR).map((c) => c.text);
    if (homeCells.some((t) => /^Wissels:/i.test(t)) || awayCells.some((t) => /^Wissels:/i.test(t))) {
      for (const [team, list] of [[home, homeCells], [away, awayCells]] as const) {
        team.name = list.find((t) => t && !/^Wissels:/i.test(t)) ?? '';
        team.substitutions = int(list.find((t) => /^Wissels:/i.test(t)));
      }
      continue;
    }
    // The ball/turnover rows start their cells with a label; empty cells inside the data stay (GOAL row)
    feedHalf(home, homeCells);
    feedHalf(away, awayCells);
  }

  if (!home.name && !away.name && !home.vakken.length) {
    throw new Error('Geen statistiekenpagina herkend');
  }
  return {title, date, clock, home, away};
}

/** windows-1252 bytes to text (the page declares it; Node's TextDecoder knows it). */
export function decodeStatsPage(buf: ArrayBuffer | Uint8Array): string {
  return new TextDecoder('windows-1252').decode(buf);
}
