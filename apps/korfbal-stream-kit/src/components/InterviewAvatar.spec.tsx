import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {initials, InterviewAvatar} from './InterviewAvatar';
import {ANNA, BRAM, KEES} from '../test/interviews';

describe('InterviewAvatar', () => {
  it('shows the player photo from /uploads', () => {
    render(<InterviewAvatar person={ANNA} role="PLAYER"/>);
    const img = screen.getByRole('img', {name: 'Foto van Anna de Vries'}) as HTMLImageElement;
    expect(img.src).toBe(`${window.location.origin}/uploads/players/anna.png`);
  });

  it('shows the shirt number large in a circle without a photo', () => {
    render(<InterviewAvatar person={BRAM} role="PLAYER"/>);
    const circle = screen.getByRole('img', {name: 'Bram Bakker, rugnummer 12'});
    expect(circle.textContent).toBe('12');
    expect(circle.className).toContain('rounded-full');
  });

  it('shows the initials without a number, and always for a coach', () => {
    render(<InterviewAvatar person={KEES} role="COACH"/>);
    expect(screen.getByRole('img', {name: 'Kees Coach'}).textContent).toBe('KC');

    // A coach with a number in the players list still gets initials
    render(<InterviewAvatar person={{...KEES, name: 'Jan de Trainer', shirtNo: 99}} role="COACH"/>);
    expect(screen.getByRole('img', {name: 'Jan de Trainer'}).textContent).toBe('JT');
  });

  it('falls back when the photo fails, and tries again with a new photo', () => {
    const {rerender} = render(<InterviewAvatar person={ANNA} role="PLAYER"/>);
    fireEvent.error(screen.getByRole('img', {name: 'Foto van Anna de Vries'}));
    expect(screen.getByRole('img', {name: 'Anna de Vries, rugnummer 7'}).textContent).toBe('7');

    rerender(<InterviewAvatar person={{...ANNA, photoUrl: 'players/anna-2.png'}} role="PLAYER"/>);
    expect((screen.getByRole('img', {name: 'Foto van Anna de Vries'}) as HTMLImageElement).src).toContain('/uploads/players/anna-2.png');
  });

  it('makes initials from the first and last word', () => {
    expect(initials('Jan de Vries')).toBe('JV');
    expect(initials('cher')).toBe('C');
    expect(initials('  ')).toBe('?');
  });
});
