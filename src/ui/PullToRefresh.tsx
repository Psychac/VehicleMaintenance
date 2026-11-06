import { useEffect, useState } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { springs } from '../design/tokens';
import { pullDistance } from './gestures';
import { haptic } from './haptics';

/** Indicator travel limits (px): the pull feels elastic and never goes past MAX. */
const MAX = 96;
const THRESHOLD = 64;
const HOLD = 48;
const MIN_SPIN_MS = 600;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const spin = { type: 'spring' as const, ...springs.smooth, mass: 1 };

/**
 * Pull-to-refresh for touch screens (DESIGN.md S5.4). The indicator stretches with the pull,
 * ticks once at the threshold, holds while `onRefresh` runs, then settles back with spring.smooth.
 * Existing content stays on screen the whole time. Under Reduce Motion the indicator doesn't
 * travel: only the spinner shows while refreshing.
 */
export function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const y = useMotionValue(0);
  const progress = useTransform(y, [0, THRESHOLD], [0, 1], { clamp: true });
  const opacity = useTransform(y, [0, 12], [0, 1], { clamp: true });
  const travel = useTransform(y, (v) => v - MAX / 2);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!matchMedia('(pointer: coarse)').matches) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let startY = 0;
    let active = false;
    let passed = false;
    let busy = false;

    const onStart = (e: TouchEvent) => {
      // Only from the very top, on one finger, and never behind a sheet.
      if (busy || window.scrollY > 0 || e.touches.length !== 1 || document.body.style.overflow === 'hidden') return;
      startY = e.touches[0].clientY;
      active = true;
      passed = false;
    };
    const onMove = (e: TouchEvent) => {
      if (!active) return;
      const dy = e.touches[0].clientY - startY;
      if (window.scrollY > 0 || dy <= 0) {
        if (dy <= 0) y.set(0);
        return;
      }
      if (e.cancelable) e.preventDefault();
      if (!reduce) y.set(pullDistance(dy, MAX));
      const crossed = pullDistance(dy, MAX) >= THRESHOLD;
      if (crossed && !passed) haptic('impactMedium');
      passed = crossed;
    };
    const onEnd = async () => {
      if (!active) return;
      active = false;
      if (passed) {
        busy = true;
        setRefreshing(true);
        if (!reduce) animate(y, HOLD, spin);
        await Promise.all([onRefresh().catch(() => {}), wait(MIN_SPIN_MS)]);
        setRefreshing(false);
        busy = false;
      }
      animate(y, 0, spin);
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, [onRefresh, y]);

  return (
    <motion.div className="ui-pull" style={{ y: travel, opacity: refreshing ? 1 : opacity }} aria-hidden="true" data-refreshing={refreshing || undefined}>
      <svg viewBox="0 0 24 24" className="ui-pull-ring">
        <circle cx="12" cy="12" r="9" className="ui-pull-track" />
        <motion.circle cx="12" cy="12" r="9" className="ui-pull-arc" style={{ pathLength: refreshing ? 0.28 : progress }} />
      </svg>
    </motion.div>
  );
}
