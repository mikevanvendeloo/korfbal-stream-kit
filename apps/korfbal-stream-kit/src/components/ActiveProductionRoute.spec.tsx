import {beforeEach, describe, expect, it, vi} from 'vitest';
import {act, render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter, Route, Routes, useLocation, useParams} from 'react-router-dom';
import {ActiveProductionRoute, LegacyLiveAddress, LivePositionRoute, SHOW_CALLER_CHOOSE, useLiveProductionId} from './ActiveProductionRoute';
import {mockApi} from '../test/organizations';

// The shared socket: keep the handlers so a test can send an event
const handlers = vi.hoisted(() => new Map<string, Set<(...args: unknown[]) => void>>());
vi.mock('../lib/socket', () => ({
  getSharedSocket: () => ({
    on: (event: string, fn: (...args: unknown[]) => void) => { if (!handlers.has(event)) handlers.set(event, new Set()); handlers.get(event)?.add(fn); },
    off: (event: string, fn: (...args: unknown[]) => void) => handlers.get(event)?.delete(fn),
  }),
}));
const send = (event: string, ...args: unknown[]) => handlers.get(event)?.forEach((fn) => fn(...args));

/** What a LIVE screen gets: the production, the position and the address */
function Probe({name}: {name: string}) {
  const productionId = useLiveProductionId();
  const {positionSlug} = useParams();
  const {pathname} = useLocation();
  return <p data-testid="probe">{name} production={productionId} position={positionSlug ?? '-'} at={pathname}</p>;
}

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<ActiveProductionRoute/>}>
            <Route path="callsheet" element={<Probe name="choice"/>}/>
            <Route path="callsheet/:positionSlug" element={<LivePositionRoute base="callsheet"><Probe name="callsheet"/></LivePositionRoute>}/>
            <Route path="show-caller" element={<Probe name="show-caller"/>}/>
            <Route path={`show-caller/${SHOW_CALLER_CHOOSE}`} element={<Probe name="show-caller-choice"/>}/>
            <Route path="show-caller/:positionSlug" element={<LivePositionRoute base="show-caller"><Probe name="show-caller"/></LivePositionRoute>}/>
          </Route>
          <Route path="callsheet/:legacyId/:positionSlug" element={<LegacyLiveAddress base="callsheet"/>}/>
          <Route path="show-caller/:legacyId/:positionSlug" element={<LegacyLiveAddress base="show-caller"/>}/>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ActiveProductionRoute', () => {
  let active: {id: number} | null;
  beforeEach(() => {
    handlers.clear();
    active = {id: 47};
    mockApi(({path}) => (path === '/api/production/active' ? {item: active} : {}));
  });

  it('shows the active production at an address without a production id', async () => {
    renderAt('/callsheet/camera-links');
    expect((await screen.findByTestId('probe')).textContent).toBe('callsheet production=47 position=camera-links at=/callsheet/camera-links');
  });

  it('opens the position choice and the show caller without a redirect', async () => {
    renderAt('/callsheet');
    expect((await screen.findByTestId('probe')).textContent).toBe('choice production=47 position=- at=/callsheet');
  });

  it('says so when the organization has no active production', async () => {
    active = null;
    renderAt('/show-caller');
    expect(await screen.findByText('Geen actieve productie')).toBeInTheDocument();
  });

  it('switches every open screen when another production is activated', async () => {
    renderAt('/show-caller/regie');
    expect((await screen.findByTestId('probe')).textContent).toContain('production=47');
    active = {id: 48};
    await act(async () => send('active_production_changed', {productionId: 48}));
    expect((await screen.findByText(/production=48/)).textContent).toBe('show-caller production=48 position=regie at=/show-caller/regie');
  });

  it('rewrites old bookmarks with a production id once', async () => {
    for (const [from, to] of [
      ['/callsheet/12/camera-links', 'callsheet production=47 position=camera-links at=/callsheet/camera-links'],
      ['/callsheet/12', 'choice production=47 position=- at=/callsheet'],
      ['/show-caller/12/all', 'show-caller production=47 position=- at=/show-caller'],
      ['/show-caller/12/regie', 'show-caller production=47 position=regie at=/show-caller/regie'],
    ]) {
      const {unmount} = renderAt(from);
      expect((await screen.findByTestId('probe')).textContent, from).toBe(to);
      unmount();
    }
  });

  it('keeps the show caller\'s own position choice', async () => {
    renderAt(`/show-caller/${SHOW_CALLER_CHOOSE}`);
    expect((await screen.findByTestId('probe')).textContent).toContain('show-caller-choice');
  });
});
