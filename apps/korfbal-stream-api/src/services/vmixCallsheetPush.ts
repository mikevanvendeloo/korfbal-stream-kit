import axios from 'axios';
import {Prisma} from '@prisma/client';
import {buildVmixApiUrl, getSetting, setSetting} from './appSettings';
import {resolveVmixInstance} from './vmixInstances';
import {CallsheetTiming, loadCallsheetTiming, TimingState} from './callsheetTiming';
import {CallsheetColors, VmixCallsheetPushConfig, VmixCallsheetPushSchema} from '../schemas/vmixCallsheet';
import {logger} from '../utils/logger';

export const VMIX_CALLSHEET_PUSH_KEY = 'vmixCallsheetPush';

export type VmixCommand = { function: 'SetText' | 'SetColor' | 'SetTextColour'; selectedName: string; value: string };

export async function getCallsheetPushConfig(): Promise<VmixCallsheetPushConfig> {
  const stored = await getSetting<unknown>(VMIX_CALLSHEET_PUSH_KEY);
  const parsed = VmixCallsheetPushSchema.safeParse(stored ?? {});
  return parsed.success ? parsed.data : VmixCallsheetPushSchema.parse({});
}

export async function setCallsheetPushConfig(config: VmixCallsheetPushConfig): Promise<void> {
  await setSetting(VMIX_CALLSHEET_PUSH_KEY, config as unknown as Prisma.JsonObject);
  // vMix may have a different title now: send everything again
  lastSent.clear();
}

function colorCommands(block: { backgroundField: string; textColorFields: string[]; colors: CallsheetColors }, state: TimingState): VmixCommand[] {
  const colors = block.colors[state];
  const commands: VmixCommand[] = [];
  if (block.backgroundField) commands.push({function: 'SetColor', selectedName: block.backgroundField, value: colors.background});
  for (const field of block.textColorFields) commands.push({function: 'SetTextColour', selectedName: field, value: colors.text});
  return commands;
}

function text(selectedName: string, value: string): VmixCommand[] {
  return selectedName ? [{function: 'SetText', selectedName, value}] : [];
}

/** Everything the title should show for this timing; fields without a configured name are skipped. */
export function buildVmixCommands(timing: CallsheetTiming, config: VmixCallsheetPushConfig): VmixCommand[] {
  const {current, next} = config;
  return [
    ...text(current.titleField, timing.currentTitle),
    ...text(current.timerField, timing.currentRemaining),
    ...text(current.startTimeField, timing.currentStartTime),
    ...colorCommands(current, timing.currentState),
    ...text(next.titleField, timing.nextTitle),
    ...text(next.durationField, timing.nextDuration),
    ...text(next.startsInField, timing.nextStartsIn),
    ...text(next.startTimeField, timing.nextStartTime),
    ...colorCommands(next, timing.nextState),
  ];
}

export function buildVmixCommandUrl(base: string, input: string, command: VmixCommand): string {
  const query = new URLSearchParams({
    Function: command.function,
    Input: input,
    SelectedName: command.selectedName,
    Value: command.value,
  });
  return buildVmixApiUrl(base, query.toString());
}

// What vMix got last, per function + field, so each tick only sends what changed
const lastSent = new Map<string, string>();
let lastTarget = '';
let lastFullPush = 0;
// vMix can be restarted or the title reloaded, which loses the values: send everything again now and then
const FULL_PUSH_INTERVAL_MS = 15_000;
const commandKey = (c: VmixCommand) => `${c.function}|${c.selectedName}`;

export type PushResult = { sent: number; skipped: number; errors: string[]; timing: CallsheetTiming | null };

/** Sends the current/next item to vMix. With force, every field is sent, not only the changed ones. */
export async function pushCallsheetToVmix(force = false, now = new Date()): Promise<PushResult> {
  const config = await getCallsheetPushConfig();
  const target = await resolveVmixInstance('callsheet');
  if ('error' in target) return {sent: 0, skipped: 0, errors: [target.error], timing: null};
  const base = target.instance.url;
  if (!config.input) return {sent: 0, skipped: 0, errors: ['No vMix title input configured'], timing: null};

  const timing = await loadCallsheetTiming(config.positions, config.warningSeconds, now);
  const commands = buildVmixCommands(timing, config);
  const targetKey = `${base}|${config.input}`;
  if (force || targetKey !== lastTarget || now.getTime() - lastFullPush > FULL_PUSH_INTERVAL_MS) {
    lastSent.clear();
    lastTarget = targetKey;
    lastFullPush = now.getTime();
  }

  let sent = 0;
  const errors: string[] = [];
  for (const command of commands) {
    const key = commandKey(command);
    if (lastSent.get(key) === command.value) continue;
    try {
      await axios.get(buildVmixCommandUrl(base, config.input, command), {timeout: 1500});
      lastSent.set(key, command.value);
      sent++;
    } catch (err) {
      // Not remembered, so the next tick tries again
      lastSent.delete(key);
      errors.push(`${command.function} ${command.selectedName}: ${(err as Error).message}`);
    }
  }
  return {sent, skipped: commands.length - sent - errors.length, errors, timing};
}

let interval: NodeJS.Timeout | null = null;
let busy = false;
let lastErrorLog = 0;

async function tick() {
  if (busy) return;
  busy = true;
  try {
    const config = await getCallsheetPushConfig();
    if (!config.enabled) return;
    const result = await pushCallsheetToVmix();
    // vMix being unreachable would otherwise log every second
    if (result.errors.length > 0 && Date.now() - lastErrorLog > 30_000) {
      lastErrorLog = Date.now();
      logger.warn(`vMix callsheet push failed: ${result.errors[0]}${result.errors.length > 1 ? ` (+${result.errors.length - 1} more)` : ''}`);
    }
  } catch (err) {
    if (Date.now() - lastErrorLog > 30_000) {
      lastErrorLog = Date.now();
      logger.error('vMix callsheet push error:', err);
    }
  } finally {
    busy = false;
  }
}

/** Pushes every second while enabled in the settings; the timer text changes every second anyway. */
export const vmixCallsheetPushService = {
  start() {
    if (interval) return;
    interval = setInterval(tick, 1000);
    logger.info('vMix callsheet push service started');
  },
  stop() {
    if (interval) clearInterval(interval);
    interval = null;
  },
};
