import {describe, expect, it} from 'vitest';
import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import StatisticsPage from './StatisticsPage';
import {mockApi, renderPage} from '../test/organizations';

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

describe('StatisticsPage', () => {
  it('shows score, clock and the vak tables of both teams, in a scroll container', async () => {
    mockApi(({path}) => path === '/api/stats/live'
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
    mockApi(() => ({status: 409, ok: false, headers: new Headers({'content-type': 'application/json'}), json: async () => ({error: 'Statistieken zijn niet ingesteld'}), clone() { return this; }}));
    renderPage(<StatisticsPage/>);
    expect((await screen.findByRole('alert')).textContent).toMatch(/niet ingesteld/);
  });

  it('shows a match from the database', async () => {
    mockApi(({path}) => {
      if (path === '/api/stats/live') return {home: team('A', 1, 'x'), away: team('B', 2, 'y'), clock: null};
      if (path === '/api/stats/matches') return [{table: 'Fortuna Koog Zaandijk_31_10_2026', home: 'Fortuna', away: 'Koog Zaandijk', date: '2026-10-31'}];
      return {source: 'copy', readAt: '2026-10-31T20:03:00.000Z', teams: {own: 'Fortuna/Ruitenheer', opponent: 'KZ/Keukensale.com'}, players: [
        {team: 'home', teamName: 'Fortuna/Ruitenheer', name: 'Roos van Groen', afstand: '3/7', doorloop: '0/1', kortSchot: '0/0', vrijeBal: '0/0', strafworp: '0/0', totaal: '3/8', percentage: 37.5, rebound: '1/1', aangeef: 0},
        {team: 'away', teamName: 'KZ/Keukensale.com', name: 'Zoë Engel', afstand: '1/13', doorloop: '0/0', kortSchot: '0/0', vrijeBal: '0/0', strafworp: '1/1', totaal: '2/14', percentage: 14.3, rebound: '0/1', aangeef: 1},
      ]};
    });
    renderPage(<StatisticsPage/>);
    fireEvent.click(screen.getByRole('tab', {name: 'Wedstrijd uit database'}));
    const select = await screen.findByLabelText('Wedstrijd');
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(2));
    fireEvent.change(select, {target: {value: 'Fortuna Koog Zaandijk_31_10_2026'}});
    expect(await screen.findByText('Zoë Engel')).toBeTruthy();
    expect(screen.getByText('1/13')).toBeTruthy();
    expect(screen.getByText('37,5%')).toBeTruthy();
    expect(screen.getByText(/Bron: lokale kopie van 21:03/)).toBeTruthy();
  });
});
