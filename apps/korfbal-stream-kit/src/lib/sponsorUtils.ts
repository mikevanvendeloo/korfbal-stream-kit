export function normalizeSponsorName(input: string): string {
  // Remove common Dutch legal suffixes like "B.V.", "BV", "B. V.", optionally with commas
  // and extra spaces around. Then collapse spaces and trim.
  let s = String(input || '');
  // Remove commas directly before/after BV tokens
  s = s.replace(/\s*,\s*/g, ' ');
  // Remove B.V. patterns (case-insensitive)
  s = s.replace(/\bB\.?\s?V\.?\b/gi, '').replace(/\s{2,}/g, ' ').trim();
  // Also remove trailing/leading stray punctuation or separators if left behind
  s = s.replace(/^[\s,.;:–—-]+/, '').replace(/[\s,.;:–—-]+$/g, '').trim();
  return s;
}

export function isValidSponsorUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
