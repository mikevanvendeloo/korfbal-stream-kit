import React from 'react';
import {useQueryClient} from '@tanstack/react-query';
import AppIcon from './AppIcon';
import OrganizationLogo from './OrganizationLogo';
import {Organization, organizationKeys, useActiveOrganizations} from '../hooks/useOrganizations';
import {getOrganizationSlug, onOrganizationRejected, setOrganizationSlug} from '../lib/organization';
import {reconnectSharedSocket} from '../lib/socket';

type CurrentOrganization = {
  /** The chosen organization; null outside the gate (component tests) */
  organization: Organization | null;
  /** Opens the start screen again ("Wissel organisatie") */
  switchOrganization: () => void;
  /** After renaming an organization's slug in Beheer: keep it chosen when it is the current one */
  followSlugChange: (oldSlug: string, newSlug: string) => void;
};

const OrganizationContext = React.createContext<CurrentOrganization>({
  organization: null, switchOrganization: () => undefined, followSlugChange: () => undefined,
});

export function useCurrentOrganization(): CurrentOrganization {
  return React.useContext(OrganizationContext);
}

/**
 * Start screen (design D2): a large button with logo and name for every active organization.
 * `current` marks the chosen one; `onCancel` (when switching) goes back without changing anything.
 */
export function OrganizationStartScreen({organizations, current, onChoose, onCancel}: {
  organizations: Organization[];
  current?: string | null;
  onChoose: (slug: string) => void;
  onCancel?: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 text-gray-800 dark:text-gray-100">
      <AppIcon className="w-20 h-20 mb-4"/>
      <h1 className="text-2xl font-bold mb-2 text-center">Kies een organisatie</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-8 text-center max-w-md">
        Voor welke organisatie werk je? Je keuze wordt op dit apparaat onthouden.
      </p>
      {organizations.length === 0 ? (
        <p role="alert" className="max-w-md text-center rounded-md border border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200 px-4 py-3">
          Er is geen actieve organisatie. Vraag de beheerder van deze installatie om er een te activeren.
        </p>
      ) : (
        <ul className="w-full max-w-2xl grid gap-4 sm:grid-cols-2" aria-label="Organisaties">
          {organizations.map((organization) => {
            const isCurrent = organization.slug === current;
            return (
              <li key={organization.id} className="min-w-0">
                <button type="button" onClick={() => onChoose(organization.slug)} aria-current={isCurrent || undefined}
                        className={`w-full min-w-0 flex items-center gap-4 p-5 rounded-xl border-2 bg-white dark:bg-gray-900 text-left shadow-sm transition-colors hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isCurrent ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700'}`}>
                  <OrganizationLogo organization={organization} size="large"/>
                  <span className="min-w-0 flex flex-col">
                    <span className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{organization.name}</span>
                    {isCurrent && <span className="text-xs text-blue-700 dark:text-blue-300">Huidige keuze</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {onCancel && (
        <button type="button" onClick={onCancel}
                className="mt-8 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
          Terug
        </button>
      )}
    </div>
  );
}

function Message({children}: { children: React.ReactNode }) {
  return <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center text-gray-800 dark:text-gray-100">{children}</div>;
}

/**
 * Renders the app for the chosen organization, or the start screen when none is chosen, the stored one
 * is gone or inactive, the API refused it (401/403), or the user asked to switch. With exactly one
 * active organization it is chosen automatically. A stored choice renders the app straight away and is
 * checked against the list in the background.
 *
 * Switching forgets every cached answer and reconnects the socket, and the app below is mounted anew
 * (keyed on the slug), so nothing of the previous organization stays on screen.
 */
export function OrganizationGate({children}: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const {data: organizations, error, refetch} = useActiveOrganizations();
  const [slug, setSlug] = React.useState<string | null>(() => getOrganizationSlug());
  const [picking, setPicking] = React.useState(false);

  const forgetCachedData = React.useCallback(() => {
    // Organizations are global; everything else belongs to the previous organization
    queryClient.removeQueries({predicate: (query) => query.queryKey[0] !== organizationKeys.all[0]});
    reconnectSharedSocket();
  }, [queryClient]);

  const choose = React.useCallback((next: string | null) => {
    if (next !== getOrganizationSlug()) {
      setOrganizationSlug(next);
      forgetCachedData();
    }
    setSlug(next);
    setPicking(false);
  }, [forgetCachedData]);

  // The API refused the organization: show the start screen and look at the list again
  React.useEffect(() => onOrganizationRejected(() => {
    setPicking(true);
    void queryClient.invalidateQueries({queryKey: organizationKeys.active});
  }), [queryClient]);

  const current = organizations?.find((o) => o.slug === slug) ?? null;

  React.useEffect(() => {
    if (!organizations) return;
    if (slug && !current) choose(null); // gone or inactive
    else if (!slug && organizations.length === 1) choose(organizations[0].slug);
  }, [organizations, slug, current, choose]);

  const value = React.useMemo<CurrentOrganization>(() => ({
    organization: current,
    switchOrganization: () => setPicking(true),
    followSlugChange: (oldSlug, newSlug) => {
      if (oldSlug === newSlug || oldSlug !== getOrganizationSlug()) return;
      setOrganizationSlug(newSlug); // same organization: nothing to forget
      setSlug(newSlug);
    },
  }), [current]);

  const autoChoosing = !!organizations && !slug && organizations.length === 1;
  if (picking || (organizations && !current && !autoChoosing)) {
    if (!organizations) return <Message>Laden…</Message>;
    return (
      <OrganizationStartScreen organizations={organizations} current={current?.slug}
                               onChoose={choose} onCancel={picking && current ? () => setPicking(false) : undefined}/>
    );
  }
  if (!slug) {
    if (error) {
      return (
        <Message>
          <p role="alert">De organisaties konden niet worden geladen: {(error as Error).message}</p>
          <button type="button" onClick={() => refetch()} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Opnieuw proberen</button>
        </Message>
      );
    }
    return <Message>Laden…</Message>;
  }
  return (
    <OrganizationContext.Provider value={value}>
      <React.Fragment key={slug}>{children}</React.Fragment>
    </OrganizationContext.Provider>
  );
}

/** The chosen organization in a nav: logo + name; a click opens the start screen. */
export function OrganizationSwitcher({className = '', showName = true}: { className?: string; showName?: boolean }) {
  const {organization, switchOrganization} = useCurrentOrganization();
  if (!organization) return null;
  return (
    <button type="button" onClick={switchOrganization} title="Wissel organisatie" aria-label={`Wissel organisatie (nu ${organization.name})`}
            className={`inline-flex items-center gap-2 min-w-0 rounded-full border border-gray-200 dark:border-gray-700 pl-1 pr-3 py-0.5 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 ${className}`}>
      <OrganizationLogo organization={organization} size="small"/>
      {showName && <span className="truncate">{organization.name}</span>}
    </button>
  );
}
