import React from 'react';
import {MdContentCopy} from 'react-icons/md';
import {CreatedApiKey, useApiKeys, useCreateApiKey, useRevokeApiKey, useVmixEndpoints, withApiKey} from '../hooks/useOrganizations';

const inputClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500';
const secondaryButton = 'px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50';
const primaryButton = 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed';

/** A copy button that says "Gekopieerd!" for a moment. */
export function CopyButton({text, label}: { text: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  }
  return (
    <button type="button" onClick={copy} aria-label={label} title={label}
            className="shrink-0 inline-flex items-center gap-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors">
      {copied ? <span className="text-green-600 text-xs font-medium">Gekopieerd!</span>
        : failed ? <span className="text-red-600 text-xs font-medium">Selecteer en kopieer zelf</span>
          : <MdContentCopy className="w-5 h-5"/>}
    </button>
  );
}

/** The feed URLs for vMix, with this key filled in. */
export function FeedUrlsWithKey({apiKey}: { apiKey: string }) {
  const {data, isLoading, error} = useVmixEndpoints();
  if (isLoading) return <div className="text-sm">Laden…</div>;
  if (error || !data) return <div className="text-sm text-red-600">De adressen konden niet worden geladen.</div>;
  return (
    <ul className="space-y-2" aria-label="Adressen met deze sleutel">
      {data.endpoints.map((endpoint) => {
        const url = withApiKey(endpoint.url, data.keyPlaceholder, apiKey);
        return (
          <li key={endpoint.url} className="border border-gray-200 dark:border-gray-700 rounded p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium truncate">{endpoint.name}</span>
              <CopyButton text={url} label={`Kopieer URL ${endpoint.name}`}/>
            </div>
            <div className="mt-1 text-xs font-mono break-all text-gray-700 dark:text-gray-300">{url}</div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The full key, shown once right after creating it, with a copy button and the feed URLs filled in.
 * The key only lives in this dialog's props: it is not cached, stored or put in the URL.
 */
export function ApiKeyCreatedDialog({created, onClose}: { created: CreatedApiKey; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="api-key-created-title"
           className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-5 rounded-lg shadow w-[640px] max-w-full max-h-full overflow-y-auto">
        <h2 id="api-key-created-title" className="text-lg font-semibold mb-3">API-sleutel {created.name} aangemaakt</h2>
        <p role="alert" className="mb-3 p-3 rounded border border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200 text-sm">
          Je ziet deze sleutel alleen nu. Kopieer hem en zet hem in vMix; daarna is alleen het begin ({created.prefix}…) nog te zien.
        </p>
        <div className="flex items-center gap-2 mb-5 bg-gray-100 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
          <code className="flex-1 min-w-0 text-sm break-all" aria-label="Nieuwe API-sleutel">{created.key}</code>
          <CopyButton text={created.key} label="Kopieer sleutel"/>
        </div>
        <h3 className="font-medium mb-2">Datasource-adressen met deze sleutel</h3>
        <FeedUrlsWithKey apiKey={created.key}/>
        <div className="flex justify-end mt-5">
          <button type="button" className={primaryButton} onClick={onClose}>Klaar</button>
        </div>
      </div>
    </div>
  );
}

/** Name + "Sleutel aanmaken"; hands the created key (once) to `onCreated`. */
export function CreateApiKeyForm({onCreated}: { onCreated: (created: CreatedApiKey) => void }) {
  const create = useCreateApiKey();
  const [name, setName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Geef de sleutel een naam');
    try {
      onCreated(await create.mutateAsync(name.trim()));
      create.reset(); // the key isn't kept in the mutation cache either
      setName('');
    } catch (err) {
      setError((err as Error).message || 'Aanmaken mislukt');
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col sm:flex-row sm:items-end gap-2">
      <div className="flex-1 min-w-0">
        <label htmlFor="api-key-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Naam van de sleutel</label>
        <input id="api-key-name" className={inputClass} value={name} placeholder="bijvoorbeeld vMix stream-pc" onChange={(e) => setName(e.target.value)}/>
      </div>
      <button type="submit" className={primaryButton} disabled={create.isPending}>{create.isPending ? 'Aanmaken…' : 'Sleutel aanmaken'}</button>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('nl-NL', {dateStyle: 'short', timeStyle: 'short'}) : null);

/** Beheer → Organisatie → API-sleutels: create (shown once), list, revoke. */
export function ApiKeysSection() {
  const {data: keys, isLoading, error} = useApiKeys();
  const revoke = useRevokeApiKey();
  const [created, setCreated] = React.useState<CreatedApiKey | null>(null);
  const [revokeError, setRevokeError] = React.useState<string | null>(null);

  function onRevoke(id: number, name: string) {
    if (!window.confirm(`Sleutel ${name} intrekken? Apparaten die hem gebruiken krijgen meteen geen gegevens meer.`)) return;
    setRevokeError(null);
    revoke.mutate(id, {onError: (err) => setRevokeError(err.message)});
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        vMix-datasources, vMix-triggers en scorebordschermen kunnen geen organisatie kiezen. Ze sturen een API-sleutel van deze
        organisatie mee (<code>?key=…</code> achter het adres). Een sleutel geeft alleen toegang tot die gegevens, niet tot Beheer.
      </p>
      <CreateApiKeyForm onCreated={setCreated}/>
      {revokeError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{revokeError}</p>}
      {isLoading && <div className="text-sm">Laden…</div>}
      {error && <p role="alert" className="text-sm text-red-600">Fout bij laden: {(error as Error).message}</p>}
      {keys && keys.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Nog geen API-sleutels.</p>}
      {keys && keys.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm" aria-label="API-sleutels">
            <thead className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-2 py-2 font-medium">Naam</th>
                <th className="px-2 py-2 font-medium">Begint met</th>
                <th className="px-2 py-2 font-medium">Aangemaakt</th>
                <th className="px-2 py-2 font-medium">Laatst gebruikt</th>
                <th className="px-2 py-2 font-medium sr-only">Acties</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className={`border-b last:border-0 border-gray-100 dark:border-gray-700 ${key.revokedAt ? 'text-gray-400 dark:text-gray-500' : ''}`}>
                  <td className="px-2 py-2 font-medium">{key.name}</td>
                  <td className="px-2 py-2 font-mono">{key.prefix}…</td>
                  <td className="px-2 py-2 whitespace-nowrap">{formatDate(key.createdAt)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{formatDate(key.lastUsedAt) ?? 'Nooit'}</td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    {key.revokedAt
                      ? <span>Ingetrokken {formatDate(key.revokedAt)}</span>
                      : <button type="button" className={secondaryButton} disabled={revoke.isPending} onClick={() => onRevoke(key.id, key.name)}
                                aria-label={`Sleutel ${key.name} intrekken`}>Intrekken</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {created && <ApiKeyCreatedDialog created={created} onClose={() => setCreated(null)}/>}
    </div>
  );
}
