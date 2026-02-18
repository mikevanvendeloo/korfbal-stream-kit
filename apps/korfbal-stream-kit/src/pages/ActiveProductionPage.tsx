import {Link, useNavigate} from 'react-router-dom';
import {useProductions, useProductionSegments} from '../hooks/useProductions';
import ProductionHeader from '../components/ProductionHeader';

export default function ActiveProductionPage() {
  const { data, isLoading, error } = useProductions();
  const navigate = useNavigate();

  const active = data?.items.find((p) => p.isActive);
  const segs = useProductionSegments(active?.id || 0);

  if (isLoading) return <div className="container py-6 text-gray-800 dark:text-gray-100">Laden…</div>;
  if (error) return <div className="container py-6 text-red-700">{String((error as any)?.message || error)}</div>;
  if (!active) return <div className="container py-6 text-gray-800 dark:text-gray-100">Geen actieve productie. Ga naar <Link className="underline" to="/admin/productions">Productions</Link>.</div>;

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Actieve productie #{active.id}</h1>
        <div className="flex gap-2">
          <Link className="underline" to={`/admin/productions/${active.id}`}>Details</Link>
          <Link className="underline" to={`/admin/productions/${active.id}/callsheets`}>Callsheet</Link>
        </div>
      </div>

      {/* Match header with logos and start time (reused component) */}
      <ProductionHeader productionId={active.id} />

      <div className="border rounded-md divide-y divide-gray-200 dark:divide-gray-800">
        {segs.data?.map((s) => (
          <div key={s.id} className="p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{s.volgorde}. {s.naam}</div>
              <div className="text-sm text-gray-500">Duur: {s.duurInMinuten} minuten{ s.isTimeAnchor ? ' • Anchor' : ''}</div>
            </div>
            <Link className="text-sm underline" to={`/admin/productions/${active.id}`}>Beheer segmenten</Link>
          </div>
        ))}
        {!segs.data?.length && (
          <div className="p-3 text-gray-600">Geen segmenten</div>
        )}
      </div>
    </div>
  );
}
