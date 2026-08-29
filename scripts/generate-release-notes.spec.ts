import {describe, expect, it} from 'vitest';
import {buildReleaseNotesPrompt, type AreaInput} from './generate-release-notes';

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
