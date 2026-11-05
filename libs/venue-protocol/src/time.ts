/** "MM:SS" from the scoreboard's time-as-array answer (["15", "34"] or [{minute, second}]). */
export function parseVenueTime(data: unknown): string {
  if (!Array.isArray(data) || data.length === 0) return '';
  if (typeof data[0] === 'string') return data.join(':');
  if (data[0]?.minute !== undefined) return `${data[0].minute}:${data[0].second}`;
  return '';
}

export type ShotclockColor = 'green' | 'orange' | 'red';

/** Red up to 10 s, orange up to 15 s, green above. */
export function colorForShotclock(time: number): ShotclockColor {
  if (time <= 10) return 'red';
  if (time <= 15) return 'orange';
  return 'green';
}

/** The shot clock's time-as-array answer with a `color` per item (undefined when the time is not a number). */
export function enrichShotclock(data: unknown[]): unknown[] {
  return data.map((item) => {
    const time = Number((item as {time?: unknown} | null)?.time);
    const color = Number.isFinite(time) ? colorForShotclock(time) : undefined;
    return {...(item as object), color};
  });
}
