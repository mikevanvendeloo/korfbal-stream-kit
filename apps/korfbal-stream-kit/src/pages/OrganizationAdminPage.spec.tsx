import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import OrganizationAdminPage from './OrganizationAdminPage';
import VmixDatasourcesPage from './VmixDatasourcesPage';
import {OrganizationGate} from '../components/OrganizationGate';
import {ApiCall, chooseOrganization, FORTUNA, jsonResponse, mockApi, renderPage} from '../test/organizations';

vi.mock('../lib/socket', () => ({reconnectSharedSocket: vi.fn()}));

const KEY = 'sk_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
const storedKey = {id: 1, name: 'vMix stream-pc', prefix: 'sk_Xy12', createdAt: '2026-10-01T10:00:00.000Z', lastUsedAt: null, revokedAt: null};
const endpoints = {
  hostIp: '192.168.1.10', keyPlaceholder: '<jouw-sleutel>',
  endpoints: [
    {name: 'Sponsor Names (Ticker)', url: 'http://192.168.1.10:3333/api/vmix/sponsor-names?key=<jouw-sleutel>', description: 'Ticker'},
    {name: 'Callsheet Timing (Presentatie)', url: 'http://192.168.1.10:3333/api/vmix/callsheet/timing?position=Presentatie&key=<jouw-sleutel>', description: 'Timing'},
  ],
};

let source = {provider: 'vrijwilligers', baseUrl: 'https://api.example.nl/v1', isEnabled: true, hasApiToken: true, configured: true, updatedAt: '2026-10-01T10:00:00.000Z'};
let testAnswer: Response | {ok: true; matches: number} = {ok: true, matches: 12};

function api() {
  return mockApi(({method, path, body}: ApiCall) => {
    if (path === '/api/organizations') return [FORTUNA];
    if (path === '/api/match-source' && method === 'GET') return source;
    if (path === '/api/match-source' && method === 'PUT') {
      const input = body as {provider: string; baseUrl: string; apiToken?: string | null};
      const sameOrigin = new URL(input.baseUrl).origin === new URL(source.baseUrl).origin;
      source = {...source, ...input, hasApiToken: input.apiToken === null ? false : input.apiToken ? true : source.hasApiToken && sameOrigin, updatedAt: new Date().toISOString()};
      return source;
    }
    if (path === '/api/match-source/test') return testAnswer;
    if (path === '/api/organization/api-keys' && method === 'GET') return [storedKey];
    if (path === '/api/organization/api-keys' && method === 'POST') return jsonResponse({...storedKey, id: 2, name: (body as {name: string}).name, prefix: 'sk_abcd', key: KEY}, 201);
    if (path.startsWith('/api/organization/api-keys/') && method === 'DELETE') return {...storedKey, revokedAt: new Date().toISOString()};
    if (path === '/api/vmix/endpoints') return endpoints;
    return [];
  });
}

const renderInOrganization = (ui: React.ReactElement) => renderPage(<OrganizationGate>{ui}</OrganizationGate>);

