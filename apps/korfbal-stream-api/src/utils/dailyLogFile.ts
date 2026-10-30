import fs from 'node:fs';
import path from 'node:path';
import {Writable} from 'node:stream';

const amsterdamDay = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Amsterdam'});

/**
 * A log file per (Amsterdam) day: `<dir>/<prefix>-YYYY-MM-DD.log`, keeping the last `keepDays` files.
 * Writing never throws: without a writable directory the line only goes to the console.
 */
export function dailyLogFile(dir: string, prefix: string, keepDays: number, now: () => Date = () => new Date()): Writable {
  let currentDay = '';
  return new Writable({
    write(chunk, _encoding, callback) {
      try {
        const day = amsterdamDay.format(now());
        const newDay = day !== currentDay;
        if (newDay) fs.mkdirSync(dir, {recursive: true});
        fs.appendFileSync(path.join(dir, `${prefix}-${day}.log`), chunk);
        if (newDay) {
          currentDay = day;
          removeOldFiles(dir, prefix, keepDays);
        }
      } catch {
        // No writable log directory: the console still has the line
      }
      callback();
    },
  });
}

function removeOldFiles(dir: string, prefix: string, keepDays: number) {
  const pattern = new RegExp(`^${prefix}-\\d{4}-\\d{2}-\\d{2}\\.log$`);
  const files = fs.readdirSync(dir).filter((name) => pattern.test(name)).sort();
  for (const name of files.slice(0, Math.max(0, files.length - keepDays))) fs.rmSync(path.join(dir, name), {force: true});
}
