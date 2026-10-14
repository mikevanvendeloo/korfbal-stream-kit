import {fireEvent, render, screen} from '@testing-library/react';
import {useState} from 'react';
import {describe, expect, it} from 'vitest';
import SponsorField from './SponsorField';

const sponsors = [
  {id: 1, name: 'Bakkerij Jansen', displayName: null, logoUrl: 'bakkerij-jansen.png'},
  {id: 2, name: 'AKB Financial Services', displayName: 'AKB', logoUrl: 'akb.png'},
];

function Field({initial = ''}: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <SponsorField id="ball" label="Balsponsor" value={value} onChange={setValue} sponsors={sponsors}/>;
}

describe('SponsorField', () => {
  it('shows the logo of the chosen sponsor', () => {
    render(<Field/>);
    expect(screen.getByText('Geen sponsor')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Balsponsor:'), {target: {value: 'Bakkerij Jansen'}});
    expect(screen.getByRole('img', {name: 'Logo Bakkerij Jansen'}).getAttribute('src')).toBe('/uploads/sponsors/bakkerij-jansen.png');
    expect((screen.getByLabelText('Balsponsor (vrije tekst)') as HTMLInputElement).value).toBe('Bakkerij Jansen');
  });

  it('finds the logo for a typed name, and shows none for free text', () => {
    render(<Field/>);
    const text = screen.getByLabelText('Balsponsor (vrije tekst)');
    fireEvent.change(text, {target: {value: 'akb'}});
    expect(screen.getByRole('img', {name: 'Logo AKB Financial Services'})).toBeTruthy();
    expect((screen.getByLabelText('Balsponsor:') as HTMLSelectElement).value).toBe('AKB Financial Services');

    fireEvent.change(text, {target: {value: 'Sportzaak om de hoek'}});
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Geen logo')).toBeTruthy();
  });
});