describe('OrganizationAdminPage', () => {
  beforeEach(() => {
    chooseOrganization(FORTUNA.slug);
    source = {provider: 'vrijwilligers', baseUrl: 'https://api.example.nl/v1', isEnabled: true, hasApiToken: true, configured: true, updatedAt: '2026-10-01T10:00:00.000Z'};
    testAnswer = {ok: true, matches: 12};
    Object.assign(navigator, {clipboard: {writeText: vi.fn().mockResolvedValue(undefined)}});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    chooseOrganization(null);
  });

  it('shows whether a token is set, never the token itself', async () => {
    api();
    renderInOrganization(<OrganizationAdminPage/>);
    expect(await screen.findByRole('heading', {name: 'Organisatie: Fortuna'})).toBeInTheDocument();
    expect(await screen.findByTestId('match-source-token-status')).toHaveTextContent('Token: ingesteld');
    expect(screen.getByLabelText('Token')).toHaveValue('');
    expect(screen.getByLabelText('Token')).toHaveAttribute('type', 'password');
    expect(screen.getByText(/Wijzig je de bron of het adres, dan wordt het opgeslagen token gewist/)).toBeInTheDocument();
  });

  it('keeps the token when the field stays empty, and says so when a new address cleared it', async () => {
    const {calls} = api();
    renderInOrganization(<OrganizationAdminPage/>);
    const url = await screen.findByLabelText('Adres (URL)');
    fireEvent.change(url, {target: {value: 'https://elders.example.nl/v1'}});
    fireEvent.click(screen.getByRole('button', {name: 'Opslaan'}));
    expect(await screen.findByRole('status')).toHaveTextContent('Het token is gewist');
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.body).toEqual({provider: 'vrijwilligers', baseUrl: 'https://elders.example.nl/v1', isEnabled: true});
    expect(screen.getByTestId('match-source-token-status')).toHaveTextContent('Token: niet ingesteld');
  });

  it('sends a new token and tests the connection', async () => {
    const {calls} = api();
    renderInOrganization(<OrganizationAdminPage/>);
    fireEvent.change(await screen.findByLabelText('Token'), {target: {value: 'geheim'}});
    // The test uses the stored settings: save first
    expect(screen.getByRole('button', {name: 'Test verbinding'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name: 'Opslaan'}));
    await screen.findByText('Wedstrijdimport opgeslagen.');
    expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({apiToken: 'geheim'});
    expect(screen.getByLabelText('Token')).toHaveValue('');

    fireEvent.click(screen.getByRole('button', {name: 'Test verbinding'}));
    expect(await screen.findByText('Verbinding gelukt (12 wedstrijden).')).toBeInTheDocument();

    testAnswer = jsonResponse({ok: false, error: 'De wedstrijdbron is niet bereikbaar', code: 'SOURCE_UNREACHABLE', hint: 'Controleer het Adres (URL).'}, 502);
    fireEvent.click(screen.getByRole('button', {name: 'Test verbinding'}));
    expect(await screen.findByText('De wedstrijdbron is niet bereikbaar')).toBeInTheDocument();
  });

  it('shows the category of a failed connection test with its hint', async () => {
    api();
    testAnswer = jsonResponse({ok: false, error: 'Token ongeldig of verlopen', code: 'SOURCE_UNAUTHORIZED', hint: 'Vul een nieuw token in en sla op.'}, 502);
    renderInOrganization(<OrganizationAdminPage/>);
    fireEvent.click(await screen.findByRole('button', {name: 'Test verbinding'}));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Token ongeldig of verlopen');
    expect(screen.getByTestId('match-source-hint')).toHaveTextContent('Vul een nieuw token in en sla op.');
  });

  it('says "1 wedstrijd" for a single match', async () => {
    api();
    testAnswer = {ok: true, matches: 1};
    renderInOrganization(<OrganizationAdminPage/>);
    fireEvent.click(await screen.findByRole('button', {name: 'Test verbinding'}));
    expect(await screen.findByText('Verbinding gelukt (1 wedstrijd).')).toBeInTheDocument();
  });

  it('lists the API keys by name and prefix, and revokes one after a confirm', async () => {
    const {calls} = api();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderInOrganization(<OrganizationAdminPage/>);
    const table = await screen.findByRole('table', {name: 'API-sleutels'});
    const row = within(table).getByText('vMix stream-pc').closest('tr') as HTMLElement;
    expect(row).toHaveTextContent('sk_Xy12…');
    expect(row).toHaveTextContent('Nooit');
    fireEvent.click(within(row).getByRole('button', {name: 'Sleutel vMix stream-pc intrekken'}));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/api/organization/api-keys/1')).toBe(true));
  });

  it('shows a new key once, with a copy button and the feed URLs filled in', async () => {
    const {calls} = api();
    renderInOrganization(<OrganizationAdminPage/>);
    fireEvent.change(await screen.findByLabelText('Naam van de sleutel'), {target: {value: 'vMix scherm-pc'}});
    fireEvent.click(screen.getByRole('button', {name: 'Sleutel aanmaken'}));

    const dialog = await screen.findByRole('dialog', {name: 'API-sleutel vMix scherm-pc aangemaakt'});
    expect(within(dialog).getByText(/Je ziet deze sleutel alleen nu/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Nieuwe API-sleutel')).toHaveTextContent(KEY);
    fireEvent.click(within(dialog).getByRole('button', {name: 'Kopieer sleutel'}));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(KEY);
    expect(await within(dialog).findByText(`http://192.168.1.10:3333/api/vmix/callsheet/timing?position=Presentatie&key=${KEY}`)).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({name: 'vMix scherm-pc'});

    fireEvent.click(within(dialog).getByRole('button', {name: 'Klaar'}));
    expect(screen.queryByText(KEY)).not.toBeInTheDocument();
  });
});

describe('VmixDatasourcesPage', () => {
  beforeEach(() => chooseOrganization(FORTUNA.slug));
  afterEach(() => chooseOrganization(null));

  it('shows the feed URLs with the key placeholder, and filled in right after creating a key', async () => {
    api();
    renderInOrganization(<VmixDatasourcesPage/>);
    const urls = async () => (await screen.findAllByTestId('datasource-url')).map((el) => el.textContent);
    expect(await urls()).toEqual([endpoints.endpoints[0].url, endpoints.endpoints[1].url]);

    fireEvent.change(screen.getByLabelText('Naam van de sleutel'), {target: {value: 'vMix stream-pc'}});
    fireEvent.click(screen.getByRole('button', {name: 'Sleutel aanmaken'}));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', {name: 'Klaar'}));

    await waitFor(async () => expect((await urls())[0]).toBe(`http://192.168.1.10:3333/api/vmix/sponsor-names?key=${KEY}`));
    expect(screen.getByRole('status')).toHaveTextContent('De adressen hieronder bevatten de nieuwe sleutel vMix stream-pc');
  });
});
