import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import ChapterAssignmentsCard from './ChapterAssignmentsCard';

// Mock hooks used by ChapterAssignmentsCard
vi.mock('../hooks/useProductions', () => {
  return {
    useChapterAssignments: () => ({ data: [], isLoading: false }),
    useAddChapterAssignment: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
    useDeleteChapterAssignment: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
    useCopyChapterAssignments: () => ({ mutateAsync: vi.fn().mockResolvedValue({ ok: true }) }),
    useChapterStandardPositions: () => ({
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
        { id: 100, code: 'COMMENTAAR', name: 'Commentaar', type: 'entertainment' },
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

describe('ChapterAssignmentsCard', () => {
  const chapter = { id: 99, productionId: 1, name: 'Eerste helft', orderIndex: 3 };
  const productionPersons = [
    { person: { id: 1, name: 'Alice' } },
    { person: { id: 2, name: 'Bob' } }
  ];

  it('renders default positions and filters crew by required capability when a position is selected', async () => {
    render(
      <ChapterAssignmentsCard chapter={chapter} chapterNumber={3} allChapters={[chapter]} productionPersons={productionPersons as any} allPositions={[]} productionPersonPositions={[]} />
    );

    expect(screen.getByText('3. Eerste helft')).toBeInTheDocument();
    // Default positions visible
    expect(screen.getByText('Standaardposities voor dit hoofdstuk (draaiboek-template)')).toBeInTheDocument();
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
