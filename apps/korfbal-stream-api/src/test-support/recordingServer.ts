import http from 'node:http';
import type {AddressInfo} from 'node:net';

/** What the recording server answers; `hang: true` never answers (for timeouts). */
export type RecordedAnswer = {status: number; body: string; contentType?: string; headers?: Record<string, string>; hang?: boolean};

/**
 * A local HTTP server that stands in for an external source (the match source): it records the
 * requests it gets and answers with `answer` (or what `answer(req)` returns). `url` ends in /v1.
 */
export async function recordingServer(answer: RecordedAnswer | ((req: http.IncomingMessage) => RecordedAnswer)) {
  const requests: http.IncomingHttpHeaders[] = [];
  const urls: string[] = [];
  const hanging = new Set<http.ServerResponse>();
  const server = http.createServer((req, res) => {
    requests.push(req.headers);
    urls.push(req.url ?? '');
    const a = typeof answer === 'function' ? answer(req) : answer;
    if (a.hang) {
      hanging.add(res);
      return;
    }
    res.writeHead(a.status, {'content-type': a.contentType ?? 'application/json', ...a.headers});
    res.end(a.body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  /** The `date` query param of every request */
  const dates = () => urls.map((u) => new URL(u, 'http://x').searchParams.get('date'));
  const close = () => new Promise<void>((resolve) => {
    hanging.forEach((res) => res.destroy());
    server.closeAllConnections();
    server.close(() => resolve());
  });
  return {url, requests, urls, dates, close};
}

/** An address where nothing listens (connection refused): a server that was started and closed. */
export async function refusedUrl(): Promise<string> {
  const server = http.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return `http://127.0.0.1:${port}/v1`;
}
