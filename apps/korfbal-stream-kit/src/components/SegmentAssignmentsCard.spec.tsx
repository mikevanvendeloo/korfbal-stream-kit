import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SegmentAssignmentsCard from './SegmentAssignmentsCard';

// Mock hooks used by SegmentAssignmentsCard
vi.mock('../hooks/useProductions', () => {
  return {
    useSegmentAssignments: () => ({ data: [], isLoading: false }),
    useAddSegmentAssignment: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
    useDeleteSegmentAssignment: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
    useCopySegmentAssignments: () => ({ mutateAsync: vi.fn().mockResolvedValue({ ok: true }) }),
    useCrewPersonsForSegment: () => ({
      data: [
        { id: 1, name: 'Alice', gender: 'female', skillIds: [100] }, // COMMENTAAR
        { id: 2, name: 'Bob', gender: 'male', skillIds: [200] }, // REGISSEUR
      ],
    }),
    useSegmentDefaultPositions: () => ({
      data: [
        { id: 10, name: 'commentaar', order: 1, requiredSkillCode: 'COMMENTAAR' },
        { id: 11, name: 'regie', order: 2, requiredSkillCode: 'REGISSEUR' },
      ],
    }),
  };
});

vi.mock('../hooks/usePositions', () => {
  return {
    usePositionsCatalog: () => ({
      data: [
        { id: 10, name: 'commentaar' },
        { id: 11, name: 'regie' },
      ],
    }),
  };
});

vi.mock('../hooks/usePersons', () => {
  return {
    useSkillsCatalog: () => ({
      data: [
        { id: 100, code: 'COMMENTAAR', nameMale: 'Commentator', nameFemale: 'Commentatrice' },
        { id: 200, code: 'REGISSEUR', nameMale: 'Regisseur', nameFemale: 'Regisseuse' },
      ],
    }),
  };
});

describe('SegmentAssignmentsCard', () => {
  const seg = { id: 99, productionId: 1, naam: 'Test', volgorde: 1, duurInMinuten: 5, isTimeAnchor: false };

  it('renders default positions and filters crew by required capability when a position is selected', async () => {
    render(
      <SegmentAssignmentsCard segment={seg as any} allSegments={[seg as any]} />
    );

    // Default positions visible
    expect(screen.getByText('Standaard posities voor dit segment')).toBeInTheDocument();
    const btnCommentaar = screen.getByRole('button', { name: /commentaar/i });
    expect(btnCommentaar).toBeInTheDocument();

    // Click default position to preselect
    fireEvent.click(btnCommentaar);

    // Now person dropdown should include only Alice (has COMMENTAAR skill 100), not Bob
    const personSelect = screen.getByLabelText('Persoon') as HTMLSelectElement;
    // open/select programmatically
    fireEvent.change(personSelect, { target: { value: '1' } });
    expect(personSelect.value).toBe('1');

    // Ensure Bob is not offered when filtering by COMMENTAAR
    const options = Array.from(personSelect.querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toContain('Alice');
    // Option list includes placeholder '— kies —' and Alice; Bob should be absent
    expect(options.some((t) => (t || '').includes('Bob'))).toBe(false);
  });
});
