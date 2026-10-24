// Prometheus-client voor de Node.js API
// npm i prom-client
import client from 'prom-client';

const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'nodejs_' });

// HTTP-request histogram
export const httpRequests = new client.Histogram({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// Endpoint
export function metricsMiddleware(req, res) {
  res.set('Content-Type', client.register.contentType);
  res.end(client.register.metrics());
}