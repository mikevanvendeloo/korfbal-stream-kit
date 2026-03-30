export type SkillType = 'crew' | 'entertainment';

export interface SeedSkill {
  code: string;
  name: string;
  nameMale: string;
  nameFemale: string;
  type: SkillType;
}

export interface SeedPosition {
  name: string;
  isStudio: boolean;
  category: 'GENERAL' | 'TECHNICAL' | 'ENTERTAINMENT';
  sortOrder: number;
  skillCode?: string;
}

export interface SeedPerson {
  name: string;
  gender: 'male' | 'female';
  skillCodes: string[];
}

export interface SeedTitlePart {
  sourceType: 'COMMENTARY' | 'PRESENTATION_AND_ANALIST' | 'TEAM_COACH' | 'TEAM_PLAYER';
  teamSide: 'AWAY' | 'HOME' | 'NONE';
  limit?: number | null;
}

export interface SeedTitleDefinition {
  name: string;
  parts: SeedTitlePart[];
}

export const seedSkills: SeedSkill[] = [
  { "code": "SHOWCALLER", "name": "Show caller", "nameMale": "Show caller", "nameFemale": "Show caller", "type": "crew" },
  { "code": "ANALIST", "name": "Analist", "nameMale": "Analist", "nameFemale": "Analist", "type": "entertainment" },
  { "code": "PRESENTATIE", "name": "Presentatie", "nameMale": "Presentator", "nameFemale": "Presentatrice", "type": "entertainment" },
  { "code": "COMMENTAAR", "name": "Commentaar", "nameMale": "Commentator", "nameFemale": "Commentatrice", "type": "entertainment" },
  { "code": "SPEAKER", "name": "Speaker", "nameMale": "Speaker", "nameFemale": "Speaker", "type": "entertainment" },
  { "code": "IN_EAR_SUPPORT", "name": "In-ear ondersteuning", "nameMale": "In-ear ondersteuning", "nameFemale": "In-ear ondersteuning", "type": "crew" },
  { "code": "INTERVIEW_COORDINATOR", "name": "Interview coordinator", "nameMale": "Interview coordinator", "nameFemale": "Interview coordinator", "type": "crew" },
  { "code": "REGISSEUR", "name": "Regie livestream", "nameMale": "Regisseur", "nameFemale": "Regisseuse", "type": "crew" },
  { "code": "CAMERA_OVERVIEW", "name": "Camera overzicht", "nameMale": "Cameraman", "nameFemale": "Cameravrouw", "type": "crew" },
  { "code": "HERHALINGEN", "name": "Herhalingen operator", "nameMale": "Herhalingen operator", "nameFemale": "Herhalingen operator", "type": "crew" },
  { "code": "CAMERA_ZOOM", "name": "Camera zoom", "nameMale": "Cameraman", "nameFemale": "Cameravrouw", "type": "crew" },
  { "code": "CAMERA_PTZ", "name": "PTZ operator", "nameMale": "PTZ operator", "nameFemale": "PTZ operator", "type": "crew" },
  { "code": "OPLOPEN_GELUID", "name": "Oplopen geluid", "nameMale": "Geluidsman", "nameFemale": "Geluidsvrouw", "type": "crew" },
  { "code": "SCHERM_REGISSEUR", "name": "Regie LEDscherm", "nameMale": "Regisseur", "nameFemale": "Regisseuse", "type": "crew" },
  { "code": "RUNNER", "name": "Runner", "nameMale": "Runner", "nameFemale": "Runner", "type": "crew" },
  { "code": "GELUID", "name": "Geluid", "nameMale": "Geluidsman", "nameFemale": "Geluidsvrouw", "type": "crew" },
  { "code": "SPOTLIGHT", "name": "Volgspot oplopen", "nameMale": "Lichtman", "nameFemale": "Lichtvrouw", "type": "crew" }
];

