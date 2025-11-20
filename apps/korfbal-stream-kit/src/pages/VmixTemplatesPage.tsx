import React from 'react';
import {
  TitleDefinition,
  TitlePart,
  useCreateTitleTemplate,
  useDeleteTitleTemplate,
  useReorderTitleTemplates,
  useTitleTemplates,
  useUpdateTitleTemplate,
} from '../hooks/useTitles';

const sourceOptions = [
  { value: 'PRESENTATION_AND_ANALIST', label: 'Presentatie & analist' },
  { value: 'PRESENTATION', label: 'Presentatie'},
  { value: 'COMMENTARY', label: 'Commentaar (allen)' },
  { value: 'TEAM_PLAYER', label: 'Team speler' },
  { value: 'TEAM_COACH', label: 'Team coach' },
  { value: 'FREE_TEXT', label: 'Vrije tekst' },
] as const;

const sideOptions = [
  { value: 'NONE', label: '—' },
  { value: 'HOME', label: 'Thuis' },
  { value: 'AWAY', label: 'Uit' },
] as const;

function TitlePartRow({ part, onChange, onRemove }: { part: TitlePart; onChange: (p: TitlePart) => void; onRemove: () => void }) {
  const showTeam = part.sourceType === 'TEAM_PLAYER' || part.sourceType === 'TEAM_COACH';
  const showLimit = showTeam; // limiet alleen logisch bij teamlijsten
  const isFree = part.sourceType === 'FREE_TEXT';
  return (
    <div className="flex items-end gap-2 flex-wrap">
      <label className="text-xs">
        <div className="mb-1">Bron</div>
        <select className="px-2 py-1 border rounded" value={part.sourceType} onChange={(e) => onChange({ ...part, sourceType: e.target.value as any })}>
          {sourceOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {showTeam && (
        <label className="text-xs">
          <div className="mb-1">Team</div>
          <select className="px-2 py-1 border rounded" value={part.teamSide || 'NONE'} onChange={(e) => onChange({ ...part, teamSide: e.target.value as any })}>
            {sideOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {showLimit && (
        <label className="text-xs">
          <div className="mb-1">Limiet</div>
          <input
            type="number"
            min={1}
            className="px-2 py-1 border rounded w-24"
            value={part.limit ?? ''}
            onChange={(e) => onChange({ ...part, limit: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
          />
        </label>
      )}
      {isFree && (
        <>
          <label className="text-xs">
            <div className="mb-1">Functie</div>
            <input
              className="px-2 py-1 border rounded min-w-[12rem]"
              value={part.customFunction || ''}
              onChange={(e) => onChange({ ...part, customFunction: e.target.value })}
              placeholder="Bijv. Presentator"
            />
          </label>
          <label className="text-xs">
            <div className="mb-1">Naam</div>
            <input
              className="px-2 py-1 border rounded min-w-[12rem]"
              value={part.customName || ''}
              onChange={(e) => onChange({ ...part, customName: e.target.value })}
              placeholder="Bijv. Jan Jansen"
            />
          </label>
        </>
      )}
      <button type="button" className="px-2 py-1 border rounded text-red-600" onClick={onRemove}>
        Verwijder
      </button>
    </div>
  );
}

function TemplateEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial?: Partial<TitleDefinition>;
  onCancel: () => void;
  onSave: (data: { name: string; enabled?: boolean; parts: TitlePart[] }) => Promise<void> | void;
}) {
  const [name, setName] = React.useState(initial?.name || '');
  const [enabled, setEnabled] = React.useState<boolean>(initial?.enabled ?? true);
  const [parts, setParts] = React.useState<TitlePart[]>(
    initial?.parts && initial.parts.length > 0
      ? initial.parts.map((p) => ({ sourceType: p.sourceType as any, teamSide: p.teamSide, limit: p.limit ?? null, filters: (p as any).filters, customFunction: (p as any).customFunction ?? '', customName: (p as any).customName ?? '' }))
      : [{ sourceType: 'PRESENTATION_AND_ANALIST', teamSide: 'NONE', limit: null } as any]
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Naam is verplicht');
    if (parts.length === 0) return setError('Voeg minimaal 1 onderdeel toe');
    try {
      setBusy(true);
      await onSave({ name: name.trim(), enabled, parts });
    } catch (err: any) {
      setError(err?.message || 'Opslaan mislukt');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 p-4 rounded shadow w-[720px] max-w-[95vw] text-gray-800 dark:text-gray-100">
        <h3 className="font-semibold mb-2">{initial?.id ? 'Template bewerken' : 'Nieuwe template'}</h3>
        {error && (
          <div role="alert" className="mb-3 rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 px-3 py-2">
            {error}
          </div>
        )}
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-xs">
            <div className="mb-1">Naam</div>
            <input className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-950" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            <span>Ingeschakeld</span>
          </label>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-medium">Onderdelen</div>
              <button type="button" className="px-2 py-1 border rounded" onClick={() => setParts((p) => [...p, { sourceType: 'COMMENTARY', teamSide: 'NONE', limit: null } as any])}>
                Onderdeel toevoegen
              </button>
            </div>
            <div className="space-y-2">
              {parts.map((p, idx) => (
                <TitlePartRow key={idx} part={p} onChange={(np) => setParts((arr) => arr.map((it, i) => (i === idx ? np : it)))} onRemove={() => setParts((arr) => arr.filter((_, i) => i !== idx))} />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="px-3 py-1 border rounded" onClick={onCancel}>
              Annuleren
            </button>
            <button disabled={busy} type="submit" className="px-3 py-1 border rounded bg-blue-600 text-white disabled:opacity-60">
              {busy ? 'Opslaan…' : 'Opslaan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VmixTemplatesPage() {
  const { data, isLoading, isError, error } = useTitleTemplates();
  const createTemplate = useCreateTitleTemplate();
  const updateTemplate = useUpdateTitleTemplate();
  const deleteTemplate = useDeleteTitleTemplate();
  const reorder = useReorderTitleTemplates();

  const [modal, setModal] = React.useState<null | { mode: 'create' | 'edit'; def?: TitleDefinition }>(null);

  function move(def: TitleDefinition, dir: -1 | 1) {
    if (!data) return;
    const ordered = [...data].sort((a, b) => a.order - b.order);
    const index = ordered.findIndex((d) => d.id === def.id);
    const swap = ordered[index + dir];
    if (!swap) return;
    const ids = ordered.map((d) => d.id);
    [ids[index], ids[index + dir]] = [ids[index + dir], ids[index]];
    reorder.mutate(ids);
  }

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">vMix Titel-templates</h1>
        <button className="px-3 py-1 border rounded" onClick={() => setModal({ mode: 'create' })}>
          Nieuwe template
        </button>
      </div>
      {isError && <div role="alert" className="mb-2 text-sm text-red-600">{(error as any)?.message || 'Laden mislukt'}</div>}
      {isLoading && <div className="text-sm text-gray-500">Laden…</div>}
      <ul className="divide-y divide-gray-200 dark:divide-gray-800">
        {(data || [])
          .sort((a, b) => a.order - b.order)
          .map((d, idx, arr) => (
            <li key={d.id} className="py-2 flex items-center justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex w-6 justify-center text-xs text-gray-500">{d.order}</span>
                  <span className="font-medium truncate">{d.name}</span>
                  {!d.enabled && <span className="text-xs text-gray-500">(uitgeschakeld)</span>}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {d.parts.map((p, i) => {
                    const src = sourceOptions.find((o) => o.value === p.sourceType)?.label || p.sourceType;
                    const side = sideOptions.find((o) => o.value === (p.teamSide || 'NONE'))?.label || '';
                    const lim = p.limit ? ` (max ${p.limit})` : '';
                    const parts = [src, side !== '—' ? side : ''].filter(Boolean).join(' · ');
                    return (
                      <span key={i}>
                        {i > 0 ? ' | ' : ''}
                        {parts}
                        {lim}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className={`px-2 py-1 border rounded ${idx === 0 ? 'opacity-40' : ''}`} onClick={() => move(d, -1)} title="Omhoog">
                  ↑
                </button>
                <button className={`px-2 py-1 border rounded ${idx === arr.length - 1 ? 'opacity-40' : ''}`} onClick={() => move(d, +1)} title="Omlaag">
                  ↓
                </button>
                <button className="px-2 py-1 border rounded" onClick={() => setModal({ mode: 'edit', def: d })}>
                  Bewerk
                </button>
                <button className="px-2 py-1 border rounded text-red-600" onClick={() => deleteTemplate.mutate(d.id)}>
                  Verwijder
                </button>
              </div>
            </li>
          ))}
        {data && data.length === 0 && <li className="py-2 text-sm text-gray-500">Geen templates</li>}
      </ul>

      {modal && (
        <TemplateEditor
          initial={modal.mode === 'edit' ? modal.def : undefined}
          onCancel={() => setModal(null)}
          onSave={async (input) => {
            if (modal.mode === 'create') await createTemplate.mutateAsync(input);
            else if (modal.def) await updateTemplate.mutateAsync({ id: modal.def.id, ...input });
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
