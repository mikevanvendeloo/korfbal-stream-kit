import {describe, expect, it} from 'vitest';
import {fireEvent, screen, within} from '@testing-library/react';
import AnalysisPage, {matchTime} from './AnalysisPage';
import {jsonResponse, mockApi, renderPage} from '../test/organizations';
import type {AttackFigures, MatchAnalysis, TurnoverKinds} from '../lib/statsApi';

const BRIDGE_UP = {bridge: {ok: true, ms: 3}, team: null, host: '10.12.0.63', network: {ok: true, ms: 4}, database: {ok: true, ms: 9}, page: {ok: true, ms: 40}};
const api = (handler: (path: string) => unknown, status: unknown = BRIDGE_UP) =>
  mockApi((call) => (call.path === '/api/stats/status' ? status : handler(call.path)));

const fig = (attacks: number, withGoal: number): AttackFigures => ({
  attacks, withGoal, goalPct: attacks ? Math.round((withGoal / attacks) * 1000) / 10 : null, attempts: attacks * 2, attemptsPerAttack: attacks ? 2 : null,
  turnovers: attacks - withGoal, reboundWon: 3, reboundTotal: 4, reboundPct: 75,
});
const split = <T, >(first: T, second: T, total: T) => ({total, firstHalf: first, secondHalf: second});
const ratio = (goals: number, attempts: number) => ({goals, attempts, pct: attempts ? Math.round((goals / attempts) * 1000) / 10 : null});
const kinds = (steal: number): TurnoverKinds => ({steal, balOver: 1, schotklok: 0, onnodigeFout: 0, total: steal + 1});

const ANALYSIS: MatchAnalysis = {
  teams: {own: 'Fortuna/Ruitenheer', opponent: 'KZ/Keukensale.com'},
  source: 'share', readAt: '2026-10-31T20:03:00.000Z',
  clock: {lastActionAt: 3311, half: 2, halftimeAt: 1659},
  score: {own: 27, opponent: 14},
  progression: [{t: 46, side: 'own', own: 1, opponent: 0, player: 'Nik van der Steen'}, {t: 1800, side: 'opponent', own: 1, opponent: 1, player: 'Isa Dik'}],
  runs: [{side: 'own', goals: 4, from: 46, to: 262, scoreBefore: {own: 0, opponent: 0}, scoreAfter: {own: 4, opponent: 0}}],
  droughts: {own: {seconds: 579, from: 1217, to: 1796}, opponent: {seconds: 466, from: 2280, to: 2746}},
  attacks: {own: split(fig(40, 12), fig(33, 15), fig(73, 27)), opponent: split(fig(40, 8), fig(34, 6), fig(74, 14))},
  vakken: [
    {vak: 1, players: ['Lindsy Krop', 'Nik van der Steen'], opponents: ['Isa Dik'], attack: split(fig(20, 6), fig(23, 8), fig(43, 14)), defence: split(fig(16, 4), fig(16, 3), fig(32, 7))},
    {vak: 2, players: ['Nikki Boerhout'], opponents: ['Jet van der Bunt'], attack: split(fig(20, 6), fig(9, 7), fig(29, 13)), defence: split(fig(24, 4), fig(18, 3), fig(42, 7))},
  ],
  attacksWithoutVak: 1,
  duels: [
    {vak: 1, player: 'Jordi van Elburg', opponent: 'Marijn van den Goorbergh', for: split(ratio(2, 5), ratio(0, 4), ratio(2, 9)), against: split(ratio(1, 6), ratio(0, 4), ratio(1, 10))},
    {vak: 2, player: 'Merijn Mensink', opponent: 'Jari Leemhuis', for: split(ratio(0, 0), ratio(0, 3), ratio(0, 3)), against: split(ratio(0, 0), ratio(2, 3), ratio(2, 3))},
  ],
  shots: {
    own: {byZone: [{kind: 'afstand', zone: 'links', goals: 4, attempts: 26, pct: 15.4}], byType: {afstand: ratio(19, 101), kort: ratio(2, 6), doorloop: ratio(2, 9), vrijeBal: ratio(0, 1), strafworp: ratio(4, 4)}},
    opponent: {byZone: [{kind: 'halveAfstand', zone: 'achter', goals: 0, attempts: 13, pct: 0}], byType: {afstand: ratio(10, 110), kort: ratio(1, 5), doorloop: ratio(1, 8), vrijeBal: ratio(0, 0), strafworp: ratio(2, 3)}},
  },
  turnovers: {own: split(kinds(2), kinds(3), kinds(5)), opponent: split(kinds(6), kinds(6), kinds(12))},
};

