import {z} from 'zod';

const HexColor = z.string().trim().regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Use #RRGGBB or #AARRGGBB');
// A vMix SelectedName (e.g. "Titel.Text" or "Achtergrond.Fill.Color"); empty means: don't push this field
const FieldName = z.string().trim().max(200).default('');

const StateColorsSchema = z.object({
  background: HexColor,
  text: HexColor,
});

export const CallsheetColorsSchema = z.object({
  normal: StateColorsSchema.default({background: '#22C55E', text: '#FFFFFF'}),
  warning: StateColorsSchema.default({background: '#F97316', text: '#FFFFFF'}),
  overtime: StateColorsSchema.default({background: '#EF4444', text: '#FFFFFF'}),
});

const ColorFieldsSchema = {
  /** Shape/rectangle whose colour follows the state (vMix SetColor) */
  backgroundField: FieldName,
  /** Text fields whose text colour follows the state (vMix SetTextColour) */
  textColorFields: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  colors: CallsheetColorsSchema.default({}),
};

export const VmixCallsheetPushSchema = z.object({
  enabled: z.boolean().default(false),
  /** vMix title input: name, number or key */
  input: z.string().trim().max(200).default(''),
  /**
   * The position to follow (at most one; a list for the timing data source, which takes several). An item
   * counts when that position is on it, or when it has no positions at all. Empty = every item.
   */
  positions: z.array(z.string().trim().min(1).max(100)).max(1, 'Kies één positie').default(['Presentatie']),
  /** From this many seconds left the state becomes 'warning' (orange) */
  warningSeconds: z.number().int().min(0).max(3600).default(10),
  current: z.object({
    titleField: FieldName,
    /** Remaining time as text, e.g. "04:32" or "-00:12" */
    timerField: FieldName,
    startTimeField: FieldName,
    ...ColorFieldsSchema,
  }).default({}),
  next: z.object({
    titleField: FieldName,
    durationField: FieldName,
    /** Time until the next item starts, e.g. "04:32" or "-00:12" */
    startsInField: FieldName,
    startTimeField: FieldName,
    ...ColorFieldsSchema,
  }).default({}),
});

export type VmixCallsheetPushConfig = z.infer<typeof VmixCallsheetPushSchema>;
export type CallsheetColors = z.infer<typeof CallsheetColorsSchema>;
