import { forwardRef, useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, animate, m, useDragControls, useMotionValue, useReducedMotion, type Variants } from 'motion/react';
import { motionValues, spring, springs, fade, fadeMotion } from '../design/tokens';
import { resolveDrag } from './gestures';
import { haptic } from './haptics';
import { MotionScope } from './MotionScope';
import { getLeaveScroll } from './leaveScroll';

/** How the route changed: switching tabs, going deeper, or coming back. */
export type TransitionKind = 'tab' | 'push' | 'back';


/**
 * DESIGN.md S5.4:
 * - Tab switch: a short crossfade, never a slide.
 * - Push: the new screen comes in from the right over a small distance (24 pt) with spring.smooth;
 *   the one underneath eases back and fades.
 * - Back: the pushed screen leaves to the right; the one underneath returns from its parallax offset.
 * Entering takes the longer spring; exits are quick and quiet.
 */
const variants: Variants = {
  enter: (k: TransitionKind) => (k === 'push' ? { x: motionValues.enterOffsetLg, opacity: 0 } : k === 'back' ? { x: -motionValues.enterOffsetMd, opacity: 0 } : { opacity: 0 }),
  center: {
    x: 0,
    opacity: 1,
    transition: { x: spring.smooth, opacity: fadeMotion.standard },
  },
  // The page scrolls to the top on every navigation; `y` keeps the leaving screen where it was on
  // screen (set instantly) instead of letting it jump up while it animates out.
  // Tab switches remove the old screen at once: two whole pages cross-fading on top of each other
  // read as a glitch, so the new one simply fades in.
  // The leaving screen stays fully opaque (0.999, invisible difference) until it is removed, and the
  // entering one fades in over it. Fading both at once dips below full brightness and flashes the
  // page background through.
  exit: (k: TransitionKind) =>
    k === 'push'
      ? { x: -motionValues.enterOffsetMd, y: -getLeaveScroll(), opacity: 0.999, transition: { x: spring.smooth, y: { duration: 0 }, opacity: { duration: fade.standard.ms / 1000 } } }
      : k === 'back'
        ? { x: '100%', y: -getLeaveScroll(), zIndex: 1, transition: { x: spring.smooth, y: { duration: 0 }, zIndex: { duration: 0 } } }
        : { opacity: 0.999, transition: { opacity: { duration: fade.standard.ms / 1000 } } },
};

/** Reduce Motion (S5.6): no slide, no parallax, no drag offset: every change is a plain crossfade. */
const reducedVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { opacity: { ...fadeMotion.standard, duration: motionValues.reducedFadeMs / 1000 } } },
  exit: () => ({ opacity: 0.999, y: -getLeaveScroll(), transition: { y: { duration: 0 }, opacity: { duration: motionValues.reducedFadeMs / 1000 } } }),
};

/**
 * Animates between routes. Every route is a `Layer` with its own position, so an interrupted or
 * overlapping transition (rapid taps, a swipe that is still settling) never shares state.
 */
export function AnimatedScreens({
  routeKey,
  kind,
  pushed,
  onBack,
  children,
}: {
  routeKey: string;
  kind: TransitionKind;
  pushed: boolean;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <MotionScope>
      <AnimatePresence mode="popLayout" initial={false} custom={kind}>
        <Layer key={routeKey} kind={kind} pushed={pushed} onBack={onBack}>
          {children}
        </Layer>
      </AnimatePresence>
    </MotionScope>
  );
}

/** One screen. Pushed screens add the edge-swipe back gesture: drag from the left edge, the screen follows 1:1, release velocity decides (S5.3). */
// Must forward its ref: AnimatePresence (popLayout) uses it to measure the leaving screen and take it
// out of the flow, so the entering screen starts at the top instead of below the old one.
const Layer = forwardRef<HTMLDivElement, { kind: TransitionKind; pushed: boolean; onBack: () => void; children: ReactNode }>(function Layer(
  { kind, pushed, onBack, children },
  ref
) {
  const x = useMotionValue(0);
  const controls = useDragControls();
  const reduced = useReducedMotion();
  // While the layer animates: promote it to its own GPU layer up front and swap blurred bars for solid
  // ones (backdrop-filter inside an animating opacity/transform group flickers on phones, then pops).
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setBusy(false), 700); // safety net if no animation event fires
    return () => window.clearTimeout(t);
  }, []);

  return (
    <m.div
      ref={ref}
      className="ui-screen-layer"
      data-busy={busy || undefined}
      onAnimationStart={() => setBusy(true)}
      onAnimationComplete={() => setBusy(false)}
      custom={kind}
      variants={reduced ? reducedVariants : variants}
      initial="enter"
      animate="center"
      exit="exit"
      style={{ x }}
      drag={pushed ? 'x' : false}
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ left: 0, right: window.innerWidth }}
      dragElastic={{ left: 0, right: 0.02 }}
      dragMomentum={false}
      onDragEnd={(_, info) => {
        if (resolveDrag(x.get(), info.velocity.x, window.innerWidth) === 'commit') {
          haptic('impactLight');
          onBack();
        } else {
          animate(x, 0, { type: 'spring', ...springs.smooth, mass: 1, velocity: info.velocity.x });
        }
      }}
    >
      {children}
      {pushed && <div className="ui-edge-swipe" onPointerDown={(e) => controls.start(e)} aria-hidden="true" />}
    </m.div>
  );
});
