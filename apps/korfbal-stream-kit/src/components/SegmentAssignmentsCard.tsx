import React from 'react';
import {usePersons} from '../hooks/usePersons';
import {usePositionsCatalog} from '../hooks/usePositions';
import {
  ProductionSegment,
  useAddSegmentAssignment,
  useCopySegmentAssignments,
  useCrewPersonsForSegment,
  useDeleteSegmentAssignment,
  useSegmentAssignments,
} from '../hooks/useProductions';
import IconButton from './IconButton';
import {MdContentCopy, MdDelete} from 'react-icons/md';
import CopyAssignmentsModal from './CopyAssignmentsModal';

export default function SegmentAssignmentsCard({
  segment,
  allSegments,
  personFilterId,
}: {
  segment: ProductionSegment;
  allSegments: Array<ProductionSegment>;
  personFilterId?: number | null;
}) {
  const assignments = useSegmentAssignments(segment.id);
  const add = useAddSegmentAssignment(segment.id);
  const del = useDeleteSegmentAssignment(segment.id);
  const copyMut = useCopySegmentAssignments(segment.id);
  const persons = usePersons({ page: 1, limit: 200 });
  const crew = useCrewPersonsForSegment(segment.id);
  const positions = usePositionsCatalog();

  const [personId, setPersonId] = React.useState<number | ''>('');
  const [positionId, setPositionId] = React.useState<number | ''>('');
  const [error, setError] = React.useState<string | null>(null);
  const [showCopy, setShowCopy] = React.useState(false);

  const positionsList = positions.data || [];

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (!personId || !positionId) return;
      await add.mutateAsync({ personId: Number(personId), positionId: Number(positionId) });
      setPositionId('');
      // keep person selected for quick multi-role adding
    } catch (err: any) {
      setError(err?.message || 'Toevoegen mislukt');
    }
  }

  function filteredAssignments() {
    const items = assignments.data || [];
    if (!personFilterId) return items;
    return items.filter((a) => a.personId === personFilterId);
  }

  return (
    <div className="border rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-medium">{segment.volgorde}. {segment.naam}</div>
          <div className="text-xs text-gray-500">Duur: {segment.duurInMinuten} min</div>
        </div>
        <IconButton ariaLabel="Kopieer toewijzingen" title="Kopieer naar…" onClick={() => setShowCopy(true)}>
          <MdContentCopy className="w-5 h-5" />
        </IconButton>
      </div>

      {error && <div role="alert" className="mb-2 text-sm text-red-600">{error}</div>}

      <form className="flex flex-wrap items-end gap-2 mb-3" onSubmit={handleAdd}>
        <label className="text-sm">
          <div className="mb-1">Persoon</div>
          <select
            aria-label="Persoon"
            className="border rounded px-2 py-1 min-w-[12rem]"
            value={personId}
            onChange={(e) => setPersonId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">— kies —</option>
            {/* Prefer crew for this production if available; otherwise fall back to all persons */}
            {((crew.data && crew.data.length > 0) ? crew.data : (persons.data?.items || [])).map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {/* Helpful hint when there are no crew persons */}
          {crew.data && crew.data.length === 0 && (
            <div className="text-xs text-gray-500 mt-1">Geen gekoppelde personen aan deze productie. Gebruik de productie crew/rollen om personen te koppelen, of kies uit alle personen.</div>
          )}
        </label>
        <label className="text-sm">
          <div className="mb-1">Positie</div>
          <select
            aria-label="Positie"
            className="border rounded px-2 py-1 min-w-[12rem]"
            value={positionId}
            onChange={(e) => setPositionId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">— kies —</option>
            {positionsList.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="px-3 py-1 border rounded bg-green-600 text-white disabled:opacity-60 disabled:cursor-not-allowed" disabled={!personId || !positionId || add.isPending}>Toevoegen</button>
      </form>

      <ul className="divide-y divide-gray-200 dark:divide-gray-800">
        {assignments.isLoading && <li className="py-2 text-sm text-gray-500">Laden…</li>}
        {filteredAssignments().map((a) => (
          <li key={a.id} className="py-2 flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-medium truncate">{a.person.name}</div>
              <div className="text-xs text-gray-500 truncate">{a.position.name}</div>
            </div>
            <IconButton ariaLabel="Verwijder toewijzing" title="Verwijder" onClick={async () => { setError(null); try { await del.mutateAsync(a.id); } catch (e: any) { setError(e?.message || 'Verwijderen mislukt'); } }}>
              <MdDelete className="w-5 h-5 text-red-600" />
            </IconButton>
          </li>
        ))}
        {assignments.data && filteredAssignments().length === 0 && (
          <li className="py-2 text-sm text-gray-500">Geen toewijzingen</li>
        )}
      </ul>

      {showCopy && (
        <CopyAssignmentsModal
          segments={allSegments.map(s => ({ id: s.id, naam: s.naam, volgorde: s.volgorde }))}
          sourceSegmentId={segment.id}
          onCancel={() => setShowCopy(false)}
          onConfirm={async ({ targetSegmentIds, mode }) => {
            try {
              await copyMut.mutateAsync({ targetSegmentIds, mode });
              setShowCopy(false);
            } catch (e: any) {
              setError(e?.message || 'Kopiëren mislukt');
            }
          }}
        />
      )}
    </div>
  );
}
