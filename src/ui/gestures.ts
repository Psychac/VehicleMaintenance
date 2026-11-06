/**
 * Pure decision logic for gestures, kept out of components so it can be unit-tested.
 * The numbers follow DESIGN.md S5.3: a fast flick completes; a slow drag past 50% completes;
 * anything else springs back.
 */

/** Distance past which a slow drag still commits, as a fraction of the row width. */
export const COMMIT_FRACTION = 0.5;
/** Release speed (px/s) that commits a flick, provided the drag has moved a little. */
export const FLICK_VELOCITY = 600;
/** Minimum drag, as a fraction of width, for a flick to count. */
export const FLICK_MIN_FRACTION = 0.12;

/** Decide what a released horizontal drag does. `offset` and `velocity` are signed along the drag axis. */
export function resolveDrag(offset: number, velocity: number, width: number): 'commit' | 'cancel' {
  const dist = Math.abs(offset);
  if (dist >= width * COMMIT_FRACTION) return 'commit';
  // A flick must travel in the same direction it was dragged.
  if (Math.abs(velocity) >= FLICK_VELOCITY && Math.sign(velocity) === Math.sign(offset) && dist >= width * FLICK_MIN_FRACTION) return 'commit';
  return 'cancel';
}

/** True while a swipe is past the point where letting go would commit (drives the threshold haptic). */
export const pastThreshold = (offset: number, width: number) => Math.abs(offset) >= width * COMMIT_FRACTION;

export interface MenuPlacement {
  left: number;
  top: number;
  /** Where the scale-in grows from, so the menu appears to open out of the touch point. */
  originX: 'left' | 'right';
  originY: 'top' | 'bottom';
}

/** Anchors a menu at a point, flipping it back inside the viewport when it would overflow. */
export function placeMenu(
  point: { x: number; y: number },
  size: { w: number; h: number },
  viewport: { w: number; h: number },
  margin: number
): MenuPlacement {
  const flipX = point.x + size.w > viewport.w - margin;
  const flipY = point.y + size.h > viewport.h - margin;
  const left = Math.max(margin, Math.min(flipX ? point.x - size.w : point.x, viewport.w - size.w - margin));
  const top = Math.max(margin, Math.min(flipY ? point.y - size.h : point.y, viewport.h - size.h - margin));
  return { left, top, originX: flipX ? 'right' : 'left', originY: flipY ? 'bottom' : 'top' };
}

export interface RollColumn {
  char: string;
  /** 0-9 for digits (animated), null for separators and symbols (static). */
  digit: number | null;
  /** Stable across renders: counted from the right, so the ones column stays the ones column as the number grows. */
  key: string;
}

/** Splits formatted text ("₹13,500") into columns for the digit-roll transition. */
export function rollColumns(text: string): RollColumn[] {
  const chars = [...text];
  return chars.map((char, i) => ({
    char,
    digit: /^[0-9]$/.test(char) ? Number(char) : null,
    key: `${chars.length - i}`,
  }));
}

/** Pull-to-refresh: finger travel → indicator travel, with resistance that grows with distance. */
export function pullDistance(raw: number, max: number): number {
  if (raw <= 0) return 0;
  // Asymptotic: approaches `max` but never reaches it, so the pull always feels elastic.
  return max * (1 - Math.exp(-raw / (max * 0.9)));
}
