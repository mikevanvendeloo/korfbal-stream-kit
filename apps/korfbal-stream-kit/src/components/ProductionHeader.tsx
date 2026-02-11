import React from 'react';
import { useProduction } from '../hooks/useProductions';
import { useClubs, Club } from '../hooks/useClubs';
import ClubLogo from './ClubLogo';

function formatDateTime(iso?: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('nl-NL', { weekday: 'short', day: '2-digit', month: 'short' });
    const time = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
  } catch {
    return '';
  }
}

export default function ProductionHeader({ productionId, showLogos = true }: { productionId: number; showLogos?: boolean }) {
  const { data, isLoading, isError, error } = useProduction(productionId);
  const ms = (data as any)?.matchSchedule as any | undefined;
  const title = ms ? `${ms.homeTeamName || 'Thuis?'} vs ${ms.awayTeamName || 'Uit?'}` : `Productie #${productionId}`;
  const sub = ms ? [formatDateTime(ms.date), ms.accommodationName].filter(Boolean).join(' · ') : undefined;
  const homeTeamName: string | undefined = ms?.homeTeamName || undefined;
  const awayTeamName: string | undefined = ms?.awayTeamName || undefined;

  return (
    <div className="mb-4 p-3 rounded border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30">
      {isError && <div role="alert" className="text-sm text-red-600">{(error as any)?.message || 'Productie laden mislukt'}</div>}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {showLogos && (
            <TeamLogos side="home" homeTeamName={homeTeamName} awayTeamName={awayTeamName} />
          )}
          <div className="min-w-0">
            <div className="text-lg font-semibold truncate">{title}</div>
            {sub && <div className="text-sm text-gray-600 dark:text-gray-400 truncate">{sub}</div>}
          </div>
          {showLogos && (
            <TeamLogos side="away" homeTeamName={homeTeamName} awayTeamName={awayTeamName} />
          )}
        </div>
        {isLoading && <div className="text-sm text-gray-500 shrink-0">Laden…</div>}
      </div>
    </div>
  );
}

function TeamLogos({ side, homeTeamName, awayTeamName }: { side: 'home' | 'away'; homeTeamName?: string; awayTeamName?: string }) {
  const { data: clubs } = useClubs();

  function normalizeTeamForLookup(name?: string): string | undefined {
    if (!name) return undefined;
    const trimmed = String(name).trim();
    const noNumber = trimmed.replace(/\s+\d+$/g, '');
    const base = noNumber.split('/')[0]?.trim() || noNumber;
    return base.toLowerCase();
  }

  function matchClub(teamName?: string, list?: Club[]): Club | undefined {
    if (!teamName || !list?.length) return undefined;
    const key = normalizeTeamForLookup(teamName);
    if (!key) return undefined;
    const exactShort = list.find((c) => c.shortName?.toLowerCase() === key);
    if (exactShort) return exactShort;
    const exactName = list.find((c) => c.name?.toLowerCase() === key);
    if (exactName) return exactName;
    const starts = list.find((c) => key && (c.shortName?.toLowerCase().startsWith(key) || c.name?.toLowerCase().startsWith(key)));
    if (starts) return starts;
    return list.find((c) => key && (c.shortName?.toLowerCase().includes(key) || c.name?.toLowerCase().includes(key)));
  }

  const homeClub = matchClub(homeTeamName, clubs);
  const awayClub = matchClub(awayTeamName, clubs);

  if (side === 'home') {
    return homeClub?.logoUrl ? (
      <ClubLogo
        logoUrl={homeClub.logoUrl}
        alt={homeClub.shortName || homeClub.name}
        size="medium"
      />
    ) : null;
  }
  return awayClub?.logoUrl ? (
    <ClubLogo
      logoUrl={awayClub.logoUrl}
      alt={awayClub.shortName || awayClub.name}
      size="medium"
      className="ml-2"
    />
  ) : null;
}
