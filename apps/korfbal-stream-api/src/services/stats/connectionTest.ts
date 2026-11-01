import net from 'node:net';
import {config} from '../config';
import {getMatchStats} from '../appSettings';
import {getLiveStats, isHttpUrl} from './liveStats';
import {sharedFileStamp} from './mdbFile';

const SMB_PORT = 445;
const CONNECT_TIMEOUT_MS = 2000;

export type Check = {ok: boolean; ms: number | null} | null;
export type StatsConnection = {host: string | null; network: Check; file: Check; page: Check};

/** A TCP connection to the host's SMB port: is the statistics PC on the network, without touching the mount. */
export function smbReachable(host: string, port = SMB_PORT, timeoutMs = CONNECT_TIMEOUT_MS): Promise<{ok: boolean; ms: number | null}> {
  const started = Date.now();
  return new Promise((resolve) => {
    const socket = net.connect({host, port});
    const done = (ok: boolean) => {
      socket.destroy();
      resolve({ok, ms: ok ? Date.now() - started : null});
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

async function timed(work: () => Promise<unknown>): Promise<{ok: boolean; ms: number | null}> {
  const started = Date.now();
  return work().then(() => ({ok: true, ms: Date.now() - started}), () => ({ok: false, ms: null}));
}

/** The share host: the setting, else the host of an http(s) page URL. */
export function shareHostOf(setting: {shareHost: string | null; pageUrl: string | null}): string | null {
  if (setting.shareHost) return setting.shareHost;
  if (setting.pageUrl && isHttpUrl(setting.pageUrl)) {
    try {
      return new URL(setting.pageUrl).hostname || null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Can we reach the statistics PC: the network (SMB port), the database file on the mounted share and the page.
 * Only ok/failed and a time, never an error text. The file is only tried when the PC is on the network, so a
 * missing PC never makes a read of the mount hang.
 */
export async function statsConnection(): Promise<StatsConnection> {
  const setting = await getMatchStats();
  const host = shareHostOf(setting);
  const network = host ? await smbReachable(host) : null;
  const [file, page] = await Promise.all([
    setting.mdbPath && config.statsDir && network?.ok !== false ? timed(() => sharedFileStamp(setting.mdbPath as string)) : null,
    setting.pageUrl ? timed(() => getLiveStats()) : null,
  ]);
  return {host, network, file, page};
}
