/** One vMix input, as the venue-bridge reads it from the XML state vMix returns. */
export type {VmixInput} from '@korfbal-stream-kit/venue-protocol';
import type {VmixInput} from '@korfbal-stream-kit/venue-protocol';

/**
 * The input a vMix `Input=` value points at, the way vMix resolves it: a number, the key (GUID) or the
 * exact title (case-sensitive, including e.g. ".gtzip").
 */
export function findVmixInput(inputs: VmixInput[], ref: string): VmixInput | undefined {
  const value = ref.trim();
  if (/^\d+$/.test(value)) return inputs.find((i) => i.number === Number(value));
  return inputs.find((i) => i.key.toLowerCase() === value.toLowerCase()) ?? inputs.find((i) => i.title === value);
}
