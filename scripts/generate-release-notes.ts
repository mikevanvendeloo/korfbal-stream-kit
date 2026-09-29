import {execSync} from 'node:child_process';
import {realpathSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5';
// Cap each area's diff so token usage (and cost) stays predictable even for a
// release with a lot of churn.
const MAX_DIFF_CHARS = 30_000;
// Same idea for the commit log - a first release would otherwise list the whole history.
const MAX_LOG_COMMITS = 200;
const MAX_TOKENS = 4096;
// Well-known hash of git's empty tree: diffing against it shows every file as added,
// which is what "changes since the beginning" means for a first release.
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const GIT_MAX_BUFFER = 1024 * 1024 * 20;

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

// `git log` and `git diff` need different ranges: log takes a revision range
// (A..HEAD, or plain HEAD for all history), diff takes two trees to compare.
// `git diff HEAD` alone would compare against the working tree, not history.
export function gitRanges(previousTag: string | null): {logRange: string; diffRange: string} {
  return previousTag
    ? {logRange: `${previousTag}..HEAD`, diffRange: `${previousTag} HEAD`}
    : {logRange: 'HEAD', diffRange: `${EMPTY_TREE} HEAD`};
}

function gitLog(range: string, pathspec: string): string {
  return execSync(`git log ${range} -n ${MAX_LOG_COMMITS} --pretty=format:"- %s (%h)" -- ${pathspec}`, {
    encoding: 'utf-8',
    maxBuffer: GIT_MAX_BUFFER,
  }).trim();
}

function gitDiff(range: string, pathspec: string): string {
  return truncateDiff(execSync(`git diff ${range} -- ${pathspec}`, {encoding: 'utf-8', maxBuffer: GIT_MAX_BUFFER}).trim());
}

async function main() {
  const newTag = process.env.NEW_TAG;
  const previousTag = process.env.PREVIOUS_TAG || null;
  const outFile = process.env.OUTPUT_FILE || 'release-notes.md';

  if (!newTag) {
    throw new Error('NEW_TAG env var is required');
  }
  // Either a plain API key/auth token, or Workload Identity Federation (the SDK
  // auto-detects WIF from ANTHROPIC_FEDERATION_RULE_ID/_ORGANIZATION_ID/
  // _SERVICE_ACCOUNT_ID + ANTHROPIC_IDENTITY_TOKEN - see services/config.ts callers).
  const hasCredentials = !!(
    process.env.ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_AUTH_TOKEN ||
    process.env.ANTHROPIC_IDENTITY_TOKEN
  );
  if (!hasCredentials) {
    console.log('No Anthropic credentials configured (API key or WIF) - skipping AI release notes generation.');
    return;
  }

  const {logRange, diffRange} = gitRanges(previousTag);
  // Exclude the lockfile from the "other" bucket - its diffs are enormous and add nothing functional.
  const otherPathspec = `. ':!${API_PATH}' ':!${KIT_PATH}' ':!pnpm-lock.yaml'`;

  const area = (pathspec: string): AreaInput => ({
    commitLog: gitLog(logRange, pathspec),
    diff: gitDiff(diffRange, pathspec),
  });
  const api = area(API_PATH);
  const kit = area(KIT_PATH);
  const other = area(otherPathspec);

  const {system, user} = buildReleaseNotesPrompt({newTag, previousTag, api, kit, other});

  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages: [{role: 'user', content: user}],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  // Notes cut off mid-sentence are worse than GitHub's generated ones - fall back instead.
  if (response.stop_reason === 'max_tokens') {
    console.log(`Claude hit the ${MAX_TOKENS} token limit - skipping truncated release notes.`);
    return;
  }

  if (!text) {
    console.log('Claude returned no text content - skipping release notes file.');
    return;
  }

  writeFileSync(outFile, text + '\n', 'utf-8');
  console.log(`Wrote AI-generated release notes to ${outFile}`);
}

// ESM equivalent of `require.main === module` - only run main() when this file
// is executed directly (via tsx), not when imported by the test file. Compare
// URLs built the same way as import.meta.url (percent-encoded, symlinks resolved),
// so paths with spaces or a symlinked checkout still match.
export function isMainModule(moduleUrl: string, argv1: string | undefined): boolean {
  if (!argv1) return false;
  try {
    return moduleUrl === pathToFileURL(realpathSync(argv1)).href;
  } catch {
    return false;
  }
}

if (isMainModule(import.meta.url, process.argv[1])) {
  main().catch((err) => {
    // Non-fatal: the workflow falls back to `gh release create --generate-notes`
    // when this file doesn't exist, so a flaky API call shouldn't fail the release.
    console.error('Failed to generate AI release notes:', err);
  });
}
