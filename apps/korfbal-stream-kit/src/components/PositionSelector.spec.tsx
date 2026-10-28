import {describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {PositionSelector} from './PositionSelector';
import {mockApi} from '../test/organizations';
import {CAMERA, REGIE} from '../test/showCaller';

function renderSelector(viewType: 'callsheet' | 'show-caller', positions: unknown[]) {
  mockApi(({path}) => (path === '/api/production/7/events/positions' ? positions : {}));
  return render(
    <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
      <MemoryRouter initialEntries={[`/${viewType}/7`]}>
        <Routes><Route path={`/${viewType}/:productionId`} element={<PositionSelector viewType={viewType}/>}/></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('PositionSelector', () => {
  it('offers the Show Caller first on the callsheet, then a tile per position', async () => {
    renderSelector('callsheet', [REGIE, CAMERA]);
    await screen.findByRole('link', {name: REGIE.name});
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/show-caller/7/all');
    expect(links[0].textContent).toContain('Show Caller');
    expect(screen.getByRole('link', {name: CAMERA.name})).toHaveAttribute('href', '/callsheet/7/camera-links');
  });

  it('still offers the Show Caller when no item has a position yet', async () => {
    renderSelector('callsheet', []);
    expect(await screen.findByText(/Geen posities gevonden/)).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /Show Caller/})).toHaveAttribute('href', '/show-caller/7/all');
  });

  it('has no Show Caller tile in the Show Caller\'s own position choice', async () => {
    renderSelector('show-caller', [REGIE]);
    await screen.findByRole('link', {name: REGIE.name});
    expect(screen.queryByRole('link', {name: /Show Caller/})).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Alle Items'})).toHaveAttribute('href', '/show-caller/7/all');
  });
});
