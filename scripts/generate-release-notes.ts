import {execSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5';
// Cap each area's diff so token usage (and cost) stays predictable even for a
// release with a lot of churn.
const MAX_DIFF_CHARS = 30_000;

const API_PATH = 'apps/korfbal-stream-api';
const KIT_PATH = 'apps/korfbal-stream-kit';

export interface AreaInput {
  commitLog: string;
  diff: string;
}

export interface ReleaseNotesInput {
  newTag: string;
  previousTag: string | null;
  // Each Docker image (API, UI) is built from its own app directory - split
  // the input by area so the notes can be organized per image, not as one
  // undifferentiated blob.
  api: AreaInput;
  kit: AreaInput;
  other: AreaInput;
}

// Pure so it can be unit tested without calling the API or shelling out to git.
export function buildReleaseNotesPrompt({newTag, previousTag, api, kit, other}: ReleaseNotesInput): {
  system: string;
  user: string;
} {
  const system = [
    'You write release notes for Korfbal StreamKit, an internal livestream production tool used by a Dutch korfbal club.',
    'The audience is the production crew and the developer maintaining the app - not end users of a public product.',
    'This repo ships two separately deployed Docker images from the same release: the backend API (apps/korfbal-stream-api) and the frontend UI (apps/korfbal-stream-kit).',
    'Structure your response as exactly two sections with these exact headings, in this order: "## Backend (API)" and "## Frontend (UI)".',
    'Under each heading, describe only the functional changes relevant to that image: new capabilities, behavior changes, fixes, and anything the crew or an operator would notice.',
    'A change to build/release infrastructure (CI, Dockerfiles, shared config) that is not specific to one app should be mentioned briefly under whichever section it most affects, or under both if it affects both equally.',
    'If a section has no meaningful functional changes this release, write exactly "No changes in this release." under that heading - do not omit the heading itself.',
    "Synthesize what the commits and diff mean in practice - don't just restate commit messages verbatim.",
    'Skip purely internal changes (refactors with no behavior change, routine dependency bumps) unless they affect reliability or how the app is deployed or configured.',
    'Write in English, in plain prose and/or short bullet points under each heading. No overall title, no "Release X" heading, no sign-off.',
  ].join(' ');

  const section = (label: string, area: AreaInput) =>
    [
      `### ${label} - commit log`,
      area.commitLog || '(no commits found)',
      '',
      `### ${label} - diff`,
      area.diff || '(no diff available)',
    ].join('\n');

  const user = [
    `Release: ${newTag}${previousTag ? ` (changes since ${previousTag})` : ' (first tracked release)'}`,
    '',
    section('Backend (API, apps/korfbal-stream-api)', api),
    '',
    section('Frontend (UI, apps/korfbal-stream-kit)', kit),
    '',
    section('Other (infra, CI, shared config)', other),
  ].join('\n');

  return {system, user};
}

function truncateDiff(diff: string): string {
  if (diff.length <= MAX_DIFF_CHARS) return diff;
  return diff.slice(0, MAX_DIFF_CHARS) + '\n\n[... diff truncated ...]';
}

function gitLog(range: string, pathspec: string): string {
  return execSync(`git log ${range} --pretty=format:"- %s (%h)" -- ${pathspec}`, {encoding: 'utf-8'}).trim();
}

function gitDiff(range: string, pathspec: string): string {
  return truncateDiff(
    execSync(`git diff ${range} -- ${pathspec}`, {encoding: 'utf-8', maxBuffer: 1024 * 1024 * 20}).trim()
  );
}

async function main() {
  const newTag = process.env.NEW_TAG;
  const previousTag = process.env.PREVIOUS_TAG || null;
  const outFile = process.env.OUTPUT_FILE || 'release-notes.md';

  if (!newTag) {
    throw new Error('NEW_TAG env var is required');
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('ANTHROPIC_API_KEY not set - skipping AI release notes generation.');
    return;
  }

  const range = previousTag ? `${previousTag}..HEAD` : 'HEAD';
  // Exclude the lockfile from the "other" bucket - its diffs are enormous and add nothing functional.
  const otherPathspec = `. ':!${API_PATH}' ':!${KIT_PATH}' ':!pnpm-lock.yaml'`;

  const api: AreaInput = {commitLog: gitLog(range, API_PATH), diff: gitDiff(range, API_PATH)};
  const kit: AreaInput = {commitLog: gitLog(range, KIT_PATH), diff: gitDiff(range, KIT_PATH)};
  const other: AreaInput = {commitLog: gitLog(range, otherPathspec), diff: gitDiff(range, otherPathspec)};

  const {system, user} = buildReleaseNotesPrompt({newTag, previousTag, api, kit, other});

  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1536,
    system,
    messages: [{role: 'user', content: user}],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  if (!text) {
    console.log('Claude returned no text content - skipping release notes file.');
    return;
  }

  writeFileSync(outFile, text + '\n', 'utf-8');
  console.log(`Wrote AI-generated release notes to ${outFile}`);
}

// ESM equivalent of `require.main === module` - only run main() when this file
// is executed directly (via tsx), not when imported by the test file.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    // Non-fatal: the workflow falls back to `gh release create --generate-notes`
    // when this file doesn't exist, so a flaky API call shouldn't fail the release.
    console.error('Failed to generate AI release notes:', err);
  });
}
