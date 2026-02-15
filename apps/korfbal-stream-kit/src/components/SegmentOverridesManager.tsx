import React from 'react';
import {MdAdd, MdDelete} from 'react-icons/md';
import {
  Position,
  ProductionPersonPosition,
  ProductionSegment,
  useAddSegmentAssignment,
} from '../hooks/useProductions';
import IconButton from './IconButton';

interface SegmentOverride {
  id: number;
  personId: number;
  personName: string;
  segmentId: number;
  segmentName: string;
  positionId: number;
  positionName: string;
}

export default function SegmentOverridesManager({
  productionId,
  segments,
  productionPersons,
  allPositions,
  productionPersonPositions,
}: {
  productionId: number;
  segments: ProductionSegment[];
  productionPersons: Array<{ id: number; person: { id: number; name: string } }>;
  allPositions: Position[];
  productionPersonPositions: ProductionPersonPosition[];
}) {
  const [selectedPersonId, setSelectedPersonId] = React.useState<number | ''>('');
  const [selectedSegmentId, setSelectedSegmentId] = React.useState<number | ''>('');
  const [selectedPositionId, setSelectedPositionId] = React.useState<number | ''>('');
  const [error, setError] = React.useState<string | null>(null);
  const [allOverrides, setAllOverrides] = React.useState<SegmentOverride[]>([]);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  // Get the mutation for the selected segment
  const addMutation = useAddSegmentAssignment(Number(selectedSegmentId) || 0);

  // Fetch all segment assignments when component mounts or refreshTrigger changes
  React.useEffect(() => {
    const fetchAllAssignments = async () => {
      const overrides: SegmentOverride[] = [];

      for (const segment of segments) {
        try {
          const response = await fetch(`/api/production/segments/${segment.id}/assignments`);
          if (response.ok) {
            const data = await response.json();
            data.forEach((assignment: any) => {
              overrides.push({
                id: assignment.id,
                personId: assignment.person.id,
                personName: assignment.person.name,
                segmentId: segment.id,
                segmentName: segment.naam,
                positionId: assignment.position.id,
                positionName: assignment.position.name,
              });
            });
          }
        } catch (err) {
          console.error(`Failed to fetch assignments for segment ${segment.id}:`, err);
        }
      }

      // Sort by person name, then segment order
      overrides.sort((a, b) => {
        const personCompare = a.personName.localeCompare(b.personName);
        if (personCompare !== 0) return personCompare;
        const segA = segments.find((s) => s.id === a.segmentId);
        const segB = segments.find((s) => s.id === b.segmentId);
        return (segA?.volgorde || 0) - (segB?.volgorde || 0);
      });

      setAllOverrides(overrides);
    };

    if (segments.length > 0) {
      fetchAllAssignments();
    }
  }, [segments, refreshTrigger]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedPersonId || !selectedSegmentId || !selectedPositionId) {
      setError('Selecteer een persoon, segment en positie');
      return;
    }

    try {
      await addMutation.mutateAsync({
        personId: Number(selectedPersonId),
        positionId: Number(selectedPositionId),
      });
      // Reset form
      setSelectedPositionId('');
      setSelectedSegmentId('');
      setSelectedPersonId('');
      // Trigger refresh
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      setError(err?.message || 'Toevoegen mislukt');
    }
  };

  const handleDelete = async (override: SegmentOverride) => {
    setError(null);
    try {
      const response = await fetch(`/api/production/segments/${override.segmentId}/assignments/${override.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Delete failed');
      }
      // Trigger refresh
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      setError(err?.message || 'Verwijderen mislukt');
    }
  };

  // Get production-wide positions for selected person (for context)
  const selectedPersonProductionPositions = React.useMemo(() => {
    if (!selectedPersonId) return [];
    return productionPersonPositions
      .filter((pp) => pp.personId === Number(selectedPersonId))
      .map((pp) => pp.position.name);
  }, [selectedPersonId, productionPersonPositions]);

  return (
    <div className="border rounded p-4 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <h2 className="text-lg font-semibold mb-3">Segment-specifieke afwijkingen</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Voeg hier afwijkingen toe voor specifieke segmenten. De productie-brede posities zijn de standaard.
      </p>

      {error && (
        <div
          role="alert"
          className="mb-3 rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 px-3 py-2"
        >
          {error}
        </div>
      )}

      {/* Add new override form */}
      <form onSubmit={handleAdd} className="mb-6 p-4 border rounded dark:border-gray-600 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2 mb-2">
          <MdAdd className="w-5 h-5" />
          <h3 className="font-medium">Nieuwe afwijking toevoegen</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm">
            <div className="mb-1 font-medium">Persoon</div>
            <select
              value={selectedPersonId}
              onChange={(e) => setSelectedPersonId(e.target.value ? Number(e.target.value) : '')}
              className="w-full border rounded px-2 py-1.5 dark:bg-gray-900 dark:border-gray-700"
            >
              <option value="">— Selecteer persoon —</option>
              {productionPersons.map((pp) => (
                <option key={pp.person.id} value={pp.person.id}>
                  {pp.person.name}
                </option>
              ))}
            </select>
            {selectedPersonId && selectedPersonProductionPositions.length > 0 && (
              <div className="mt-1 text-xs text-gray-500">
                Standaard: {selectedPersonProductionPositions.join(', ')}
              </div>
            )}
          </label>

          <label className="text-sm">
            <div className="mb-1 font-medium">Segment</div>
            <select
              value={selectedSegmentId}
              onChange={(e) => setSelectedSegmentId(e.target.value ? Number(e.target.value) : '')}
              className="w-full border rounded px-2 py-1.5 dark:bg-gray-900 dark:border-gray-700"
            >
              <option value="">— Selecteer segment —</option>
              {segments.map((seg) => (
                <option key={seg.id} value={seg.id}>
                  {seg.volgorde}. {seg.naam}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <div className="mb-1 font-medium">Positie (afwijking)</div>
            <select
              value={selectedPositionId}
              onChange={(e) => setSelectedPositionId(e.target.value ? Number(e.target.value) : '')}
              className="w-full border rounded px-2 py-1.5 dark:bg-gray-900 dark:border-gray-700"
            >
              <option value="">— Selecteer positie —</option>
              {allPositions.map((pos) => (
                <option key={pos.id} value={pos.id}>
                  {pos.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="submit"
          disabled={!selectedPersonId || !selectedSegmentId || !selectedPositionId || addMutation.isPending}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          <MdAdd className="w-5 h-5" />
          <span>Afwijking toevoegen</span>
        </button>
      </form>

      {/* List of overrides */}
      <div>
        <h3 className="font-medium mb-2">Huidige afwijkingen ({allOverrides.length})</h3>
        {allOverrides.length === 0 ? (
          <p className="text-sm text-gray-500">Geen segment-specifieke afwijkingen. Alle personen gebruiken hun productie-brede posities.</p>
        ) : (
          <div className="space-y-2">
            {allOverrides.map((override) => (
              <div
                key={`${override.segmentId}-${override.id}`}
                className="flex items-center justify-between p-3 border rounded dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                <div className="flex-grow grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">Persoon</div>
                    <div className="font-medium">{override.personName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Segment</div>
                    <div>{override.segmentName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Positie</div>
                    <div className="font-medium text-blue-600 dark:text-blue-400">{override.positionName}</div>
                  </div>
                </div>
                <IconButton
                  ariaLabel="Verwijder afwijking"
                  title="Verwijder afwijking"
                  onClick={() => handleDelete(override)}
                >
                  <MdDelete className="w-5 h-5 text-red-600" />
                </IconButton>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
