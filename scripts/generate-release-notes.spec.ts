import {describe, expect, it} from 'vitest';
import {mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildReleaseNotesPrompt, gitRanges, isMainModule, type AreaInput} from './generate-release-notes';

const empty: AreaInput = {commitLog: '', diff: ''};

describe('buildReleaseNotesPrompt', () => {
  it('instructs the model to produce a Backend and a Frontend section', () => {
    const {system} = buildReleaseNotesPrompt({
      newTag: '2026.09.1',
      previousTag: '2026.08.3',
      api: empty,
      kit: empty,
      other: empty,
    });

    expect(system).toContain('## Backend (API)');
    expect(system).toContain('## Frontend (UI)');
    expect(system.toLowerCase()).toContain('english');
  });

  it('includes the new tag and previous tag', () => {
    const {user} = buildReleaseNotesPrompt({
      newTag: '2026.09.1',
      previousTag: '2026.08.3',
      api: empty,
      kit: empty,
      other: empty,
    });

    expect(user).toContain('2026.09.1');
    expect(user).toContain('changes since 2026.08.3');
  });

  it('marks the release as the first tracked release when there is no previous tag', () => {
    const {user} = buildReleaseNotesPrompt({
      newTag: '2026.01.1',
      previousTag: null,
      api: empty,
      kit: empty,
      other: empty,
    });

    expect(user).toContain('first tracked release');
    expect(user).not.toContain('changes since');
  });

  it('keeps each area\'s commit log and diff clearly separated in the prompt', () => {
    const {user} = buildReleaseNotesPrompt({
      newTag: '2026.09.1',
      previousTag: '2026.08.3',
      api: {commitLog: '- Add match provider (abc123)', diff: '+ new provider code'},
      kit: {commitLog: '- Fix schedule page (def456)', diff: '+ new UI code'},
      other: {commitLog: '- Update CI (ghi789)', diff: '+ workflow change'},
    });

    // Backend content appears before the Frontend heading, frontend content after it
    const backendIdx = user.indexOf('Add match provider');
    const frontendHeadingIdx = user.indexOf('Frontend (UI');
    const frontendIdx = user.indexOf('Fix schedule page');
    expect(backendIdx).toBeGreaterThan(-1);
    expect(frontendIdx).toBeGreaterThan(frontendHeadingIdx);
    expect(user).toContain('Update CI');
  });

  it('falls back to placeholder text when an area has no commits or diff', () => {
    const {user} = buildReleaseNotesPrompt({
      newTag: '2026.01.1',
      previousTag: '2026.01.0',
      api: empty,
      kit: {commitLog: '- Fix bug (abc)', diff: '+ fix'},
      other: empty,
    });

    expect(user).toContain('(no commits found)');
    expect(user).toContain('(no diff available)');
    expect(user).toContain('Fix bug');
  });
});

describe('gitRanges', () => {
  it('uses the previous tag for both log and diff', () => {
    expect(gitRanges('2026.08.4')).toEqual({logRange: '2026.08.4..HEAD', diffRange: '2026.08.4 HEAD'});
  });

  it('diffs against the empty tree for a first release, never the working tree', () => {
    const {logRange, diffRange} = gitRanges(null);
    expect(logRange).toBe('HEAD');
    expect(diffRange).toBe('4b825dc642cb6eb9a060e54bf8d69288fbee4904 HEAD');
  });
});

describe('isMainModule', () => {
  it('matches a path with spaces reached through a symlink', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'release notes '));
    mkdirSync(path.join(dir, 'real dir'));
    const real = path.join(dir, 'real dir', 'script.ts');
    writeFileSync(real, '');
    const link = path.join(dir, 'link.ts');
    symlinkSync(real, link);

    // import.meta.url is the percent-encoded URL of the resolved file (tmpdir is itself a symlink on macOS)
    const moduleUrl = pathToFileURL(realpathSync(real)).href;
    expect(isMainModule(moduleUrl, real)).toBe(true);
    expect(isMainModule(moduleUrl, link)).toBe(true);
  });

  it('does not match another file or a missing argv[1]', () => {
    expect(isMainModule('file:///some/other.ts', __filename)).toBe(false);
    expect(isMainModule('file:///some/other.ts', undefined)).toBe(false);
  });
});
