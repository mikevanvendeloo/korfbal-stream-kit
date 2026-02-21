import {useEffect, useRef, useState} from 'react';
import {
  deletePlayerImage,
  listPlayerImages,
  PlayerImage,
  uploadPlayerImage
} from '../lib/api';
import {MdDelete, MdFileDownload, MdRefresh, MdUploadFile} from 'react-icons/md';

export default function SponsorSlidesPage() {
  const [players, setPlayers] = useState<PlayerImage[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [subject, setSubject] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function loadPlayers() {
    try {
      setLoadingPlayers(true);
      const res = await listPlayerImages();
      setPlayers(res.items);
    } catch (e: any) {
      setError(e?.message || 'Failed to load player images');
    } finally {
      setLoadingPlayers(false);
    }
  }

  useEffect(() => {
    loadPlayers();
  }, []);

  function onPickFile() {
    fileRef.current?.click();
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setSelectedFile(f);
    if (f) {
      // Prefill subject from filename (without extension)
      const name = f.name.replace(/\.[^.]+$/i, '');
      if (!subject) setSubject(name);
      // Preview
      const url = URL.createObjectURL(f);
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
    } else {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    // do not auto-upload; wait for explicit Upload click
  }

  async function onUpload() {
    if (!selectedFile) return;
    try {
      setUploading(true);
      await uploadPlayerImage(subject || undefined, selectedFile);
      setSubject('');
      setSelectedFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      if (fileRef.current) fileRef.current.value = '';
      await loadPlayers();
    } catch (e: any) {
      setError(e?.message || 'Upload mislukt');
    } finally {
      setUploading(false);
    }
  }

  async function onDeletePlayer(p: PlayerImage) {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`Verwijder speler ‘${p.subject}’`)) return;
    try {
      await deletePlayerImage(p.id);
      await loadPlayers();
    } catch (e: any) {
      setError(e?.message || 'Verwijderen mislukt');
    }
  }

  function downloadJson() {
    const url = '/api/vmix/sponsor-slides';
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vmix-sponsor-slides.json';
    a.click();
  }

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Sponsor Slides Beheer</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => {
            loadPlayers();
          }} title="Vernieuwen"
                  className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center justify-center">
            <MdRefresh className="w-5 h-5"/>
            <span className="sr-only">Vernieuwen</span>
          </button>
        </div>
      </div>

      {error && <div role="alert"
                     className="mt-4 rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 px-3 py-2">{error}</div>}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">Speler foto’s beheren</h2>
          <div className="mt-2 flex items-center gap-2">
            <input type="text" placeholder="Subject (bijv. Jumbo-099)" value={subject}
                   onChange={(e) => setSubject(e.target.value)}
                   className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex-1"/>
            <input ref={fileRef} className="hidden" type="file" accept="image/*" onChange={onFilePicked}/>
            <button onClick={onPickFile}
                    className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center justify-center"
                    title="Kies bestand">
              <MdUploadFile className="w-5 h-5"/>
            </button>
            <button disabled={!selectedFile || uploading} onClick={onUpload}
                    className="px-3 py-2 rounded-md border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20">Upload
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Subject wordt standaard de bestandsnaam; je
            kunt dit aanpassen.
          </div>
          {previewUrl && (
            <div className="mt-2">
              <img src={previewUrl} alt="preview"
                   className="max-h-24 rounded border border-gray-200 dark:border-gray-700 object-contain"/>
            </div>
          )}
          {loadingPlayers ? (
            <div className="mt-2 text-gray-600 dark:text-gray-300">Laden…</div>
          ) : (
            <ul
              className="mt-2 max-h-96 overflow-auto border border-gray-200 dark:border-gray-700 rounded-md divide-y divide-gray-100 dark:divide-gray-800">
              {players.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                  <img alt="" src={`/uploads/${p.filename}`} className="h-24 w-24 object-cover rounded"
                       onError={(e) => {
                         (e.currentTarget as any).style.visibility = 'hidden';
                       }}/>
                  <div className="flex flex-col">
                    <span className="text-gray-800 dark:text-gray-100">{p.subject}</span>
                    <span className="text-xs text-gray-500">{p.filename}</span>
                  </div>
                  <button title="Verwijderen" onClick={() => onDeletePlayer(p)}
                          className="ml-auto text-red-600 hover:text-red-700">
                    <MdDelete className="w-5 h-5"/>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6 flex items-center gap-2">
          <button onClick={downloadJson}
                  className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-1">
            <MdFileDownload className="w-5 h-5"/> Download JSON
          </button>
      </div>
    </div>
  );
}
