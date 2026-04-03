import {useNavigate, useParams} from 'react-router-dom';
import {CallSheetColumn} from './CallSheetColumn';
import {ShowControl} from './ShowControl';
import {TimeDisplay} from './TimeDisplay';
import {calculateEventTimes, useLiveState} from '../hooks/useLiveState';
import {useEffect, useMemo, useRef, useState} from "react";
import {MatchHeader} from "./MatchHeader";
import {MdSettings} from "react-icons/md";
import {useFontSize} from "../hooks/useFontSize"; // Helper om een naam om te zetten naar een URL-vriendelijke slug

// Helper om een naam om te zetten naar een URL-vriendelijke slug
const toSlug = (name: string) => {
    return name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
};

export const CallSheetView = () => {
    const {productionId, positionSlug} = useParams<{ productionId: string; positionSlug: string }>();
    const navigate = useNavigate();

    const {
        allItems,
        allPositions,
        isConnected,
        timeSinceLastSync,
        activeEvent,
        productionClock,
        venueClock,
        systemTime,
        activeEventElapsedTime,
        activeEventRemainingTime,
        isLoading,
        autoAdvanceEventId
    } = useLiveState();

    // Lokale staat voor de tweede en derde kolom
    const [secondaryPositionId, setSecondaryPositionId] = useState<number | null>(null);
    const [tertiaryPositionId, setTertiaryPositionId] = useState<number | null>(null);
    const [showSecondaryColumn, setShowSecondaryColumn] = useState(true);
    const [showTertiaryColumn, setShowTertiaryColumn] = useState(false);
    const { fontSize, setFontSize } = useFontSize();
    const [showSettings, setShowSettings] = useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);

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

    const handleApiCall = async (endpoint: string) => {
        try {
            const response = await fetch(`/api/show/${endpoint}`, {
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
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check of de focus niet in een input- of textarea-veld staat
            const target = e.target as HTMLElement;
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

            if (isInput) return;

            if (e.key === 'ArrowRight') {
                handleApiCall('next');
            } else if (e.key === 'ArrowLeft') {
                handleApiCall('previous');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Vind de geselecteerde positie voor de eerste kolom op basis van de URL
    const primaryPosition = useMemo(() => {
        if (!allPositions.length || !positionSlug || positionSlug === 'all') return null;
        return allPositions.find(pos => toSlug(pos.name) === positionSlug);
    }, [allPositions, positionSlug]);

    const primaryPositionId = primaryPosition?.id ?? -1;

    // Initialiseer de tweede en derde kolom met logische defaults
    useEffect(() => {
        if (allPositions.length > 0) {
            // Tweede kolom initialisatie
            if (secondaryPositionId === null) {
                const showcaller = allPositions.find(pos => pos.name === 'Showcaller');
                if (showcaller && showcaller.id !== primaryPositionId) {
                    setSecondaryPositionId(showcaller.id);
                } else {
                    const other = allPositions.find(pos => pos.id !== primaryPositionId);
                    if (other) {
                        setSecondaryPositionId(other.id);
                    }
                }
            }

            // Derde kolom initialisatie
            if (tertiaryPositionId === null) {
                const third = allPositions.find(pos =>
                    pos.id !== primaryPositionId &&
                    pos.id !== secondaryPositionId
                );
                if (third) {
                    setTertiaryPositionId(third.id);
                }
            }
        }
    }, [allPositions, primaryPositionId, secondaryPositionId, tertiaryPositionId]);

    // Vind de secondary position object
    const secondaryPosition = useMemo(() => {
        return allPositions.find(pos => pos.id === secondaryPositionId);
    }, [allPositions, secondaryPositionId]);

    // Vind de tertiary position object
    const tertiaryPosition = useMemo(() => {
        return allPositions.find(pos => pos.id === tertiaryPositionId);
    }, [allPositions, tertiaryPositionId]);

    // Functie om de primaire positie te veranderen (via URL)
    const handleSetPrimary = (posId: number) => {
        const pos = allPositions.find(p => p.id === posId);
        if (pos) {
            // Als we deze positie als primair zetten, en hij was al secundair of tertiair,
            // dan moeten we de andere naar een andere positie verplaatsen (of leegmaken)
            if (posId === secondaryPositionId) {
                const other = allPositions.find(p => p.id !== posId && p.id !== primaryPositionId && p.id !== tertiaryPositionId);
                setSecondaryPositionId(other ? other.id : null);
            } else if (posId === tertiaryPositionId) {
                const other = allPositions.find(p => p.id !== posId && p.id !== primaryPositionId && p.id !== secondaryPositionId);
                setTertiaryPositionId(other ? other.id : null);
            }
            navigate(`/live/${productionId}/view/${toSlug(pos.name)}`);
        }
    };

    // Functie om de secundaire positie te veranderen
    const handleSetSecondary = (posId: number) => {
        // Als we deze positie als secundair zetten, en hij was al primair,
        // dan moeten we de primaire naar de oude secundaire verplaatsen
        if (posId === primaryPositionId) {
            if (secondaryPosition) {
                navigate(`/live/${productionId}/view/${toSlug(secondaryPosition.name)}`);
            }
        } else if (posId === tertiaryPositionId) {
            // Als deze al tertiair was, wissel ze om
            setTertiaryPositionId(secondaryPositionId);
        }
        setSecondaryPositionId(posId);
    };

    // Functie om de tertiaire positie te veranderen
    const handleSetTertiary = (posId: number) => {
        // Als we deze positie als tertiair zetten, en hij was al primair,
        // dan moeten we de primaire naar de oude tertiaire verplaatsen
        if (posId === primaryPositionId) {
            if (tertiaryPosition) {
                navigate(`/live/${productionId}/view/${toSlug(tertiaryPosition.name)}`);
            }
        } else if (posId === secondaryPositionId) {
            // Als deze al secundair was, wissel ze om
            setSecondaryPositionId(tertiaryPositionId);
        }
        setTertiaryPositionId(posId);
    };

    const timedItems = useMemo(() => {
        return calculateEventTimes(allItems);
    }, [allItems]);

    const allTimes = useMemo(() => {
        // Alleen de items voor de geselecteerde posities meenemen
        const p1Items = timedItems.filter(item =>
            item.positions.length === 0 || item.positions.some(p => p.position.id === primaryPositionId)
        );

        if (!showSecondaryColumn && !showTertiaryColumn) {
            // Als we maar één kolom tonen, hebben we geen slots nodig, gewoon de items zelf op hun tijdstip.
            const slots: string[] = [];
            const p1ByTime: Record<string, number> = {};
            p1Items.forEach(item => {
                const t = item.calculatedTime ? item.calculatedTime.toISOString() : 'no-time';
                const count = p1ByTime[t] || 0;
                slots.push(`${t}#${count}`);
                p1ByTime[t] = count + 1;
            });
            return slots;
        }

        const p2Items = showSecondaryColumn ? timedItems.filter(item =>
            item.positions.length === 0 || item.positions.some(p => p.position.id === (secondaryPositionId ?? -2))
        ) : [];

        const p3Items = showTertiaryColumn ? timedItems.filter(item =>
            item.positions.length === 0 || item.positions.some(p => p.position.id === (tertiaryPositionId ?? -3))
        ) : [];

        // Groepeer items per tijdstip voor alle actieve kolommen
        const p1ByTime: Record<string, number> = {};
        p1Items.forEach(item => {
            const t = item.calculatedTime ? item.calculatedTime.toISOString() : 'no-time';
            p1ByTime[t] = (p1ByTime[t] || 0) + 1;
        });

        const p2ByTime: Record<string, number> = {};
        p2Items.forEach(item => {
            const t = item.calculatedTime ? item.calculatedTime.toISOString() : 'no-time';
            p2ByTime[t] = (p2ByTime[t] || 0) + 1;
        });

        const p3ByTime: Record<string, number> = {};
        p3Items.forEach(item => {
            const t = item.calculatedTime ? item.calculatedTime.toISOString() : 'no-time';
            p3ByTime[t] = (p3ByTime[t] || 0) + 1;
        });

        // Verzamel alle unieke tijden over alle actieve kolommen heen
        const uniqueTimes = Array.from(new Set([
            ...Object.keys(p1ByTime),
            ...Object.keys(p2ByTime),
            ...Object.keys(p3ByTime)
        ])).sort();

        // Voor elk tijdstip, bepaal het maximum aantal items in een van de kolommen
        // en genereer unieke keys (tijd#index) om slots te creëren.
        const slots: string[] = [];
        uniqueTimes.forEach(t => {
            const count = Math.max(
                p1ByTime[t] || 0,
                showSecondaryColumn ? p2ByTime[t] || 0 : 0,
                showTertiaryColumn ? p3ByTime[t] || 0 : 0
            );
            for (let i = 0; i < count; i++) {
                slots.push(`${t}#${i}`);
            }
        });

        return slots;
    }, [timedItems, primaryPositionId, secondaryPositionId, tertiaryPositionId, showSecondaryColumn, showTertiaryColumn]);


    const lastScrolledEventId = useRef<string | null>(null);

    useEffect(() => {
        if (activeEvent && activeEvent.id !== lastScrolledEventId.current) {
            const activeElement = document.getElementById(`event-${activeEvent.id}`);
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
    }, [activeEvent]);

    if (isLoading && allItems.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-white p-4 flex items-center justify-center transition-colors">
                <p>Laden...</p>
            </div>
        );
    }

    if (!primaryPosition) {
        return (
            <div className="bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-white p-4 flex items-center justify-center transition-colors">
                <p className="text-red-500">Geselecteerde positie "{positionSlug}" niet gevonden voor deze productie.</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-950 min-h-screen text-gray-900 dark:text-white p-2 md:p-4 transition-colors">
            <header
                className="mb-1 sticky top-0 z-40 bg-white dark:bg-gray-950 transition-colors">
                <div className="flex flex-col gap-4 p-3 bg-gray-100/80 dark:bg-black/80 rounded-b-lg backdrop-blur-md border-b border-gray-200 dark:border-white/10 shadow-2xl relative min-h-[72px] box-content">
                    {/* Background accent */}
                    <div className="absolute top-0 left-0 w-1 bg-blue-500 h-full"></div>

                    <div className="w-full relative flex items-center justify-center min-h-[64px] z-10">
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-4">
                            <button
                                onClick={() => navigate(`/live/${productionId}/positions`)}
                                className="px-4 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all border border-black/10 dark:border-white/10 text-gray-600 dark:text-white/70"
                            >
                                Wissel Positie
                            </button>

                            <div className="relative" ref={settingsRef}>
                                <button
                                    onClick={() => setShowSettings(!showSettings)}
                                    className={`p-2 rounded-full transition-all border ${
                                        showSettings
                                            ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]'
                                            : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-gray-600 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                    title="Instellingen"
                                >
                                    <MdSettings className={`w-6 h-6 ${showSettings ? 'animate-spin-slow' : ''}`}/>
                                </button>

                                {showSettings && (
                                    <div
                                        className="absolute top-full left-0 mt-2 flex flex-col gap-6 bg-white dark:bg-black/95 p-6 rounded-2xl border border-gray-200 dark:border-white/20 animate-in fade-in slide-in-from-top-2 duration-300 shadow-[0_20px_50px_rgba(0,0,0,0.5)] min-w-[360px] z-[100] backdrop-blur-xl">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <span
                                                    className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-white/30">Lettergrootte</span>
                                                <div className="flex bg-gray-100 dark:bg-white/5 rounded-lg p-1 border border-gray-200 dark:border-white/10">
                                                    <button
                                                        onClick={() => setFontSize('m')}
                                                        className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${fontSize === 'm' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
                                                    >
                                                        M
                                                    </button>
                                                    <button
                                                        onClick={() => setFontSize('l')}
                                                        className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${fontSize === 'l' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
                                                    >
                                                        L
                                                    </button>
                                                    <button
                                                        onClick={() => setFontSize('xl')}
                                                        className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${fontSize === 'xl' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
                                                    >
                                                        XL
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <span
                                                    className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-white/30">Weergave</span>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            const currentPath = window.location.pathname;
                                                            const newPath = currentPath.replace('/view/', '/show-caller/');
                                                            navigate(newPath);
                                                            setShowSettings(false);
                                                        }}
                                                        className="px-3 py-1.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60"
                                                        title="Wissel naar de Show Caller weergave"
                                                    >
                                                        Show Caller
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-3 pt-4 border-t border-gray-200 dark:border-white/10">
                                            <div className="flex items-center justify-between mb-1">
                                                <span
                                                    className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-white/30">Kolommen</span>
                                            </div>

                                            <div
                                                className="flex items-center justify-between bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-200 dark:border-white/5">
                                                <span className="text-xs font-bold text-gray-600 dark:text-gray-200">2 Posities (Default)</span>
                                                <button
                                                    onClick={() => {
                                                        setShowSecondaryColumn(!showSecondaryColumn);
                                                        if (!showSecondaryColumn) {
                                                            setShowTertiaryColumn(false);
                                                        }
                                                    }}
                                                    className={`w-11 h-6 rounded-full transition-colors relative ${showSecondaryColumn && !showTertiaryColumn ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                                                >
                                                    <div
                                                        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${showSecondaryColumn && !showTertiaryColumn ? 'left-6' : 'left-1'}`}></div>
                                                </button>
                                            </div>

                                            <div
                                                className="flex items-center justify-between bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-200 dark:border-white/5">
                                                <span className="text-xs font-bold text-gray-600 dark:text-gray-200">3 Posities</span>
                                                <button
                                                    onClick={() => {
                                                        setShowTertiaryColumn(!showTertiaryColumn);
                                                        if (!showTertiaryColumn) {
                                                            setShowSecondaryColumn(true);
                                                        } else {
                                                            setShowSecondaryColumn(true);
                                                        }
                                                    }}
                                                    className={`w-11 h-6 rounded-full transition-colors relative ${showTertiaryColumn ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                                                >
                                                    <div
                                                        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${showTertiaryColumn ? 'left-6' : 'left-1'}`}></div>
                                                </button>
                                            </div>

                                            {!showSecondaryColumn && !showTertiaryColumn && (
                                                <div className="px-2 py-1 bg-blue-500/10 rounded border border-blue-500/20">
                                                    <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium text-center">Enkele positie weergave actief</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-4 pt-4 border-t border-gray-200 dark:border-white/10">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">Positie Instellingen</span>
                                            </div>

                                            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar max-w-[80vw]">
                                                {/* Positie 1 Selectie */}
                                                <div
                                                    className="flex flex-col gap-2 bg-blue-500/5 p-3 rounded-xl border border-blue-500/10 min-w-[160px]">
                                                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">Positie 1 (Hoofd)</span>
                                                    <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
                                                        {allPositions.map(pos => (
                                                            <button
                                                                key={pos.id}
                                                                onClick={() => handleSetPrimary(pos.id)}
                                                                className={`px-3 py-2 rounded-lg text-[11px] font-bold transition-all text-left ${
                                                                    primaryPositionId === pos.id
                                                                        ? 'bg-blue-600 text-white shadow-lg'
                                                                        : 'bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-gray-200 border border-transparent'
                                                                }`}
                                                            >
                                                                {pos.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Positie 2 Selectie */}
                                                {(showSecondaryColumn || showTertiaryColumn) && (
                                                    <div
                                                        className="flex flex-col gap-2 bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10 min-w-[160px]">
                                                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Positie 2</span>
                                                        <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
                                                            {allPositions.map(pos => (
                                                                <button
                                                                    key={pos.id}
                                                                    onClick={() => handleSetSecondary(pos.id)}
                                                                    disabled={pos.id === primaryPositionId || pos.id === tertiaryPositionId}
                                                                    className={`px-3 py-2 rounded-lg text-[11px] font-bold transition-all text-left ${
                                                                        secondaryPositionId === pos.id
                                                                            ? 'bg-emerald-600 text-white shadow-lg'
                                                                            : pos.id === primaryPositionId || pos.id === tertiaryPositionId
                                                                                ? 'bg-black/5 dark:bg-white/5 text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-30'
                                                                                : 'bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-gray-200 border border-transparent'
                                                                    }`}
                                                                >
                                                                    {pos.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Positie 3 Selectie */}
                                                {showTertiaryColumn && (
                                                    <div
                                                        className="flex flex-col gap-2 bg-purple-500/5 p-3 rounded-xl border border-purple-500/10 min-w-[160px]">
                                                        <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider">Positie 3</span>
                                                        <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
                                                            {allPositions.map(pos => (
                                                                <button
                                                                    key={pos.id}
                                                                    onClick={() => handleSetTertiary(pos.id)}
                                                                    disabled={pos.id === primaryPositionId || pos.id === secondaryPositionId}
                                                                    className={`px-3 py-2 rounded-lg text-[11px] font-bold transition-all text-left ${
                                                                        tertiaryPositionId === pos.id
                                                                            ? 'bg-purple-600 text-white shadow-lg'
                                                                            : pos.id === primaryPositionId || pos.id === secondaryPositionId
                                                                                ? 'bg-black/5 dark:bg-white/5 text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-30'
                                                                                : 'bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-gray-200 border border-transparent'
                                                                    }`}
                                                                >
                                                                    {pos.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {productionId && (
                            <MatchHeader
                                productionId={parseInt(productionId)}
                                size="small"
                                className="transition-colors"
                            />
                        )}

                        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-end gap-6">
                            <TimeDisplay
                                isConnected={isConnected}
                                timeSinceLastSync={timeSinceLastSync}
                                productionClock={productionClock}
                                activeEventRemainingTime={activeEventRemainingTime}
                                venueClock={venueClock}
                                systemTime={systemTime}
                            />
                        </div>
                    </div>

                </div>
            </header>

            <main className={`grid gap-6 items-start ${
                showSecondaryColumn && showTertiaryColumn
                    ? 'grid-cols-1 lg:grid-cols-3'
                    : (showSecondaryColumn || showTertiaryColumn)
                        ? 'grid-cols-1 md:grid-cols-2'
                        : 'grid-cols-1 max-w-4xl mx-auto'
            }`}>
                <CallSheetColumn
                    title={primaryPosition.name.toUpperCase()}
                    positionId={primaryPositionId}
                    items={timedItems}
                    activeEvent={activeEvent}
                    autoAdvanceEventId={autoAdvanceEventId}
                    elapsedTime={activeEventElapsedTime}
                    allTimes={allTimes}
                    allPositions={allPositions}
                    onPositionChange={handleSetPrimary}
                    secondaryPositionId={showSecondaryColumn ? secondaryPositionId : null}
                    tertiaryPositionId={showTertiaryColumn ? tertiaryPositionId : null}
                    accentColor="blue"
                    isCompact={showSecondaryColumn || showTertiaryColumn}
                />
                {showSecondaryColumn && (
                    <CallSheetColumn
                        title={secondaryPosition?.name.toUpperCase() ?? 'GEEN POSITIE'}
                        positionId={secondaryPositionId ?? -2}
                        items={timedItems}
                        activeEvent={activeEvent}
                        autoAdvanceEventId={autoAdvanceEventId}
                        elapsedTime={activeEventElapsedTime}
                        allTimes={allTimes}
                        allPositions={allPositions}
                        onPositionChange={handleSetSecondary}
                        secondaryPositionId={primaryPositionId}
                        tertiaryPositionId={showTertiaryColumn ? tertiaryPositionId : null}
                        accentColor="emerald"
                        isCompact={true}
                    />
                )}
                {showTertiaryColumn && (
                    <CallSheetColumn
                        title={tertiaryPosition?.name.toUpperCase() ?? 'GEEN POSITIE'}
                        positionId={tertiaryPositionId ?? -3}
                        items={timedItems}
                        activeEvent={activeEvent}
                        autoAdvanceEventId={autoAdvanceEventId}
                        elapsedTime={activeEventElapsedTime}
                        allTimes={allTimes}
                        allPositions={allPositions}
                        onPositionChange={handleSetTertiary}
                        secondaryPositionId={primaryPositionId}
                        tertiaryPositionId={showSecondaryColumn ? secondaryPositionId : null}
                        accentColor="purple"
                        isCompact={true}
                    />
                )}
            </main>

            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
                <ShowControl />
            </div>
        </div>
    );
};
