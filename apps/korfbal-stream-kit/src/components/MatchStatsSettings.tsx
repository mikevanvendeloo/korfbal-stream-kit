import {useEffect, useState} from 'react';
import {getMatchStatsConfig, setMatchStatsConfig} from '../lib/statsApi';
import StatsConnectionStatus from './StatsConnectionStatus';

const input = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100';

/** The statistics bridge: its own app that reads the statistics PC. Where the PC, share and page are set is on the bridge. */
export default function MatchStatsSettings() {
  const [bridgeUrl, setBridgeUrl] = useState('');
  const [bridgeToken, setBridgeToken] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [message, setMessage] = useState<{ok: boolean; text: string} | null>(null);

  useEffect(() => {
    getMatchStatsConfig()
      .then((c) => {
        setBridgeUrl(c.bridgeUrl ?? '');
        setHasToken(c.hasBridgeToken);
      })
      .catch(() => undefined);
  }, []);

  async function save(clearToken = false) {
    setMessage(null);
    try {
      // The token is write-only: only sent when typed (or cleared), otherwise the stored one stays
      const saved = await setMatchStatsConfig({
        bridgeUrl: bridgeUrl.trim() || null,
        ...(clearToken ? {bridgeToken: null} : bridgeToken ? {bridgeToken} : {}),
      });
      setHasToken(saved.hasBridgeToken);
      setBridgeToken('');
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
          <label htmlFor="statsBridgeUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Statistics bridge URL</label>
          <input id="statsBridgeUrl" type="text" className={input} placeholder="http://statistics-bridge:3340" value={bridgeUrl} onChange={(e) => setBridgeUrl(e.target.value)}/>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Het adres van de statistics bridge die de statistiek-pc uitleest. Staat de bridge in dezelfde Docker-omgeving, dan is dat <code>http://statistics-bridge:3340</code>. De pc, de gedeelde map en de statistiekenpagina stel je in op de bridge zelf.</p>
        </div>
        <div>
          <label htmlFor="statsBridgeToken" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bridge-token</label>
          <input id="statsBridgeToken" type="password" autoComplete="new-password" className={input}
                 placeholder={hasToken ? 'Ingesteld (laat leeg om te behouden)' : 'Alleen nodig als de bridge een token vraagt'}
                 value={bridgeToken} onChange={(e) => setBridgeToken(e.target.value)}/>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Het token wordt alleen verstuurd, nooit getoond. Een ander adres zonder nieuw token wist het token.
            {hasToken && <> <button type="button" className="underline" onClick={() => save(true)}>Token verwijderen</button></>}
          </p>
        </div>
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
