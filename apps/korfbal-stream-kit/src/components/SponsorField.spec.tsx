import {fireEvent, render, screen} from '@testing-library/react';
import {useState} from 'react';
import {describe, expect, it} from 'vitest';
import SponsorField, {sponsorLogoSrc} from './SponsorField';

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

  it('shows "Logo niet gevonden" when the logo file is missing', () => {
    render(<Field initial="Bakkerij Jansen"/>);
    fireEvent.error(screen.getByRole('img', {name: 'Logo Bakkerij Jansen'}));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Logo niet gevonden')).toBeTruthy();
  });

  it('shows the logo of the next sponsor after one failed to load', () => {
    render(<Field initial="Bakkerij Jansen"/>);
    fireEvent.error(screen.getByRole('img', {name: 'Logo Bakkerij Jansen'}));
    fireEvent.change(screen.getByLabelText('Balsponsor:'), {target: {value: 'AKB Financial Services'}});
    const akb = screen.getByRole('img', {name: 'Logo AKB Financial Services'});
    expect(akb.getAttribute('src')).toBe('/uploads/sponsors/akb.png');
    expect(akb.style.visibility).toBe('');
    expect(screen.queryByText('Logo niet gevonden')).toBeNull();

    // And back to the broken one: the placeholder again, not a hidden or broken image
    fireEvent.change(screen.getByLabelText('Balsponsor:'), {target: {value: 'Bakkerij Jansen'}});
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Logo niet gevonden')).toBeTruthy();
  });

  it('builds the logo URL for an organization logo and a legacy file name', () => {
    expect(sponsorLogoSrc({id: 3, name: 'X', logoUrl: '7/x-logo.webp'})).toBe('/uploads/sponsors/7/x-logo.webp');
    expect(sponsorLogoSrc({id: 4, name: 'Y', logoUrl: 'Oud Logo.png'})).toBe('/uploads/sponsors/Oud%20Logo.png');
    expect(sponsorLogoSrc({id: 5, name: 'Z', logoUrl: null})).toBeNull();
  });

  it('prints the name and the logo, not the form fields', () => {
    render(<Field initial="Bakkerij Jansen"/>);
    // jsdom applies no print media: check the print classes instead
    expect(screen.getByTestId('ball-print-name').textContent).toBe('Bakkerij Jansen');
    expect(screen.getByTestId('ball-print-name').className).toContain('print:block');
    expect(screen.getByLabelText('Balsponsor:').closest('.print\\:hidden')).not.toBeNull();
    const logoBox = screen.getByTestId('ball-logo');
    expect(logoBox.closest('.print\\:hidden')).toBeNull();
    expect(logoBox.querySelector('img')?.closest('.print\\:hidden')).toBeNull();
  });
});
