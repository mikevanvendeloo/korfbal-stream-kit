import axios from 'axios';
import {logger} from '../utils/logger';
import {getScoreboardUrl} from './appSettings';
import {config} from './config';
import {organizationsWithActiveProduction, updateVenueClock} from './productionState';
import {runWithOrganization} from './organizationContext';

let syncInterval: NodeJS.Timeout | null = null;
let planning = false;
const INTERVAL_MS = 1000; // Elke seconde pollen
/** A wall-clock deadline per request, shorter than the interval (axios' `timeout` is an idle timeout). */
const REQUEST_DEADLINE_MS = 800;
/** The answer is a few bytes ("["15","34"]"); anything bigger is not a scoreboard. */
const MAX_ANSWER_BYTES = 4096;

/** Scoreboards still being asked: a slow one is skipped until it answers, the others go on. */
const inFlight = new Set<string>();

/** "MM:SS" from the scoreboard's time-as-array answer (["15", "34"] or [{minute, second}]). */
function parseVenueTime(data: unknown): string {
  if (!Array.isArray(data) || data.length === 0) return '';
  if (typeof data[0] === 'string') return data.join(':');
  if (data[0]?.minute !== undefined) return `${data[0].minute}:${data[0].second}`;
  return '';
}

async function fetchVenueTime(baseUrl: string): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, '')}/time-as-array`;
  const response = await axios.get(url, {signal: AbortSignal.timeout(REQUEST_DEADLINE_MS), maxContentLength: MAX_ANSWER_BYTES});
  return parseVenueTime(response.data);
}

/**
 * The scoreboards to ask, each with the organizations that use it: every organization with an active
 * production, by its `scoreboardUrl` setting (else the installation default). One organization's failing
 * settings lookup doesn't stop the others.
 */
async function venueClockTargets(): Promise<Map<string, number[]>> {
  const organizationsByUrl = new Map<string, number[]>();
  for (const organizationId of await organizationsWithActiveProduction()) {
    try {
      const baseUrl = (await runWithOrganization(organizationId, getScoreboardUrl)) || config.scoreBoardBaseUrl;
      if (!baseUrl) continue;
      organizationsByUrl.set(baseUrl, [...(organizationsByUrl.get(baseUrl) ?? []), organizationId]);
    } catch (err) {
      logger.debug(`Venue clock: settings of organization ${organizationId} failed`, {error: (err as Error)?.message});
    }
  }
  return organizationsByUrl;
}

/** Asks one scoreboard, unless it is still busy with an earlier round. */
async function syncFrom(baseUrl: string, organizationIds: number[]): Promise<void> {
  if (inFlight.has(baseUrl)) return;
  inFlight.add(baseUrl);
  try {
    const time = await fetchVenueTime(baseUrl);
    if (!time) return;
    for (const organizationId of organizationIds) runWithOrganization(organizationId, () => updateVenueClock(time));
  } catch (err) {
    // Niet op 'info' niveau, om de logs niet te vervuilen als het scoreboard uit staat
    logger.debug('Failed to fetch venue clock from scoreboard', {error: (err as Error)?.message});
  } finally {
    inFlight.delete(baseUrl);
  }
}

/**
 * One round: every organization with an active production gets the clock of its own scoreboard. A
 * scoreboard shared by several organizations is asked once; one still busy from an earlier round is
 * skipped. Resolves when every scoreboard of this round answered or hit its deadline.
 */
export async function syncVenueClocks(): Promise<void> {
  const targets = await venueClockTargets();
  await Promise.all([...targets].map(([baseUrl, organizationIds]) => syncFrom(baseUrl, organizationIds)));
}

/** A timer round: doesn't wait for the scoreboards, so a slow one never holds up the next round. */
async function tick() {
  if (planning) return;
  planning = true;
  let targets: Map<string, number[]>;
  try {
    targets = await venueClockTargets();
  } catch (err) {
    logger.debug('Venue clock sync failed', {error: (err as Error)?.message});
    return;
  } finally {
    planning = false;
  }
  for (const [baseUrl, organizationIds] of targets) void syncFrom(baseUrl, organizationIds);
}

export const venueClockSyncService = {
  start: () => {
    if (syncInterval) return;

    logger.info('🔄 Venue clock sync service started');
    syncInterval = setInterval(() => void tick(), INTERVAL_MS);
  },

  stop: () => {
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
      logger.info('🔄 Venue clock sync service stopped');
    }
  }
};
