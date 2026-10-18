import {fireEvent, render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import MatchImportForm from './MatchImportForm';

const json = (data: unknown, status = 200) => Promise.resolve({
  ok: status < 400, status,
  headers: new Headers({'content-type': 'application/json'}),
  json: async () => data,
});

describe('MatchImportForm', () => {
  let answer: () => ReturnType<typeof json>;
  let urls: string[];

  beforeEach(() => {
    urls = [];
    answer = () => json({ok: true, inserted: 40, updated: 4, total: 44, bySeason: [{seasonId: 1, name: '2026/2027', count: 44}]});
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      urls.push(input.toString());
      return answer();
    }) as unknown as typeof fetch;
  });
  afterEach(() => vi.restoreAllMocks());

  const renderForm = (indoorStartDate: string | null = null) => render(
    <QueryClientProvider client={new QueryClient({defaultOptions: {mutations: {retry: false}}})}>
      <MatchImportForm indoorStartDate={indoorStartDate}/>
    </QueryClientProvider>,
  );
  const dateParam = () => new URL(urls[0], 'http://localhost').searchParams.get('date');

  it('explains both date formats next to the field', () => {
    renderForm();
    const field = screen.getByLabelText('Vanaf datum of periode');
    expect(field).toHaveAttribute('placeholder', 'DD-MM-JJJJ of 30-weeks');
    expect(field).toHaveValue('30-weeks');
    expect(field).toHaveAccessibleDescription(/DD-MM-JJJJ.*30-weeks.*telt vanaf deze week/);
  });

  it('sends the typed date and shows how many matches were imported and updated', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Vanaf datum of periode'), {target: {value: '07-11-2026'}});
    fireEvent.click(screen.getByRole('button', {name: 'Wedstrijden importeren'}));
    expect(await screen.findByTestId('match-import-result')).toHaveTextContent('44 wedstrijden in 2026/2027 (40 nieuw, 4 bijgewerkt)');
    expect(dateParam()).toBe('07-11-2026');
  });

  it('shows the error and the hint of the API', async () => {
    answer = () => json({ok: false, code: 'SOURCE_SERVER_ERROR', error: 'De wedstrijdbron gaf een serverfout', hint: 'Mogelijk klopt het datumformaat niet.'}, 502);
    renderForm();
    fireEvent.click(screen.getByRole('button', {name: 'Wedstrijden importeren'}));
    expect(await screen.findByTestId('match-import-error')).toHaveTextContent('Import mislukt: De wedstrijdbron gaf een serverfout');
    expect(screen.getByTestId('match-import-hint')).toHaveTextContent('Mogelijk klopt het datumformaat niet.');
  });

  it('falls back to the status when the API sends no message', async () => {
    answer = () => json({}, 500);
    renderForm();
    fireEvent.click(screen.getByRole('button', {name: 'Wedstrijden importeren'}));
    expect(await screen.findByTestId('match-import-error')).toHaveTextContent('Wedstrijden importeren mislukt (500)');
    expect(screen.queryByTestId('match-import-hint')).not.toBeInTheDocument();
  });

  it('disables the Zaalcompetitie preset without a start date, with a hint', () => {
    renderForm(null);
    expect(screen.getByRole('radio', {name: /Zaalcompetitie/})).toBeDisabled();
    expect(screen.getByTestId('indoor-start-missing')).toHaveTextContent('Stel de startdatum van de zaalcompetitie in bij Seizoenen');
  });

  it('imports the Zaalcompetitie preset as date=indoor, and the free field stays available', async () => {
    renderForm('2026-11-07');
    const preset = screen.getByRole('radio', {name: 'Zaalcompetitie (vanaf 7 november 2026)'});
    expect(preset).toBeEnabled();
    expect(preset).toBeChecked();
    expect(screen.queryByTestId('indoor-start-missing')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Vanaf datum of periode')).toBeEnabled();
    fireEvent.click(screen.getByRole('button', {name: 'Wedstrijden importeren'}));
    await screen.findByTestId('match-import-result');
    expect(dateParam()).toBe('indoor');
  });

  it('switches to the free field when it is used', async () => {
    renderForm('2026-11-07');
    fireEvent.focus(screen.getByLabelText('Vanaf datum of periode'));
    fireEvent.click(screen.getByRole('button', {name: 'Wedstrijden importeren'}));
    await screen.findByTestId('match-import-result');
    expect(dateParam()).toBe('30-weeks');
  });
});
