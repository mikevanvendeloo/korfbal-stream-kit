export interface SeedPerson {
  name: string;
  gender: 'male' | 'female';
  skillCodes: string[];
}

/** Fortuna's own crew; not part of the standard set (src/standardSet). */
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
