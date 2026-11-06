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
  if (props.open) void loadMotion();
  if (!parts) return null;
  return <parts.SheetImpl {...props} />;
}
