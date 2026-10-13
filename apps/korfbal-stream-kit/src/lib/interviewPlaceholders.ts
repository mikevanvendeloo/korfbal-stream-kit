/**
 * Interview placeholders in callsheet titles and notes, e.g. "Interview {coach-tegenstander:kort}".
 *   role:   speler | coach
 *   side:   thuis | uit | eigen | tegenstander (eigen/tegenstander follow the own club, so one template fits home and away matches)
 *   format: (none) "Jan de Vries" | kort "J. de Vries" | achternaam "de Vries"
 * Without a selection the placeholder becomes a short label like "coach uit".
 * Keep in sync with apps/korfbal-stream-api/src/services/interviewPlaceholders.ts.
 */
export const INTERVIEW_PLACEHOLDER = /\{(speler|coach)-(thuis|uit|eigen|tegenstander)(?::(kort|achternaam))?\}/gi;

export type Side = 'HOME' | 'AWAY';
export type Role = 'PLAYER' | 'COACH';
export type InterviewNames = {
  ownSide: Side;
  names: Record<Side, Record<Role, string | null>>;
};

export function shortName(name: string, format?: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2 || !format) return name.trim();
  const rest = parts.slice(1).join(' ');
  return format.toLowerCase() === 'kort' ? `${parts[0][0]}. ${rest}` : rest;
}

export type PlaceholderSegment = { text: string; resolved: boolean | null };

/** Splits text into plain parts (resolved: null), names (true) and fallback labels (false). */
export function splitInterviewPlaceholders(text: string, names: InterviewNames | null): PlaceholderSegment[] {
  const segments: PlaceholderSegment[] = [];
  let last = 0;
  // A fresh regex: a global one keeps lastIndex between calls
  for (const match of text.matchAll(new RegExp(INTERVIEW_PLACEHOLDER.source, 'gi'))) {
    const [raw, roleWord, sideWord, format] = match;
    const index = match.index ?? 0;
    if (index > last) segments.push({text: text.slice(last, index), resolved: null});
    const role: Role = roleWord.toLowerCase() === 'coach' ? 'COACH' : 'PLAYER';
    const sideKey = sideWord.toLowerCase();
    const ownSide = names?.ownSide ?? 'HOME';
    const side: Side = sideKey === 'thuis' ? 'HOME' : sideKey === 'uit' ? 'AWAY'
      : sideKey === 'eigen' ? ownSide : ownSide === 'HOME' ? 'AWAY' : 'HOME';
    const name = names?.names[side][role];
    segments.push(name
      ? {text: shortName(name, format), resolved: true}
      : {text: `${roleWord.toLowerCase()} ${sideKey}`, resolved: false});
    last = index + raw.length;
  }
  if (last < text.length) segments.push({text: text.slice(last), resolved: null});
  return segments;
}

export function resolveInterviewPlaceholders(text: string, names: InterviewNames | null): string {
  if (!text) return text;
  return splitInterviewPlaceholders(text, names).map((s) => s.text).join('');
}

