import {describe, expect, it} from 'vitest';
import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import StatisticsPage from './StatisticsPage';
import {jsonResponse, mockApi, renderPage} from '../test/organizations';

const stats = (goals: number, attempts: number) => ({goals, attempts});
const player = (name: string, afstand = stats(3, 7)) => ({
  name, afstand, doorloop: stats(0, 1), kortSchot: stats(0, 0), vrijeBal: stats(0, 0), strafworp: stats(1, 1), totaal: stats(4, 9),
  rebound: {won: 1, total: 2}, aangeef: 2,
});
const pcts = {afstand: 42.9, doorloop: 0, kortSchot: null, vrijeBal: null, strafworp: 100, totaal: 44.4, rebound: 50, aangeef: null};
const team = (name: string, score: number, playerName: string) => ({
  name, score, substitutions: 3,
  vakken: [{balls: 44, possessionTime: '14:05', players: [player(playerName)], total: player('VAKTOTAAL', stats(10, 67)), percentages: pcts}],
  teamTotal: player('TEAM TOTAAL', stats(19, 101)), teamPercentages: pcts,
});

const BRIDGE_UP = {bridge: {ok: true, ms: 3}, team: null, host: '10.12.0.63', network: {ok: true, ms: 4}, database: {ok: true, ms: 9}, page: {ok: true, ms: 40}};
/** The bridge answers online unless the test says otherwise */
const api = (handler: (call: {path: string}) => unknown, status: unknown = BRIDGE_UP) =>
  mockApi((call) => (call.path === '/api/stats/status' ? status : handler(call)));

const LIVE = {home: team('A', 1, 'x'), away: team('B', 2, 'y'), clock: null};

const matchPlayers = (extra: object) => ({
  readAt: '2026-10-31T20:03:00.000Z', team: null, teams: {own: 'Fortuna/Ruitenheer', opponent: 'KZ/Keukensale.com'}, players: [
    {team: 'home', teamName: 'Fortuna/Ruitenheer', name: 'Roos van Groen', afstand: '3/7', doorloop: '0/1', kortSchot: '0/0', vrijeBal: '0/0', strafworp: '0/0', totaal: '3/8', percentage: 37.5, rebound: '1/1', aangeef: 0},
    {team: 'away', teamName: 'KZ/Keukensale.com', name: 'Zoë Engel', afstand: '1/13', doorloop: '0/0', kortSchot: '0/0', vrijeBal: '0/0', strafworp: '1/1', totaal: '2/14', percentage: 14.3, rebound: '0/1', aangeef: 1},
  ], ...extra,
});

async function openMatch(table: string) {
  fireEvent.click(screen.getByRole('tab', {name: 'Wedstrijd uit database'}));
  const select = await screen.findByLabelText('Wedstrijd');
  await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(2));
  fireEvent.change(select, {target: {value: table}});
}

