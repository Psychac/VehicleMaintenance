import { useEffect, useRef } from 'react';
import { breakpoints } from '../design/tokens';
import { useMediaQuery } from './useMediaQuery';

/** True at the desktop size class (sidebar layout, tables, inspector panels). */
export const useIsDesktop = () => useMediaQuery(`(min-width: ${breakpoints.desktop}px)`);

/** True when there is room for a detail panel beside the list (below this, rows open a dialog). */
export const useHasInspector = () => useMediaQuery(`(min-width: ${breakpoints.wide}px)`);

let finePointer: boolean | null = null;
/** True when the primary input is a mouse or trackpad (so mouse-drag gestures like swipe are off). */
export function hasFinePointer(): boolean {
  if (finePointer === null) finePointer = typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;
  return finePointer;
}

/**
 * Single-key shortcuts (`n` for new, `1`-`4` for tabs). They never fire while typing, with a modifier
 * held, or while a sheet or dialog is open, so they can't swallow text or fight a form.
 */
export function useShortcuts(map: Record<string, () => void>, enabled = true) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (document.querySelector('[role=dialog], [role=menu]')) return;
      const fn = ref.current[e.key.toLowerCase()];
      if (!fn) return;
      e.preventDefault();
      fn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
