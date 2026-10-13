import React from 'react';
import {
  InterviewRole,
  InterviewSide,
  useInterviewOptions,
  useInterviewSelections,
  useSaveInterviewSelections
} from '../hooks/useInterviews';

type SelKey = `${InterviewSide}-${InterviewRole}`;
type Selection = Record<SelKey, { playerId: number | null }>;

const keys: SelKey[] = ['HOME-PLAYER', 'AWAY-PLAYER', 'HOME-COACH', 'AWAY-COACH'];

function emptySelection(): Selection {
  return {
    'HOME-PLAYER': { playerId: null },
    'AWAY-PLAYER': { playerId: null },
    'HOME-COACH': { playerId: null },
    'AWAY-COACH': { playerId: null },
  };
}

function OptionSelect({ label, value, options, loading, onChange }: {
  label: string;
  value: number | null;
  options: Array<{ id: number; name: string; function?: string | null }>;
  loading?: boolean;
  onChange: (playerId: number | null) => void;
}) {
  return (
    <div className="flex items-end gap-2">
      <label className="text-xs">
        <div className="mb-1">{label}</div>
        <select
          className="px-2 py-1 border rounded min-w-[16rem] disabled:opacity-60 bg-white dark:bg-gray-900"
          value={value ?? ''}
          disabled={loading}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— kies —</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}{o.function ? ` – ${o.function}` : ''}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** Choose the home/away player and coach to interview. Used by both the LIVE and the admin app. */
export default function InterviewSelector({ productionId, className }: { productionId: number; className?: string }) {
  const interviews = useInterviewSelections(productionId);
  const saveInterviews = useSaveInterviewSelections(productionId);
  const [localSel, setLocalSel] = React.useState<Selection>(emptySelection);

  // Load options for each combination
  const optHomePlayer = useInterviewOptions(productionId, 'HOME', 'PLAYER');
  const optAwayPlayer = useInterviewOptions(productionId, 'AWAY', 'PLAYER');
  const optHomeCoach = useInterviewOptions(productionId, 'HOME', 'COACH');
  const optAwayCoach = useInterviewOptions(productionId, 'AWAY', 'COACH');

  React.useEffect(() => {
    if (!interviews.data) return;
    const map = emptySelection();
    // Prefer title-agnostic selection for each key; if multiple exist, pick the one without titleDefinitionId.
    for (const it of interviews.data) {
      const k = `${it.side}-${it.role}` as SelKey;
      if (!map[k].playerId || it.titleDefinitionId == null) {
        map[k] = { playerId: it.playerId };
      }
    }
    setLocalSel(map);
  }, [interviews.data]);

  // Geen automatische voorselectie: alles blijft leeg totdat de gebruiker kiest.

  function handleSaveInterviews() {
    const items: Array<{ side: InterviewSide; role: InterviewRole; playerId: number; titleDefinitionId: null }> = [];
    for (const k of keys) {
      const sel = localSel[k];
      if (sel?.playerId) {
        const [side, role] = k.split('-') as [InterviewSide, InterviewRole];
        items.push({ side, role, playerId: sel.playerId, titleDefinitionId: null });
      }
    }
    saveInterviews.mutate(items);
  }

  const select = (k: SelKey) => ({
    value: localSel[k]?.playerId ?? null,
    onChange: (playerId: number | null) => setLocalSel((s) => ({ ...s, [k]: { playerId } })),
  });

  return (
    <div className={className ?? 'p-3 border rounded bg-gray-50 dark:bg-gray-900/30'}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">Interview selectie</h3>
        <button
          className="px-3 py-1 border rounded"
          onClick={handleSaveInterviews}
          disabled={saveInterviews.isPending || optHomePlayer.isLoading || optAwayPlayer.isLoading || optHomeCoach.isLoading || optAwayCoach.isLoading}
          aria-label="save-interviews"
        >{saveInterviews.isPending ? 'Interview opslaan…' : 'Interview opslaan'}</button>
      </div>
      {interviews.isError && <div role="alert" className="mb-2 text-sm text-red-600">{(interviews.error as any)?.message || 'Interview selectie laden mislukt'}</div>}
      {saveInterviews.isError && <div role="alert" className="mb-2 text-sm text-red-600">{(saveInterviews.error as any)?.message || 'Interview opslaan mislukt'}</div>}
      <div className="space-y-2">
        <OptionSelect label="Thuis – speler/speelster" options={optHomePlayer.data?.items || []} loading={optHomePlayer.isLoading} {...select('HOME-PLAYER')} />
        <OptionSelect label="Uit – speler/speelster" options={optAwayPlayer.data?.items || []} loading={optAwayPlayer.isLoading} {...select('AWAY-PLAYER')} />
        <OptionSelect label="Thuis – coach" options={optHomeCoach.data?.items || []} loading={optHomeCoach.isLoading} {...select('HOME-COACH')} />
        <OptionSelect label="Uit – coach" options={optAwayCoach.data?.items || []} loading={optAwayCoach.isLoading} {...select('AWAY-COACH')} />
      </div>
      <div className="text-xs text-gray-500 mt-2">Kies per team een speler/speelster en coach. De selectie geldt automatisch voor alle relevante titels.</div>
    </div>
  );
}