export const seedPositions: SeedPosition[] = [
  { "name": "Showcaller", "isStudio": false, "category": "GENERAL", "sortOrder": 110, "skillCode": "SHOWCALLER" },
  { "name": "Analist", "isStudio": true, "category": "ENTERTAINMENT", "sortOrder": 150, "skillCode": "ANALIST" },
  { "name": "Presentatie", "isStudio": true, "category": "ENTERTAINMENT", "sortOrder": 140, "skillCode": "PRESENTATIE" },
  { "name": "Commentaar", "isStudio": true, "category": "ENTERTAINMENT", "sortOrder": 130, "skillCode": "COMMENTAAR" },
  { "name": "Speaker", "isStudio": true, "category": "ENTERTAINMENT", "sortOrder": 160, "skillCode": "SPEAKER" },
  { "name": "In-ear ondersteuning", "isStudio": false, "category": "ENTERTAINMENT", "sortOrder": 180, "skillCode": "IN_EAR_SUPPORT" },
  { "name": "Interview coordinator", "isStudio": true, "category": "ENTERTAINMENT", "sortOrder": 120, "skillCode": "INTERVIEW_COORDINATOR" },
  { "name": "Regie livestream", "isStudio": false, "category": "TECHNICAL", "sortOrder": 0, "skillCode": "REGISSEUR" },
  { "name": "Camera overzicht", "isStudio": false, "category": "TECHNICAL", "sortOrder": 20, "skillCode": "CAMERA_OVERVIEW" },
  { "name": "Herhalingen", "isStudio": false, "category": "TECHNICAL", "sortOrder": 50, "skillCode": "HERHALINGEN" },
  { "name": "Camera links", "isStudio": false, "category": "TECHNICAL", "sortOrder": 10, "skillCode": "CAMERA_ZOOM" },
  { "name": "Camera rechts", "isStudio": false, "category": "TECHNICAL", "sortOrder": 30, "skillCode": "CAMERA_ZOOM" },
  { "name": "PTZ operator", "isStudio": true, "category": "TECHNICAL", "sortOrder": 40, "skillCode": "CAMERA_PTZ" },
  { "name": "Oplopen geluid", "isStudio": false, "category": "TECHNICAL", "sortOrder": 80, "skillCode": "OPLOPEN_GELUID" },
  { "name": "Regie LEDscherm", "isStudio": false, "category": "TECHNICAL", "sortOrder": 60, "skillCode": "SCHERM_REGISSEUR" },
  { "name": "Runner", "isStudio": false, "category": "GENERAL", "sortOrder": 170, "skillCode": "RUNNER" },
  { "name": "Muziek", "isStudio": false, "category": "TECHNICAL", "sortOrder": 70, "skillCode": "GELUID" }
];

