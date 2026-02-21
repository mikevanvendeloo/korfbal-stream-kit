import { renderHook, waitFor } from '@testing-library/react';
import { useProductionTitles } from './useTitles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { vi } from 'vitest';

// Mock fetch
global.fetch = vi.fn();

describe('useProductionTitles', () => {
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

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );

  it('should return production-specific titles, sorted by order', async () => {
    const mockProdTitles = [
      { id: 1, name: 'Production Title 2', order: 2 },
      { id: 2, name: 'Production Title 1', order: 1 },
    ];

    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/production/1/titles')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockProdTitles),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    const { result } = renderHook(() => useProductionTitles(1), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([
      { id: 2, name: 'Production Title 1', order: 1 },
      { id: 1, name: 'Production Title 2', order: 2 },
    ]);
  });

  it('should return default titles if production-specific titles are empty, sorted by order', async () => {
    const mockDefaultTitles = [
      { id: 101, name: 'Default Title 2', order: 2 },
      { id: 100, name: 'Default Title 1', order: 1 },
    ];

    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/production/1/titles')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]), // Empty array
        });
      }
      if (url.includes('/api/admin/vmix/title-templates')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDefaultTitles),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    const { result } = renderHook(() => useProductionTitles(1), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([
      { id: 100, name: 'Default Title 1', order: 1 },
      { id: 101, name: 'Default Title 2', order: 2 },
    ]);
  });
});
