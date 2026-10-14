import {describe, expect, it} from 'vitest';
import {headingId, manualChapters, parseChapter, renderManual, searchManual} from './manual';
import {helpTopicFor, manualPath} from './helpTopics';

describe('manual files', () => {
  it('reads the order, slug, title and sections from a file', () => {
    const chapter = parseChapter('./live/03-callsheet.md', '# De callsheet\n\nIntro\n\n## Kleuren & tijden\n\n## Wat je ziet\n');
    expect(chapter).toEqual({
      part: 'live', slug: 'callsheet', title: 'De callsheet', markdown: expect.any(String),
      sections: [{id: 'kleuren-tijden', title: 'Kleuren & tijden'}, {id: 'wat-je-ziet', title: 'Wat je ziet'}],
    });
    expect(parseChapter('./live/zonder-nummer.md', '# X')).toBeNull();
  });

  it('gives headings an anchor id, also with accents', () => {
    expect(headingId('Interviews kiezen')).toBe('interviews-kiezen');
    expect(headingId('Coördinatie & tijd')).toBe('coordinatie-tijd');
    expect(renderManual('## Kleuren & tijden')).toContain('<h2 id="kleuren-tijden">Kleuren &amp; tijden</h2>');
  });

  it('bundles both parts, in file order', () => {
    const live = manualChapters('live');
    expect(live.length).toBeGreaterThan(0);
    expect(live[0].slug).toBe('aan-de-slag');
    expect(manualChapters('beheer').length).toBeGreaterThan(0);
    expect(live.every((c) => c.part === 'live')).toBe(true);
  });

  it('every LIVE help topic points at an existing chapter', () => {
    const slugs = manualChapters('live').map((c) => c.slug);
    for (const path of ['/', '/callsheet/3/presentatie', '/show-caller', '/scoreboard', '/vmix']) {
      expect(slugs).toContain(helpTopicFor(path).chapter);
    }
  });

  it('finds chapters that contain all search words', () => {
    const hits = searchManual('live', 'oranje rood');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((c) => /oranje/i.test(c.markdown) && /rood/i.test(c.markdown))).toBe(true);
    expect(searchManual('live', 'xyzzy-bestaat-niet')).toEqual([]);
  });
});

describe('help topics', () => {
  it('opens the chapter about the current screen', () => {
    expect(manualPath(helpTopicFor('/show-caller/7/regie'))).toBe('/handleiding/show-caller');
    expect(manualPath(helpTopicFor('/admin/producties/5/beschikbaarheid'))).toBe('/admin/handleiding/bezetting#beschikbaarheid');
    expect(manualPath(helpTopicFor('/admin/producties/5'))).toBe('/admin/handleiding/draaiboek');
    expect(manualPath(helpTopicFor('/admin/stamgegevens/vmix-koppeling'))).toBe('/admin/handleiding/vmix');
    expect(manualPath(helpTopicFor('/admin/iets-onbekends'))).toBe('/admin/handleiding/aan-de-slag');
  });
});
