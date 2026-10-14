// Single source of truth for mapping production positions -> required skill codes

export function normalizePositionName(name: string): string {
  return name.trim().toLowerCase();
}

// Canonical skill codes per normalized position name.
// Note on LED vs SCHERM_REGISSEUR: we use SCHERM_REGISSEUR as the canonical code.
export const POSITION_TO_SKILL: Record<string, string> = {
  // Cameras
  'camera rechts': 'CAMERA_ZOOM',
  'camera links': 'CAMERA_ZOOM',
  'camera studio': 'CAMERA_ZOOM',
  'camera midden': 'CAMERA_OVERVIEW',
  'camera overzicht': 'CAMERA_OVERVIEW',
  'overzicht camera': 'CAMERA_OVERVIEW',
  'ptz operator': 'CAMERA_PTZ',

  // Direction / production
  'regie': 'REGISSEUR',
  'regie livestream': 'REGISSEUR',
  'show caller': 'SHOWCALLER',
  'showcaller': 'SHOWCALLER',

  // Replay / VT
  'herhalingen': 'HERHALINGEN',

  // LED/graphics/music
  'scherm regie': 'SCHERM_REGISSEUR',
  'regie ledscherm': 'SCHERM_REGISSEUR',
  'ledscherm regie': 'SCHERM_REGISSEUR',
  'muziek': 'GELUID',

  // On-air
  'commentaar': 'COMMENTAAR',
  'presentatie': 'PRESENTATIE',
  'analist': 'ANALIST',
  'speaker': 'SPEAKER',

  // Misc / utility
  'volgspot oplopen': 'SPOTLIGHT',
  'interview coordinator': 'INTERVIEW_COORDINATOR',
  'oplopen geluid': 'OPLOPEN_GELUID',
  'in-ear ondersteuning': 'IN_EAR_SUPPORT',
  'runner': 'RUNNER',
};

export function getRequiredSkillCodeForPosition(name: string): string | null {
  const key = normalizePositionName(name);
  if (POSITION_TO_SKILL[key]) return POSITION_TO_SKILL[key];
  const found = findPositionByName(Object.keys(POSITION_TO_SKILL).map((n) => ({name: n})), name);
  return found ? POSITION_TO_SKILL[found.name] : null;
}

// Default ordered list of positions to suggest for each segment
export const DEFAULT_SEGMENT_POSITIONS: string[] = [
  'Camera overzicht',
  'Camera links',
  'Camera rechts',
  'Regie livestream',
  'Regie LEDscherm',
  'Commentaar',
];

/** The show caller position that every callsheet item gets; the seed creates it under this name. */
export const SHOWCALLER_POSITION = 'Showcaller';

/** Compares position names ignoring case, spaces and punctuation: "Show caller" = "Showcaller". */
export function positionKey(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
}

/** Other names in use for the same position (keys as positionKey gives them). */
export const POSITION_ALIASES: Record<string, string> = {
  overzichtcamera: 'cameraoverzicht',
  regie: 'regielivestream',
  schermregie: 'regieledscherm',
  ledschermregie: 'regieledscherm',
};

/**
 * The existing position meant by `name`, matching case, spacing and known aliases. Use this instead of
 * an exact name lookup, so a slightly different spelling never creates a second position.
 */
export function findPositionByName<T extends { name: string }>(positions: T[], name: string): T | undefined {
  const key = positionKey(name);
  const byKey = (k: string) => positions.find((p) => positionKey(p.name) === k);
  const alias = POSITION_ALIASES[key];
  return byKey(key) ?? (alias ? byKey(alias) : undefined)
    // Also the other way round: "Regie livestream" finds a position that is still called "regie"
    ?? Object.entries(POSITION_ALIASES).filter(([, canonical]) => canonical === key).map(([a]) => byKey(a)).find(Boolean);
}
