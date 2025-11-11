import { describe, it, expect } from 'vitest';
import { normalizeSponsorName } from './sponsorUtils';

describe('normalizeSponsorName', () => {
  const cases: Array<[string, string]> = [
    ['ACME B.V.', 'ACME'],
    ['ACME B. V.', 'ACME'],
    ['ACME BV', 'ACME'],
    ['ACME, B.V.', 'ACME'],
    ['ACME  B.V.', 'ACME'],
    ['  ACME B.V.  ', 'ACME'],
    ['B.V. ACME', 'ACME'], // although uncommon, make sure leading token is removed
    ['ACME', 'ACME'],
  ];

  for (const [input, expected] of cases) {
    it(`strips BV token from "${input}" -> "${expected}"`, () => {
      expect(normalizeSponsorName(input)).toBe(expected);
    });
  }
});
