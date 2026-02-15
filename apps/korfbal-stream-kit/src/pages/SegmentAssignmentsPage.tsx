import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SegmentAssignmentsCard from '../components/SegmentAssignmentsCard';
import {
  useProductionSegments,
  useProductionPersonPositions,
  useProductionPersons,
  usePositions,
  useProduction,
} from '../hooks/useProductions';
import { usePersons } from '../hooks/usePersons';
import ProductionHeader from '../components/ProductionHeader';

function PersonFilterControlInner({ value, onChange, persons }: { value: number | null; onChange: (v: number | null) => void; persons: Array<{ id: number; name: string }>; }) {
  return (
    <label className="text-sm">
      <div className="mb-1">Filter op persoon</div>
      <select
        aria-label="Filter op persoon"
        className="border rounded px-2 py-1 min-w-[12rem]"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">— alle —</option>
        {persons.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </label>
  );
}

export default function SegmentAssignmentsPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const navigate = useNavigate();

  const { data: prod, isError: isProdError, error: prodError } = useProduction(id);
  const segments = useProductionSegments(id);
  const { data: productionPersonPositions } = useProductionPersonPositions(id);
  const { data: productionPersons } = useProductionPersons(id);
  const { data: allPositions } = usePositions();
  const personsList = usePersons({ page: 1, limit: 200 });

  const [personFilterId, setPersonFilterId] = React.useState<number | null>(null);

  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="container py-6 text-gray-800 dark:text-gray-100">
        <div>Ongeldige productie id</div>
        <button className="mt-3 px-3 py-1 border rounded" onClick={() => navigate(-1)}>Terug</button>
      </div>
    );
  }

  if (isProdError) {
    return (
      <div className="container py-6 text-gray-800 dark:text-gray-100">
        <div role="alert" className="text-red-600">Fout bij laden productie: {(prodError as any)?.message}</div>
      </div>
    );
  }

  if (!prod) {
    return (
      <div className="container py-6 text-gray-800 dark:text-gray-100">
        <div>Laden productiegegevens...</div>
      </div>
    );
  }

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <ProductionHeader productionId={id} showLogos={false} />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Segment Toewijzingen</h1>
        <button className="px-3 py-1 border rounded" onClick={() => navigate(`/admin/productions/${id}`)}>Terug naar productiedetails</button>
      </div>

      <div className="mt-8">
        <div className="flex items-end justify-between mb-3">
          <h2 className="font-semibold">Effectieve bezetting per segment</h2>
          <PersonFilterControlInner
            value={personFilterId}
            onChange={setPersonFilterId}
            persons={(personsList.data?.items || []).map((p) => ({ id: p.id, name: p.name }))}
          />
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Dit overzicht toont de effectieve toewijzingen per segment (productie-breed + afwijkingen).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(segments.data || []).map((s) => (
            <SegmentAssignmentsCard
              key={s.id}
              segment={s}
              allSegments={segments.data || []}
              personFilterId={personFilterId}
              productionPersonPositions={productionPersonPositions || []}
              productionPersons={productionPersons || []}
              allPositions={allPositions || []}
            />
          ))}
          {segments.data && segments.data.length === 0 && (
            <div className="text-sm text-gray-500">Geen segmenten</div>
          )}
        </div>
      </div>
    </div>
  );
}
