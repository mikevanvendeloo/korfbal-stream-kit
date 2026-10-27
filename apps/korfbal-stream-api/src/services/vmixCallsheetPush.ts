import axios from 'axios';
import {Prisma} from '@prisma/client';
import {buildVmixFunctionUrl, getSetting, setSetting} from './appSettings';
import {resolveVmixInstance} from './vmixInstances';
import {CallsheetTiming, loadCallsheetTiming, TimingState} from './callsheetTiming';
import {CallsheetColors, VmixCallsheetPushConfig, VmixCallsheetPushSchema} from '../schemas/vmixCallsheet';
import {logger} from '../utils/logger';
import {fetchVmixInputs, findVmixInput, VmixInput} from './vmixInputs';
import {liveOrganizationIds} from './productionState';
import {getOrganizationId, runWithOrganization} from './organizationContext';

export const VMIX_CALLSHEET_PUSH_KEY = 'vmixCallsheetPush';

export type VmixCommand = { function: 'SetText' | 'SetColor' | 'SetTextColour'; selectedName: string; value: string };

export async function getCallsheetPushConfig(): Promise<VmixCallsheetPushConfig> {
  const stored = await getSetting<Record<string, unknown>>(VMIX_CALLSHEET_PUSH_KEY);
  // Settings saved when several positions were allowed keep the first one
  const positions = Array.isArray(stored?.positions) ? stored.positions.slice(0, 1) : stored?.positions;
  const parsed = VmixCallsheetPushSchema.safeParse(stored ? {...stored, positions} : {});
  return parsed.success ? parsed.data : VmixCallsheetPushSchema.parse({});
}

export async function setCallsheetPushConfig(config: VmixCallsheetPushConfig): Promise<void> {
  await setSetting(VMIX_CALLSHEET_PUSH_KEY, config as unknown as Prisma.JsonObject);
  // vMix may have a different title now: send everything again
  pushMemory().lastSent.clear();
}

function colorCommands(block: { backgroundField: string; textColorFields: string[]; colors: CallsheetColors }, state: TimingState): VmixCommand[] {
  const colors = block.colors[state];
  const commands: VmixCommand[] = [];
  if (block.backgroundField) commands.push({function: 'SetColor', selectedName: block.backgroundField, value: colors.background});
  for (const field of block.textColorFields) commands.push({function: 'SetTextColour', selectedName: field, value: colors.text});
  return commands;
}

/** The timing with the colours of its states (as set for the push, #RRGGBB), for the vMix data source. */
export function withStateColors(timing: CallsheetTiming, config: VmixCallsheetPushConfig) {
  const current = config.current.colors[timing.currentState];
  const next = config.next.colors[timing.nextState];
  return {
    ...timing,
    currentBackgroundColor: current.background,
    currentTextColor: current.text,
    nextBackgroundColor: next.background,
    nextTextColor: next.text,
  };
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
  return buildVmixFunctionUrl(base, {Function: command.function, Input: input, SelectedName: command.selectedName, Value: command.value});
}

// What vMix got last, per function + field, so each tick only sends what changed. Per organization:
// each one pushes its own callsheet to its own vMix.
type PushMemory = { lastSent: Map<string, string>; lastTarget: string; lastFullPush: number; lastErrorLog: number; busy: boolean };
const pushMemories = new Map<number, PushMemory>();

function pushMemory(): PushMemory {
  // Unit tests call the push without an organization: they share one memory
  const key = getOrganizationId() ?? 0;
  let memory = pushMemories.get(key);
  if (!memory) {
    memory = {lastSent: new Map(), lastTarget: '', lastFullPush: 0, lastErrorLog: 0, busy: false};
    pushMemories.set(key, memory);
  }
  return memory;
}
/** Forgets what was pushed for an organization (it was switched off). */
export function discardPushMemory(organizationId: number) {
  pushMemories.delete(organizationId);
}

