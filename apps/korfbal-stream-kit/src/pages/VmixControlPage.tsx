import {useEffect, useState} from 'react';
import {getVmixSettings, setVmixSettings, vmixSetTimer} from '../lib/api';

export default function VmixControlPage() {
  const [vmixUrl, setVmixUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const s = await getVmixSettings();
        if (!mounted) return;
        setVmixUrl(s.vmixWebUrl || '');
      } catch (e: any) {
        setError(e?.message || 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setMessage(null);
    try {
      setSaving(true);
      const res = await setVmixSettings(vmixUrl.trim());
      setMessage('Saved vMix Web URL');
      setVmixUrl(res.vmixWebUrl || '');
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function sendTimer(seconds: number) {
    setError(null);
    setMessage(null);
    try {
      await vmixSetTimer(seconds);
      setMessage(`Timer set to ${seconds} seconds`);
    } catch (e: any) {
      setError(e?.message || 'Failed to set timer');
    }
  }

  return (
    <div className="container py-6">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">vMix control</h1>

      {loading ? (
        <div className="mt-4 text-gray-700 dark:text-gray-300">Loading…</div>
      ) : (
        <form onSubmit={handleSave} className="mt-4 space-y-4 max-w-xl">
          <div>
            <label htmlFor="vmix-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300">vMix Web URL</label>
            <input
              id="vmix-url"
              type="url"
              required
              placeholder="http://10.0.0.10:8088"
              value={vmixUrl}
              onChange={(e) => setVmixUrl(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Enter the vMix Web Controller base URL, for example http://192.168.1.50:8088 or http://vmix-host:8088</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-2 rounded-md border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >{saving ? 'Saving…' : 'Save settings'}</button>
          </div>
        </form>
      )}

      <div className="mt-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Set countdown timer</h2>
        <div className="mt-2 flex items-center gap-2">
          <button onClick={() => sendTimer(10)} className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800">10s</button>
          <button onClick={() => sendTimer(30)} className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800">30s</button>
          <button onClick={() => sendTimer(60)} className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800">1m</button>
        </div>
      </div>

      {message && (
        <div role="status" className="mt-4 rounded-md border border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300 px-3 py-2">{message}</div>
      )}
      {error && (
        <div role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 px-3 py-2">{error}</div>
      )}
    </div>
  );
}
