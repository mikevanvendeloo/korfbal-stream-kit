import {act, renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {PHONE_QUERY, useMediaQuery} from './useMediaQuery';

/** A matchMedia whose result the test can change, like rotating a phone or resizing a window. */
function fakeMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  const list = {
    get matches() { return matches; },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  const matchMedia = vi.fn(() => list);
  vi.stubGlobal('matchMedia', matchMedia);
  return {
    matchMedia,
    listeners,
    set(value: boolean) { matches = value; listeners.forEach((fn) => fn()); },
  };
}

describe('useMediaQuery', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('follows the media query, also when it changes', () => {
    const media = fakeMatchMedia(true);
    const {result, unmount} = renderHook(() => useMediaQuery(PHONE_QUERY));
    expect(result.current).toBe(true);
    expect(media.matchMedia).toHaveBeenCalledWith('(max-width: 767px)');

    act(() => media.set(false));
    expect(result.current).toBe(false);

    unmount();
    expect(media.listeners.size).toBe(0);
  });

  it('is false where matchMedia does not exist', () => {
    vi.stubGlobal('matchMedia', undefined);
    const {result} = renderHook(() => useMediaQuery(PHONE_QUERY));
    expect(result.current).toBe(false);
  });
});
