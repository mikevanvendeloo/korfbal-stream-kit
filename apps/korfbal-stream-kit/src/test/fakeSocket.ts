type Handler = (...args: unknown[]) => void;

/** A minimal stand-in for the shared Socket.io client, with `emit` to simulate a server push. */
export function createFakeSocket() {
  const handlers = new Map<string, Set<Handler>>();
  return {
    on: (event: string, fn: Handler) => {
      const set = handlers.get(event) ?? new Set<Handler>();
      handlers.set(event, set);
      set.add(fn);
    },
    off: (event: string, fn: Handler) => { handlers.get(event)?.delete(fn); },
    emit: (event: string, ...args: unknown[]) => handlers.get(event)?.forEach((fn) => fn(...args)),
  };
}
