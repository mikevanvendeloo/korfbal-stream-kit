import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {dailyLogFile} from './dailyLogFile';

const write = (stream: ReturnType<typeof dailyLogFile>, line: string) => new Promise<void>((resolve) => stream.write(line, () => resolve()));

describe('dailyLogFile', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-log-')); });
  afterEach(() => fs.rmSync(dir, {recursive: true, force: true}));

  it('writes to a file per Amsterdam day and keeps the last days', async () => {
    let now = new Date('2026-10-30T22:30:00Z'); // 23:30 in Amsterdam
    const stream = dailyLogFile(dir, 'error', 2, () => now);
    await write(stream, 'a\n');
    now = new Date('2026-10-30T23:30:00Z'); // 31 Oct in Amsterdam
    await write(stream, 'b\n');
    now = new Date('2026-11-01T12:00:00Z');
    await write(stream, 'c\n');
    expect(fs.readdirSync(dir).sort()).toEqual(['error-2026-10-31.log', 'error-2026-11-01.log']);
    expect(fs.readFileSync(path.join(dir, 'error-2026-10-31.log'), 'utf8')).toBe('b\n');
  });

  it('never throws without a writable directory', async () => {
    const file = path.join(dir, 'not-a-dir');
    fs.writeFileSync(file, '');
    await expect(write(dailyLogFile(file, 'error', 2), 'x\n')).resolves.toBeUndefined();
  });
});
