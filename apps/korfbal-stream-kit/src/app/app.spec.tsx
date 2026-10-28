import {fireEvent, render, screen, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {vi} from 'vitest';

import App from './app';
import {chooseOrganization, FORTUNA, jsonResponse, KNKV} from '../test/organizations';

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({on: vi.fn(), off: vi.fn(), disconnect: vi.fn()})),
}));

const activeSeason = {
  id: 2, startYear: 2026, name: '2026/2027',
  startDate: '2026-06-30T22:00:00.000Z', endDate: '2027-06-30T21:59:59.999Z',
  isActive: true, matchCount: 0, playerCount: 0, createdAt: '2026-07-01T00:00:00.000Z',
};

// Beheer is lazy loaded: the first test that opens it also waits for the import
const LAZY = {timeout: 5000};

function renderApp(path = '/') {
  const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('App', () => {
  beforeEach(() => {
    chooseOrganization(FORTUNA.slug);
    global.fetch = vi.fn((url: RequestInfo | URL) => {
      if (url.toString().endsWith('/api/organizations')) return Promise.resolve(jsonResponse([FORTUNA, KNKV]));
      if (url.toString().includes('/api/seasons/active')) {
        return Promise.resolve({ok: true, json: async () => activeSeason} as Response);
      }
      return Promise.resolve({ok: false, status: 404, json: async () => ({})} as Response);
    }) as unknown as typeof fetch;
  });

  it('should render successfully', () => {
    const { baseElement } = renderApp();
    expect(baseElement).toBeTruthy();
  });

  it('shows the LIVE app on the root; Beheer only through the gear and the organization menu', async () => {
    renderApp('/');
    expect(screen.getAllByText('LIVE').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', {name: 'Scoreboard'})).toHaveAttribute('href', '/scoreboard');
    expect(screen.getByRole('link', {name: 'Callsheet'})).toHaveAttribute('href', '/callsheet');
    expect(screen.queryByRole('link', {name: 'Show Caller'})).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Sponsors'})).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Beheer'})).toHaveAttribute('href', '/admin');
    // The organization menu as in Beheer: its settings and switching
    const organization = within((await screen.findByLabelText('Organisatiemenu (nu Fortuna)')).closest('details') as HTMLElement);
    expect(organization.getByRole('link', {name: 'Organisatie-instellingen'})).toHaveAttribute('href', '/admin/setup/organisatie');
    expect(organization.getByRole('button', {name: 'Wissel organisatie (nu Fortuna)'})).toBeInTheDocument();
    expect(Array.from(document.querySelectorAll('a[href^="/admin"]')).map((a) => a.getAttribute('href')))
      .toEqual(['/admin/setup/organisatie', '/admin']);
  });

  it('serves the LIVE manual in LIVE and the Beheer manual under /admin', async () => {
    const {unmount} = renderApp('/handleiding/show-caller');
    expect(screen.getByRole('heading', {level: 1, name: /Handleiding LIVE/})).toBeInTheDocument();
    expect(screen.getByRole('heading', {level: 1, name: 'De Show Caller'})).toBeInTheDocument();
    unmount();

    renderApp('/admin/handleiding/producties');
    expect(await screen.findByRole('heading', {level: 1, name: /Handleiding Beheer/}, LAZY)).toBeInTheDocument();
    expect(screen.getByRole('heading', {level: 1, name: 'Producties'})).toBeInTheDocument();
    // The help button on a Beheer screen leads to the Beheer manual
    expect(screen.getByRole('link', {name: 'Handleiding bij dit scherm'})).toHaveAttribute('href', '/admin/handleiding');
  });

  it('shows the Beheer app under /admin with Sponsors link', async () => {
    renderApp('/admin');
    expect(await screen.findByText('Korfbal Streamz Kit', {}, LAZY)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Sponsors' })[0]).toHaveAttribute('href', '/admin/stamgegevens/sponsors');
  });

  it('shows the active season badge linking to settings', async () => {
    renderApp('/admin');
    const badge = await screen.findByRole('link', {name: 'Seizoen 2026/2027'}, LAZY);
    expect(badge).toHaveAttribute('href', '/admin/instellingen');
  });

  it('folds the LIVE menu behind a button on small screens', () => {
    renderApp('/scoreboard');
    expect(screen.queryByRole('navigation', {name: 'LIVE'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Menu openen'}));
    const menu = screen.getByRole('navigation', {name: 'LIVE'});
    expect(within(menu).getByRole('link', {name: 'Callsheet'})).toHaveAttribute('href', '/callsheet');
    expect(within(menu).getByRole('link', {name: /Beheer/})).toHaveAttribute('href', '/admin');
    // Choosing a screen closes the menu again
    fireEvent.click(within(menu).getByRole('link', {name: 'Callsheet'}));
    expect(screen.queryByRole('navigation', {name: 'LIVE'})).not.toBeInTheDocument();
  });

  it('shows the about page in LIVE', () => {
    renderApp('/');
    expect(screen.getByRole('link', {name: 'Over deze app'})).toHaveAttribute('href', '/over');
  });

  it('operates vMix from LIVE', async () => {
    renderApp('/vmix');
    expect(screen.getByRole('link', {name: 'vMix'})).toHaveAttribute('href', '/vmix');
    expect(await screen.findByRole('heading', {name: /^Countdown timer/})).toBeInTheDocument();
  });

  it('groups the Beheer menu by when you need it', async () => {
    renderApp('/admin');
    await screen.findByText('Korfbal Streamz Kit', {}, LAZY);
    for (const menu of ['Producties', 'Stamgegevens', 'Rapportages']) {
      expect(screen.getByText(menu, {selector: 'summary'})).toBeInTheDocument();
    }
    expect(screen.getByRole('link', {name: 'Personen'})).toHaveAttribute('href', '/admin/stamgegevens/personen');
    // Segment templates and the standard positions per segment are part of the draaiboek templates now (hoofdstukken)
    expect(screen.queryByRole('link', {name: 'Standaardbezetting per segment'})).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Segment-templates'})).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'QR-generator'})).toHaveAttribute('href', '/admin/tools/qr');
    expect(screen.getByRole('link', {name: 'Organisaties'})).toHaveAttribute('href', '/admin/setup/organisaties');
    expect(await screen.findByRole('link', {name: 'Organisatie-instellingen'})).toHaveAttribute('href', '/admin/setup/organisatie');
    expect(screen.getByRole('link', {name: 'Instellingen'})).toHaveAttribute('href', '/admin/instellingen');
    expect(screen.queryByRole('link', {name: /vMix control/})).not.toBeInTheDocument();
  });

  it('puts the chosen organization under its logo, and settings, organizations, theme, about and the tools in the gear menu', async () => {
    renderApp('/admin');
    const organization = within((await screen.findByLabelText('Organisatiemenu (nu Fortuna)', {}, LAZY)).closest('details') as HTMLElement);
    expect(organization.getByRole('link', {name: 'Organisatie-instellingen'})).toHaveAttribute('href', '/admin/setup/organisatie');
    expect(organization.getByRole('button', {name: 'Wissel organisatie (nu Fortuna)'})).toBeInTheDocument();

    const menu = within(screen.getByLabelText('Instellingen en tools').closest('details') as HTMLElement);
    expect(menu.getByRole('link', {name: 'Instellingen'})).toHaveAttribute('href', '/admin/instellingen');
    expect(menu.getByRole('link', {name: 'Organisaties'})).toHaveAttribute('href', '/admin/setup/organisaties');
    expect(menu.getByRole('link', {name: 'Over deze app'})).toHaveAttribute('href', '/admin/over');
    expect(menu.getByText('Tools')).toBeInTheDocument();
    expect(menu.getByRole('link', {name: 'QR-generator'})).toHaveAttribute('href', '/admin/tools/qr');
    const theme = menu.getByRole('button', {name: /modus$/});
    const before = theme.textContent;
    fireEvent.click(theme);
    expect(theme.textContent).not.toBe(before);
  });

  it('shows the tabs of a production, from draaiboek to rapport', async () => {
    renderApp('/admin/producties/5/bezetting');
    const tabs = await screen.findByRole('navigation', {name: 'Productie'}, LAZY);
    const hrefs = Array.from(tabs.querySelectorAll('a')).map((a) => [a.textContent, a.getAttribute('href')]);
    expect(hrefs).toEqual([
      ['Draaiboek', '/admin/producties/5'],
      ['Beschikbaarheid', '/admin/producties/5/beschikbaarheid'],
      ['Bezetting', '/admin/producties/5/bezetting'],
      ['vMix-titels', '/admin/producties/5/vmix-titels'],
      ['Rapport', '/admin/producties/5/rapport'],
    ]);
    expect(screen.getByRole('link', {name: 'Bezetting'})).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('navigation', {name: 'Rapport'})).not.toBeInTheDocument();
  });

  it('shows the report sub tabs under Rapport', async () => {
    renderApp('/admin/producties/5/rapport/crew');
    const sub = await screen.findByRole('navigation', {name: 'Rapport'}, LAZY);
    expect(sub).toHaveTextContent('ProductierapportCallsheetTijdsanalyse');
    expect(screen.getByRole('link', {name: 'Rapport'})).toHaveAttribute('aria-current', 'page');
  });

  it('opens a report by its URL', async () => {
    renderApp('/admin/rapportages');
    expect(await screen.findByRole('heading', {name: 'Rapportages'}, LAZY)).toBeInTheDocument();
    const tab = screen.getAllByRole('link', {name: 'Dagbezetting'}).find((a) => a.getAttribute('aria-current') === 'page');
    expect(tab).toHaveAttribute('href', '/admin/rapportages/dagbezetting');
  });

  it('no longer serves Beheer pages outside /admin', () => {
    renderApp('/sponsors');
    expect(screen.getByText('Pagina niet gevonden')).toBeInTheDocument();
  });

  it('shows the chosen organization in the LIVE and Beheer navs, and switches from there', async () => {
    const {unmount} = renderApp('/');
    expect(await screen.findByRole('button', {name: 'Wissel organisatie (nu Fortuna)'})).toBeInTheDocument();
    unmount();

    renderApp('/admin');
    fireEvent.click(await screen.findByRole('button', {name: 'Wissel organisatie (nu Fortuna)'}, LAZY));
    expect(screen.getByRole('heading', {name: 'Kies een organisatie'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: /KNKV/}));
    expect(await screen.findByRole('button', {name: 'Wissel organisatie (nu KNKV)'}, LAZY)).toBeInTheDocument();
    expect(window.localStorage.getItem('organization')).toBe('knkv');
  });

  it('shows the start screen before anything else when no organization is chosen', async () => {
    chooseOrganization(null);
    renderApp('/');
    expect(await screen.findByRole('heading', {name: 'Kies een organisatie'})).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Beheer'})).not.toBeInTheDocument();
  });
});
