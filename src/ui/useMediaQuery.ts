import { useSyncExternalStore } from 'react';

/** Subscribes to a CSS media query (e.g. the 900 px desktop split). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = matchMedia(query);
      mq.addEventListener('change', notify);
      return () => mq.removeEventListener('change', notify);
    },
    () => matchMedia(query).matches,
    () => false
  );
}
