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
        chapters={[
          { id: 1, name: 'Bron', number: 1 },
          { id: 2, name: 'Doel A', number: 2 },
          { id: 3, name: 'Doel B', number: 3 },
        ]}
        sourceChapterId={1}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    // Choose both targets
    const list = screen.getByText('Naar hoofdstukken').parentElement as HTMLElement;
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
    expect(onConfirm).toHaveBeenCalledWith({ targetChapterIds: [2, 3], mode: 'overwrite' });
  });
});
