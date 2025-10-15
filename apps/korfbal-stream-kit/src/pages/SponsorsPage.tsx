import { useSponsors } from '../hooks/useSponsors';
import { SponsorsTable } from '../components/SponsorsTable';
import { useState } from 'react';

export default function SponsorsPage() {
  const [type, setType] = useState<undefined | 'premium' | 'goud' | 'zilver' | 'brons'>(undefined);
  const { data, isLoading, isError, error, refetch, isFetching } = useSponsors({ type, limit: 100 });

  return (
    <div className="container py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Sponsors</h1>
        <div className="flex items-center gap-2">
          <select
            aria-label="Filter type"
            className="border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2"
            value={type || ''}
            onChange={(e) => setType((e.target.value as any) || undefined)}
          >
            <option value="">Alle types</option>
            <option value="premium">Premium</option>
            <option value="goud">Goud</option>
            <option value="zilver">Zilver</option>
            <option value="brons">Brons</option>
          </select>
          <button
            onClick={() => refetch()}
            className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Vernieuwen {isFetching ? '…' : ''}
          </button>
        </div>
      </div>

      {isLoading && <div role="status" className="mt-6 text-gray-600 dark:text-gray-300">Laden…</div>}
      {isError && (
        <div role="alert" className="mt-6 text-red-600">Fout bij laden: {(error as Error).message}</div>
      )}

      {data && (
        <div className="mt-4">
          <SponsorsTable data={data.items} />
        </div>
      )}
    </div>
  );
}
