import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import IconButton from '../components/IconButton';
import { MdDelete, MdEdit, MdAdd } from 'react-icons/md';

export type Capability = { id: number; code: string; functionName: string; nameMale: string; nameFemale: string; vMixTitle?: boolean; createdAt?: string };

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3333';
const url = (p: string) => new URL(p, API_BASE || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3333')).toString();

async function extractError(res: Response): Promise<string> {
  try {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const body: any = await res.json().catch(() => ({}));
      if (body && (body.error || body.message)) return String(body.error || body.message);
    } else {
      const text = await res.text();
      if (text) return text;
    }
  } catch {}
  return `Request failed (${res.status})`;
}

function useCapabilities(q?: string) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  const qk = ['capabilities', q] as const;
  return useQuery({
    queryKey: qk,
    queryFn: async (): Promise<{ items: Capability[]; total: number }> => {
      const res = await fetch(url(`/api/capabilities?${params.toString()}`));
      if (!res.ok) throw new Error(await extractError(res));
      const data = await res.json();
      return Array.isArray(data) ? { items: data, total: data.length } : data;
    },
  });
}

function useCreateCapability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { code: string; functionName: string; nameMale: string; nameFemale: string; vMixTitle?: boolean }) => {
      const res = await fetch(url('/api/capabilities'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, vMixTitle: !!input.vMixTitle }) });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['capabilities'] }),
  });
}

function useUpdateCapability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; code?: string; functionName?: string; nameMale?: string; nameFemale?: string; vMixTitle?: boolean }) => {
      const res = await fetch(url(`/api/capabilities/${input.id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: input.code, functionName: input.functionName, nameMale: input.nameMale, nameFemale: input.nameFemale, vMixTitle: input.vMixTitle }) });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['capabilities'] }),
  });
}

function useDeleteCapability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(url(`/api/capabilities/${id}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['capabilities'] }),
  });
}

export default function CapabilitiesAdminPage() {
  const [q, setQ] = React.useState('');
  const { data, isLoading, error } = useCapabilities(q);
  const create = useCreateCapability();
  const update = useUpdateCapability();
  const del = useDeleteCapability();

  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<{ id?: number; code: string; functionName: string; nameMale: string; nameFemale: string; vMixTitle?: boolean } | null>(null);

  const columns = React.useMemo<ColumnDef<Capability>[]>(() => [
    { header: 'Code', accessorKey: 'code' },
    { header: 'Functie', accessorKey: 'functionName' },
    { header: 'Male', accessorKey: 'nameMale' },
    { header: 'Female', accessorKey: 'nameFemale' },
    { header: 'vMixTitle', accessorKey: 'vMixTitle', cell: ({ row }) => (<input type="checkbox" checked={!!row.original.vMixTitle} readOnly aria-label={`vMixTitle-${row.original.code}`} />) },
    {
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <IconButton ariaLabel="Edit capability" title="Wijzig" onClick={() => setEditing({ id: row.original.id, code: row.original.code, functionName: row.original.functionName, nameMale: row.original.nameMale, nameFemale: row.original.nameFemale, vMixTitle: !!row.original.vMixTitle })}>
            <MdEdit className="w-5 h-5" />
          </IconButton>
          <IconButton ariaLabel="Delete capability" title="Verwijder" onClick={async () => {
            setErrorMsg(null);
            try {
              await del.mutateAsync(row.original.id);
            } catch (e: any) {
              setErrorMsg(e?.message || 'Verwijderen mislukt');
            }
          }}>
            <MdDelete className="w-5 h-5 text-red-600" />
          </IconButton>
        </div>
      ),
    },
  ], [del]);

  const table = useReactTable({ data: data?.items || [], columns, getCoreRowModel: getCoreRowModel() });

  async function onSave() {
    if (!editing) return;
    const payload = { code: editing.code.toUpperCase(), functionName: editing.functionName, nameMale: editing.nameMale, nameFemale: editing.nameFemale, vMixTitle: !!editing.vMixTitle };
    setErrorMsg(null);
    try {
      if (editing.id) {
        await update.mutateAsync({ id: editing.id, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      setEditing(null);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Opslaan mislukt');
    }
  }

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Capabilities</h1>
        <button className="px-3 py-1 border rounded inline-flex items-center gap-1" onClick={() => setEditing({ code: '', functionName: '', nameMale: '', nameFemale: '' })}>
          <MdAdd /> Nieuw
        </button>
      </div>

      <div className="mb-3">
        <input aria-label="Search capabilities" value={q} onChange={(e) => setQ(e.target.value)} className="px-2 py-1 border rounded w-64 bg-white dark:bg-gray-950" placeholder="Zoek code of naam" />
      </div>

      {isLoading && <div>Laden…</div>}
      {error && <div className="text-red-600">Fout bij laden</div>}
      {errorMsg && (
        <div role="alert" className="mt-2 rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 px-3 py-2">
          {errorMsg}
        </div>
      )}

      <table className="min-w-full border border-gray-200 dark:border-gray-800 text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th key={header.id} className="text-left p-2 border-b border-gray-200 dark:border-gray-800">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="p-2 border-b border-gray-200 dark:border-gray-800">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-900 p-4 rounded shadow w-[460px]">
            <h2 className="font-semibold mb-2">{editing.id ? 'Capability wijzigen' : 'Nieuwe capability'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1">Code</label>
                <input autoFocus aria-label="Capability code" value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} className="px-2 py-1 border rounded w-full bg-white dark:bg-gray-950" />
              </div>
              <div>
                <label className="block text-xs mb-1">Functie naam</label>
                <input aria-label="Capability function name" value={editing.functionName} onChange={(e) => setEditing({ ...editing, functionName: e.target.value })} className="px-2 py-1 border rounded w-full bg-white dark:bg-gray-950" />
              </div>
              <div>
                <label className="block text-xs mb-1">Naam (man)</label>
                <input aria-label="Capability name male" value={editing.nameMale} onChange={(e) => setEditing({ ...editing, nameMale: e.target.value })} className="px-2 py-1 border rounded w-full bg-white dark:bg-gray-950" />
              </div>
              <div>
                <label className="block text-xs mb-1">Naam (vrouw)</label>
                <input aria-label="Capability name female" value={editing.nameFemale} onChange={(e) => setEditing({ ...editing, nameFemale: e.target.value })} className="px-2 py-1 border rounded w-full bg-white dark:bg-gray-950" />
              </div>
              <div className="flex items-center gap-2">
                <input id="cap-vmixtitle" type="checkbox" aria-label="Capability vMixTitle" checked={!!editing.vMixTitle} onChange={(e) => setEditing({ ...editing, vMixTitle: e.target.checked })} />
                <label htmlFor="cap-vmixtitle" className="text-sm">vMixTitle</label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1 border rounded" onClick={() => setEditing(null)}>Annuleren</button>
              <button className="px-3 py-1 border rounded bg-blue-600 text-white" onClick={onSave}>Opslaan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
