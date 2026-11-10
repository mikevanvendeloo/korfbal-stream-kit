import {act, render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createFakeSocket} from '../test/fakeSocket';
import VenueBridgeIndicator from './VenueBridgeIndicator';

const socket = createFakeSocket();
vi.mock('../lib/socket', () => ({getSharedSocket: () => socket}));

const status = (connected: boolean) => ({
  connected, name: connected ? 'Zaal' : null, version: null, pageUrl: null, connectedAt: null,
  config: {state: 'applied', error: null},
  devices: {score: {state: 'ok', ageMs: 1}, clock: {state: 'ok', ageMs: 1}, shotclock: {state: 'not-configured', ageMs: null}},
});

describe('VenueBridgeIndicator', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(status(true)))));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the bridge connected, links to Instellingen → Venue and turns offline on the socket event', async () => {
    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><MemoryRouter><VenueBridgeIndicator/></MemoryRouter></QueryClientProvider>);
    const link = await screen.findByRole('link', {name: 'Bridge verbonden'});
    expect(link).toHaveAttribute('href', '/admin/instellingen?tab=venue');
    // 360 px: the text is for screen readers, the dot is what shows
    expect(screen.getByText('Bridge verbonden')).toHaveClass('sr-only');

    act(() => socket.emit('venue_bridge_status', status(false)));
    expect(await screen.findByRole('link', {name: 'Bridge offline'})).toBeInTheDocument();
  });
});
