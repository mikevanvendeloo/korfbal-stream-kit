import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {TimeDisplay} from './TimeDisplay';

const clock = (minutes: string, seconds: string, rawSeconds: number, isNegative = false) => ({minutes, seconds, rawSeconds, isNegative});

function renderClocks(overrides: Partial<Parameters<typeof TimeDisplay>[0]> = {}) {
  return render(
    <TimeDisplay isConnected timeSinceLastSync={1} productionClock={clock('12', '30', 750)} activeEventRemainingTime={null}
                 venueClock="08:15" systemTime="19:45:10" {...overrides}/>
  );
}

describe('TimeDisplay', () => {
  it('shows the venue clock, the time and the production clock', () => {
    renderClocks();
    expect(screen.getByText('08:15')).toBeTruthy();
    expect(screen.getByText('19:45:10')).toBeTruthy();
    expect(screen.getByText('Productie')).toBeTruthy();
  });

  it('shows the remaining time of the active item, red in the last 10 seconds and over time', () => {
    const {rerender} = renderClocks({activeEventRemainingTime: clock('00', '45', 45)});
    expect(screen.getByText('Resterend').parentElement?.className).not.toContain('bg-red-600');

    rerender(<TimeDisplay isConnected timeSinceLastSync={1} productionClock={clock('12', '30', 750)} activeEventRemainingTime={clock('00', '12', -12, true)}
                          venueClock="08:15" systemTime="19:45:10"/>);
    const box = screen.getByText('Resterend').parentElement;
    expect(box?.className).toContain('bg-red-600');
    expect(box?.textContent).toContain('-00:12');
  });

  it('names the connection state, also when only the dot is visible (phones)', () => {
    const {rerender} = renderClocks();
    expect(screen.getByLabelText('Verbonden')).toBeTruthy();

    rerender(<TimeDisplay isConnected timeSinceLastSync={null} productionClock={clock('0', '0', 0)} activeEventRemainingTime={null} venueClock="" systemTime=""/>);
    expect(screen.getByLabelText('Synchroniseren...')).toBeTruthy();

    rerender(<TimeDisplay isConnected timeSinceLastSync={9} productionClock={clock('0', '0', 0)} activeEventRemainingTime={null} venueClock="" systemTime=""/>);
    expect(screen.getByLabelText('Sync >5s')).toBeTruthy();

    rerender(<TimeDisplay isConnected={false} timeSinceLastSync={1} productionClock={clock('0', '0', 0)} activeEventRemainingTime={null} venueClock="" systemTime=""/>);
    expect(screen.getByLabelText('Verbinding verbroken').className).toContain('animate-pulse');
  });

  it('has a large variant for the Show Caller', () => {
    render(<TimeDisplay isConnected timeSinceLastSync={1} productionClock={clock('01', '05', 65)} activeEventRemainingTime={null}
                        venueClock="08:15" systemTime="19:45:10" variant="large"/>);
    expect(screen.getByText('Zaal')).toBeTruthy();
    expect(screen.getByText('19:45:10')).toBeTruthy();
  });
});
