import {useSyncExternalStore} from 'react';

/**
 * The "Interviewfoto's" setting of the callsheet and Show Caller gear menu: photos of the chosen
 * interview people next to their names. On by default and remembered on this device, like the font
 * size. Kept in memory as well, so it also works when storage is blocked (private mode).
 */
export const INTERVIEW_PHOTOS_STORAGE_KEY = 'callsheet-interview-photos';

let current: boolean | null = null;
const listeners = new Set<() => void>();

function read(): boolean {
  if (current !== null) return current;
  try {
    current = window.localStorage.getItem(INTERVIEW_PHOTOS_STORAGE_KEY) !== 'off';
  } catch {
    current = true;
  }
  return current;
}

export function setInterviewPhotos(on: boolean) {
  current = on;
  try {
    window.localStorage.setItem(INTERVIEW_PHOTOS_STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // Storage blocked: the choice holds until the page is reloaded
  }
  listeners.forEach((listener) => listener());
}

/** Forgets the in-memory value, so the next read comes from storage again (tests). */
export function resetInterviewPhotosForTests() {
  current = null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether interview photos are shown, and a setter; every screen on the device follows the same choice. */
export function useInterviewPhotos(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, read, () => true);
  return [on, setInterviewPhotos];
}
