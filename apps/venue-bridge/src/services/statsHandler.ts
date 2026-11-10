import http from 'node:http';
import net from 'node:net';
import type {Express} from 'express';
import type {StatsAnswer} from '@korfbal-stream-kit/venue-protocol';
import {createStatsApp} from '../app';

let statsApp: Express | null = null;

const FORWARDED_HEADERS = /^(content-type|x-stats-[a-z-]+)$/i;

/**
 * Calls a statistics route in this process: `path` is the route plus query ("/matches?team=2"), the answer is
 * what the route gives. Paths outside the statistics routes get 404 from the router; nothing is read for them.
 */
export function handleStatsRequest(pathAndQuery: string): Promise<StatsAnswer> {
  // eslint-disable-next-line no-control-regex
  if (!pathAndQuery.startsWith('/') || pathAndQuery.startsWith('//') || /[\u0000-\u001f\\]/.test(pathAndQuery)) {
    return Promise.resolve({status: 404, headers: {'content-type': 'application/json'}, body: {error: 'Niet gevonden'}});
  }
  statsApp ??= createStatsApp();
  const app = statsApp;
  return new Promise((resolve) => {
    const req = new http.IncomingMessage(new net.Socket());
    req.method = 'GET';
    req.url = pathAndQuery;
    req.headers = {host: 'bridge.local'};
    const res = new http.ServerResponse(req);
    const chunks: Buffer[] = [];
    res.write = ((chunk: string | Buffer) => {
      chunks.push(Buffer.from(chunk));
      return true;
    }) as typeof res.write;
    res.end = ((chunk?: string | Buffer) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(res.getHeaders())) {
        if (FORWARDED_HEADERS.test(name) && value !== undefined) headers[name.toLowerCase()] = String(value);
      }
      const text = Buffer.concat(chunks).toString('utf8');
      let body: unknown = text;
      if (/json/i.test(headers['content-type'] ?? '')) {
        try {
          body = JSON.parse(text);
        } catch {
          body = null;
        }
      }
      resolve({status: res.statusCode, headers, body});
      return res;
    }) as typeof res.end;
    app(req, res);
  });
}

/** The `team` query of a statistics path, for the fallback API to remember. */
export function teamOfPath(pathAndQuery: string): string | null {
  try {
    return new URL(pathAndQuery, 'http://bridge.local').searchParams.get('team');
  } catch {
    return null;
  }
}
