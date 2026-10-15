import {useEffect, useState} from 'react';

/** Whether a CSS media query matches, e.g. '(max-width: 767px)'. False where matchMedia doesn't exist. */
export function useMediaQuery(query: string): boolean {
  const get = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(get);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Phones: the width below which LIVE uses its compact layouts. */
export const PHONE_QUERY = '(max-width: 767px)';
