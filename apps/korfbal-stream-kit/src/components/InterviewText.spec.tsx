import {render, screen} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {InterviewNamesProvider, InterviewText} from './InterviewText';

function renderAt(text: string, withProvider = true) {
  const content = <span data-testid="text"><InterviewText text={text}/></span>;
  return render(
    <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
      <MemoryRouter initialEntries={['/callsheet/7/presentatie']}>
        <Routes>
          <Route path="/callsheet/:productionId/:positionSlug"
                 element={withProvider ? <InterviewNamesProvider>{content}</InterviewNamesProvider> : content}/>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('InterviewText', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fills in the selected names of the production in the URL', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ownSide: 'HOME',
      names: {HOME: {PLAYER: 'Sanne de Vries', COACH: null}, AWAY: {PLAYER: null, COACH: 'Jan Jansen'}},
    })));
    vi.stubGlobal('fetch', fetchMock);

    renderAt('Interview {coach-tegenstander:kort} & {speler-eigen} / {coach-eigen}');

    expect(await screen.findByText(/J\. Jansen/)).toBeTruthy();
    expect(screen.getByTestId('text').textContent).toBe('Interview J. Jansen & Sanne de Vries / coach eigen');
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('/api/production/7/interview-names');
  });

  it('shows the text as typed outside the LIVE views', () => {
    renderAt('Interview {coach-uit}', false);
    expect(screen.getByTestId('text').textContent).toBe('Interview {coach-uit}');
  });
});
