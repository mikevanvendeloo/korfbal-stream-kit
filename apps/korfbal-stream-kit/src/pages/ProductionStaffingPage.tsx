import React from 'react';
import { useParams } from 'react-router-dom';
import ChapterAssignmentsCard from '../components/ChapterAssignmentsCard';
import {
  useProductionChapters,
  useProductionPersonPositions,
  useProductionPersons,
  usePositions,
  useProduction,
} from '../hooks/useProductions';
import { usePersons } from '../hooks/usePersons';
import ProductionWideAssignmentsCard from '../components/ProductionWideAssignmentsCard';
import ChapterOverridesManager from '../components/ChapterOverridesManager';

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

/** Bezetting tab: who does what during the production, overall and per hoofdstuk. */
export default function ProductionStaffingPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const { data: prod, isError: isProdError, error: prodError } = useProduction(id);
  const chapters = useProductionChapters(id);
  const { data: productionPersonPositions } = useProductionPersonPositions(id);
  const { data: productionPersons } = useProductionPersons(id);
  const { data: allPositions } = usePositions();
  const personsList = usePersons({ page: 1, limit: 200 });

  const [personFilterId, setPersonFilterId] = React.useState<number | null>(null);

  if (!Number.isInteger(id) || id <= 0) {
    return <div className="container py-6 text-gray-800 dark:text-gray-100">Ongeldige productie id</div>;
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProductionWideAssignmentsCard productionId={id} />
      </div>

      <div className="mt-8">
        <ChapterOverridesManager
          productionId={id}
          chapters={chapters.data || []}
          productionPersons={productionPersons || []}
          allPositions={allPositions || []}
          productionPersonPositions={productionPersonPositions || []}
        />
      </div>

      <div className="mt-8">
        <div className="flex items-end justify-between mb-3">
          <h2 className="font-semibold">Effectieve bezetting per hoofdstuk</h2>
          <PersonFilterControlInner
            value={personFilterId}
            onChange={setPersonFilterId}
            persons={(personsList.data?.items || []).map((p) => ({ id: p.id, name: p.name }))}
          />
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Dit overzicht toont de effectieve toewijzingen per hoofdstuk (productie-breed + afwijkingen).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(chapters.data || []).map((c, i) => (
            <ChapterAssignmentsCard
              key={c.id}
              chapter={c}
              chapterNumber={i + 1}
              allChapters={chapters.data || []}
              personFilterId={personFilterId}
              productionPersonPositions={productionPersonPositions || []}
              productionPersons={productionPersons || []}
              allPositions={allPositions || []}
            />
          ))}
          {chapters.data && chapters.data.length === 0 && (
            <div className="text-sm text-gray-500">Geen hoofdstukken</div>
          )}
        </div>
      </div>
    </div>
  );
}
