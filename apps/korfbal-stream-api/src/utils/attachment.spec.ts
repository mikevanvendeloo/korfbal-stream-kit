import {describe, expect, it} from 'vitest';
import {attachmentFileName, contentDisposition} from './attachment';

describe('contentDisposition', () => {
  it('keeps a normal name readable', () => {
    expect(attachmentFileName('production-2026-11-07-Fortuna/Ruitenheer 1-PKC 1-export.json'))
      .toBe('production-2026-11-07-Fortuna-Ruitenheer-1-PKC-1-export.json');
    expect(attachmentFileName('draaiboek-Café Zaal.xlsx')).toBe('draaiboek-Cafe-Zaal.xlsx');
  });

  it('cannot inject header parameters or break the header', () => {
    const header = contentDisposition(`x"; filename*=UTF-8''evil.html`);
    expect(header).toBe('attachment; filename="x-filename-UTF-8-evil.html"');
    expect(header.match(/"/g)).toHaveLength(2);
    expect(contentDisposition('名前\r\n')).toBe('attachment; filename="download"');
    expect(() => new Headers({'content-disposition': contentDisposition('Ωmega 🏐 ☃')})).not.toThrow();
  });
});
