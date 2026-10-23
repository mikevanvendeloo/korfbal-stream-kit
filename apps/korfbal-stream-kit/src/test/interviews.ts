import type {InterviewNames} from '../lib/interviewPlaceholders';
import type {InterviewCard} from '../hooks/useInterviews';

/**
 * Shared test data for the interview photos: the choice as /interview-names and /interview-cards
 * deliver it. A player with a photo, a player without one, and a coach (no number).
 */
export const ANNA = {name: 'Anna de Vries', shirtNo: 7, photoUrl: 'players/anna.png'};
export const BRAM = {name: 'Bram Bakker', shirtNo: 12, photoUrl: null};
export const KEES = {name: 'Kees Coach', shirtNo: null, photoUrl: null};

/** Home match: Anna is the home player, Bram the away player, Kees the away coach. */
export const interviewNames: InterviewNames = {
  ownSide: 'HOME',
  names: {HOME: {PLAYER: ANNA.name, COACH: null}, AWAY: {PLAYER: BRAM.name, COACH: KEES.name}},
  people: {HOME: {PLAYER: ANNA, COACH: null}, AWAY: {PLAYER: BRAM, COACH: KEES}},
};

export const interviewCards: InterviewCard[] = [
  {id: 1, side: 'HOME', role: 'PLAYER', title: 'Interview speler', teamName: 'Fortuna/Ruitenheer 1', ...ANNA},
  {id: 2, side: 'AWAY', role: 'PLAYER', title: null, teamName: 'Dalto 1', ...BRAM},
  {id: 3, side: 'AWAY', role: 'COACH', title: null, teamName: 'Dalto 1', ...KEES},
];
