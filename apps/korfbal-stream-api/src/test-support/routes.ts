import type {Express} from 'express';

/** "METHOD /path" for every route mounted on the app (Express 4 router stack), e.g. "GET /api/sponsors/:id". */
type Layer = {
  route?: {path: string | string[]; methods: Record<string, boolean>};
  name: string;
  handle?: {stack?: Layer[]};
  regexp: RegExp & {fast_slash?: boolean};
};

export function listRoutes(app: Express): string[] {
  const routes = new Set<string>();
  const walk = (stack: Layer[], prefix: string) => {
    for (const layer of stack) {
      if (layer.route) {
        const paths: string[] = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
        for (const method of Object.keys(layer.route.methods)) {
          for (const p of paths) routes.add(`${method.toUpperCase()} ${join(prefix, p)}`);
        }
      } else if (layer.name === 'router' && layer.handle?.stack) {
        walk(layer.handle.stack, join(prefix, mountPath(layer)));
      }
    }
  };
  walk((app as unknown as {_router: {stack: Layer[]}})._router.stack, '');
  return [...routes].sort();
}

function mountPath(layer: Layer): string {
  if (layer.regexp.fast_slash) return '';
  return layer.regexp.source
    .replace(/^\^/, '')
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '')
    .replace(/\\\//g, '/');
}

function join(prefix: string, path: string): string {
  const joined = `${prefix}/${path}`.replace(/\/+/g, '/');
  return joined.length > 1 ? joined.replace(/\/$/, '') : joined;
}
