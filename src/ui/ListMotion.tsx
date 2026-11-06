import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { AnimatePresence, animate, m, useMotionValue, useMotionValueEvent } from 'motion/react';
import { fadeMotion, spring, springs } from '../design/tokens';
import { pastThreshold, resolveDrag } from './gestures';
import { haptic } from './haptics';
import type { SwipeAction } from './List';
import { MotionScope } from './MotionScope';

/** Wraps the rows of a `live` list: removed rows collapse and fade, siblings slide into the gap. */
export function LiveBoundary({ children }: { children: ReactNode }) {
  return (
    <MotionScope>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </MotionScope>
  );
}

/** A list item that eases in, and collapses + fades out with spring.smooth when its row is removed. */
export function LiveItem({ leading, children }: { leading: boolean; children: ReactNode }) {
  return (
    <m.li
      className="ui-row-item"
      data-leading={leading || undefined}
      data-live
      layout="position"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0, transition: { height: spring.smooth, opacity: fadeMotion.exit } }}
      transition={{ default: spring.smooth, opacity: fadeMotion.standard }}
    >
      {children}
    </m.li>
  );
}

/**
 * Swipe actions (touch and mouse): trailing (swipe left) for destructive, leading (swipe right) for
 * positive. A slow drag past 50% or a flick commits, with a haptic at the threshold. The coloured
 * panels sit under the row and are only visible while the row is displaced.
 */
export function SwipeLayer({
  swipe,
  dragged,
  children,
}: {
  swipe: { leading?: SwipeAction; trailing?: SwipeAction };
  /** Set while a drag is in progress, so the click that follows doesn't activate the row. */
  dragged: MutableRefObject<boolean>;
  children: ReactNode;
}) {
  const x = useMotionValue(0);
  const under = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [armed, setArmed] = useState<'leading' | 'trailing' | null>(null);
  const [revealed, setRevealed] = useState(false);
  useMotionValueEvent(x, 'change', (v) => setRevealed(Math.abs(v) > 1));

  useEffect(() => {
    const el = under.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.offsetWidth));
    ro.observe(el);
    setWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, []);

  const springBack = (velocity = 0) => animate(x, 0, { type: 'spring', ...springs.smooth, mass: 1, velocity });

  return (
    <MotionScope>
      <div ref={under} className="ui-swipe-under" aria-hidden="true" data-revealed={revealed || undefined}>
        <div className="ui-swipe-action" data-tone={swipe.leading?.tone} data-side="leading" data-armed={armed === 'leading' || undefined}>
          {swipe.leading && (
            <span className="ui-swipe-label">
              {swipe.leading.icon}
              {swipe.leading.label}
            </span>
          )}
        </div>
        <div className="ui-swipe-action" data-tone={swipe.trailing?.tone} data-side="trailing" data-armed={armed === 'trailing' || undefined}>
          {swipe.trailing && (
            <span className="ui-swipe-label">
              {swipe.trailing.icon}
              {swipe.trailing.label}
            </span>
          )}
        </div>
      </div>
      <m.div
        className="ui-swipe-content"
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: swipe.trailing ? -width : 0, right: swipe.leading ? width : 0 }}
        dragElastic={0}
        dragMomentum={false}
        onDragStart={() => {
          dragged.current = true;
        }}
        onDrag={() => {
          const off = x.get();
          const past = pastThreshold(off, width);
          const side = past ? (off < 0 ? 'trailing' : 'leading') : null;
          if (side !== armed) {
            setArmed(side);
            if (side) haptic('impactMedium');
          }
        }}
        onDragEnd={async (_, info) => {
          setTimeout(() => (dragged.current = false), 60);
          const off = x.get();
          const action = off < 0 ? swipe.trailing : swipe.leading;
          setArmed(null);
          if (action && resolveDrag(off, info.velocity.x, width) === 'commit') {
            await animate(x, off < 0 ? -width : width, { type: 'spring', ...springs.smooth, mass: 1, velocity: info.velocity.x });
            await action.onCommit();
            springBack();
          } else {
            springBack(info.velocity.x);
          }
        }}
      >
        {children}
      </m.div>
    </MotionScope>
  );
}
