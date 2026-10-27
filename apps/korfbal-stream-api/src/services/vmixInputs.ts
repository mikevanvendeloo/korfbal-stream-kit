import axios from 'axios';
import {buildVmixApiUrl} from './appSettings';

/** One vMix input, from the XML state vMix returns for /api/ without a function. */
export type VmixInput = {
  key: string;
  number: number;
  type: string;
  title: string;
  /** SelectedNames of the title's text fields, e.g. "Titel.Text" (GT titles include ".Text") */
  fields: string[];
};

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

/**
 * The input a vMix `Input=` value points at, the way vMix resolves it: a number, the key (GUID) or the
 * exact title (case-sensitive, including e.g. ".gtzip").
 */
export function findVmixInput(inputs: VmixInput[], ref: string): VmixInput | undefined {
  const value = ref.trim();
  if (/^\d+$/.test(value)) return inputs.find((i) => i.number === Number(value));
  return inputs.find((i) => i.key.toLowerCase() === value.toLowerCase()) ?? inputs.find((i) => i.title === value);
}

/** Asks vMix for its inputs. Throws when vMix can't be reached or answers something else. */
export async function fetchVmixInputs(base: string): Promise<VmixInput[]> {
  // A wall-clock deadline and a size limit: the XML of a big production is a few hundred kB
  const res = await axios.get(buildVmixApiUrl(base, ''), {
    signal: AbortSignal.timeout(3000), maxContentLength: 5_000_000, responseType: 'text', transformResponse: (d) => d,
  });
  const xml = String(res.data ?? '');
  if (!/<vmix[\s>]/i.test(xml)) throw new Error('vMix gaf geen XML-status terug');
  return parseVmixInputs(xml);
}
