import {act, screen, waitFor, within} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import InterviewsPage, {interviewRoleLabel} from './InterviewsPage';
import {mockApi, renderPage} from '../test/organizations';
import {interviewCards} from '../test/interviews';
import type {SocketListener} from '../lib/socket';

// The app-wide socket, as a plain emitter: the test sends the API's events itself
const listeners = new Map<string, Set<SocketListener>>();
const fakeSocket = {
  on: (event: string, fn: SocketListener) => { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event)?.add(fn); },
  off: (event: string, fn: SocketListener) => { listeners.get(event)?.delete(fn); },
};
const emit = (event: string, payload: unknown) => listeners.get(event)?.forEach((fn) => fn(payload));
vi.mock('../lib/socket', () => ({getSharedSocket: () => fakeSocket}));

function mockShow(cards = interviewCards, moments: unknown[] = []) {
  return mockApi(({path}) => {
    if (path === '/api/production/active') return {item: {id: 47, matchScheduleId: 1, isActive: true}};
    if (path === '/api/production/47/interview-cards') return {items: cards, moments};
    return {};
  });
}

describe('InterviewsPage', () => {
  afterEach(() => listeners.clear());

  it('shows one large card per chosen interview: photo, name, number, team and role', async () => {
    mockShow();
    renderPage(<InterviewsPage/>);

    const list = await screen.findByRole('list', {name: 'Gekozen interviews'});
    const [anna, bram, kees] = within(list).getAllByRole('listitem');
    expect(within(anna).getByRole('img', {name: 'Foto van Anna de Vries'})).toBeTruthy();
    expect(within(anna).getByRole('heading').textContent).toBe('Anna de Vries');
    expect(anna.textContent).toContain('#7');
    expect(anna.textContent).toContain('Fortuna/Ruitenheer 1');
    expect(anna.textContent).toContain('Speler thuis');
    expect(anna.textContent).toContain('Titel: Interview speler');

    // No photo: the number in the circle; a coach: initials and no number
    expect(within(bram).getByRole('img', {name: 'Bram Bakker, rugnummer 12'})).toBeTruthy();
    expect(bram.textContent).toContain('Speler uit');
    expect(within(kees).getByRole('img', {name: 'Kees Coach'}).textContent).toBe('KC');
    expect(kees.textContent).toContain('Coach uit');
    expect(kees.textContent).not.toContain('#');
  });

  it('says so when nothing is chosen yet', async () => {
    mockShow([]);
    renderPage(<InterviewsPage/>);
    expect(await screen.findByText(/Er zijn nog geen interviews gekozen/)).toBeTruthy();
  });

  it('refetches at once when the choice changes on another device', async () => {
    const {calls} = mockShow();
    renderPage(<InterviewsPage/>);
    await screen.findByRole('list', {name: 'Gekozen interviews'});
    const cardCalls = () => calls.filter((c) => c.path === '/api/production/47/interview-cards').length;
    expect(cardCalls()).toBe(1);

    act(() => emit('interviews_updated', {productionId: 99}));
    act(() => emit('interviews_updated', {productionId: 47}));
    await waitFor(() => expect(cardCalls()).toBe(2));
  });

  it('labels the role with the side', () => {
    expect(interviewRoleLabel('PLAYER', 'HOME')).toBe('Speler thuis');
    expect(interviewRoleLabel('COACH', 'AWAY')).toBe('Coach uit');
    expect(interviewRoleLabel('PLAYER', 'NONE')).toBe('Speler');
  });
});

describe('InterviewsPage order', () => {
  afterEach(() => listeners.clear());

  it('shows the interviews in draaiboek order with their hoofdstuk, and on each card its numbers', async () => {
    mockShow(interviewCards, [
      {position: 1, itemId: 'a', title: 'Interview Kees Coach', chapter: 'Voorbeschouwing', plannedStartTime: null, people: [{side: 'AWAY', role: 'COACH', name: 'Kees Coach'}]},
      {position: 2, itemId: 'b', title: 'Interview coach thuis', chapter: 'Voorbeschouwing', plannedStartTime: null, people: [{side: 'HOME', role: 'COACH', name: null}]},
      {position: 3, itemId: 'c', title: 'Interview Kees Coach en Bram Bakker', chapter: 'Nabeschouwing', plannedStartTime: null, people: [{side: 'AWAY', role: 'COACH', name: 'Kees Coach'}, {side: 'AWAY', role: 'PLAYER', name: 'Bram Bakker'}]},
    ]);
    renderPage(<InterviewsPage/>);

    const order = await screen.findByRole('list', {name: 'Volgorde van de interviews'});
    expect(within(order).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '1VoorbeschouwingInterview Kees Coach',
      '2VoorbeschouwingInterview coach thuis',
      '3NabeschouwingInterview Kees Coach en Bram Bakker',
    ]);
    const cards = screen.getByRole('list', {name: 'Gekozen interviews'});
    expect(within(cards).getByRole('listitem', {name: 'Kees Coach'}).textContent).toContain('Interview 1 en 3');
    expect(within(cards).getByRole('listitem', {name: 'Bram Bakker'}).textContent).toContain('Interview 3');
    expect(within(cards).getByRole('listitem', {name: 'Anna de Vries'}).textContent).not.toContain('Interview 1');
  });
});
