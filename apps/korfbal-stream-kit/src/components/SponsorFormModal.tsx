import React from 'react';
import { Sponsor, SponsorInput } from '../lib/api';
import { normalizeSponsorName, isValidSponsorUrl } from '../lib/sponsorUtils';

export type SponsorFormModalProps = {
  initial?: Partial<Sponsor>;
  onCancel: () => void;
  onSubmit: (input: SponsorInput & { logoFile?: File }) => Promise<void> | void;
};

export default function SponsorFormModal({ initial, onCancel, onSubmit }: SponsorFormModalProps) {
  const [name, setName] = React.useState(initial?.name || '');
  const [type, setType] = React.useState<Exclude<Sponsor['type'], undefined>>(initial?.type || 'brons');
  const [websiteUrl, setWebsiteUrl] = React.useState(initial?.websiteUrl || '');
  const [logoUrl, setLogoUrl] = React.useState(initial?.logoUrl || '');
  const [displayName, setDisplayName] = React.useState((initial as any)?.displayName || '');
  const [logoFile, setLogoFile] = React.useState<File | undefined>();
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const firstRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    firstRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanedName = normalizeSponsorName(name);
    if (!cleanedName) return setError('Naam is verplicht');
    if (!websiteUrl || !isValidSponsorUrl(websiteUrl)) return setError('Ongeldige website URL');

    const payload: SponsorInput & { logoFile?: File } = {
      name: cleanedName,
      type,
      websiteUrl,
      logoUrl: logoUrl || undefined,
      displayName: displayName || undefined,
      logoFile,
    };
    try {
      setBusy(true);
      await onSubmit(payload);
    } catch (err: any) {
      setError(err?.message || 'Opslaan mislukt');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 p-4 rounded shadow w-[480px] max-w-[95vw]">
        <h2 className="font-semibold mb-3">{initial?.id ? 'Sponsor wijzigen' : 'Nieuwe sponsor'}</h2>
        {error && (
          <div role="alert" className="mb-3 rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 px-3 py-2">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="sponsor-name" className="block text-xs mb-1">Naam</label>
            <input id="sponsor-name" ref={firstRef} value={name} onChange={(e) => setName(e.target.value)} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-950" />
            <div className="text-xs text-gray-500 mt-1">‘B.V.’ in de naam wordt automatisch weggefilterd</div>
          </div>
          <div>
            <label htmlFor="sponsor-type" className="block text-xs mb-1">Type</label>
            <select id="sponsor-type" value={type} onChange={(e) => setType(e.target.value as Sponsor['type'])} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-950">
              <option value="premium">Premium</option>
              <option value="goud">Goud</option>
              <option value="zilver">Zilver</option>
              <option value="brons">Brons</option>
            </select>
          </div>
          <div>
            <label htmlFor="sponsor-website" className="block text-xs mb-1">Website URL</label>
            <input id="sponsor-website" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://example.com" className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-950" />
          </div>
          <div>
            <label htmlFor="sponsor-logo-upload" className="block text-xs mb-1">Logo uploaden (optioneel)</label>
            <input
              id="sponsor-logo-upload"
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              onChange={(e) => setLogoFile(e.target.files?.[0])}
              className="w-full text-sm file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <div>
            <label htmlFor="sponsor-logo" className="block text-xs mb-1">Logo bestandsnaam (optioneel)</label>
            <input id="sponsor-logo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="wordt-afgeleid-van-naam.png" className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-950" />
          </div>
          <div>
            <label htmlFor="sponsor-displayname" className="block text-xs mb-1">Weergavenaam (optioneel)</label>
            <input id="sponsor-displayname" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Laat leeg om reguliere naam te gebruiken" className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-950" />
            <div className="text-xs text-gray-500 mt-1">Wordt gebruikt in vMix ticker en carrousel als deze gevuld is</div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onCancel} className="px-3 py-1 border rounded">Annuleren</button>
            <button disabled={busy} type="submit" className="px-3 py-1 border rounded bg-blue-600 text-white disabled:opacity-60">
              {busy ? 'Opslaan…' : 'Opslaan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
