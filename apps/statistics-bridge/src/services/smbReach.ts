import net from 'node:net';

const SMB_PORT = 445;
const CONNECT_TIMEOUT_MS = 2000;

export const isHttpUrl = (v: string) => /^https?:\/\//i.test(v);

export type Reach = {ok: boolean; ms: number | null};

/** A TCP connection to the host's SMB port: is the statistics PC on the network, without touching the mount. */
export function smbReachable(host: string, port = SMB_PORT, timeoutMs = CONNECT_TIMEOUT_MS): Promise<Reach> {
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
