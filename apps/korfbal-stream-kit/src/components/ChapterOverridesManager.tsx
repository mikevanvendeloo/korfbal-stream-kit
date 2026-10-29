import React from 'react';
import {MdAdd, MdDelete} from 'react-icons/md';
import {
  ProductionPersonPosition,
  ProductionChapter,
  useAddChapterAssignment,
} from '../hooks/useProductions';
import IconButton from './IconButton';
import {Position} from '../hooks/usePositions';

interface ChapterOverride {
  id: number;
  personId: number;
  personName: string;
  chapterId: number;
  chapterName: string;
  positionId: number;
  positionName: string;
}

export default function ChapterOverridesManager({
  productionId,
  chapters,
  productionPersons,
  allPositions,
  productionPersonPositions,
}: {
  productionId: number;
  chapters: ProductionChapter[];
  productionPersons: Array<{ id: number; person: { id: number; name: string } }>;
  allPositions: Position[];
  productionPersonPositions: ProductionPersonPosition[];
}) {
  const [selectedPersonId, setSelectedPersonId] = React.useState<number | ''>('');
  const [selectedChapterId, setSelectedChapterId] = React.useState<number | ''>('');
  const [selectedPositionId, setSelectedPositionId] = React.useState<number | ''>('');
  const [error, setError] = React.useState<string | null>(null);
  const [allOverrides, setAllOverrides] = React.useState<ChapterOverride[]>([]);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  // Get the mutation for the selected hoofdstuk
  const addMutation = useAddChapterAssignment(Number(selectedChapterId) || 0);

  // Fetch the assignments of every hoofdstuk when the component mounts or refreshTrigger changes
  React.useEffect(() => {
    const fetchAllAssignments = async () => {
      const overrides: ChapterOverride[] = [];

      for (const chapter of chapters) {
        try {
          const response = await fetch(`/api/production/segments/${chapter.id}/assignments`);
          if (response.ok) {
            const data = await response.json();
            data.forEach((assignment: any) => {
              overrides.push({
                id: assignment.id,
                personId: assignment.person.id,
                personName: assignment.person.name,
                chapterId: chapter.id,
                chapterName: chapter.name,
                positionId: assignment.position.id,
                positionName: assignment.position.name,
              });
            });
          }
        } catch (err) {
          console.error(`Failed to fetch assignments for hoofdstuk ${chapter.id}:`, err);
        }
      }

      // Sort by person name, then hoofdstuk order
      overrides.sort((a, b) => {
        const personCompare = a.personName.localeCompare(b.personName);
        if (personCompare !== 0) return personCompare;
        const chapterA = chapters.find((c) => c.id === a.chapterId);
        const chapterB = chapters.find((c) => c.id === b.chapterId);
        return (chapterA?.orderIndex || 0) - (chapterB?.orderIndex || 0);
      });

      setAllOverrides(overrides);
    };

    if (chapters.length > 0) {
      fetchAllAssignments();
    }
  }, [chapters, refreshTrigger]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedPersonId || !selectedChapterId || !selectedPositionId) {
      setError('Selecteer een persoon, hoofdstuk en positie');
      return;
    }

    try {
      await addMutation.mutateAsync({
        personId: Number(selectedPersonId),
        positionId: Number(selectedPositionId),
      });
      // Reset form
      setSelectedPositionId('');
      setSelectedChapterId('');
      setSelectedPersonId('');
      // Trigger refresh
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      setError(err?.message || 'Toevoegen mislukt');
    }
  };

  const handleDelete = async (override: ChapterOverride) => {
    setError(null);
    try {
      const response = await fetch(`/api/production/segments/${override.chapterId}/assignments/${override.id}`, {
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
      <h2 className="text-lg font-semibold mb-3">Afwijkingen per hoofdstuk</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Voeg hier afwijkingen toe voor een hoofdstuk. De productie-brede posities zijn de standaard.
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
            <div className="mb-1 font-medium">Hoofdstuk</div>
            <select
              value={selectedChapterId}
              onChange={(e) => setSelectedChapterId(e.target.value ? Number(e.target.value) : '')}
              className="w-full border rounded px-2 py-1.5 dark:bg-gray-900 dark:border-gray-700"
            >
              <option value="">— Selecteer hoofdstuk —</option>
              {chapters.map((chapter, i) => (
                <option key={chapter.id} value={chapter.id}>
                  {i + 1}. {chapter.name}
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
          disabled={!selectedPersonId || !selectedChapterId || !selectedPositionId || addMutation.isPending}
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
          <p className="text-sm text-gray-500">Geen afwijkingen per hoofdstuk. Alle personen gebruiken hun productie-brede posities.</p>
        ) : (
          <div className="space-y-2">
            {allOverrides.map((override) => (
              <div
                key={`${override.chapterId}-${override.id}`}
                className="flex items-center justify-between p-3 border rounded dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                <div className="flex-grow grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">Persoon</div>
                    <div className="font-medium">{override.personName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Hoofdstuk</div>
                    <div>{override.chapterName}</div>
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
