import { haptics } from '../design/tokens';

export type HapticKind = 'selection' | 'impactLight' | 'impactMedium' | 'impactSoft' | 'success' | 'warning' | 'error';

let last = 0;

/**
 * Semantic haptics (DESIGN.md S6.3). Backed by the Vibration API, so it only does anything on
 * Android; elsewhere visual feedback carries the moment. Never fires twice within `minGapMs`.
 *
 * Call it on the same frame as the visual change, from the event handler, not from an effect.
 * Don't call it for scrolling, navigation pushes or plain link taps.
 */
export function haptic(kind: HapticKind): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  const now = performance.now();
  if (now - last < haptics.minGapMs) return;
  last = now;
  navigator.vibrate([...haptics[kind]]);
}
