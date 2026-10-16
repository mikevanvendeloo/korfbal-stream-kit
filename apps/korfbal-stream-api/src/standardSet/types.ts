export type SkillType = 'crew' | 'entertainment';

export interface StandardSkill {
  code: string;
  name: string;
  nameMale: string;
  nameFemale: string;
  type: SkillType;
}

export interface StandardPosition {
  name: string;
  isStudio: boolean;
  category: 'GENERAL' | 'TECHNICAL' | 'ENTERTAINMENT';
  sortOrder: number;
  skillCode?: string;
}

export interface StandardPositionLink {
  source: string;
  targets: string[];
}

export interface StandardTitlePart {
  sourceType: 'COMMENTARY' | 'PRESENTATION_AND_ANALIST' | 'TEAM_COACH' | 'TEAM_PLAYER';
  teamSide: 'AWAY' | 'HOME' | 'NONE';
  limit?: number | null;
}

export interface StandardTitleDefinition {
  name: string;
  parts: StandardTitlePart[];
}

export interface StandardCallSheetTemplateItem {
  /** Only to link items to their parent (`parentKey`) */
  key?: string;
  parentKey?: string;
  title: string;
  note?: string;
  durationSec: number;
  orderIndex: number;
  isInVenue: boolean;
  isInLivestream: boolean;
  isTimeAnchor?: boolean;
  anchorType?: string;
  autoAdvance?: boolean;
  /** Position names, matched like findPositionByName */
  positions: string[];
}

export interface StandardCallSheetTemplate {
  name: string;
  items: StandardCallSheetTemplateItem[];
}

export interface StandardSegmentTemplate {
  name: string;
  isDefault: boolean;
  items: Array<{naam: string; volgorde: number; duurInMinuten: number; isTimeAnchor: boolean}>;
}
