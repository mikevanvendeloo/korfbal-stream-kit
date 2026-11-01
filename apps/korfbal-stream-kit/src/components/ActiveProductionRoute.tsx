import {createContext, Fragment, useContext, useEffect} from 'react';
import {Navigate, Outlet, useParams} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';
import {useActiveProduction} from '../hooks/useProductions';
import {getSharedSocket} from '../lib/socket';

/**
 * LIVE callsheet and show caller always show the organization's active production (openspec/changes/
 * callsheet-active-production): the address holds no production id, and a newly activated production
 * reaches every open screen through the socket.
 */
const LiveProductionContext = createContext<string | null>(null);

/** The production a LIVE screen shows: the active one inside ActiveProductionRoute, else the route's id (Beheer). */
export function useLiveProductionId(): string | undefined {
  const active = useContext(LiveProductionContext);
  const {productionId} = useParams<{productionId?: string}>();
  return active ?? productionId;
}

/** The show caller's own position choice (its plain address `/show-caller` shows all items) */
export const SHOW_CALLER_CHOOSE = 'kies';

const centered = 'min-h-screen flex items-center justify-center text-gray-800 dark:text-gray-100';

/** Layout route: loads the active production, follows `active_production_changed`, and renders the screen for it. */
export function ActiveProductionRoute() {
  const {data: active, isLoading, error} = useActiveProduction();
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSharedSocket();
    const refresh = () => void queryClient.invalidateQueries({queryKey: ['productions', 'active']});
    // A reconnect may have missed the event: ask again
    socket.on('active_production_changed', refresh);
    socket.on('connect', refresh);
    return () => {
      socket.off('active_production_changed', refresh);
      socket.off('connect', refresh);
    };
  }, [queryClient]);

  if (isLoading) return <div className={centered}>Actieve productie laden…</div>;
  if (error) return <div className={`${centered} text-red-600`}>Fout bij laden: {(error as Error).message}</div>;
  if (!active) return <div className={centered}>Geen actieve productie</div>;
  return (
    <LiveProductionContext.Provider value={String(active.id)}>
      {/* A new production starts the screens fresh instead of mixing two productions */}
      <Fragment key={active.id}><Outlet/></Fragment>
    </LiveProductionContext.Provider>
  );
}

const onlyDigits = (s: string | undefined) => !!s && /^\d+$/.test(s);

/**
 * `/callsheet/:positionSlug` and `/show-caller/:positionSlug`, also catching old bookmarks with a production id
 * (`/callsheet/12` → `/callsheet`): a one-time rewrite, never a hop through the active production.
 */
export function LivePositionRoute({base, children}: {base: 'callsheet' | 'show-caller'; children: React.ReactNode}) {
  const {positionSlug} = useParams<{positionSlug: string}>();
  if (onlyDigits(positionSlug)) return <Navigate to={`/${base}`} replace/>;
  return <>{children}</>;
}

/** Old bookmarks `/callsheet/12/camera-links` and `/show-caller/12/all` → the address without the id */
export function LegacyLiveAddress({base}: {base: 'callsheet' | 'show-caller'}) {
  const {legacyId, positionSlug} = useParams<{legacyId: string; positionSlug: string}>();
  if (!onlyDigits(legacyId)) return <Navigate to={`/${base}`} replace/>;
  const target = !positionSlug || positionSlug === 'all' ? `/${base}` : `/${base}/${positionSlug}`;
  return <Navigate to={target} replace/>;
}
