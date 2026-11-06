import { useRef } from 'react';
import { loadMotion, useMotionParts } from './motionLoader';
import type { SheetProps } from './SheetImpl';

export type { SheetProps };

/**
 * Bottom sheet with detents on touch-width screens, centred dialog from 900 px (see SheetImpl).
 * The implementation and its animation code live in the lazily loaded motion chunk; opening a
 * sheet requests it immediately, and it is normally already there (prefetched after first paint).
 */
export function Sheet(props: SheetProps) {
  const parts = useMotionParts();
  // Mount on first open only: a closed sheet that has never been shown costs nothing, which keeps
  // screens (each has two or three sheets) quick to appear. After that it stays mounted for its exit.
  const everOpened = useRef(false);
  if (props.open) {
    everOpened.current = true;
    void loadMotion();
  }
  if (!everOpened.current || !parts) return null;
  return <parts.SheetImpl {...props} />;
}
