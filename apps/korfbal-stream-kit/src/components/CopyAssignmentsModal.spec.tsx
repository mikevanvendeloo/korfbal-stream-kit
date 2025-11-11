import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import CopyAssignmentsModal from './CopyAssignmentsModal';

describe('CopyAssignmentsModal', () => {
  it('selects targets and mode, and calls onConfirm with payload', async () => {
    // no user-event; use fireEvent directly
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <CopyAssignmentsModal
        segments={[
          { id: 1, naam: 'Bron', volgorde: 1 },
          { id: 2, naam: 'Doel A', volgorde: 2 },
          { id: 3, naam: 'Doel B', volgorde: 3 },
        ]}
        sourceSegmentId={1}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    // Choose both targets
    const list = screen.getByText('Doelsegmenten').parentElement as HTMLElement;
    const a = within(list).getByLabelText('2. Doel A') as HTMLInputElement;
    const b = within(list).getByLabelText('3. Doel B') as HTMLInputElement;

    // Click checkboxes
    fireEvent.click(a);
    fireEvent.click(b);

    // Switch to overwrite mode
    const overwrite = screen.getByRole('radio', { name: /overwrite/i });
    fireEvent.click(overwrite);

    // Confirm
    const btn = screen.getByRole('button', { name: /kopieer/i });
    fireEvent.click(btn);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({ targetSegmentIds: [2, 3], mode: 'overwrite' });
  });
});
