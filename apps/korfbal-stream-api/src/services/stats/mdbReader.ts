import {pathToFileURL} from 'node:url';
import {Worker} from 'node:worker_threads';
import {setMdbOpener, type MdbDatabase} from './mdbFile';
import {StatsError} from './statsErrors';

export const PARSE_LIMIT_MS = 10_000;

/**
 * mdb-reader parses synchronously, so it runs in a worker thread: a slow or hostile file never blocks the
 * event loop and a parse over the wall-clock limit is terminated. The worker is an inline script (no extra
 * file to bundle): it opens the buffer and returns the table names and the rows of the match tables and
 * of `spelersover`, which is all the API reads (it caches the result per read of the file anyway).
 */
const WORKER_SOURCE = `
const {parentPort, workerData} = require('node:worker_threads');
(async () => {
  const MDBReader = (await import(workerData.moduleUrl)).default;
  const db = new MDBReader(Buffer.from(workerData.buffer));
  const names = db.getTableNames();
  const tables = {};
  for (const name of names) {
    if (/_\\d{2}_\\d{2}_\\d{4}$/.test(name) || name === 'spelersover') tables[name] = db.getTable(name).getData();
  }
  parentPort.postMessage({ok: true, names, tables});
})().catch(() => parentPort.postMessage({ok: false}));
`;

type Snapshot = {ok: true; names: string[]; tables: Record<string, Record<string, unknown>[]>} | {ok: false};

const failed = () => new StatsError(502, 'Het statistiekenbestand kon niet worden gelezen');

/** Parse the buffer in a worker (at most `timeoutMs`); the buffer is copied and transferred. */
export function openMdbInWorker(buffer: Buffer, options: {timeoutMs?: number; source?: string} = {}): Promise<MdbDatabase> {
  const bytes = new Uint8Array(buffer); // a copy: the caller keeps its buffer, the worker gets this one
  return new Promise<MdbDatabase>((resolve, reject) => {
    let settled = false;
    const worker = new Worker(options.source ?? WORKER_SOURCE, {
      eval: true,
      workerData: {buffer: bytes.buffer, moduleUrl: pathToFileURL(require.resolve('mdb-reader')).href},
      transferList: [bytes.buffer],
    });
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      fn();
    };
    const timer = setTimeout(() => finish(() => reject(failed())), options.timeoutMs ?? PARSE_LIMIT_MS);
    worker.once('message', (snapshot: Snapshot) => finish(() => {
      if (!snapshot.ok) return reject(failed());
      resolve({
        getTableNames: () => snapshot.names,
        getTable: (name) => {
          const rows = snapshot.tables[name];
          if (!rows) throw new StatsError(404, 'Tabel niet gevonden');
          return {getData: () => rows};
        },
      });
    }));
    worker.once('error', () => finish(() => reject(failed())));
    worker.once('exit', () => finish(() => reject(failed())));
  });
}

/** The Access adapter: reads a .mdb/.accdb buffer with mdb-reader (pure JS, no ODBC) in a worker thread. */
export function installMdbReader(): void {
  setMdbOpener((buffer) => openMdbInWorker(buffer));
}
