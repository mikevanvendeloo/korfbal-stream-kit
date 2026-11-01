import {describe, expect, it} from 'vitest';
import {interviewMomentsOf} from './interviewMoments';
import type {InterviewNames} from './interviewPlaceholders';

const names: InterviewNames = {
  ownSide: 'HOME',
  names: {HOME: {PLAYER: 'Anna de Vries', COACH: 'Henk Thuis'}, AWAY: {PLAYER: null, COACH: 'Kees Uit'}},
  people: {HOME: {PLAYER: null, COACH: null}, AWAY: {PLAYER: null, COACH: null}},
};
const item = (id: string, title: string, chapter: string | null = null) => ({id, title, plannedStartTime: null, chapter: chapter ? {name: chapter} : null});

describe('interviewMomentsOf', () => {
  it('lists the interviews in draaiboek order with their hoofdstuk, also the same person twice', () => {
    const moments = interviewMomentsOf([
      item('a', 'Livestream starten', 'Voorbeschouwing'),
      item('b', 'Interview {coach-uit}', 'Voorbeschouwing'),
      item('c', 'Interview {coach-thuis:achternaam}', 'Voorbeschouwing'),
      item('d', 'Analyse rust', 'Rust'),
      item('e', 'Interview {coach-tegenstander} en {speler-tegenstander}', 'Nabeschouwing'),
      item('f', 'Interview {coach-eigen} en {speler-eigen:kort}', 'Nabeschouwing'),
    ], names);
    expect(moments.map((m) => [m.position, m.chapter, m.title])).toEqual([
      [1, 'Voorbeschouwing', 'Interview Kees Uit'],
      [2, 'Voorbeschouwing', 'Interview Thuis'],
      [3, 'Nabeschouwing', 'Interview Kees Uit en speler tegenstander'],
      [4, 'Nabeschouwing', 'Interview Henk Thuis en A. de Vries'],
    ]);
    expect(moments[2].people).toEqual([{side: 'AWAY', role: 'COACH', name: 'Kees Uit'}, {side: 'AWAY', role: 'PLAYER', name: null}]);
  });

  it('names a person once per item, and skips items without a placeholder', () => {
    const [moment] = interviewMomentsOf([item('x', '{coach-uit} kort: {coach-uit:kort}'), item('y', 'Geen interview')], names);
    expect(moment.people).toEqual([{side: 'AWAY', role: 'COACH', name: 'Kees Uit'}]);
  });

  it('still lists the moments before anyone is chosen', () => {
    expect(interviewMomentsOf([item('z', 'Interview {speler-thuis}')], null)).toEqual([
      {position: 1, itemId: 'z', title: 'Interview speler thuis', chapter: null, plannedStartTime: null, people: [{side: 'HOME', role: 'PLAYER', name: null}]},
    ]);
  });
});
