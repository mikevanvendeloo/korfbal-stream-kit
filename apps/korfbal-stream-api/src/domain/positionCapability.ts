// Single source of truth for mapping production positions -> required capability codes

export function normalizePositionName(name: string): string {
  return name.trim().toLowerCase();
}

// Canonical capability codes per normalized position name.
// Note on LED vs SCHERM_REGISSEUR: we use SCHERM_REGISSEUR as the canonical code.
export const POSITION_TO_CAPABILITY: Record<string, string> = {
  // Cameras
  'camera rechts': 'CAMERA_ZOOM',
  'camera links': 'CAMERA_ZOOM',
  'camera studio': 'CAMERA_ZOOM',
  'camera midden': 'CAMERA_OVERVIEW',

  // Direction / production
  'regie': 'REGISSEUR',
  'show caller': 'SHOW_CALLER',

  // Replay / VT
  'herhalingen': 'HERHALINGEN',

  // LED/graphics/music
  'scherm regie': 'SCHERM_REGISSEUR',
  'muziek': 'GELUID',

  // On-air
  'commentaar': 'COMMENTAAR',
  'presentatie': 'PRESENTATIE',
  'analist': 'ANALIST',

  // Misc / utility
  'volgspot oplopen': 'SPOTLIGHT',
  'interview coordinator': 'INTERVIEW_COORDINATOR',
};

export function getRequiredCapabilityCodeForPosition(name: string): string | null {
  const key = normalizePositionName(name);
  return POSITION_TO_CAPABILITY[key] || null;
}

// Default ordered list of positions to suggest for each segment
export const DEFAULT_SEGMENT_POSITIONS: string[] = [
  'overzicht camera',
  'camera links',
  'camera rechts',
  'regie',
  'scherm regie',
  'commentaar',
];
