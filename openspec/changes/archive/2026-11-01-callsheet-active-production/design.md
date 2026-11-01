## Context

LIVE screens read the production id from the route (`useParams().productionId`): `useLiveState`, `CallSheetView`, `ShowCallerView`, `ShowCallerPhone`, `PositionSelector`, `InterviewText`. `LiveCallsheetEntry` resolves `/callsheet` to `/callsheet/<active id>` with a redirect. `ShowControl` (Beheer) also uses `useLiveState` with an id in its own route. Activating a production (`POST /api/production/:id/activate`) emits nothing.

## Goals / Non-Goals

**Goals:** addresses without a production; always the active production; live switch on activation; old bookmarks keep working.

**Non-Goals:** previewing a non-active production's callsheet in LIVE (Beheer has the draaiboek for that); several active productions per organization.

## Decisions

1. **One provider for the LIVE callsheet routes.** `ActiveProductionRoute` (layout route around `callsheet/*` and `show-caller/*`) loads the active production (`useActiveProduction`) and provides its id through a context. Loading: "Actieve productie laden…"; none: "Geen actieve productie". Children render with `key={productionId}`, so a switch starts the screens fresh (positions, scroll, local column choices) instead of mixing two productions.
2. **`useLiveProductionId()`** returns the context id, else `useParams().productionId`. LIVE components use it instead of `useParams`; `ShowControl` in Beheer keeps working with its route id.
3. **Live switch through the socket.** The API emits `active_production_changed {productionId}` to the organization room after activation (and after an import that activates). The provider listens on the shared socket and invalidates `['productions', 'active']`. Reconnects refetch too (TanStack Query refetch on reconnect is not enough for a socket; the provider refetches on `connect`).
4. **Routes.** `callsheet` → position choice (with the Show Caller tile); `callsheet/:positionSlug` → callsheet; `show-caller` → show caller with all items; `show-caller/kies` → the show caller's own position choice (was `/show-caller/<id>`); `show-caller/:positionSlug` → show caller for a position. Links and navigation drop the id.
5. **Old bookmarks.** A first segment of only digits is an old production id: `/callsheet/12/x` → `/callsheet/x`, `/callsheet/12` → `/callsheet`, same for `/show-caller` (`all` → `/show-caller`). It is a one-time rewrite with `replace`, not a hop through the active production. Position slugs are never only digits (they come from names).
6. **Beheer link.** "Open in LIVE" links to `/callsheet` when this production is active; otherwise it is a disabled button with the explanation "Activeer deze productie om hem in LIVE te openen".

## Risks / Trade-offs

- [A screen switches during a broadcast when someone activates another production] → intended: there is one active production; the switch is what was asked.
- [Old e2e tests and bookmarks with ids] → rewritten (decision 5); e2e test updated.
