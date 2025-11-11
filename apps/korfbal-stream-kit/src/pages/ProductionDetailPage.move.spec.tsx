import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import ProductionDetailPage from './ProductionDetailPage';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock hooks used by the page so we can control data and capture mutations
vi.mock('../hooks/useProductions', async () => {
  const actual = await vi.importActual<any>('../hooks/useProductions');
  const mutateAsync = vi.fn();
  const mocks: any = {
    __esModule: true,
    ...actual,
    useProduction: () => ({ data: { id: 1, matchScheduleId: 1, createdAt: new Date().toISOString(), matchSchedule: { homeTeamName: 'A', awayTeamName: 'B', date: new Date().toISOString() } }, isError: false }),
    useProductionSegments: () => ({ data: [
      { id: 11, productionId: 1, naam: 'Seg 1', volgorde: 1, duurInMinuten: 10, isTimeAnchor: false },
      { id: 22, productionId: 1, naam: 'Seg 2', volgorde: 2, duurInMinuten: 10, isTimeAnchor: false },
      { id: 33, productionId: 1, naam: 'Seg 3', volgorde: 3, duurInMinuten: 10, isTimeAnchor: false },
    ] }),
    useProductionTiming: () => ({ data: [], isError: false }),
    useCreateSegment: () => ({ mutateAsync: vi.fn() }),
    useUpdateSegment: () => ({ mutateAsync }),
    useDeleteSegment: () => ({ mutateAsync: vi.fn() }),
    // expose to test to assert calls
    __mutateAsync: mutateAsync,
  };
  return mocks;
});

// Mock persons hook used for the assignments person filter
vi.mock('../hooks/usePersons', () => ({
  usePersons: () => ({ data: { items: [] } }),
}));

// Mock positions hook indirectly used by SegmentAssignmentsCard (not under test here)
vi.mock('../hooks/usePositions', () => ({
  usePositionsCatalog: () => ({ data: [] }),
}));

// Mock SegmentAssignmentsCard to avoid unrelated complexity
vi.mock('../components/SegmentAssignmentsCard', () => ({
  __esModule: true,
  default: () => <div data-testid="segment-assignments-card" />,
}));

function renderWithRoute() {
  return render(
    <MemoryRouter initialEntries={["/admin/productions/1"]}>
      <Routes>
        <Route path="/admin/productions/:id" element={<ProductionDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProductionDetailPage segment move buttons', () => {
  let mutateAsync: any;
  beforeEach(async () => {
    // Access the mocked mutate to assert on it
    const mocked = await import('../hooks/useProductions');
    mutateAsync = (mocked as any).__mutateAsync;
    mutateAsync.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('moves first segment down with a single update call', async () => {
    renderWithRoute();

    // Click the first "Omlaag" button (title="Omlaag")
    const downButtons = screen.getAllByTitle('Omlaag');
    fireEvent.click(downButtons[0]);

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({ id: 11, volgorde: 2 });
  });

  it('moves second segment up with a single update call', async () => {
    renderWithRoute();

    const upButtons = screen.getAllByTitle('Omhoog');
    // Second segment's up button is the second in the list (index 1)
    fireEvent.click(upButtons[1]);

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({ id: 22, volgorde: 1 });
  });
});
