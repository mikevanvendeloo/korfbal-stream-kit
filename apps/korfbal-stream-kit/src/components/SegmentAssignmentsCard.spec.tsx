import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
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
        { id: 100, code: 'COMMENTAAR', name: 'Commentaar', type: 'on_stream' },
        { id: 200, code: 'REGISSEUR', name: 'Regisseur', type: 'crew' },
      ],
    }),
  };
});

// Mock fetch for person skills
global.fetch = vi.fn((url) => {
  if (url.toString().includes('/api/persons/1/skills')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([{ skillId: 100 }]), // Alice has COMMENTAAR
    });
  }
  if (url.toString().includes('/api/persons/2/skills')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([{ skillId: 200 }]), // Bob has REGISSEUR
    });
  }
  return Promise.resolve({ ok: false });
}) as any;

describe('SegmentAssignmentsCard', () => {
  const seg = { id: 99, productionId: 1, naam: 'Test', volgorde: 1, duurInMinuten: 5, isTimeAnchor: false };
  const productionPersons = [
    { person: { id: 1, name: 'Alice' } },
    { person: { id: 2, name: 'Bob' } }
  ];

  it('renders default positions and filters crew by required capability when a position is selected', async () => {
    render(
      <SegmentAssignmentsCard segment={seg as any} allSegments={[seg as any]} productionPersons={productionPersons as any} />
    );

    // Default positions visible
    expect(screen.getByText('Standaard posities voor dit segment (template)')).toBeInTheDocument();
    const btnCommentaar = screen.getByRole('button', { name: /commentaar/i });
    expect(btnCommentaar).toBeInTheDocument();

    // Click default position to preselect
    fireEvent.click(btnCommentaar);

    // Wait for skills to be fetched and filtering to apply
    await waitFor(() => {
      const personSelect = screen.getByLabelText('Persoon') as HTMLSelectElement;
      const options = Array.from(personSelect.querySelectorAll('option')).map((o) => o.textContent);
      // Alice should be present (has COMMENTAAR)
      expect(options).toContain('Alice');
      // Bob should be absent (does not have COMMENTAAR)
      expect(options.some((t) => (t || '').includes('Bob'))).toBe(false);
    });
  });
});
