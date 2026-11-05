import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {Button, Card, CardTitle, KeyValueRow, StatusBadge} from './index';

describe('libs/ui', () => {
  it('renders a card with a title and a button', () => {
    render(<Card><CardTitle>Titel</CardTitle><Button variant="outline">Kopieer</Button></Card>);
    expect(screen.getByRole('heading', {name: 'Titel'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Kopieer'})).toBeInTheDocument();
  });

  it('shows the status text, and only for screen readers as a dot', () => {
    const {rerender} = render(<StatusBadge tone="ok">Verbonden</StatusBadge>);
    expect(screen.getByText('Verbonden')).not.toHaveClass('sr-only');
    rerender(<StatusBadge tone="error" dotOnly>Offline</StatusBadge>);
    expect(screen.getByText('Offline')).toHaveClass('sr-only');
  });

  it('renders a key/value row', () => {
    render(<dl><KeyValueRow label="Naam">Zaal</KeyValueRow></dl>);
    expect(screen.getByText('Naam')).toBeInTheDocument();
    expect(screen.getByText('Zaal')).toBeInTheDocument();
  });
});
