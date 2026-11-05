import axios from 'axios';
import type {
  VenueConfig, VmixCallAnswer, VmixCallRequest, VmixFunction, VmixInput, VmixInputsAnswer, VmixInputsRequest, VmixInstance,
} from '@korfbal-stream-kit/venue-protocol';
import {logger} from '../logger';

/** A wall-clock deadline per vMix call and for reading the inputs. */
export const FUNCTION_DEADLINE_MS = 1500;
export const INPUTS_DEADLINE_MS = 2000;
const MAX_FUNCTION_ANSWER_BYTES = 100_000;
/** The XML of a big production is a few hundred kB */
const MAX_INPUTS_BYTES = 5_000_000;

/** http://host:8088/api/?<query>, the form the vMix Developer API documents (also when the base ends in /api). */
export function buildVmixApiUrl(base: string, query: string): string {
  const root = (base || '').replace(/\/+$/, '').replace(/\/api$/i, '');
  return `${root}/api/?${query.replace(/^\?/, '')}`;
}

/**
 * A vMix function call. Values are percent-encoded: a space is %20, not the form-encoding "+", which a
 * server need not read as a space ("Eerste helft" could arrive as "Eerste+helft").
 */
export function buildVmixFunctionUrl(base: string, params: Record<string, string>): string {
  const query = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return buildVmixApiUrl(base, query);
}

export type ResolvedVmix = {instance: VmixInstance} | {error: string};

/** The instance a function sends to: the one named, else the one chosen for it, else the first one. */
export function resolveVmixInstance(vmix: VenueConfig['vmix'] | undefined, fn: VmixFunction, override?: string | null): ResolvedVmix {
  const instances = (vmix?.instances ?? []).map((i) => ({...i, id: i.id ?? ''}));
  const wanted = override || vmix?.targets[fn];
  if (wanted) {
    const instance = instances.find((i) => i.id === wanted);
    return instance ? {instance} : {error: `vMix instance "${wanted}" is not configured`};
  }
  return instances[0] ? {instance: instances[0]} : {error: 'vMix Web URL is not configured'};
}

const ENTITIES: Record<string, string> = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'"};

function unescapeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()];
  });
}

function attributes(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [, name, value] of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) result[name] = unescapeXml(value);
  return result;
}

/** The inputs in vMix's XML state, in vMix's order. Only reads `<input>` elements and their `<text>` fields. */
export function parseVmixInputs(xml: string): VmixInput[] {
  const inputs: VmixInput[] = [];
  for (const [, attrs, body = ''] of xml.matchAll(/<input\s([^>]*?)(?:\/>|>([\s\S]*?)<\/input>)/g)) {
    const a = attributes(attrs);
    const number = Number(a.number);
    if (!a.key || !Number.isInteger(number)) continue;
    const fields = [...body.matchAll(/<text\s([^>]*?)\/?>/g)].map(([, t]) => attributes(t).name).filter(Boolean);
    inputs.push({key: a.key, number, type: a.type ?? '', title: a.title ?? '', fields});
  }
  return inputs;
}

export type VmixInstanceState = {ok: boolean; at: string};

/** Carries out vMix requests from the API (and the fallback API) on the instance the configuration gives. */
export class VmixClient {
  private readonly states = new Map<string, VmixInstanceState>();

  constructor(private readonly getVmix: () => VenueConfig['vmix'] | undefined) {}

  /** The result of the last call per instance id, for the status. */
  state(instanceId: string): VmixInstanceState | null {
    return this.states.get(instanceId) ?? null;
  }

  resolve(fn: VmixFunction, instanceId?: string | null): ResolvedVmix {
    return resolveVmixInstance(this.getVmix(), fn, instanceId);
  }

  private note(instance: VmixInstance, ok: boolean): void {
    this.states.set(instance.id, {ok, at: new Date().toISOString()});
  }

  /** The commands in order; the first one that fails stops the batch. Answers never carry the vMix address. */
  async call(request: VmixCallRequest): Promise<VmixCallAnswer> {
    const target = this.resolve(request.function, request.instanceId);
    if ('error' in target) return {ok: false, error: target.error};
    for (const command of request.commands) {
      const url = buildVmixFunctionUrl(target.instance.url, command);
      try {
        await axios.get(url, {signal: AbortSignal.timeout(FUNCTION_DEADLINE_MS), maxContentLength: MAX_FUNCTION_ANSWER_BYTES, responseType: 'text', transformResponse: (d) => d});
      } catch (err) {
        this.note(target.instance, false);
        logger.warn('vMix call failed', {instance: target.instance.name, function: command.Function, error: axios.isAxiosError(err) ? err.code ?? err.message : 'unknown'});
        return {ok: false, error: 'unreachable'};
      }
    }
    this.note(target.instance, true);
    return {ok: true};
  }

  async inputs(request: VmixInputsRequest): Promise<VmixInputsAnswer> {
    const target = this.resolve(request.function, request.instanceId);
    if ('error' in target) return {ok: false, error: target.error};
    try {
      const res = await axios.get(buildVmixApiUrl(target.instance.url, ''), {
        signal: AbortSignal.timeout(INPUTS_DEADLINE_MS), maxContentLength: MAX_INPUTS_BYTES, responseType: 'text', transformResponse: (d) => d,
      });
      const xml = String(res.data ?? '');
      if (!/<vmix[\s>]/i.test(xml)) {
        this.note(target.instance, false);
        return {ok: false, error: 'invalid'};
      }
      this.note(target.instance, true);
      return {ok: true, instance: target.instance.name, inputs: parseVmixInputs(xml)};
    } catch (err) {
      this.note(target.instance, false);
      logger.warn('vMix inputs failed', {instance: target.instance.name, error: axios.isAxiosError(err) ? err.code ?? err.message : 'unknown'});
      return {ok: false, error: 'unreachable'};
    }
  }
}
