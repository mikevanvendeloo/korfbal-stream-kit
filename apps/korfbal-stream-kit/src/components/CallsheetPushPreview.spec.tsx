import {fireEvent, render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {CallsheetPushPreview} from './VmixCallsheetPushSettings';

const colors = (normal: string, warning: string, overtime: string) => ({
  normal: {background: normal, text: '#FFFFFF'},
  warning: {background: warning, text: '#000000'},
  overtime: {background: overtime, text: '#FFFFFF'},
});
const config = {
  current: {colors: colors('#22C55E', '#F97316', '#EF4444')},
  next: {colors: colors('#111111', '#222222', '#333333')},
} as never;

function renderPreview(timing: object) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([timing]))));
  return render(
    <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
      <CallsheetPushPreview colors={config}/>
    </QueryClientProvider>
  );
}

const background = (label: string) => (screen.getByTestId(`preview-${label}`) as HTMLElement).style.background;

describe('CallsheetPushPreview', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the colours of the live state, Nu above Straks', async () => {
    renderPreview({productionId: 7, currentTitle: 'Opening', currentState: 'overtime', nextTitle: 'Interview', nextState: 'warning'});
    expect(await screen.findByText('Opening')).toBeTruthy();
    expect(background('Nu')).toBe('rgb(239, 68, 68)');
    expect(background('Straks')).toBe('rgb(34, 34, 34)');
    const [nu, straks] = screen.getAllByTestId(/^preview-/);
    expect(nu.dataset.testid).toBe('preview-Nu');
    expect(straks.dataset.testid).toBe('preview-Straks');
  });

  it('shows the colours of a chosen state, also without an active production', async () => {
    renderPreview({productionId: null, currentTitle: '', currentState: 'normal', nextTitle: '', nextState: 'normal'});
    expect(await screen.findByText('Geen actieve productie: voorbeeldtekst.')).toBeTruthy();
    expect(screen.getByText('Voorbeeld: opening')).toBeTruthy();
    expect(background('Nu')).toBe('rgb(34, 197, 94)');

    fireEvent.click(screen.getByRole('radio', {name: 'Bijna op'}));
    expect(background('Nu')).toBe('rgb(249, 115, 22)');
    expect(background('Straks')).toBe('rgb(34, 34, 34)');
  });
});