describe('matchTime', () => {
  it('counts from the start of the half', () => {
    expect(matchTime(262, 1659)).toBe('4:22');
    expect(matchTime(1796, 1659)).toBe('2e 2:17');
    expect(matchTime(600, null)).toBe('10:00');
  });
});

describe('AnalysisPage', () => {
  it('shows the four cards: score, runs and droughts, per vak, duels, shots and turnovers', async () => {
    api((path) => (path === '/api/stats/analysis' ? ANALYSIS : {}));
    renderPage(<AnalysisPage/>);
    const progression = await screen.findByRole('region', {name: 'Verloop'});
    expect(within(progression).getByText(/27 – 14/)).toBeTruthy();
    expect(within(progression).getByText('4–0 Fortuna/Ruitenheer')).toBeTruthy();
    expect(within(progression).getByText('9:39 (20:17–2e 2:17)')).toBeTruthy();
    expect(within(progression).getByRole('img', {name: /Fortuna\/Ruitenheer 27, KZ\/Keukensale.com 14/})).toBeTruthy();

    const vakken = screen.getByRole('region', {name: 'Per vak'});
    const vak1 = within(vakken).getByRole('table', {name: 'Vak 1'});
    expect(within(vak1).getByRole('row', {name: /Met doelpunt 14 \(32,6%\) 7 \(21,9%\)/})).toBeTruthy();
    expect(within(vakken).getByText('1 aanvallen zonder bekend vak (alleen in de ploeg geteld)')).toBeTruthy();

    const duels = screen.getByRole('region', {name: 'Duels'});
    expect(within(duels).getByRole('row', {name: /Jordi van Elburg Marijn van den Goorbergh 2\/9 \(22,2%\) 1\/10 \(10%\)/})).toBeTruthy();

    const shots = screen.getByRole('region', {name: 'Schotkaart en balverlies'});
    expect(within(shots).getByText('Afstand · links')).toBeTruthy();
    expect(within(within(shots).getByRole('table', {name: 'Balverlies per soort'})).getByRole('row', {name: 'Steal 5 12'})).toBeTruthy();
    expect(screen.getByText(/Bron: share/)).toBeTruthy();
  });

  it('switches a card to one half', async () => {
    api((path) => (path === '/api/stats/analysis' ? ANALYSIS : {}));
    renderPage(<AnalysisPage/>);
    const duels = await screen.findByRole('region', {name: 'Duels'});
    fireEvent.click(within(duels).getByRole('button', {name: '1e helft'}));
    expect(within(duels).getByRole('row', {name: /Jordi van Elburg .* 2\/5 \(40%\) 1\/6/})).toBeTruthy();
    // Merijn had no shot in the first half
    expect(within(duels).queryByText('Merijn Mensink')).toBeNull();
    fireEvent.click(within(duels).getByRole('button', {name: '2e helft'}));
    expect(within(duels).getByText('Merijn Mensink')).toBeTruthy();
  });

  it('shows the second half switch disabled during the first half', async () => {
    api((path) => (path === '/api/stats/analysis' ? {...ANALYSIS, clock: {lastActionAt: 900, half: 1, halftimeAt: null}} : {}));
    renderPage(<AnalysisPage/>);
    const vakken = await screen.findByRole('region', {name: 'Per vak'});
    expect((within(vakken).getByRole('button', {name: '2e helft'}) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the bridge\'s message when the analysis needs the database', async () => {
    api((path) => (path === '/api/stats/analysis' ? jsonResponse({error: 'De analyse heeft het statistiekenbestand nodig'}, 503) : {}));
    renderPage(<AnalysisPage/>);
    expect((await screen.findByRole('alert')).textContent).toBe('De analyse heeft het statistiekenbestand nodig');
  });

  it('shows "De statistics bridge is offline" instead of the cards', async () => {
    api(() => jsonResponse({error: 'De statistics bridge is offline', code: 'STATS_BRIDGE_OFFLINE'}, 503), {bridge: {ok: false, ms: null}});
    renderPage(<AnalysisPage/>);
    expect((await screen.findByRole('alert')).textContent).toBe('De statistics bridge is offline');
    expect(screen.queryByRole('region', {name: 'Verloop'})).toBeNull();
  });
});
