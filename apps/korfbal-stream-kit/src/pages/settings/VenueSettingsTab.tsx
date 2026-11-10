import React, {useEffect, useState} from 'react';
import {getScoreboardConfig, setScoreboardConfig} from '../../lib/api';
import VenueBridgeCard from '../../components/VenueBridgeCard';
import StatisticsSettings from '../../components/StatisticsSettings';
import VmixInstancesSettings from '../../components/VmixInstancesSettings';

/** Instellingen → Venue: the venue-bridge status on top, below it what the bridge is configured with (scoreboard and shot clock, statistics, vMix). */
export default function VenueSettingsTab() {
  const [scoreboardUrl, setScoreboardUrl] = useState('');
  const [shotclockUrl, setShotclockUrl] = useState('');
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
      const scoreboard = await getScoreboardConfig();
      setScoreboardUrl(scoreboard.scoreboardUrl || '');
      setShotclockUrl(scoreboard.shotclockUrl || '');
    } catch (err) {
      setError((err as Error).message || 'Failed to load settings');
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
      await setScoreboardConfig({ scoreboardUrl, shotclockUrl });
      setSuccess('Verbindingsinstellingen opgeslagen');
    } catch (err) {
      setError((err as Error).message || 'Opslaan mislukt');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-gray-600 dark:text-gray-300">Laden...</div>;

  return (
    <div className="space-y-8">
      <VenueBridgeCard/>

      <form onSubmit={handleSave} className="space-y-8">
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded dark:bg-green-900/30 dark:border-green-800 dark:text-green-300">{success}</div>}

        <section className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">Scorebord & Shotclock</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="scoreboardUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scoreboard Base URL</label>
              <input
                id="scoreboardUrl"
                type="text"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
                placeholder="http://192.168.1.20:8080"
                value={scoreboardUrl}
                onChange={(e) => setScoreboardUrl(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="shotclockUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shotclock Base URL</label>
              <input
                id="shotclockUrl"
                type="text"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
                placeholder="http://192.168.1.21:8080"
                value={shotclockUrl}
                onChange={(e) => setShotclockUrl(e.target.value)}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Deze adressen gelden in de zaal: de venue-bridge leest ze daar uit.</p>
          </div>
          <div className="flex justify-end mt-4">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? 'Opslaan...' : 'Scorebord opslaan'}
            </button>
          </div>
        </section>
      </form>

      <StatisticsSettings/>

      <section className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1 border-b border-gray-100 dark:border-gray-700 pb-2">vMix-pc's</h2>
        <VmixInstancesSettings/>
      </section>
    </div>
  );
}
