import {describe, expect, it} from 'vitest';
import {matchPartState} from './matchParts';

const part = (status: string) => ({status, isMatchPart: true});
const other = (status: string) => ({status, isMatchPart: false});

describe('matchPartState', () => {
  it('is part 1, not running, without items or without match parts (a match always starts in part 1)', () => {
    expect(matchPartState([])).toEqual({matchPart: 1, matchPartRunning: false});
    expect(matchPartState([other('ACTIVE'), {status: 'WAITING'}])).toEqual({matchPart: 1, matchPartRunning: false});
  });

  it('is part 1, not running, before the first match part', () => {
    expect(matchPartState([other('ACTIVE'), part('WAITING'), part('WAITING')])).toEqual({matchPart: 1, matchPartRunning: false});
  });

  it('counts the second half as running', () => {
    expect(matchPartState([part('COMPLETED'), other('COMPLETED'), part('ACTIVE')])).toEqual({matchPart: 2, matchPartRunning: true});
  });

  it('keeps the count during the rust', () => {
    expect(matchPartState([part('COMPLETED'), other('ACTIVE'), part('WAITING')])).toEqual({matchPart: 1, matchPartRunning: false});
  });

  it('counts the third of four quarters', () => {
    expect(matchPartState([part('COMPLETED'), part('COMPLETED'), part('ACTIVE'), part('WAITING')])).toEqual({matchPart: 3, matchPartRunning: true});
  });

  it('goes back with Vorig', () => {
    expect(matchPartState([part('COMPLETED'), part('WAITING')])).toEqual({matchPart: 1, matchPartRunning: false});
  });
});
