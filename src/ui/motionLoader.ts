import { useSyncExternalStore } from 'react';

type Parts = typeof import('./motionParts');

let parts: Parts | null = null;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

/**
 * Loads every motion-driven part of the UI (screen transitions, sheets, toasts, menus, swipe and
 * list animations, pull-to-refresh) as one chunk. The first screen paints without it: it is
 * started once the browser is idle after first paint, or immediately when something needs it
 * (opening a sheet, showing a toast). Idempotent.
 */
export function loadMotion(): Promise<void> {
  pending ??= import('./motionParts').then((m) => {
    parts = m;
    listeners.forEach((l) => l());
  });
  return pending;
}

/** Starts loading when the browser is idle (after first paint). */
export function loadMotionWhenIdle(): void {
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(() => void loadMotion(), { timeout: 1500 });
  else window.setTimeout(() => void loadMotion(), 300);
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};

/** The loaded motion parts, or null until they have arrived. Components render a plain fallback meanwhile. */
export function useMotionParts(): Parts | null {
  return useSyncExternalStore(subscribe, () => parts, () => null);
}
