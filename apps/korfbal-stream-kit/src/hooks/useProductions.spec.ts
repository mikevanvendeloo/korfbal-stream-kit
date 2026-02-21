import { renderHook, waitFor } from '@testing-library/react';
import { useProductionInterviews } from './useProductions';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { vi } from 'vitest';
import { useProductionTitles } from './useTitles';

// Mock fetch and other hooks
vi.mock('./useTitles');
global.fetch = vi.fn();

const mockUseProductionTitles = useProductionTitles as jest.Mock;

describe('useProductionInterviews', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  it('should sort interviews based on the index in the sorted titles array', async () => {
    const mockInterviews = [
      { id: 1, titleDefinitionId: 10, player: { name: 'Player A' } }, // Should be second
      { id: 2, titleDefinitionId: 5, player: { name: 'Player B' } },  // Should be first
      { id: 3, titleDefinitionId: null, player: { name: 'Player C' } },// Should be last
      { id: 4, titleDefinitionId: 20, player: { name: 'Player D' } }, // Should be third
    ];

    // The titles hook now guarantees the order
    const mockSortedTitles = [
      { id: 5, order: 1 },
      { id: 10, order: 2 },
      { id: 20, order: 3 },
    ];

    // Mock the fetch for interviews
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockInterviews,
    });

    // Mock the titles hook to return the pre-sorted list
    mockUseProductionTitles.mockReturnValue({
      data: mockSortedTitles,
      isSuccess: true,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      React.createElement(QueryClientProvider, { client: queryClient }, children)
    );

    const { result } = renderHook(() => useProductionInterviews(1), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const sorted = result.current.data;
    expect(sorted).toHaveLength(4);

    expect(sorted![0].id).toBe(2); // Corresponds to title.id 5 (index 0)
    expect(sorted![1].id).toBe(1); // Corresponds to title.id 10 (index 1)
    expect(sorted![2].id).toBe(4); // Corresponds to title.id 20 (index 2)
    expect(sorted![3].id).toBe(3); // null titleDefinitionId (last)
  });
});
