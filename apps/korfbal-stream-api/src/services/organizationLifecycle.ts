import {discardLiveState, restoreLiveState} from './productionState';
import {timeSyncService} from './timeSyncService';
import {discardPushMemory} from './vmixCallsheetPush';
import {disconnectOrganizationSockets} from './socket';
import {runWithOrganization} from './organizationContext';
import {logger} from '../utils/logger';

/**
 * An organization was switched off: its live show stops right away. Clock and auto-advance timer stop,
 * the in-memory state (live state, production clock, vMix push memory) is forgotten and its sockets are
 * closed. The database is left alone, so switching it on again picks up the active production.
 * The background services skip it from now on (`organizationsWithActiveProduction`).
 */
export function stopOrganization(organizationId: number) {
  discardLiveState(organizationId);
  timeSyncService.discard(organizationId);
  discardPushMemory(organizationId);
  disconnectOrganizationSockets(organizationId);
  logger.info(`Organization ${organizationId} switched off: live state stopped and sockets closed`);
}

/** An organization was switched on again: restore its active production, as on startup. */
export async function resumeOrganization(organizationId: number) {
  await runWithOrganization(organizationId, restoreLiveState).catch((err) => {
    logger.error(`Restoring the active production of organization ${organizationId} failed:`, err);
  });
}
