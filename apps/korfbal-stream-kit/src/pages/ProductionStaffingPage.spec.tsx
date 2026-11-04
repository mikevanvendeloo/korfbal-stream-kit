import {fireEvent, render, screen} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {describe, expect, it, vi} from 'vitest';
import ProductionStaffingPage from './ProductionStaffingPage';

vi.mock('../hooks/useProductions', () => ({
  useProduction: () => ({data: {id: 7}, isError: false}),
  useProductionChapters: () => ({data: [{id: 10, name: 'Voorbeschouwing', orderIndex: 1}]}),
  useProductionPersonPositions: () => ({data: []}),
  useProductionPersons: () => ({data: []}),
  usePositions: () => ({data: []}),
}));
vi.mock('../hooks/usePersons', () => ({usePersons: () => ({data: {items: []}})}));
vi.mock('../components/ProductionWideAssignmentsCard', () => ({default: () => <div>Productie-brede posities</div>}));
vi.mock('../components/ChapterAssignmentsCard', () => ({default: () => <div>Hoofdstukkaart</div>}));
vi.mock('../components/ChapterOverridesManager', () => ({default: () => <div>Afwijkingen per hoofdstuk</div>}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/producties/7/bezetting']}>
      <Routes><Route path="/admin/producties/:id/bezetting" element={<ProductionStaffingPage/>}/></Routes>
    </MemoryRouter>
  );
}

describe('ProductionStaffingPage', () => {
  it('hides the afwijkingen per hoofdstuk behind Geavanceerd, the effective crew stays visible', () => {
    renderPage();
    const toggle = screen.getByRole('button', {name: 'Geavanceerd'});
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Afwijkingen per hoofdstuk')).toBeNull();
    expect(screen.getByText('Effectieve bezetting per hoofdstuk')).toBeTruthy();
    expect(screen.getByText('Hoofdstukkaart')).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Afwijkingen per hoofdstuk')).toBeTruthy();
  });
});
