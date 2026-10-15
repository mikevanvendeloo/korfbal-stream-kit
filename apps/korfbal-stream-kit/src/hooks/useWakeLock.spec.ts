import {renderHook, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useWakeLock} from './useWakeLock';

describe('useWakeLock', () => {
  let release: ReturnType<typeof vi.fn>;
  let request: ReturnType<typeof vi.fn>;
  let visibility: DocumentVisibilityState;

  beforeEach(() => {
    release = vi.fn(async () => undefined);
    request = vi.fn(async () => ({release}));
    visibility = 'visible';
    Object.defineProperty(navigator, 'wakeLock', {value: {request}, configurable: true});
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'wakeLock');
  });

  it('keeps the screen on while enabled and lets go when the page closes', async () => {
    const {unmount} = renderHook(() => useWakeLock(true));
    await waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
    unmount();
    expect(release).toHaveBeenCalledOnce();
  });

  it('asks again when the page becomes visible, since the browser drops the lock when hidden', async () => {
    renderHook(() => useWakeLock(true));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));

    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(request).toHaveBeenCalledTimes(1);

    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });

  it('does nothing when disabled', () => {
    renderHook(() => useWakeLock(false));
    expect(request).not.toHaveBeenCalled();
  });

  it('copes with a browser that refuses or has no wake lock', async () => {
    request.mockRejectedValueOnce(new Error('NotAllowedError'));
    const {unmount} = renderHook(() => useWakeLock(true));
    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(() => unmount()).not.toThrow();

    Reflect.deleteProperty(navigator, 'wakeLock');
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
  });
});
