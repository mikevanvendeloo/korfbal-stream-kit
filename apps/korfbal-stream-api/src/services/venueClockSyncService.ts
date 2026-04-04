import axios from 'axios';
import {logger} from '../utils/logger';
import {getScoreboardUrl} from './appSettings';
import {config} from './config';
import {updateVenueClock} from './productionState';

let syncInterval: NodeJS.Timeout | null = null;
const INTERVAL_MS = 1000; // Elke seconde pollen

export const venueClockSyncService = {
  start: () => {
    if (syncInterval) return;

    logger.info('🔄 Venue clock sync service started');
    syncInterval = setInterval(async () => {
      try {
        const baseUrl = await getScoreboardUrl() || config.scoreBoardBaseUrl;
        if (!baseUrl) return;

        const url = `${baseUrl.replace(/\/$/, '')}/time-as-array`;
        const response = await axios.get(url, { timeout: 800 }); // Iets kortere timeout dan interval

        if (Array.isArray(response.data) && response.data.length > 0) {
            // De scoreboard API 'time-as-array' geeft meestal iets als ["15", "34"]
            // We verwachten dat updateVenueClock in productionState.ts dit kan parsen ("MM:SS")
            const timeStr = response.data.join(':');
            updateVenueClock(timeStr);
        }
      } catch (err: any) {
        // We loggen dit niet op 'info' niveau om de logs niet te vervuilen als het scoreboard uit staat
        logger.debug('Failed to fetch venue clock from scoreboard', { error: err?.message });
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
