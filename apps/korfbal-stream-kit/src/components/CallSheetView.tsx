import {useNavigate, useParams} from 'react-router-dom';
import {CallSheetColumn} from './CallSheetColumn';
import {ShowControl} from './ShowControl';
import {TimeDisplay} from './TimeDisplay';
import {TimeControls} from './TimeControls';
import {useLiveState} from '../hooks/useLiveState';
import {useEffect, useMemo, useState} from "react";
import {MatchHeader} from "./MatchHeader";

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
        isLoading
    } = useLiveState();

    // Lokale staat voor de tweede en derde kolom
    const [secondaryPositionId, setSecondaryPositionId] = useState<number | null>(null);
    const [tertiaryPositionId, setTertiaryPositionId] = useState<number | null>(null);
    const [showSecondaryColumn, setShowSecondaryColumn] = useState(true);
    const [showTertiaryColumn, setShowTertiaryColumn] = useState(false);

    // Vind de geselecteerde positie voor de eerste kolom op basis van de URL
    const primaryPosition = useMemo(() => {
        if (!allPositions.length || !positionSlug) return null;
        return allPositions.find(pos => toSlug(pos.name) === positionSlug);
    }, [allPositions, positionSlug]);

    const primaryPositionId = primaryPosition?.id ?? -1;

    // Initialiseer de tweede en derde kolom met logische defaults
    useEffect(() => {
        if (allPositions.length > 0) {
            // Tweede kolom initialisatie
            if (secondaryPositionId === null) {
                const streamRegie = allPositions.find(pos => pos.name === 'Regie livestream');
                if (streamRegie && streamRegie.id !== primaryPositionId) {
                    setSecondaryPositionId(streamRegie.id);
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
        if (!allItems.length) return [];
        // We gebruiken de plannedStartTime die uit de database komt (via de sync van de callsheet)
        const itemsWithCalculatedTime = allItems.map(item => {
            let calculatedStartTime: Date | null = null;

            if (item.plannedStartTime) {
                calculatedStartTime = new Date(item.plannedStartTime);
            } else {
                // Fallback naar de oude order-gebaseerde berekening als er geen geplande tijd is
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                calculatedStartTime = new Date(today.getTime() + item.order * 1000);
            }

            // Pas de tijd aan op basis van de werkelijke starttijd van de wedstrijd (als die er is)
            const anchorEvent = allItems.find(it => it.title === 'Start wedstrijd');
            if (anchorEvent && anchorEvent.actualStartTime && item.plannedStartTime) {
                const plannedAnchorDate = new Date(anchorEvent.plannedStartTime!);
                const actualAnchorDate = new Date(anchorEvent.actualStartTime);
                const timeShiftMs = actualAnchorDate.getTime() - plannedAnchorDate.getTime();
                calculatedStartTime = new Date(calculatedStartTime.getTime() + timeShiftMs);
            }

            return {
                ...item,
                calculatedTime: calculatedStartTime,
            };
        });

        return itemsWithCalculatedTime;
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


    if (isLoading) {
        return (
            <div className="bg-gray-900 min-h-screen text-white p-4 flex items-center justify-center">
                <p>Laden...</p>
            </div>
        );
    }

    if (!primaryPosition) {
        return (
            <div className="bg-gray-900 min-h-screen text-white p-4 flex items-center justify-center">
                <p className="text-red-500">Geselecteerde positie "{positionSlug}" niet gevonden voor deze productie.</p>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 min-h-screen text-white p-4">
            <header
                className="mb-4 sticky top-4 z-20">
                <div className="flex justify-between items-center p-3 bg-black/40 rounded-lg backdrop-blur-md border border-white/10 shadow-2xl overflow-hidden relative">
                    {/* Background accent */}
                    <div className="absolute top-0 left-0 w-1 bg-blue-500 h-full"></div>

                    <div className="flex items-center gap-8 relative z-10">
                        <div className="flex flex-col">
                            <h1 className="text-2xl font-black tracking-tighter text-white drop-shadow-sm">LIVE CALLSHEET</h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">System Online</span>
                            </div>
                        </div>

                        {productionId && (
                            <MatchHeader
                                productionId={parseInt(productionId)}
                                size="small"
                                className="border-l border-white/10 pl-8 py-1"
                            />
                        )}
                    </div>
                    <div className="flex items-center gap-6 relative z-10">
                        <div className="flex items-center gap-6 mr-4 border-r border-white/10 pr-6">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Kolom 2</span>
                                <button
                                    onClick={() => setShowSecondaryColumn(!showSecondaryColumn)}
                                    className={`w-10 h-5 rounded-full transition-colors relative ${showSecondaryColumn ? 'bg-blue-600' : 'bg-gray-700'}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${showSecondaryColumn ? 'left-6' : 'left-1'}`}></div>
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Kolom 3</span>
                                <button
                                    onClick={() => setShowTertiaryColumn(!showTertiaryColumn)}
                                    className={`w-10 h-5 rounded-full transition-colors relative ${showTertiaryColumn ? 'bg-blue-600' : 'bg-gray-700'}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${showTertiaryColumn ? 'left-6' : 'left-1'}`}></div>
                                </button>
                            </div>
                        </div>
                        <TimeDisplay
                            isConnected={isConnected}
                            timeSinceLastSync={timeSinceLastSync}
                            productionClock={productionClock}
                            venueClock={venueClock}
                            systemTime={systemTime}
                        />
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
                    elapsedTime={activeEventElapsedTime}
                    allTimes={allTimes}
                    allPositions={allPositions}
                    onPositionChange={handleSetPrimary}
                    secondaryPositionId={showSecondaryColumn ? secondaryPositionId : null}
                    tertiaryPositionId={showTertiaryColumn ? tertiaryPositionId : null}
                    accentColor="blue"
                />
                {showSecondaryColumn && (
                    <CallSheetColumn
                        title={secondaryPosition?.name.toUpperCase() ?? 'GEEN POSITIE'}
                        positionId={secondaryPositionId ?? -2}
                        items={timedItems}
                        activeEvent={activeEvent}
                        elapsedTime={activeEventElapsedTime}
                        allTimes={allTimes}
                        allPositions={allPositions}
                        onPositionChange={handleSetSecondary}
                        secondaryPositionId={primaryPositionId}
                        tertiaryPositionId={showTertiaryColumn ? tertiaryPositionId : null}
                        accentColor="emerald"
                    />
                )}
                {showTertiaryColumn && (
                    <CallSheetColumn
                        title={tertiaryPosition?.name.toUpperCase() ?? 'GEEN POSITIE'}
                        positionId={tertiaryPositionId ?? -3}
                        items={timedItems}
                        activeEvent={activeEvent}
                        elapsedTime={activeEventElapsedTime}
                        allTimes={allTimes}
                        allPositions={allPositions}
                        onPositionChange={handleSetTertiary}
                        secondaryPositionId={primaryPositionId}
                        tertiaryPositionId={showSecondaryColumn ? secondaryPositionId : null}
                        accentColor="purple"
                    />
                )}
            </main>

            <footer className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
                <ShowControl/>
                <TimeControls/>
            </footer>
        </div>
    );
};
