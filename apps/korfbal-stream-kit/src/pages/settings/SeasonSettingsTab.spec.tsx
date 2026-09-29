import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {vi} from 'vitest';
import SeasonSettingsTab from './SeasonSettingsTab';

type Season = {
  id: number; startYear: number; name: string; startDate: string; endDate: string;
  isActive: boolean; matchCount: number; playerCount: number; createdAt: string;
};

const mk = (id: number, startYear: number, over: Partial<Season> = {}): Season => ({
  id, startYear, name: `${startYear}/${startYear + 1}`,
  startDate: `${startYear}-06-30T22:00:00.000Z`, endDate: `${startYear + 1}-06-30T21:59:59.999Z`,
  isActive: false, matchCount: 0, playerCount: 0, createdAt: '2025-07-01T00:00:00.000Z',
  ...over,
});

const json = (data: unknown, status = 200) => Promise.resolve({
  ok: status < 400, status,
  headers: new Headers({'content-type': 'application/json'}),
  json: async () => data,
});

describe('SeasonSettingsTab', () => {
  let seasons: Season[];
  let calls: { url: string; method: string; body?: Record<string, unknown> }[];

  beforeEach(() => {
    seasons = [
      mk(3, 2027),                                              // empty, not active → deletable
      mk(2, 2026, {matchCount: 4}),                             // non-empty → not deletable
      mk(1, 2025, {isActive: true, matchCount: 12, playerCount: 80}), // active
    ];
    calls = [];
    global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({url, method, body});
      const path = new URL(url, 'http://localhost').pathname;

      if (path === '/api/seasons' && method === 'GET') return json(seasons);
      if (path === '/api/seasons/suggest-next') return json({startYear: 2028, name: '2028/2029'});
      if (path === '/api/seasons/active' && method === 'PUT') {
        seasons = seasons.map(s => ({...s, isActive: s.id === body.seasonId}));
        return json(seasons.find(s => s.id === body.seasonId));
      }
      if (path === '/api/seasons' && method === 'POST') {
        const startYear = Number(body.name.slice(0, 4));
        const created = mk(10, startYear, {isActive: !!body.activate});
        if (body.activate) seasons = seasons.map(s => ({...s, isActive: false}));
        seasons = [created, ...seasons];
        return json(created, 201);
      }
      if (path.startsWith('/api/seasons/') && method === 'DELETE') {
        const id = Number(path.split('/').pop());
        seasons = seasons.filter(s => s.id !== id);
        return Promise.resolve({ok: true, status: 204});
      }
      if (path === '/api/match/matches/schedule/import' && method === 'POST') {
        return json({ok: true, inserted: 7, updated: 2, total: 9, bySeason: [
          {seasonId: 10, name: '2028/2029', count: 6},
          {seasonId: 1, name: '2025/2026', count: 3},
        ]});
      }
      if (path === '/api/clubs/import/league-teams' && method === 'POST') {
        return json({ok: true, clubsCreated: 1, clubsUpdated: 5, playersCreated: 40, playersUpdated: 3, problems: []});
      }
      return json({error: 'not found'}, 404);
    }) as unknown as typeof fetch;
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  const renderComponent = () => {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
    return render(
      <QueryClientProvider client={queryClient}>
        <SeasonSettingsTab />
      </QueryClientProvider>
    );
  };

  it('lists seasons with counts and marks the active one', async () => {
    renderComponent();
    const activeRow = await screen.findByTestId('season-row-1');
    expect(within(activeRow).getByText('2025/2026')).toBeInTheDocument();
    expect(within(activeRow).getByText('Actief')).toBeInTheDocument();
    expect(within(activeRow).getByText('12')).toBeInTheDocument();
    expect(within(activeRow).getByText('80')).toBeInTheDocument();
    expect(screen.getByTestId('season-row-2')).toBeInTheDocument();
    expect(screen.getByTestId('season-row-3')).toBeInTheDocument();
    expect(screen.getByLabelText('Seizoen')).toHaveValue('1');
  });

  it('changes the active season', async () => {
    renderComponent();
    const select = await screen.findByLabelText('Seizoen');
    const save = screen.getByRole('button', {name: /actief seizoen opslaan/i});
    expect(save).toBeDisabled(); // nothing changed yet

    fireEvent.change(select, {target: {value: '2'}});
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await screen.findByText(/seizoen 2026\/2027 is nu actief/i);
    const put = calls.find(c => c.url.includes('/api/seasons/active') && c.method === 'PUT');
    expect(put?.body).toEqual({seasonId: 2});
    await waitFor(() => expect(within(screen.getByTestId('season-row-2')).getByText('Actief')).toBeInTheDocument());
  });

  it('prefills the new season name from suggest-next', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByLabelText('Naam')).toHaveValue('2028/2029'));
  });

  it('shows a validation error for bad names and does not POST', async () => {
    renderComponent();
    const input = await screen.findByLabelText('Naam');

    fireEvent.change(input, {target: {value: '2028-2029'}});
    expect(screen.getByRole('alert')).toHaveTextContent(/formaat/i);

    fireEvent.change(input, {target: {value: '2028/2030'}});
    expect(screen.getByRole('alert')).toHaveTextContent(/2029/);

    fireEvent.click(screen.getByRole('button', {name: /seizoen aanmaken/i}));
    await new Promise(r => setTimeout(r, 0));
    expect(calls.some(c => c.url.includes('/api/seasons') && c.method === 'POST')).toBe(false);
  });

  it('always shows the "Seizoen vullen" section for the active season with both imports', async () => {
    renderComponent();
    const fill = await screen.findByTestId('fill-season');
    expect(within(fill).getByRole('heading', {name: 'Seizoen vullen'})).toBeInTheDocument();
    expect(fill).toHaveTextContent('2025/2026');
    expect(fill).toHaveTextContent('12 wedstrijden, 80 spelers');
    expect(within(fill).queryByText(/gestart/i)).not.toBeInTheDocument();

    fireEvent.click(within(fill).getByRole('button', {name: /teams\/spelers importeren/i}));
    await within(fill).findByText(/Spelers: 40 nieuw, 3 bijgewerkt/);
    const league = calls.find(c => c.url.includes('/api/clubs/import/league-teams'));
    expect(league?.body).toMatchObject({seasonId: 1});
  });

  it('shows match import results per season', async () => {
    renderComponent();
    const fill = await screen.findByTestId('fill-season');
    fireEvent.click(within(fill).getByRole('button', {name: /wedstrijden importeren/i}));
    await within(fill).findByText('6 wedstrijden in 2028/2029, 3 in 2025/2026 (7 nieuw, 2 bijgewerkt)');
    expect(calls.some(c => c.url.includes('/api/match/matches/schedule/import') && c.method === 'POST')).toBe(true);
  });

  it('follows the active season after switching and drops results of the previous one', async () => {
    renderComponent();
    const fill = await screen.findByTestId('fill-season');
    fireEvent.click(within(fill).getByRole('button', {name: /teams\/spelers importeren/i}));
    await within(fill).findByText(/Spelers: 40 nieuw/);

    fireEvent.change(screen.getByLabelText('Seizoen'), {target: {value: '2'}});
    fireEvent.click(screen.getByRole('button', {name: /actief seizoen opslaan/i}));

    await waitFor(() => expect(screen.getByTestId('fill-season')).toHaveTextContent('2026/2027'));
    expect(screen.queryByText(/Spelers: 40 nieuw/)).not.toBeInTheDocument();
  });

  it('hints that the match program only imports ~20 weeks ahead when the active season has not started', async () => {
    seasons = [mk(5, 2099, {isActive: true})];
    renderComponent();
    const hint = await screen.findByTestId('season-not-started-hint');
    expect(hint).toHaveTextContent(/20 weken vooruit/);
  });

  it('shows no not-started hint for a running season', async () => {
    renderComponent();
    await screen.findByTestId('fill-season');
    expect(screen.queryByTestId('season-not-started-hint')).not.toBeInTheDocument();
  });

  it('creates a season (direct activeren) and highlights the fill section for it', async () => {
    renderComponent();
    const input = await screen.findByLabelText('Naam');
    await waitFor(() => expect(input).toHaveValue('2028/2029'));
    expect(screen.getByLabelText(/direct activeren/i)).toBeChecked();

    fireEvent.click(screen.getByRole('button', {name: /seizoen aanmaken/i}));

    await screen.findByText(/seizoen 2028\/2029 gestart/i);
    const fill = screen.getByTestId('fill-season');
    expect(fill).toHaveTextContent(/seizoen 2028\/2029 gestart/i);
    expect(screen.getAllByTestId('fill-season')).toHaveLength(1);
    const post = calls.find(c => c.url.includes('/api/seasons') && c.method === 'POST');
    expect(post?.body).toEqual({name: '2028/2029', activate: true});

    fireEvent.click(within(fill).getByRole('button', {name: /teams\/spelers importeren/i}));
    await within(fill).findByText(/Spelers: 40 nieuw, 3 bijgewerkt/);
    const league = calls.find(c => c.url.includes('/api/clubs/import/league-teams'));
    expect(league?.body).toMatchObject({seasonId: 10});
  });

  it('creates a season without activating it and keeps filling the active season', async () => {
    renderComponent();
    const input = await screen.findByLabelText('Naam');
    fireEvent.change(input, {target: {value: '2030/2031'}});
    fireEvent.click(screen.getByLabelText(/direct activeren/i));
    fireEvent.click(screen.getByRole('button', {name: /seizoen aanmaken/i}));

    await screen.findByText(/seizoen 2030\/2031 aangemaakt/i);
    expect(screen.getByText(/nog niet actief/i)).toBeInTheDocument();
    const post = calls.find(c => c.url.includes('/api/seasons') && c.method === 'POST');
    expect(post?.body).toEqual({name: '2030/2031', activate: false});
    await waitFor(() => expect(screen.getByTestId('season-row-10')).toBeInTheDocument());
    expect(screen.getByTestId('fill-season')).toHaveTextContent('2025/2026');
    expect(screen.queryByText(/gestart/i)).not.toBeInTheDocument();
  });

  it('disables delete for the active season and for non-empty seasons', async () => {
    renderComponent();
    await screen.findByTestId('season-row-1');
    expect(screen.getByRole('button', {name: 'Verwijder seizoen 2025/2026'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Verwijder seizoen 2026/2027'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Verwijder seizoen 2027/2028'})).toBeEnabled();
  });

  it('deletes an empty, non-active season', async () => {
    renderComponent();
    fireEvent.click(await screen.findByRole('button', {name: 'Verwijder seizoen 2027/2028'}));
    await waitFor(() => expect(screen.queryByTestId('season-row-3')).not.toBeInTheDocument());
    expect(calls.some(c => c.url.includes('/api/seasons/3') && c.method === 'DELETE')).toBe(true);
  });
});
