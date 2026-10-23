import {act, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {INTERVIEW_PHOTOS_STORAGE_KEY, resetInterviewPhotosForTests, useInterviewPhotos} from './useInterviewPhotos';

describe('useInterviewPhotos', () => {
  beforeEach(() => {
    window.localStorage.removeItem(INTERVIEW_PHOTOS_STORAGE_KEY);
    resetInterviewPhotosForTests();
  });
  afterEach(() => vi.restoreAllMocks());

  it('is on by default', () => {
    expect(renderHook(() => useInterviewPhotos()).result.current[0]).toBe(true);
  });

  it('remembers the choice on the device, and every screen follows it', () => {
    const first = renderHook(() => useInterviewPhotos());
    const second = renderHook(() => useInterviewPhotos());
    act(() => first.result.current[1](false));
    expect(first.result.current[0]).toBe(false);
    expect(second.result.current[0]).toBe(false);
    expect(window.localStorage.getItem(INTERVIEW_PHOTOS_STORAGE_KEY)).toBe('off');

    // After a reload the stored choice comes back
    resetInterviewPhotosForTests();
    expect(renderHook(() => useInterviewPhotos()).result.current[0]).toBe(false);
  });

  it('still works when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const {result} = renderHook(() => useInterviewPhotos());
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
  });
});