describe('StatisticsPage', () => {
  it('shows the bridge online and, through it, the network, the database and the page', async () => {
    api(() => LIVE, {...BRIDGE_UP, database: {ok: false, ms: null}, page: null});
    renderPage(<StatisticsPage/>);
    expect(await screen.findByText('Statistics bridge: online (3 ms)')).toBeTruthy();
    expect(screen.getByText('Netwerk (10.12.0.63): bereikbaar (4 ms)')).toBeTruthy();
    expect(screen.getByText('Database op de share: niet bereikbaar')).toBeTruthy();
    expect(screen.queryByText(/Statistiekenpagina:/)).toBeNull();
  });

  it('says the database is switched off on the bridge', async () => {
    api(() => LIVE, {...BRIDGE_UP, network: null, database: 'disabled'});
    renderPage(<StatisticsPage/>);
    expect(await screen.findByText(/Database: uitgeschakeld op de bridge/)).toBeTruthy();
  });

  it('shows "De statistics bridge is offline" instead of the tables when the bridge is offline', async () => {
    api(() => ({}), {bridge: {ok: false, ms: null}});
    renderPage(<StatisticsPage/>);
    expect((await screen.findByRole('alert')).textContent).toBe('De statistics bridge is offline');
    expect(screen.getByText('Statistics bridge: offline')).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByText(/Stand:/)).toBeNull();
  });

  it('shows score, clock and the vak tables of both teams, in a scroll container', async () => {
    api(({path}) => path === '/api/stats/live'
      ? {title: 'x', date: '2026-10-31', clock: '00:55:11', home: team('Fortuna/Ruitenheer', 27, 'Roos van Groen'), away: team('KZ/Keukensale.com', 14, 'Zoë Engel')}
      : {});
    renderPage(<StatisticsPage/>);
    expect(await screen.findByText('Stand: 27 - 14')).toBeTruthy();
    expect(screen.getByText('Bron: live pagina')).toBeTruthy();
    expect(screen.getByText('Tijd: 00:55:11')).toBeTruthy();
    const home = screen.getByRole('region', {name: 'Fortuna/Ruitenheer'});
    expect(within(home).getByText('Roos van Groen')).toBeTruthy();
    expect(within(home).getByText('3/7')).toBeTruthy();
    expect(within(home).getByText('Vaktotaal')).toBeTruthy();
    expect(within(home).getByText('Teamtotaal')).toBeTruthy();
    expect(within(home).getByText(/Ballen: 44/)).toBeTruthy();
    expect(home.querySelector('.overflow-x-auto table')).not.toBeNull();
    expect(screen.getByRole('region', {name: 'KZ/Keukensale.com'})).toBeTruthy();
  });

  it('shows the API message when statistics are not set up', async () => {
    api(() => jsonResponse({error: 'Statistieken zijn niet ingesteld'}, 409));
    renderPage(<StatisticsPage/>);
    expect((await screen.findByText(/niet ingesteld/)).textContent).toMatch(/niet ingesteld/);
  });

  it('shows a match from the database with its source and team', async () => {
    api(({path}) => {
      if (path === '/api/stats/live') return {home: team('A', 1, 'x'), away: team('B', 2, 'y'), clock: null};
      if (path === '/api/stats/matches') return [{table: 'Fortuna Koog Zaandijk_31_10_2026', home: 'Fortuna', away: 'Koog Zaandijk', date: '2026-10-31'}];
      return matchPlayers({source: 'copy', team: {value: '2', from: 'production'}});
    });
    renderPage(<StatisticsPage/>);
    await openMatch('Fortuna Koog Zaandijk_31_10_2026');
    expect(await screen.findByText('Zoë Engel')).toBeTruthy();
    expect(screen.getByText('1/13')).toBeTruthy();
    expect(screen.getByText('37,5%')).toBeTruthy();
    expect(screen.getByText(/Bron: lokale kopie van 21:03/)).toBeTruthy();
    expect(screen.getByText(/Team 2 \(actieve productie\)/)).toBeTruthy();
  });

  it.each([
    ['disabled', 'Bron: live pagina (database uit)'],
    ['unreachable', 'Bron: live pagina (database niet bereikbaar)'],
  ])('shows the live page as the source when the database is %s', async (database, label) => {
    api(({path}) => {
      if (path === '/api/stats/live') return {home: team('A', 1, 'x'), away: team('B', 2, 'y'), clock: null};
      if (path === '/api/stats/matches') return [{table: 'live', home: 'Fortuna/Ruitenheer', away: 'KZ/Keukensale.com', date: '2026-10-31', source: 'page'}];
      return matchPlayers({source: 'page', database});
    });
    renderPage(<StatisticsPage/>);
    await openMatch('live');
    expect(await screen.findByText(label)).toBeTruthy();
    expect(screen.getByText('Roos van Groen')).toBeTruthy();
  });

  const teamRow = (team: 'home' | 'away', extra: object) => ({
    team, teamName: team === 'home' ? 'Fortuna/Ruitenheer' : 'KZ/Keukensale.com', goals: 27, attempts: 75, goalPct: 36,
    reboundWon: 12, reboundTotal: 16, reboundPct: 75, strafworpGoals: 1, strafworpAttempts: 2, strafworpPct: 50,
    vrijeBalGoals: 0, vrijeBalAttempts: 0, vrijeBalPct: null, afstandGoals: 19, afstandAttempts: 101, afstandPct: 18.8,
    kortSchotGoals: 2, kortSchotAttempts: 6, kortSchotPct: 33.3, doorloopGoals: 2, doorloopAttempts: 9, doorloopPct: 22.2,
    goalsDames: 7, goalsHeren: 20, goalsDamesPct: 25.9, goalsRatio: '7:20',
    attacks: 73, attackGoals: 27, turnovers: 46, turnoversWithoutAttempt: 7, avgAttemptsPerAttack: 1.66, attackGoalPct: 37,
    source: 'share', readAt: '2026-10-31T20:03:00.000Z', ...extra,
  });

  it('shows the team statistics of both teams side by side', async () => {
    api(({path}) => path === '/api/stats/team-stats' ? [teamRow('home', {}), teamRow('away', {goalsRatio: null, goalsDames: null, goalsDamesPct: null, attacks: null, vrijeBalPct: null})] : LIVE);
    renderPage(<StatisticsPage/>);
    fireEvent.click(screen.getByRole('tab', {name: 'Teamstatistieken'}));
    const table = await screen.findByRole('table', {name: 'Statistieken per team'});
    expect(within(table).getByText('Doelpunten / pogingen')).toBeTruthy();
    expect(within(table).getAllByText('27/75 (36%)')).toHaveLength(2);
    expect(within(table).getAllByText('12/16 (75%)').length).toBe(2);
    expect(within(table).getAllByText('19/101 (18,8%)').length).toBe(2);
    expect(within(table).getByText('7:20 (25,9% dames)')).toBeTruthy();
    expect(within(table).getAllByText('Vrije ballen').length).toBe(1);
    expect(within(table).getAllByText('–').length).toBeGreaterThan(2);
    expect(within(table).getAllByText('1,66').length).toBeGreaterThan(0);
    expect(table.closest('.overflow-x-auto')).not.toBeNull();
    expect(screen.getByText('Bron: share')).toBeTruthy();
  });

  it('shows the top scorers of both teams next to each other, most goals first', async () => {
    const scorer = (team: 'home' | 'away', rank: number, name: string, goals: number, attempts: number) =>
      ({team, teamName: team === 'home' ? 'Fortuna/Ruitenheer' : 'KZ/Keukensale.com', rank, name, sex: null, goals, attempts, goalPct: Math.round((goals / attempts) * 1000) / 10, source: 'page', database: 'disabled', readAt: '2026-10-31T20:03:00.000Z'});
    api(({path}) => path === '/api/stats/top-scorers'
      ? [scorer('home', 1, 'Nik van der Steen', 6, 32), scorer('home', 2, 'Renée van Ginkel', 2, 5), scorer('away', 1, 'Isa Dik', 2, 18)]
      : LIVE);
    renderPage(<StatisticsPage/>);
    fireEvent.click(screen.getByRole('tab', {name: 'Topscorers'}));
    const home = await screen.findByRole('region', {name: 'Fortuna/Ruitenheer'});
    const away = screen.getByRole('region', {name: 'KZ/Keukensale.com'});
    const names = within(home).getAllByRole('listitem').map((li) => li.textContent);
    expect(names[0]).toContain('Nik van der Steen');
    expect(names[0]).toContain('6/32 (18,8%)');
    expect(names[1]).toContain('Renée van Ginkel');
    expect(within(away).getByText('Isa Dik')).toBeTruthy();
    expect(screen.getByText('Bron: live pagina (database uit)')).toBeTruthy();
  });
});
