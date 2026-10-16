import axios from 'axios';
import {logger} from '../utils/logger';
import {getScoreboardUrl} from './appSettings';
import {config} from './config';
import {organizationsWithActiveProduction, updateVenueClock} from './productionState';
import {runWithOrganization} from './organizationContext';

let syncInterval: NodeJS.Timeout | null = null;
let busy = false;
const INTERVAL_MS = 1000; // Elke seconde pollen

/** "MM:SS" from the scoreboard's time-as-array answer (["15", "34"] or [{minute, second}]). */
function parseVenueTime(data: unknown): string {
  if (!Array.isArray(data) || data.length === 0) return '';
  if (typeof data[0] === 'string') return data.join(':');
  if (data[0]?.minute !== undefined) return `${data[0].minute}:${data[0].second}`;
  return '';
}

async function fetchVenueTime(baseUrl: string): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, '')}/time-as-array`;
  const response = await axios.get(url, {timeout: 800}); // Iets kortere timeout dan interval
  return parseVenueTime(response.data);
}

/**
 * One round: every organization with an active production gets the clock of its own scoreboard (its
 * `scoreboardUrl` setting, else the installation default). A scoreboard shared by several organizations
 * is asked once.
 */
export async function syncVenueClocks(): Promise<void> {
  const organizationsByUrl = new Map<string, number[]>();
  for (const organizationId of await organizationsWithActiveProduction()) {
    const baseUrl = (await runWithOrganization(organizationId, getScoreboardUrl)) || config.scoreBoardBaseUrl;
    if (!baseUrl) continue;
    organizationsByUrl.set(baseUrl, [...(organizationsByUrl.get(baseUrl) ?? []), organizationId]);
  }

  await Promise.all([...organizationsByUrl].map(async ([baseUrl, organizationIds]) => {
    try {
      const time = await fetchVenueTime(baseUrl);
      if (!time) return;
      for (const organizationId of organizationIds) runWithOrganization(organizationId, () => updateVenueClock(time));
    } catch (err) {
      // Niet op 'info' niveau, om de logs niet te vervuilen als het scoreboard uit staat
      logger.debug('Failed to fetch venue clock from scoreboard', {error: (err as Error)?.message});
    }
  }));
}

export const venueClockSyncService = {
  start: () => {
    if (syncInterval) return;

    logger.info('🔄 Venue clock sync service started');
    syncInterval = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        await syncVenueClocks();
      } catch (err) {
        logger.debug('Venue clock sync failed', {error: (err as Error)?.message});
      } finally {
        busy = false;
      }
    }, INTERVAL_MS);
  },

  stop: () => {
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
      logger.info('🔄 Venue clock sync service stopped');
    }
  }
};
