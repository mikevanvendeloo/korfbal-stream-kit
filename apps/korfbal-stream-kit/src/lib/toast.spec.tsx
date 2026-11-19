import {afterEach, describe, expect, it, vi} from 'vitest';
import {act, fireEvent, screen} from '@testing-library/react';
import {toast} from './toast';

describe('toast', () => {
  afterEach(() => vi.useRealTimers());

  it('shows a success message that disappears after 4 seconds', async () => {
    vi.useFakeTimers();
    act(() => toast.success('Positie overzicht opgeslagen!'));
    expect(screen.getByTestId('toast-success')).toHaveTextContent('Positie overzicht opgeslagen!');
    expect(screen.getByTestId('toast-success').parentElement).toHaveAttribute('aria-live', 'polite');
    act(() => vi.advanceTimersByTime(3900));
    expect(screen.getByTestId('toast-success')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByTestId('toast-success')).not.toBeInTheDocument();
  });

  it('keeps an error longer, read out at once, and closes it with the button', () => {
    vi.useFakeTimers();
    act(() => toast.error('Fout bij opslaan: netwerk'));
    const item = screen.getByTestId('toast-error');
    expect(item.parentElement).toHaveAttribute('aria-live', 'assertive');
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByTestId('toast-error')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Melding sluiten'}));
    expect(screen.queryByTestId('toast-error')).not.toBeInTheDocument();
  });

  it('stacks several messages', () => {
    act(() => {
      toast.success('Een');
      toast.success('Twee');
      toast.error('Drie');
    });
    expect(screen.getAllByTestId('toast-success')).toHaveLength(2);
    expect(screen.getByTestId('toast-error')).toHaveTextContent('Drie');
  });
});
