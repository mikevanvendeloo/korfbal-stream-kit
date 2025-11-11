import { describe, it, expect } from 'vitest';
import { generateSponsorRows } from './sponsorRows';

describe('generateSponsorRows', () => {
  it('generates rows with unique images per row and no adjacent overlap by construction', () => {
    const subjects = ['Jumbo-099', 'Jumbo-101', 'Jumbo-123', 'beer-geluk'];
    const sponsors = ['a.png', 'b.jpg', 'c.svg', 'd.webp', 'e.jpeg', 'f.png'];

    const rows = generateSponsorRows(subjects, sponsors);

    expect(rows).toHaveLength(subjects.length);
    for (const r of rows) {
      // within row, all images must be unique
      expect(new Set([r.image1, r.image2, r.image3]).size).toBe(3);
    }

    // Verify no overlap between row i and i+1 in any single column by partitioning design
    for (let i = 0; i < rows.length - 1; i++) {
      const a = rows[i];
      const b = rows[i + 1];
      expect(a.image1).not.toBe(b.image2);
      expect(a.image1).not.toBe(b.image3);
      expect(a.image2).not.toBe(b.image1);
      expect(a.image2).not.toBe(b.image3);
      expect(a.image3).not.toBe(b.image1);
      expect(a.image3).not.toBe(b.image2);
    }
  });

  it('throws when less than 3 sponsors', () => {
    expect(() => generateSponsorRows(['subj'], ['a.png', 'b.png'])).toThrow();
  });

  it('throws when no subjects', () => {
    expect(() => generateSponsorRows([], ['a.png', 'b.png', 'c.png'])).toThrow();
  });
});
