import {useNavigate, useParams} from 'react-router-dom';
import {calculateEventTimes, ProductionEvent, useLiveState} from '../hooks/useLiveState';
import {useEffect, useMemo, useRef, useState} from "react";
import {MatchHeader} from "./MatchHeader";
import {CallSheetItem} from "./CallSheetItem";
import {LucideTvMinimalPlay, Play, Settings, SkipBack, SkipForward, Spotlight} from 'lucide-react';
import {useFontSize} from "../hooks/useFontSize";
import {createUrl} from "../lib/api";

// Helper om een naam om te zetten naar een URL-vriendelijke slug
const toSlug = (name: string) => {
  return name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
};

export const ShowCallerView = () => {
  const {productionId, positionSlug} = useParams<{ productionId: string; positionSlug: string }>();
  const navigate = useNavigate();

  const {
    allItems,
    allPositions,
    activeEvent,
    activeEventElapsedTime,
    productionClock,
    venueClock,
    systemTime,
    activeEventRemainingTime,
    isLoading, error,
    autoAdvanceEventId
  } = useLiveState();

  const {fontSize, setFontSize} = useFontSize();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApiCall = async (endpoint: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const response = await fetch(createUrl(`/api/show/${endpoint}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Failed to trigger ${endpoint}:`, errorData.error || 'Unknown error');
      }
    } catch (error) {
      console.error(`API call to ${endpoint} failed:`, error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStart = () => handleApiCall(`start/${productionId}`);
  const handleNext = () => handleApiCall('next');
  const handlePrevious = () => handleApiCall('previous');

  // Click outside handler for settings menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };

    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettings]);

  // Automatisch scrollen naar het actieve event
  const lastScrolledEventId = useRef<string | null>(null);

  useEffect(() => {
    if (autoScroll && activeEvent?.id && activeEvent.id !== lastScrolledEventId.current) {
      // Zoek het element voor het actieve event
      // We proberen eerst de specifieke rij te vinden die gemarkeerd is als actief
      const activeElement = document.getElementById(`row-${activeEvent.id}`) ||
                          document.getElementById(`event-${activeEvent.id}`);

      if (activeElement) {
        // Check of het item al redelijk centraal staat om onrustig scrollen te voorkomen
        const rect = activeElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

        // We beschouwen het item als "redelijk centraal" als het midden van het item
        // tussen de 30% en 70% van de viewport hoogte staat.
        const itemCenter = rect.top + rect.height / 2;
        const isCentrallyVisible = (itemCenter > viewportHeight * 0.3) && (itemCenter < viewportHeight * 0.7);

        if (!isCentrallyVisible) {
          activeElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
        lastScrolledEventId.current = activeEvent.id;
      }
    }
  }, [activeEvent?.id, autoScroll]);

  // Vind de geselecteerde positie voor highlighting
  const selectedPosition = useMemo(() => {
    if (!allPositions.length || !positionSlug || positionSlug === 'all') return null;
    return allPositions.find(pos => toSlug(pos.name) === positionSlug);
  }, [allPositions, positionSlug]);

  const selectedPositionId = selectedPosition?.id ?? -1;

  const [isFocusMode, setIsFocusMode] = useState(false);

  // Groeperen van events in rijen
  const rows = useMemo(() => {
    const timedItems = calculateEventTimes(allItems);
    if (!timedItems.length) return [];

    // Pak alleen de 'hoofd' items (geen parent) en sorteer op 'order'
    const mainTrack = timedItems
      .filter(e => !e.parentId)
      .sort((a, b) => a.order - b.order);

    return mainTrack.map(mainEvent => {
      // Zoek alle items die aan dit hoofd-item gekoppeld zijn
      const linked = timedItems.filter(e => e.parentId === mainEvent.id);

      // Check of het hoofditem voor beide is, of specifiek voor één track
      const isBoth = mainEvent.isInLivestream && mainEvent.isInVenue;

      // Filter linked items op kolom
      const linkedStream = linked.filter(e => e.isInLivestream);
      const linkedVenue = linked.filter(e => e.isInVenue);

      return {
        mainEvent,
        linked,
        isBoth,
        // Items voor de respectievelijke kolommen als het niet 'Both' is
        streamItems: linkedStream,
        venueItems: linkedVenue,
        // De visuele hoogte van deze rij
        maxDuration: Math.max(
          mainEvent.durationSec || 0,
          ...linked.map(c => c.durationSec || 0)
        )
      };
    });
  }, [allItems]);

  if (isLoading && allItems.length === 0) return <div
    className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white flex items-center justify-center">Laden...</div>;
  if (error) return <div
    className="min-h-screen bg-white dark:bg-gray-950 text-red-600 dark:text-red-500 flex items-center justify-center">Error: {error}</div>;

  const isRelevantForMe = (event: ProductionEvent) => {
    if (selectedPositionId === -1) return true;
    return event.positions.length === 0 || event.positions.some(p => p.position.id === selectedPositionId);
  };

  return (
    <div className="bg-white dark:bg-gray-950 min-h-screen text-gray-900 dark:text-white flex flex-col font-sans selection:bg-blue-500/30">
      {/* Header met Clocks */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/5 p-2 shadow-2xl">
        <div className="mx-auto px-4">
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="w-full relative flex items-center justify-between min-h-[64px]">
              <div className="flex items-center gap-4">
                <div className="relative" ref={settingsRef}>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`p-3 rounded-full transition-all border ${
                      showSettings
                        ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]'
                        : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-gray-600 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
                    }`}
                    title="Instellingen"
                  >
                    <Settings className={`w-6 h-6 ${showSettings ? 'animate-spin-slow' : ''}`}/>
                  </button>

                  {showSettings && (
                    <div
                      className="absolute left-0 mt-4 w-72 bg-white dark:bg-gray-900/95 backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in duration-200">
                      <div className="space-y-6">
                        <div>
                          <span
                            className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-white/30 block mb-3">Lettergrootte</span>
                          <div className="flex bg-gray-100 dark:bg-black/40 rounded-xl p-1 border border-gray-200 dark:border-white/5">
                            <button
                              onClick={() => setFontSize('m')}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${fontSize === 'm' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
                            >
                              M
                            </button>
                            <button
                              onClick={() => setFontSize('l')}
                              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${fontSize === 'l' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
                            >
                              L
                            </button>
                            <button
                              onClick={() => setFontSize('xl')}
                              className={`flex-1 py-2 rounded-lg text-base font-bold transition-all ${fontSize === 'xl' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
                            >
                              XL
                            </button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <span
                            className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-white/30 block">Weergave</span>
                          <button
                            onClick={() => setAutoScroll(!autoScroll)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border ${
                              autoScroll
                                ? 'bg-blue-600/20 border-blue-500/40 text-blue-600 dark:text-blue-400'
                                : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/5 text-gray-500 dark:text-white/40 hover:bg-gray-200 dark:hover:bg-white/10'
                            }`}
                          >
                            <span>Auto Scroll</span>
                            <span className={autoScroll ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-white/20'}>
                                                        {autoScroll ? 'AAN' : 'UIT'}
                                                    </span>
                          </button>
                          <button
                            onClick={() => setIsFocusMode(!isFocusMode)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border ${
                              isFocusMode
                                ? 'bg-orange-600/20 border-orange-500/40 text-orange-600 dark:text-orange-400'
                                : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/5 text-gray-500 dark:text-white/40 hover:bg-gray-200 dark:hover:bg-white/10'
                            }`}
                          >
                            <span>Focus Mode</span>
                            <span className={isFocusMode ? 'text-orange-600 dark:text-orange-400' : 'text-gray-300 dark:text-white/20'}>
                                                        {isFocusMode ? 'AAN' : 'UIT'}
                                                    </span>
                          </button>
                        </div>

                        <div className="pt-4 border-t border-gray-200 dark:border-white/5 space-y-3">
                          <button
                            onClick={() => {
                              const currentPath = window.location.pathname;
                              const newPath = currentPath.replace('/show-caller/', '/view/');
                              navigate(newPath);
                              setShowSettings(false);
                            }}
                            className="w-full px-4 py-3 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border border-gray-200 dark:border-white/5 text-gray-600 dark:text-white/70"
                          >
                            Multi View
                          </button>
                          <button
                            onClick={() => navigate(`/live/${productionId}/positions`)}
                            className="w-full px-4 py-3 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border border-gray-200 dark:border-white/5 text-gray-600 dark:text-white/70"
                          >
                            Wissel Positie
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
                <MatchHeader productionId={Number(productionId)} size="small" className="pointer-events-auto" />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevious}
                  disabled={!activeEvent || isProcessing}
                  title="Vorig item"
                  className="p-3 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70 hover:bg-gray-200 dark:hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <SkipBack className="w-5 h-5 fill-current" />
                </button>
                <button
                  onClick={handleStart}
                  disabled={isProcessing}
                  title={activeEvent ? "Herstart Show" : "Start Show"}
                  className={`p-4 rounded-full transition-all shadow-lg ${
                    activeEvent
                      ? 'bg-orange-600 border-orange-500 text-white hover:bg-orange-500'
                      : 'bg-green-600 border-green-500 text-white hover:bg-green-500'
                  }`}
                >
                  <Play className="w-6 h-6 fill-current" />
                </button>
                <button
                  onClick={handleNext}
                  disabled={!activeEvent || isProcessing}
                  title="Volgend item"
                  className="p-3 rounded-full bg-blue-600 border border-blue-500 text-white hover:bg-blue-500 transition-all shadow-lg disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <SkipForward className="w-6 h-6 fill-current" />
                </button>
              </div>
            </div>

            <div className="w-full max-w-xl">
              <div className="grid grid-cols-3 gap-4 sm:gap-8">
                <div className="text-center">
                  <span
                    className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-500/60 block mb-1">Zaal</span>
                  <span className="text-3xl font-mono font-black tracking-tighter text-emerald-600 dark:text-emerald-500">
                                      {venueClock}
                                  </span>
                </div>
                <div className="text-center">
                  <span
                    className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-white/40 block mb-1">Tijd</span>
                  <span className="text-3xl font-mono font-black tracking-tighter text-gray-900 dark:text-white">
                                      {systemTime}
                                  </span>
                </div>
                <div className="text-center">
                  <span
                    className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-white/40 block mb-1">
                    {activeEventRemainingTime ? 'Resterend' : 'Productie'}
                  </span>
                  <span className={`text-3xl font-mono font-black tracking-tighter ${
                    activeEventRemainingTime && activeEventRemainingTime.rawSeconds <= 10
                      ? 'text-red-600 dark:text-red-500 animate-pulse'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {activeEventRemainingTime
                      ? `${activeEventRemainingTime.isNegative ? '-' : ''}${activeEventRemainingTime.minutes}:${activeEventRemainingTime.seconds}`
                      : `${productionClock.minutes}:${productionClock.seconds}`
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 py-2">
          <div className="col-span-6">
            <div className="flex items-center gap-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <Spotlight className="w-4 h-4 text-emerald-600 dark:text-emerald-500"/>
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">Zaal draaiboek</h2>
            </div>
          </div>
          <div className="col-span-6">
            <div className="flex items-center gap-3 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <LucideTvMinimalPlay className="w-4 h-4 text-blue-600 dark:text-blue-500 animate-pulse"/>
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-blue-700 dark:text-blue-400">Stream draaiboek</h2>
            </div>
          </div>
        </div>
      </header>

      {/* Rows */}
      <main className="flex-grow p-4 md:p-6 lg:p-8 pt-0 mx-auto w-full">
        <div className="space-y-8">
          {rows.map((row, idx) => {
            const isMainActive = activeEvent?.id === row.mainEvent.id;
            const isAnyLinkedActive = row.linked.some(l => l.id === activeEvent?.id);
            const isRowActive = isMainActive || isAnyLinkedActive;

            const isMainRelevant = isRelevantForMe(row.mainEvent);
            const relevantLinkedCount = row.linked.filter(isRelevantForMe).length;
            const isRowRelevant = isMainRelevant || relevantLinkedCount > 0;

            // Focus mode logica: verberg rijen die niet relevant zijn EN geen actief event hebben
            if (isFocusMode && !isRowRelevant && !isRowActive) {
              return null;
            }

            // Als de rij niet relevant is voor de huidige positie, tonen we hem subtieler
            const rowOpacity = isRowRelevant ? 'opacity-100' : 'opacity-30 grayscale-[0.5]';
            const rowScale = isRowActive ? 'scale-[1.01]' : 'scale-100';

            return (
              <div key={row.mainEvent.id}
                   id={`row-${row.mainEvent.id}`}
                   className={`transition-all duration-500 ${rowOpacity} ${rowScale} ${isRowActive ? 'z-10 relative' : ''}`}>
                {row.isBoth && row.linked.length === 0 ? (
                  /* GEDEELD ITEM: Pak de volle breedte, alleen als er geen parallelle items zijn */
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12">
                      <CallSheetItem
                        item={row.mainEvent}
                        isActive={isMainActive}
                        isAutoAdvanceScheduled={autoAdvanceEventId === row.mainEvent.id}
                        elapsedTime={activeEventElapsedTime}
                        hideStreamVenueLabels={true}
                        isVenueItem={row.mainEvent.isInVenue}
                      />
                    </div>
                  </div>
                ) : (
                  /* PARALLEL ITEMS of Gedeeld met gekoppelde items */
                  <div className="grid grid-cols-12 gap-4">
                    {/* LINKER KOLOM: Venue */}
                    <div className="col-span-6 space-y-4">
                      {row.mainEvent.isInVenue && (
                        <CallSheetItem
                          item={row.mainEvent}
                          isActive={isMainActive}
                          isAutoAdvanceScheduled={autoAdvanceEventId === row.mainEvent.id}
                          elapsedTime={activeEventElapsedTime}
                          hideStreamVenueLabels={true}
                          isVenueItem={true}
                        />
                      )}
                      {row.venueItems.map(item => {
                        const isActive = activeEvent?.id === item.id;
                        const isRelevant = isRelevantForMe(item);

                        if (isFocusMode && !isRelevant && !isActive) return null;

                        return (
                          <CallSheetItem
                            key={item.id}
                            item={item}
                            isActive={isActive}
                            isAutoAdvanceScheduled={autoAdvanceEventId === item.id}
                            elapsedTime={activeEventElapsedTime}
                            hideStreamVenueLabels={true}
                            isVenueItem={true}
                          />
                        );
                      })}
                      {/* Indien leeg in deze kolom voor deze rij */}
                      {!row.mainEvent.isInVenue && row.venueItems.filter(item => !isFocusMode || isRelevantForMe(item) || activeEvent?.id === item.id).length === 0 && (
                        <div
                          className="h-full min-h-[100px] border-2 border-dashed border-emerald-500/10 dark:border-emerald-500/5 rounded-lg flex items-center justify-center bg-emerald-500/5">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/20 dark:text-emerald-500/10 italic">Geen zaal actie</span>
                        </div>
                      )}
                    </div>

                    {/* RECHTER KOLOM: Livestream */}
                    <div className="col-span-6 space-y-4">
                      {row.mainEvent.isInLivestream && (
                        <CallSheetItem
                          item={row.mainEvent}
                          isActive={isMainActive}
                          isAutoAdvanceScheduled={autoAdvanceEventId === row.mainEvent.id}
                          elapsedTime={activeEventElapsedTime}
                          hideStreamVenueLabels={true}
                          isVenueItem={false}
                        />
                      )}
                      {row.streamItems.map(item => {
                        const isActive = activeEvent?.id === item.id;
                        const isRelevant = isRelevantForMe(item);

                        // In focus mode, toon alleen relevante items OF actieve items
                        if (isFocusMode && !isRelevant && !isActive) return null;

                        return (
                          <CallSheetItem
                            key={item.id}
                            item={item}
                            isActive={isActive}
                            isAutoAdvanceScheduled={autoAdvanceEventId === item.id}
                            elapsedTime={activeEventElapsedTime}
                            hideStreamVenueLabels={true}
                            isVenueItem={false}
                          />
                        );
                      })}
                      {/* Indien leeg in deze kolom voor deze rij */}
                      {!row.mainEvent.isInLivestream && row.streamItems.filter(item => !isFocusMode || isRelevantForMe(item) || activeEvent?.id === item.id).length === 0 && (
                        <div
                          className="h-full min-h-[100px] border-2 border-dashed border-white/5 rounded-lg flex items-center justify-center">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-white/10 italic">Geen stream actie</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};
