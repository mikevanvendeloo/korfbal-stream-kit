import {useCreateSponsor, useDeleteSponsor, useDownloadAllSponsorLogos, useSponsors, useUpdateSponsor, useUploadSponsorLogo} from '../hooks/useSponsors';
import {SponsorsTable} from '../components/SponsorsTable';
import React, {useRef, useState} from 'react';
// Using a plain anchor to avoid Router context requirement in tests
// import { Link } from 'react-router-dom';
import {uploadSponsorsExcel} from '../lib/api';
import {MdAdd, MdDownload, MdRefresh, MdUploadFile} from 'react-icons/md';
import SponsorFormModal from '../components/SponsorFormModal';

type SponsorType = 'premium' | 'goud' | 'zilver' | 'brons';

export default function SponsorsPage() {
  const [selectedTypes, setSelectedTypes] = useState<SponsorType[]>([]);
  const { data, isLoading, isError, error, refetch } = useSponsors({ type: selectedTypes.length > 0 ? selectedTypes : undefined, limit: 100 });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<null | { created: number; updated: number; total?: number; problems?: Array<{ row: number; reason: string }> }>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const create = useCreateSponsor();
  const update = useUpdateSponsor();
  const del = useDeleteSponsor();
  const uploadLogo = useUploadSponsorLogo();
  const downloadLogos = useDownloadAllSponsorLogos();

  const [editing, setEditing] = useState<null | { id?: number; name?: string; type?: SponsorType; websiteUrl?: string; logoUrl?: string; displayName?: string }>(null);
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

  async function handleSubmitSponsor(input: { name: string; type: SponsorType; websiteUrl: string; logoUrl?: string; displayName?: string, logoFile?: File }) {
    try {
      setActionError(null);
      let sponsorId: number;
      if (editing?.id) {
        await update.mutateAsync({ id: editing.id, input });
        sponsorId = editing.id;
      } else {
        const newSponsor = await create.mutateAsync(input);
        sponsorId = newSponsor.id;
      }

      if (input.logoFile) {
        await uploadLogo.mutateAsync({ id: sponsorId, file: input.logoFile });
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

  const toggleType = (t: SponsorType) => {
    setSelectedTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  return (
    <div className="container py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Sponsors</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 mr-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1">
            <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">Filter:</span>
            {(['premium', 'goud', 'zilver', 'brons'] as SponsorType[]).map((t) => (
              <label key={t} className="flex items-center gap-1 cursor-pointer select-none px-1 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(t)}
                  onChange={() => toggleType(t)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm capitalize text-gray-700 dark:text-gray-200">{t}</span>
              </label>
            ))}
          </div>

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
          <a href="/api/sponsors/export-excel" className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center justify-center" title="Export sponsors naar Excel" download>
            <MdDownload className="w-5 h-5" />
            <span className="sr-only">Export Excel</span>
          </a>
          <button
            aria-label="download-all-logos"
            onClick={() => downloadLogos.mutate()}
            className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center justify-center"
            title="Download alle logos"
          >
            <MdDownload className="w-5 h-5" />
            <span className="sr-only">Download alle logos</span>
          </button>
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
        <div role="alert" className="mt-6 text-red-600">Fout bij laden: {(error as Error).message}<br/>
          {(error as Error).stack}<br/>Contacteer de beheerder als dit probleem zich blijft voordoen.</div>

      )}

      {data && (
        <div className="mt-4">
          <SponsorsTable
            data={data.items}
            onEdit={(s) => setEditing({ id: s.id, name: s.name, type: s.type, websiteUrl: s.websiteUrl, logoUrl: s.logoUrl, displayName: (s as any).displayName })}
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
