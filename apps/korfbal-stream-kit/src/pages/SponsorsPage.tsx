import { useSponsors, useCreateSponsor, useUpdateSponsor, useDeleteSponsor } from '../hooks/useSponsors';
import { SponsorsTable } from '../components/SponsorsTable';
import { useRef, useState } from 'react';
// Using a plain anchor to avoid Router context requirement in tests
// import { Link } from 'react-router-dom';
import { uploadSponsorsExcel } from '../lib/api';
import { MdAdd, MdRefresh, MdUploadFile } from 'react-icons/md';
import SponsorFormModal from '../components/SponsorFormModal';

export default function SponsorsPage() {
  const [type, setType] = useState<undefined | 'premium' | 'goud' | 'zilver' | 'brons'>(undefined);
  const { data, isLoading, isError, error, refetch } = useSponsors({ type, limit: 100 });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<null | { created: number; updated: number; total?: number; problems?: Array<{ row: number; reason: string }> }>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const create = useCreateSponsor();
  const update = useUpdateSponsor();
  const del = useDeleteSponsor();

  const [editing, setEditing] = useState<null | { id?: number; name?: string; type?: 'premium' | 'goud' | 'zilver' | 'brons'; websiteUrl?: string; logoUrl?: string }>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const onPickFile = () => fileRef.current?.click();
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setUploading(true);
      setUploadError(null);
      setUploadResult(null);
      const result = await uploadSponsorsExcel(f);
      setUploadResult({ created: result.created ?? 0, updated: result.updated ?? 0, total: result.total, problems: result.problems });
      await refetch();
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
      // reset value so selecting the same file triggers change again
      e.target.value = '';
    }
  };

  async function handleSubmitSponsor(input: { name: string; type: 'premium' | 'goud' | 'zilver' | 'brons'; websiteUrl: string; logoUrl?: string }) {
    try {
      setActionError(null);
      if (editing?.id) {
        await update.mutateAsync({ id: editing.id, input });
      } else {
        await create.mutateAsync(input);
      }
      setEditing(null);
    } catch (e: any) {
      setActionError(e?.message || 'Opslaan mislukt');
    }
  }

  async function handleDeleteSponsor(s: { id: number }) {
    setActionError(null);
    try {
      if (confirm(`Sponsor ‘${(s as any).name ?? s.id}’ verwijderen?`)) {
        await del.mutateAsync(s.id);
      }
    } catch (e: any) {
      setActionError(e?.message || 'Verwijderen mislukt');
    }
  }

  return (
    <div className="container py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Sponsors</h1>
        <div className="flex items-center gap-2">
          <select
            aria-label="Filter type"
            className="border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2"
            value={type || ''}
            onChange={(e) => setType((e.target.value as any) || undefined)}
          >
            <option value="">Alle types</option>
            <option value="premium">Premium</option>
            <option value="goud">Goud</option>
            <option value="zilver">Zilver</option>
            <option value="brons">Brons</option>
          </select>
          <button
            aria-label="refresh-sponsors"
            onClick={() => refetch()}
            className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center justify-center"
            title="Vernieuwen"
          >
            <MdRefresh className="w-5 h-5" />
            <span className="sr-only">Vernieuwen</span>
          </button>
          <input ref={fileRef} aria-label="sponsors-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={onFileChange} />
          <button aria-label="upload-sponsors" onClick={onPickFile} className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center justify-center" title="Upload sponsors">
            <MdUploadFile className="w-5 h-5" />
            <span className="sr-only">Upload sponsors</span>
          </button>
          <a href="/vmix/sponsor-rows" className="px-3 py-2 rounded-md border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 inline-flex items-center justify-center gap-1" title="Genereer sponsor JSON">
            Sponsor JSON
          </a>
          <button aria-label="new-sponsor" onClick={() => setEditing({})} className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center justify-center gap-1" title="Nieuwe sponsor">
            <MdAdd className="w-5 h-5" />
            <span>Nieuwe sponsor</span>
          </button>
        </div>
      </div>

      {/* Upload result / error message */}
      {uploadResult && (
        <div role="status" className="mt-4 rounded-md border border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300 px-3 py-2">
          Sponsors geüpload: {uploadResult.created} nieuw, {uploadResult.updated} bijgewerkt{typeof uploadResult.total === 'number' ? ` (totaal ${uploadResult.total})` : ''}.
          {uploadResult.problems && uploadResult.problems.length > 0 ? (
            <div className="mt-1 text-sm">Overgeslagen rijen: {uploadResult.problems.length}</div>
          ) : null}
        </div>
      )}
      {uploadError && (
        <div role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 px-3 py-2">{uploadError}</div>
      )}
      {actionError && (
        <div role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 px-3 py-2">{actionError}</div>
      )}

      {isLoading && <div role="status" className="mt-6 text-gray-600 dark:text-gray-300">Laden…</div>}
      {isError && (
        <div role="alert" className="mt-6 text-red-600">Fout bij laden: {(error as Error).message}</div>
      )}

      {data && (
        <div className="mt-4">
          <SponsorsTable
            data={data.items}
            onEdit={(s) => setEditing({ id: s.id, name: s.name, type: s.type, websiteUrl: s.websiteUrl, logoUrl: s.logoUrl })}
            onDelete={(s) => handleDeleteSponsor(s)}
          />
        </div>
      )}

      {editing && (
        <SponsorFormModal
          initial={editing as any}
          onCancel={() => setEditing(null)}
          onSubmit={handleSubmitSponsor}
        />
      )}
    </div>
  );
}
