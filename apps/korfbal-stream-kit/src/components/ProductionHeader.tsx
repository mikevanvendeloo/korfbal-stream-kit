import React from 'react';
import { useProduction } from '../hooks/useProductions';

function formatDateTime(iso?: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('nl-NL', { weekday: 'short', day: '2-digit', month: 'short' });
    const time = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
  } catch {
    return '';
  }
}

export default function ProductionHeader({ productionId }: { productionId: number }) {
  const { data, isLoading, isError, error } = useProduction(productionId);
  const ms = (data as any)?.matchSchedule as any | undefined;
  const title = ms ? `${ms.homeTeamName || 'Thuis?'} vs ${ms.awayTeamName || 'Uit?'}` : `Productie #${productionId}`;
  const sub = ms ? [formatDateTime(ms.date), ms.accommodationName].filter(Boolean).join(' · ') : undefined;

  return (
    <div className="mb-4 p-3 rounded border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30">
      {isError && <div role="alert" className="text-sm text-red-600">{(error as any)?.message || 'Productie laden mislukt'}</div>}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-lg font-semibold truncate">{title}</div>
          {sub && <div className="text-sm text-gray-600 dark:text-gray-400 truncate">{sub}</div>}
        </div>
        {isLoading && <div className="text-sm text-gray-500">Laden…</div>}
      </div>
    </div>
  );
}
