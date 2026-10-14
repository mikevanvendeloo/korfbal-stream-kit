import {fireEvent, render, screen, within} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {describe, expect, it, vi} from 'vitest';
import CrewReportPage from './CrewReportPage';

const camera = {id: 1, name: 'Camera', category: 'TECHNICAL'};
const regie = {id: 2, name: 'Regie', category: 'TECHNICAL'};

vi.mock('html2canvas', () => ({default: vi.fn()}));
vi.mock('../hooks/useCallsheet', () => ({
  useCrewReport: () => ({
    isLoading: false, error: null,
    data: {
      segments: [{id: 10, naam: 'Voorbeschouwing', volgorde: 1}, {id: 11, naam: 'Eerste helft', volgorde: 2}],
      groupedPositions: [{category: 'TECHNICAL', positions: [regie, camera]}],
      cells: [
        {segmentId: 10, positionId: 2, personName: 'Anna', type: 'production'},
        {segmentId: 11, positionId: 2, personName: 'Anna', type: 'production'},
        {segmentId: 11, positionId: 1, personName: 'Bas', type: 'segment'},
      ],
      callsheets: [{id: 1, productionId: 7, name: 'Main', items: [
        {id: 'a', cue: 'A1', title: 'Opening', durationSec: 60, positionIds: [1], productionSegment: null},
        {id: 'b', cue: 'A2', title: 'Iedereen', durationSec: 60, positionIds: [], productionSegment: null},
        {id: 'c', cue: 'A3', title: 'Alleen regie', durationSec: 60, positionIds: [2], productionSegment: null},
      ]}],
      productionReport: null,
    },
  }),
}));
vi.mock('../hooks/useProductions', () => ({
  useProduction: () => ({isLoading: false, data: {matchSchedule: {homeTeamName: 'Thuis', awayTeamName: 'Uit'}}}),
  useProductionInterviews: () => ({isLoading: false, data: []}),
}));
vi.mock('../hooks/usePositions', () => ({
  usePositionsCatalog: () => ({data: [camera, regie]}),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/producties/7/rapport/crew']}>
      <Routes><Route path="/admin/producties/:id/rapport/crew" element={<CrewReportPage/>}/></Routes>
    </MemoryRouter>
  );
}

describe('CrewReportPage', () => {
  it('shows who does what per segment', () => {
    renderPage();
    const rows = screen.getAllByRole('row');
    const firstHalf = rows.find((r) => r.textContent?.includes('2. Eerste helft'))!;
    expect(within(firstHalf).getByText('Anna')).toBeTruthy();
    expect(within(firstHalf).getByText('Bas')).toBeTruthy();
  });

  it('shows a call sheet per position, including items for everyone', () => {
    renderPage();
    fireEvent.change(screen.getByRole('combobox'), {target: {value: '1'}});
    expect(screen.getByText('Call sheet: Camera')).toBeTruthy();
    expect(screen.getByText('Opening')).toBeTruthy();
    expect(screen.getByText('Iedereen')).toBeTruthy();
    expect(screen.queryByText('Alleen regie')).toBeNull();
  });
});
