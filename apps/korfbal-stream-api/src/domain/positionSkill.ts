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
  return POSITION_TO_SKILL[key] || null;
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
