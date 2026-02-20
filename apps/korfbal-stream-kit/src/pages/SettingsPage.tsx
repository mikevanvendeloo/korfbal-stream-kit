import {useEffect, useState} from 'react';
import {
  getScoreboardConfig,
  getSponsorConfig,
  getVmixSettings,
  setScoreboardConfig,
  setSponsorConfig,
  setVmixSettings
} from '../lib/api';

type SponsorType = 'premium' | 'goud' | 'zilver' | 'brons';
const ALL_TYPES: SponsorType[] = ['premium', 'goud', 'zilver', 'brons'];

export default function SettingsPage() {
  const [vmixUrl, setVmixUrl] = useState('');
  const [scoreboardUrl, setScoreboardUrl] = useState('');
  const [shotclockUrl, setShotclockUrl] = useState('');

  const [namesTypes, setNamesTypes] = useState<SponsorType[]>([]);
  const [rowsTypes, setRowsTypes] = useState<SponsorType[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const [vmix, sponsor, scoreboard] = await Promise.all([
        getVmixSettings(),
        getSponsorConfig(),
        getScoreboardConfig(),
      ]);
      setVmixUrl(vmix.vmixWebUrl || '');
      setNamesTypes(sponsor.namesTypes as SponsorType[]);
      setRowsTypes(sponsor.rowsTypes as SponsorType[]);
      setScoreboardUrl(scoreboard.scoreboardUrl || '');
      setShotclockUrl(scoreboard.shotclockUrl || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await Promise.all([
        setVmixSettings(vmixUrl),
        setSponsorConfig({ namesTypes, rowsTypes }),
        setScoreboardConfig({ scoreboardUrl, shotclockUrl }),
      ]);

      setSuccess('Instellingen opgeslagen');
    } catch (err: any) {
      setError(err.message || 'Opslaan mislukt');
    } finally {
      setSaving(false);
    }
  }

  const toggleType = (list: SponsorType[], setList: (l: SponsorType[]) => void, type: SponsorType) => {
    if (list.includes(type)) {
      setList(list.filter(t => t !== type));
    } else {
      setList([...list, type]);
    }
  };

  if (loading) return <div className="p-6 text-gray-600 dark:text-gray-300">Laden...</div>;

  return (
    <div className="container py-6 max-w-3xl">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Instellingen</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded dark:bg-green-900/30 dark:border-green-800 dark:text-green-300">
          {success}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">

        {/* vMix Settings */}
        <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">vMix Koppeling</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              vMix Web Controller URL
            </label>
            <input
              type="url"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
              placeholder="http://192.168.1.10:8088"
              value={vmixUrl}
              onChange={(e) => setVmixUrl(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              URL van de vMix Web Controller API (bijv. http://localhost:8088)
            </p>
          </div>
        </section>

        {/* Scoreboard Settings */}
        <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">Scorebord & Shotclock</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Scorebord Base URL
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
                placeholder="http://192.168.1.20:8080"
                value={scoreboardUrl}
                onChange={(e) => setScoreboardUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Shotclock Base URL
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
                placeholder="http://192.168.1.21:8080"
                value={shotclockUrl}
                onChange={(e) => setShotclockUrl(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Sponsor Configuration */}
        <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">Sponsor Configuratie</h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Sponsor Names (Ticker) */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Sponsor Namen (Ticker & Carrousel)</h3>
              <div className="space-y-2">
                {ALL_TYPES.map(type => (
                  <label key={`names-${type}`} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={namesTypes.includes(type)}
                      onChange={() => toggleType(namesTypes, setNamesTypes, type)}
                    />
                    <span className="capitalize text-gray-700 dark:text-gray-300">{type}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Selecteer welke types worden getoond in de ticker en carrousel.
              </p>
            </div>

            {/* Sponsor Rows */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Sponsor Rows (Spelerfoto's)</h3>
              <div className="space-y-2">
                {ALL_TYPES.map(type => (
                  <label key={`rows-${type}`} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={rowsTypes.includes(type)}
                      onChange={() => toggleType(rowsTypes, setRowsTypes, type)}
                    />
                    <span className="capitalize text-gray-700 dark:text-gray-300">{type}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Selecteer welke types worden gebruikt voor de sponsor rows (onder spelerfoto's).
              </p>
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </form>
    </div>
  );
}
