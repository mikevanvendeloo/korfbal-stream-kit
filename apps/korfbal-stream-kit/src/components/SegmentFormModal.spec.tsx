import React from 'react';
import {describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen} from '@testing-library/react';
import SegmentFormModal from './SegmentFormModal';

describe('SegmentFormModal', () => {
  it('submits provided naam, duur, volgorde and isTimeAnchor', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    render(
      <SegmentFormModal
        title="Test"
        onCancel={onCancel}
        onSubmit={onSubmit}
        initial={{ naam: '', duurInMinuten: 0 }}
      />
    );

    act(() => {
      fireEvent.change(screen.getByLabelText('Naam'), { target: { value: 'Voorbeschouwing' } });
      fireEvent.change(screen.getByLabelText('Duur (minuten)'), { target: { value: '12' } });
      fireEvent.change(screen.getByLabelText('Volgorde (optioneel)'), { target: { value: '2' } });
      fireEvent.click(screen.getByText('Dit segment is het tijdanker'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Opslaan'));
    });

    expect(onSubmit).toHaveBeenCalledWith({ naam: 'Voorbeschouwing', duurInMinuten: 12, volgorde: 2, isTimeAnchor: true });
  });

  it('allows leaving volgorde empty to append automatically', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    render(
      <SegmentFormModal
        onCancel={onCancel}
        onSubmit={onSubmit}
        initial={{ naam: '', duurInMinuten: 0 }}
      />
    );

    act(() => {
      fireEvent.change(screen.getByLabelText('Naam'), { target: { value: 'Nabeschouwing' } });
      fireEvent.change(screen.getByLabelText('Duur (minuten)'), { target: { value: '8' } });
    });
    // leave Volgorde empty

    await act(async () => {
      fireEvent.click(screen.getByText('Opslaan'));
    });

    expect(onSubmit).toHaveBeenCalledWith({ naam: 'Nabeschouwing', duurInMinuten: 8 });
  });
});