export const seedPersons: SeedPerson[] = [
  { "name": "Danny", "gender": "male", "skillCodes": [ "REGISSEUR", "CAMERA_ZOOM", "CAMERA_OVERVIEW", "SCHERM_REGISSEUR", "IN_EAR_SUPPORT" ] },
  { "name": "Pascal", "gender": "male", "skillCodes": [ "REGISSEUR", "GELUID", "SPOTLIGHT", "SCHERM_REGISSEUR", "CAMERA_ZOOM", "CAMERA_OVERVIEW", "HERHALINGEN", "IN_EAR_SUPPORT", "RUNNER" ] },
  { "name": "Michel", "gender": "male", "skillCodes": [ "REGISSEUR", "CAMERA_ZOOM", "CAMERA_OVERVIEW", "SCHERM_REGISSEUR", "SPOTLIGHT", "HERHALINGEN", "IN_EAR_SUPPORT" ] },
  { "name": "Richard", "gender": "male", "skillCodes": [ "CAMERA_ZOOM", "SPOTLIGHT", "GELUID", "CAMERA_OVERVIEW", "REGISSEUR", "HERHALINGEN" ] },
  { "name": "Henk", "gender": "male", "skillCodes": [ "CAMERA_OVERVIEW" ] },
  { "name": "Mike", "gender": "male", "skillCodes": [ "CAMERA_OVERVIEW", "CAMERA_ZOOM", "SCHERM_REGISSEUR", "INTERVIEW_COORDINATOR", "HERHALINGEN" ] },
  { "name": "Bart", "gender": "male", "skillCodes": [ "CAMERA_ZOOM", "REGISSEUR", "HERHALINGEN" ] },
  { "name": "Christie", "gender": "female", "skillCodes": [ "CAMERA_OVERVIEW", "CAMERA_ZOOM", "INTERVIEW_COORDINATOR" ] },
  { "name": "Peter Jan", "gender": "male", "skillCodes": [ "CAMERA_OVERVIEW", "CAMERA_ZOOM", "SCHERM_REGISSEUR" ] },
  { "name": "Bastiaan", "gender": "male", "skillCodes": [ "CAMERA_OVERVIEW", "CAMERA_ZOOM", "SCHERM_REGISSEUR" ] },
  { "name": "Ron", "gender": "male", "skillCodes": [ "CAMERA_OVERVIEW", "CAMERA_ZOOM", "SCHERM_REGISSEUR" ] },
  { "name": "Justin", "gender": "male", "skillCodes": [ "SCHERM_REGISSEUR" ] },
  { "name": "Thomas", "gender": "male", "skillCodes": [ "CAMERA_OVERVIEW", "CAMERA_ZOOM", "SPOTLIGHT", "GELUID" ] },
  { "name": "Ferdinand Wittenberg", "gender": "male", "skillCodes": [ "PRESENTATIE", "COMMENTAAR" ] },
  { "name": "Daan de Groot", "gender": "male", "skillCodes": [ "COMMENTAAR" ] },
  { "name": "Peter Boes", "gender": "male", "skillCodes": [ "ANALIST" ] },
  { "name": "Ryanne Segaar", "gender": "female", "skillCodes": [ "PRESENTATIE" ] },
  { "name": "Claire van Oosten", "gender": "female", "skillCodes": [ "PRESENTATIE", "ANALIST" ] },
  { "name": "Jennifer Tromp", "gender": "female", "skillCodes": [ "COMMENTAAR", "ANALIST" ] },
  { "name": "Ed van der Steen", "gender": "male", "skillCodes": [ "ANALIST" ] },
  { "name": "Laurens Verbaan", "gender": "male", "skillCodes": [ "ANALIST", "COMMENTAAR" ] },
  { "name": "Bruun van der Steuijt", "gender": "male", "skillCodes": [ "SPEAKER" ] },
  { "name": "Maarten Boot", "gender": "male", "skillCodes": [ "SPEAKER" ] },
  { "name": "Cindy van Eijk", "gender": "female", "skillCodes": [ "COMMENTAAR", "ANALIST" ] },
  { "name": "Alwin Blijleven", "gender": "male", "skillCodes": [ "PRESENTATIE" ] }
];

export const seedTitles: SeedTitleDefinition[] = [
  {
    name: 'Presentatie & analist',
    parts: [
      { sourceType: 'PRESENTATION_AND_ANALIST', teamSide: 'NONE' },
    ]
  },
  {
    name: 'Commentaar (allen)',
    parts: [
      { sourceType: 'COMMENTARY', teamSide: 'NONE' },
    ]
  },
  {
    name: 'Uit coach',
    parts: [
      { sourceType: 'TEAM_COACH', teamSide: 'AWAY' },
    ]
  },
  {
    name: 'Uit speler',
    parts: [
      { sourceType: 'TEAM_PLAYER', teamSide: 'AWAY' },
    ]
  },
  {
    name: 'Thuis coach',
    parts: [
      { sourceType: 'TEAM_COACH', teamSide: 'HOME' },
    ]
  },
  {
    name: 'Thuis speler',
    parts: [
      { sourceType: 'TEAM_PLAYER', teamSide: 'HOME' },
    ]
  }
];
