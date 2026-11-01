import {describe, expect, it} from 'vitest';
import {fireEvent, screen, waitFor} from '@testing-library/react';
import MatchStatsSettings from './MatchStatsSettings';
import {mockApi, renderPage} from '../test/organizations';

const settings = (hasBridgeToken: boolean) => ({bridgeUrl: 'http://statistics-bridge:3340', hasBridgeToken});

describe('MatchStatsSettings', () => {
  it('shows the bridge URL, never a token, and keeps the stored token unless a new one is typed', async () => {
    const {calls} = mockApi(({method}) => (method === 'PUT' ? settings(true) : settings(true)));
    renderPage(<MatchStatsSettings/>);
    const url = await screen.findByLabelText('Statistics bridge URL');
    await waitFor(() => expect((url as HTMLInputElement).value).toBe('http://statistics-bridge:3340'));
    const token = screen.getByLabelText('Bridge-token') as HTMLInputElement;
    expect(token.value).toBe('');
    expect(token.placeholder).toMatch(/Ingesteld/);
    fireEvent.click(screen.getByRole('button', {name: 'Statistieken opslaan'}));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    // No token field in the body: the API keeps the stored one
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({bridgeUrl: 'http://statistics-bridge:3340'});
  });

  it('sends a typed token once and clears the field', async () => {
    const {calls} = mockApi(() => settings(false));
    renderPage(<MatchStatsSettings/>);
    await screen.findByLabelText('Statistics bridge URL');
    fireEvent.change(screen.getByLabelText('Bridge-token'), {target: {value: 's3cret'}});
    fireEvent.click(screen.getByRole('button', {name: 'Statistieken opslaan'}));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({bridgeUrl: 'http://statistics-bridge:3340', bridgeToken: 's3cret'}));
    await waitFor(() => expect((screen.getByLabelText('Bridge-token') as HTMLInputElement).value).toBe(''));
  });

  it('removes the token on request', async () => {
    const {calls} = mockApi(() => settings(true));
    renderPage(<MatchStatsSettings/>);
    fireEvent.click(await screen.findByRole('button', {name: 'Token verwijderen'}));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({bridgeUrl: 'http://statistics-bridge:3340', bridgeToken: null}));
  });

  it('has a Verbinding testen button', async () => {
    mockApi(() => settings(false));
    renderPage(<MatchStatsSettings/>);
    expect(await screen.findByRole('button', {name: 'Verbinding testen'})).toBeTruthy();
  });
});
