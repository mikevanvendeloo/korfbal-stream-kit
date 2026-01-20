import {useEffect, useMemo, useRef, useState} from 'react';
import {
  deletePlayerImage,
  fetchSponsors,
  generateSponsorRowsApi,
  listPlayerImages,
  PlayerImage,
  Sponsor,
  SponsorRow,
  uploadPlayerImage
} from '../lib/api';
import {MdDelete, MdFileDownload, MdRefresh, MdUploadFile} from 'react-icons/md';

export default function SponsorRowsPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loadingSponsors, setLoadingSponsors] = useState(true);
  const [players, setPlayers] = useState<PlayerImage[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Record<number, boolean>>({});

  const [generating, setGenerating] = useState(false);
  const [rows, setRows] = useState<SponsorRow[] | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [subject, setSubject] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function loadSponsors() {
    try {
      setLoadingSponsors(true);
      const res = await fetchSponsors({limit: 100});
      setSponsors(res.items);
    } catch (e: any) {
      setError(e?.message || 'Failed to load sponsors');
    } finally {
      setLoadingSponsors(false);
    }
  }

  const typeOrder: Record<Sponsor['type'], number> = {premium: 0, goud: 1, zilver: 2, brons: 3};
  const sortedSponsors = useMemo(() => {
    return [...sponsors].sort((a, b) => {
      const ta = typeOrder[a.type];
      const tb = typeOrder[b.type];
      if (ta !== tb) return ta - tb;
      return a.name.localeCompare(b.name, 'nl');
    });
  }, [sponsors]);

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
    loadSponsors();
    loadPlayers();
  }, []);

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[Number(k)]).map(Number), [selected]);

  const selectedCountByType = useMemo(() => {
    const counts: Record<Sponsor['type'], number> = {premium: 0, goud: 0, zilver: 0, brons: 0};
    for (const s of sponsors) {
      if (selected[s.id]) counts[s.type]++;
    }
    return counts;
  }, [selected, sponsors]);

  const allSelected = useMemo(() => {
    if (sponsors.length === 0) return false;
    return sponsors.every((s) => !!selected[s.id]);
  }, [sponsors, selected]);

  function setAllSponsors(checked: boolean) {
    const map: Record<number, boolean> = {};
    if (checked) {
      for (const s of sponsors) map[s.id] = true;
    }
    setSelected(map);
  }

  function isTypeFullySelected(type: Sponsor['type']): boolean {
    const items = sponsors.filter((s) => s.type === type);
    if (items.length === 0) return false;
    return items.every((s) => !!selected[s.id]);
  }

  function setTypeSelected(type: Sponsor['type'], checked: boolean) {
    setSelected((prev) => {
      const next = {...prev} as Record<number, boolean>;
      for (const s of sponsors) {
        if (s.type === type) next[s.id] = checked;
      }
      return next;
    });
  }

  async function onGenerate() {
    try {
      setGenerating(true);
      setRows(await generateSponsorRowsApi(selectedIds.length > 0 ? selectedIds : undefined));
    } catch (e: any) {
      setError(e?.message || 'Genereren mislukt');
    } finally {
      setGenerating(false);
    }
  }

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
    if (!confirm(`Verwijder speler ‘${p.subject}’`)) return;
    try {
      await deletePlayerImage(p.id);
      await loadPlayers();
    } catch (e: any) {
      setError(e?.message || 'Verwijderen mislukt');
    }
  }

  function asJsonText() {
    return JSON.stringify(rows ?? [], null, 2);
  }

  function downloadJson() {
    if (!rows) return;
    const blob = new Blob([asJsonText()], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vmix-sponsor-rows.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">vMix Sponsor JSON</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => {
            loadSponsors();
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
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">Selecteer sponsors</h2>
          {loadingSponsors && <div className="text-gray-600 dark:text-gray-300">Laden…</div>}
          {!loadingSponsors && (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <button
                  onClick={() => setAllSponsors(!allSelected)}
                  aria-pressed={allSelected}
                  className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {allSelected ? 'Deselecteer alles' : 'Selecteer alles'}
                </button>
                <span className="mx-2 text-gray-500">|</span>
                <button
                  onClick={() => setTypeSelected('premium', !isTypeFullySelected('premium'))}
                  aria-pressed={isTypeFullySelected('premium')}
                  className="px-2 py-1 rounded border border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                >
                  Premium ({selectedCountByType.premium})
                </button>
                <button
                  onClick={() => setTypeSelected('goud', !isTypeFullySelected('goud'))}
                  aria-pressed={isTypeFullySelected('goud')}
                  className="px-2 py-1 rounded border border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                >
                  Goud ({selectedCountByType.goud})
                </button>
                <button
                  onClick={() => setTypeSelected('zilver', !isTypeFullySelected('zilver'))}
                  aria-pressed={isTypeFullySelected('zilver')}
                  className="px-2 py-1 rounded border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/20"
                >
                  Zilver ({selectedCountByType.zilver})
                </button>
                <button
                  onClick={() => setTypeSelected('brons', !isTypeFullySelected('brons'))}
                  aria-pressed={isTypeFullySelected('brons')}
                  className="px-2 py-1 rounded border border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                >
                  Brons ({selectedCountByType.brons})
                </button>
              </div>
              <ul
                className="mt-2 max-h-96 overflow-auto border border-gray-200 dark:border-gray-700 rounded-md divide-y divide-gray-100 dark:divide-gray-800">
                {sortedSponsors.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                    <input type="checkbox" checked={!!selected[s.id]}
                           onChange={(e) => setSelected((prev) => ({...prev, [s.id]: e.target.checked}))}/>
                    <span className="text-gray-800 dark:text-gray-100">{s.name}</span>
                    <span className="ml-auto text-xs text-gray-500">{s.type}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

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
        <button disabled={generating} onClick={onGenerate}
                className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800">
          Genereer JSON
        </button>
        {rows && (
          <button onClick={downloadJson}
                  className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-1">
            <MdFileDownload className="w-5 h-5"/> Download JSON
          </button>
        )}
      </div>

      {rows && (
        <div className="mt-4">
          <h3 className="font-medium text-gray-800 dark:text-gray-100">Resultaat</h3>
          <textarea readOnly
                    className="w-full mt-2 h-80 font-mono text-sm px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100">{asJsonText()}</textarea>
        </div>
      )}
    </div>
  );
}