/** Whether there is push memory for the organization (tests). */
export function hasPushMemory(organizationId: number): boolean {
  return pushMemories.has(organizationId);
}

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
  const memory = pushMemory();
  const {lastSent} = memory;
  const targetKey = `${base}|${config.input}`;
  if (force || targetKey !== memory.lastTarget || now.getTime() - memory.lastFullPush > FULL_PUSH_INTERVAL_MS) {
    lastSent.clear();
    memory.lastTarget = targetKey;
    memory.lastFullPush = now.getTime();
  }

  let sent = 0;
  const errors: string[] = [];
  for (const command of commands) {
    const key = commandKey(command);
    if (lastSent.get(key) === command.value) continue;
    try {
      // A wall-clock deadline: axios' `timeout` only fires when vMix goes quiet, not when it drips
      await axios.get(buildVmixCommandUrl(base, config.input, command), {signal: AbortSignal.timeout(1500), maxContentLength: 4096});
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

/**
 * What vMix will silently ignore in the push settings: an input it doesn't have, or text fields the title
 * doesn't have (vMix answers 200 to those calls too). Asks vMix for its inputs; for the manual push only.
 * The background shape (SetColor) isn't checked: vMix doesn't list shapes.
 */
export async function checkCallsheetTarget(): Promise<string[]> {
  const config = await getCallsheetPushConfig();
  const target = await resolveVmixInstance('callsheet');
  if ('error' in target || !config.input) return [];
  let inputs: VmixInput[];
  try {
    inputs = await fetchVmixInputs(target.instance.url);
  } catch {
    return ['De lijst met inputs kon niet uit vMix worden gehaald'];
  }
  const input = findVmixInput(inputs, config.input);
  if (!input) {
    return [`vMix heeft geen input "${config.input}". Een naam moet precies kloppen, met hoofdletters en extensie (bijv. "Callsheet.gtzip"); kies de title uit de lijst.`];
  }
  const fields = [config.current.titleField, config.current.timerField, config.current.startTimeField, ...config.current.textColorFields,
    config.next.titleField, config.next.durationField, config.next.startsInField, config.next.startTimeField, ...config.next.textColorFields];
  const missing = [...new Set(fields.filter((f) => f && !input.fields.includes(f)))];
  return missing.map((f) => `Title "${input.title}" heeft geen veld "${f}"`);
}

let interval: NodeJS.Timeout | null = null;
let ticking = false;

/**
 * One push per organization whose show runs, each with its own settings and vMix. They run
 * side by side: an unreachable vMix of one organization doesn't hold up the others.
 */
async function startPushes(): Promise<Promise<void>[]> {
  // From the live state in memory: no database query per second while no show runs
  return liveOrganizationIds().map((organizationId) => runWithOrganization(organizationId, pushWhenEnabled));
}

/** A push round that waits until every organization is done (tests); the timer doesn't wait. */
export async function pushForActiveOrganizations(): Promise<void> {
  await Promise.all(await startPushes());
}

async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    // An organization still busy with the last round skips this one (pushWhenEnabled)
    await startPushes();
  } catch (err) {
    logger.error('vMix callsheet push error:', err);
  } finally {
    ticking = false;
  }
}

async function pushWhenEnabled() {
  const memory = pushMemory();
  if (memory.busy) return;
  memory.busy = true;
  try {
    const config = await getCallsheetPushConfig();
    if (!config.enabled) return;
    const result = await pushCallsheetToVmix();
    // vMix being unreachable would otherwise log every second
    if (result.errors.length > 0 && Date.now() - memory.lastErrorLog > 30_000) {
      memory.lastErrorLog = Date.now();
      logger.warn(`vMix callsheet push failed: ${result.errors[0]}${result.errors.length > 1 ? ` (+${result.errors.length - 1} more)` : ''}`);
    }
  } catch (err) {
    if (Date.now() - memory.lastErrorLog > 30_000) {
      memory.lastErrorLog = Date.now();
      logger.error('vMix callsheet push error:', err);
    }
  } finally {
    memory.busy = false;
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
