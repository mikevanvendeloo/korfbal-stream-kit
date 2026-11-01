import React, {useEffect, useState} from 'react';
import {getMatchStatsConfig, setMatchStatsConfig} from '../lib/statsApi';

const input = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100';

/** Settings of the statistics PC: the "Tweede Scherm" page and the Access file inside the mounted share. */
export default function MatchStatsSettings() {
  const [pageUrl, setPageUrl] = useState('');
  const [mdbPath, setMdbPath] = useState('');
  const [message, setMessage] = useState<{ok: boolean; text: string} | null>(null);

  useEffect(() => {
    getMatchStatsConfig()
      .then((c) => {
        setPageUrl(c.pageUrl ?? '');
        setMdbPath(c.mdbPath ?? '');
      })
      .catch(() => undefined);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      await setMatchStatsConfig({pageUrl: pageUrl.trim() || null, mdbPath: mdbPath.trim() || null});
      setMessage({ok: true, text: 'Statistiekeninstellingen opgeslagen'});
    } catch (err) {
      setMessage({ok: false, text: (err as Error).message || 'Opslaan mislukt'});
    }
  }

  return (
    <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">Statistieken</h2>
      {message && <div role={message.ok ? 'status' : 'alert'} className={`mb-4 p-3 rounded border ${message.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>{message.text}</div>}
      <div className="space-y-4">
        <div>
          <label htmlFor="statsPageUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Statistiekenpagina (Tweede Scherm)</label>
          <input id="statsPageUrl" type="text" className={input} placeholder="http://10.12.0.63/..." value={pageUrl} onChange={(e) => setPageUrl(e.target.value)}/>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Een http(s)-adres, of een relatief pad naar een .html-bestand in de statistiekenmap op de server (voor testen).</p>
        </div>
        <div>
          <label htmlFor="statsMdbPath" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pad naar WEDSTRIJDEN.mdb</label>
          <input id="statsMdbPath" type="text" className={input} placeholder="F1/WEDSTRIJDEN.mdb" value={mdbPath} onChange={(e) => setMdbPath(e.target.value)}/>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Relatief aan de gedeelde map van de statistiek-pc op de server.</p>
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <button type="button" onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Statistieken opslaan</button>
      </div>
    </section>
  );
}
