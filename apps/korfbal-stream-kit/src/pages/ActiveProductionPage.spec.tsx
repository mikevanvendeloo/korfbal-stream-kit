import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ActiveProductionPage from './ActiveProductionPage';
import { useProductions, useProductionInterviews, useProductionTiming, useProductionPersonPositions } from '../hooks/useProductions';
import { vi } from 'vitest';

// Mock the hooks
vi.mock('../hooks/useProductions');
vi.mock('../components/ProductionHeader', () => ({
  default: () => <div data-testid="production-header">Header</div>
}));

const mockUseProductions = useProductions as any;
const mockUseProductionInterviews = useProductionInterviews as any;
const mockUseProductionTiming = useProductionTiming as any;
const mockUseProductionPersonPositions = useProductionPersonPositions as any;

describe('ActiveProductionPage', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockUseProductions.mockReturnValue({
      data: {
        items: [
          { id: 1, isActive: true, liveTime: '2023-10-28T14:00:00' }
        ]
      },
      isLoading: false,
      error: null
    });

    mockUseProductionTiming.mockReturnValue({
      data: [],
      isLoading: false
    });

    mockUseProductionPersonPositions.mockReturnValue({
      data: [],
      isLoading: false
    });

    mockUseProductionInterviews.mockReturnValue({
      data: [],
      isLoading: false
    });
  });

  it('displays interviews in the order received from the hook', async () => {
    // This test verifies that the component correctly renders the list as provided by the hook.
    // The actual sorting logic is tested in the hook's own spec.
    const sortedInterviewsFromHook = [
      { id: 2, player: { name: 'First Interviewee' } },
      { id: 1, player: { name: 'Second Interviewee' } },
      { id: 4, player: { name: 'Third Interviewee' } },
      { id: 3, player: { name: 'Fourth Interviewee' } },
    ];

    mockUseProductionInterviews.mockReturnValue({
      data: sortedInterviewsFromHook,
      isLoading: false
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ActiveProductionPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const interviewItems = screen.getAllByText(/Interviewee/);
    expect(interviewItems).toHaveLength(4);
    expect(interviewItems[0]).toHaveTextContent('First Interviewee');
    expect(interviewItems[1]).toHaveTextContent('Second Interviewee');
    expect(interviewItems[2]).toHaveTextContent('Third Interviewee');
    expect(interviewItems[3]).toHaveTextContent('Fourth Interviewee');
  });
});
