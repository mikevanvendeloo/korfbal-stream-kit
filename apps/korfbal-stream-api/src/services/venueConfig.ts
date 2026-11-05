import {createHash} from 'node:crypto';
import {
  ConfigApplyAnswerSchema, VENUE_EVENTS, VenueConfigSchema, type VenueConfig,
} from '@korfbal-stream-kit/venue-protocol';
import {getMatchStats, getScoreboardUrl, getShotclockUrl} from './appSettings';
import {getVmixInstancesConfig} from './vmixInstances';
import {requireOrganizationId, runWithOrganization} from './organizationContext';
import {askBridge, BridgeOfflineError, hasBridge} from './venueBridge';
import {setConfigState} from './venueData';
import {logger} from '../utils/logger';

export const CONFIG_PUSH_DEBOUNCE_MS = 500;
const CONFIG_DEADLINE_MS = 3000;

/** The venue configuration of the organization in the context: addresses, statistics settings, vMix instances. Never a key. */
export async function buildVenueConfig(): Promise<VenueConfig> {
  const [scoreboardUrl, shotclockUrl, stats, vmix] = await Promise.all([getScoreboardUrl(), getShotclockUrl(), getMatchStats(), getVmixInstancesConfig()]);
  const content = {
    scoreboard: {url: scoreboardUrl?.trim() || null},
    shotclock: {url: shotclockUrl?.trim() || null},
    stats,
    vmix,
  };
  const version = createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0, 16);
  return VenueConfigSchema.parse({...content, version});
}

/** Sends the configuration to the organization's bridge now and records whether it was applied. */
export async function pushVenueConfigNow(organizationId: number): Promise<void> {
  await runWithOrganization(organizationId, async () => {
    if (!hasBridge(organizationId)) return;
    let config: VenueConfig;
    try {
      config = await buildVenueConfig();
    } catch (err) {
      setConfigState(organizationId, {state: 'refused', error: 'De instellingen zijn ongeldig'});
      logger.warn('Venue configuration is invalid', {organizationId, error: (err as Error)?.message});
      return;
    }
    setConfigState(organizationId, {state: 'pending', error: null});
    try {
      const answer = await askBridge(VENUE_EVENTS.configApply, {config}, {deadlineMs: CONFIG_DEADLINE_MS, maxBytes: 2000, schema: ConfigApplyAnswerSchema});
      setConfigState(organizationId, answer.ok ? {state: 'applied', error: null} : {state: 'refused', error: answer.error});
    } catch (err) {
      // Not answered: the bridge asks nothing of the settings; the next connect or save sends them again
      if (!(err instanceof BridgeOfflineError)) throw err;
      logger.warn('Venue-bridge did not answer the configuration', {organizationId});
    }
  });
}

const timers = new Map<number, NodeJS.Timeout>();

/** After a save of one of the venue settings: sends the configuration of the organization in the context, debounced. */
export function scheduleVenueConfigPush(): void {
  const organizationId = requireOrganizationId('venue configuration');
  clearTimeout(timers.get(organizationId));
  const timer = setTimeout(() => {
    timers.delete(organizationId);
    pushVenueConfigNow(organizationId).catch((err: unknown) => logger.warn('Sending the venue configuration failed', {organizationId, error: (err as Error)?.message}));
  }, CONFIG_PUSH_DEBOUNCE_MS);
  timer.unref();
  timers.set(organizationId, timer);
}
