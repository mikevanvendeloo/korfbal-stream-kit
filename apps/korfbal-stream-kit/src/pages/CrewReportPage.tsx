import React from 'react';
import {Link, useParams} from 'react-router-dom';
import {useCrewReport} from '../hooks/useCallsheet';

export default function CrewReportPage() {
  const params = useParams<{ id: string }>();
  const productionId = Number(params.id);
  const { data, isLoading, error } = useCrewReport(productionId);

  if (!productionId) return <div className="container py-6">Invalid production id</div>;
  if (isLoading) return <div className="container py-6">Laden…</div>;
  if (error) return <div className="container py-6 text-red-700">{String((error as any)?.message || error)}</div>;
  if (!data) return <div className="container py-6">Geen data</div>;

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Crew report</h1>
        <Link className="underline" to={`/admin/productions/${productionId}`}>Terug naar productie</Link>
      </div>

      <div className="overflow-auto border rounded-md">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900">
              <th className="p-2 text-left sticky left-0 bg-gray-50 dark:bg-gray-900">Segment</th>
              {data.positions.map((pos) => (
                <th key={pos.id} className="p-2 text-left whitespace-nowrap">{pos.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.segments.map((seg) => (
              <tr key={seg.id} className="border-t">
                <th className="p-2 text-left sticky left-0 bg-white dark:bg-gray-950">{seg.volgorde}. {seg.naam}</th>
                {data.positions.map((pos) => {
                  const names = data.cells
                    .filter((c) => c.segmentId === seg.id && c.positionId === pos.id)
                    .map((c) => c.personName);
                  return (
                    <td key={pos.id} className="p-2 align-top">
                      {names.length ? names.join(', ') : <span className="text-gray-400">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
