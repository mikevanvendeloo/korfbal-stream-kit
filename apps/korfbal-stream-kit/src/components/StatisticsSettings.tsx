import {useEffect, useState} from 'react';
import {getMatchStatsConfig, setMatchStatsConfig, type MatchStatsConfig} from '../lib/statsApi';
import StatsConnectionStatus from './StatsConnectionStatus';

const input = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100';
const label = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const hint = 'text-xs text-gray-500 dark:text-gray-400 mt-1';

type Form = {pageUrl: string; mdbPath: string; mdbEnabled: boolean; shareHost: string; keepCopy: boolean};

const toForm = (c: MatchStatsConfig): Form => ({pageUrl: c.pageUrl ?? '', mdbPath: c.mdbPath ?? '', mdbEnabled: c.mdbEnabled, shareHost: c.shareHost ?? '', keepCopy: c.keepCopy});

/** What the venue-bridge reads from the statistics PC: the page, the database on the share, and whether it keeps a copy. */
export default function StatisticsSettings() {
  const [form, setForm] = useState<Form>({pageUrl: '', mdbPath: '', mdbEnabled: true, shareHost: '', keepCopy: true});
  const [message, setMessage] = useState<{ok: boolean; text: string} | null>(null);

  useEffect(() => {
    getMatchStatsConfig().then((c) => setForm(toForm(c))).catch(() => undefined);
  }, []);

  async function save() {
    setMessage(null);
    try {
      const saved = await setMatchStatsConfig({
        pageUrl: form.pageUrl.trim() || null,
        mdbPath: form.mdbPath.trim() || null,
        mdbEnabled: form.mdbEnabled,
        shareHost: form.shareHost.trim() || null,
        keepCopy: form.keepCopy,
      });
      setForm(toForm(saved));
      setMessage({ok: true, text: 'Statistiekeninstellingen opgeslagen'});
    } catch (err) {
      // The API's own 400 message (e.g. a database path outside the share)
      setMessage({ok: false, text: (err as Error).message || 'Opslaan mislukt'});
    }
  }

  return (
    <section className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">Statistieken</h2>
      {message && <div role={message.ok ? 'status' : 'alert'} className={`mb-4 p-3 rounded border ${message.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>{message.text}</div>}
      <div className="space-y-4">
        <div>
          <label htmlFor="statsPageUrl" className={label}>Statistiekenpagina</label>
          <input id="statsPageUrl" type="text" className={input} placeholder="http://10.12.0.63/TweedeScherm/klassiek.html" value={form.pageUrl} onChange={(e) => setForm({...form, pageUrl: e.target.value})}/>
          <p className={hint}>Een http(s)-adres, of een .html-pad binnen de gedeelde map.</p>
        </div>
        <div>
          <label htmlFor="statsMdbPath" className={label}>Pad van de database</label>
          <input id="statsMdbPath" type="text" className={input} placeholder="Data/WEDSTRIJDEN{team}.mdb" value={form.mdbPath} onChange={(e) => setForm({...form, mdbPath: e.target.value})}/>
          <p className={hint}>Relatief aan de gedeelde map (zonder <code>..</code>), op .mdb of .accdb eindigend. <code>{'{team}'}</code> wordt het teamnummer.</p>
        </div>
        <div>
          <label htmlFor="statsShareHost" className={label}>Adres van de statistiek-pc</label>
          <input id="statsShareHost" type="text" className={input} placeholder="10.12.0.63" value={form.shareHost} onChange={(e) => setForm({...form, shareHost: e.target.value})}/>
          <p className={hint}>De bridge kijkt eerst of deze pc antwoordt, voor hij de database leest. Leeg: de pc van de statistiekenpagina.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={form.mdbEnabled} onChange={(e) => setForm({...form, mdbEnabled: e.target.checked})}/>
          Database gebruiken
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={form.keepCopy} onChange={(e) => setForm({...form, keepCopy: e.target.checked})}/>
          Lokale kopie van de database bewaren
        </label>
      </div>
      <div className="mt-4">
        <StatsConnectionStatus/>
      </div>
      <div className="flex justify-end mt-4">
        <button type="button" onClick={() => save()} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Statistieken opslaan</button>
      </div>
    </section>
  );
}
