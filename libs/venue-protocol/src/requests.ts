import {z} from 'zod';
import {VenueConfigSchema} from './config';
import {VMIX_FUNCTIONS} from './vmixInstances';

const instanceId = z.string().max(40).optional();

// config:apply
export const ConfigApplyRequestSchema = z.object({config: VenueConfigSchema});
export type ConfigApplyRequest = z.infer<typeof ConfigApplyRequestSchema>;
export const ConfigApplyAnswerSchema = z.union([
  z.object({ok: z.literal(true)}),
  z.object({ok: z.literal(false), error: z.string().max(500)}),
]);
export type ConfigApplyAnswer = z.infer<typeof ConfigApplyAnswerSchema>;

// stats:request
export const StatsRequestSchema = z.object({path: z.string().min(1).max(2000)});
export type StatsRequest = z.infer<typeof StatsRequestSchema>;
export const StatsAnswerSchema = z.object({
  status: z.number().int().min(100).max(599),
  headers: z.record(z.string()),
  body: z.unknown(),
});
export type StatsAnswer = z.infer<typeof StatsAnswerSchema>;

// vmix:call: one batch of function calls, each a set of vMix parameters (Function, Input, SelectedName, Value, ...)
export const VmixCommandSchema = z.record(z.string().max(500)).refine((c) => typeof c.Function === 'string' && c.Function.length > 0, {message: 'Function is required'});
export type VmixCommand = z.infer<typeof VmixCommandSchema>;
export const VmixCallRequestSchema = z.object({
  function: z.enum(VMIX_FUNCTIONS),
  instanceId,
  commands: z.array(VmixCommandSchema).min(1).max(100),
});
export type VmixCallRequest = z.infer<typeof VmixCallRequestSchema>;
export const VmixCallAnswerSchema = z.union([
  z.object({ok: z.literal(true)}),
  z.object({ok: z.literal(false), error: z.string().max(200)}),
]);
export type VmixCallAnswer = z.infer<typeof VmixCallAnswerSchema>;

// vmix:inputs
export const VmixInputsRequestSchema = z.object({function: z.enum(VMIX_FUNCTIONS), instanceId});
export type VmixInputsRequest = z.infer<typeof VmixInputsRequestSchema>;
export const VmixInputSchema = z.object({
  key: z.string(),
  number: z.number().int(),
  type: z.string(),
  title: z.string(),
  fields: z.array(z.string()),
});
export type VmixInput = z.infer<typeof VmixInputSchema>;
export const VmixInputsAnswerSchema = z.union([
  z.object({ok: z.literal(true), instance: z.string(), inputs: z.array(VmixInputSchema)}),
  z.object({ok: z.literal(false), error: z.string().max(200)}),
]);
export type VmixInputsAnswer = z.infer<typeof VmixInputsAnswerSchema>;
