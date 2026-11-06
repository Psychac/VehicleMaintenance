import { useState, type ReactNode } from 'react';
import type { TransitionKind } from '../ui/AnimatedScreens';
import { useMotionParts } from '../ui/motionLoader';

export type { TransitionKind };

/**
 * Animates between routes (tab crossfade, push and back with edge-swipe) once the motion chunk has
 * loaded. The first screen is plain, so the animation library is not on the first-paint path. We
 * only switch to the animated implementation when the route next changes, so the screen that is
 * already showing is never remounted.
 */
export function ScreenTransition({
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
  const parts = useMotionParts();
  const [animated, setAnimated] = useState(false);
  const [seenKey, setSeenKey] = useState(routeKey);
  if (routeKey !== seenKey) {
    setSeenKey(routeKey);
    if (parts && !animated) setAnimated(true);
  }
  if (!animated || !parts) {
    return (
      <div key={routeKey} className="ui-screen-layer">
        {children}
      </div>
    );
  }
  return (
    <parts.AnimatedScreens routeKey={routeKey} kind={kind} pushed={pushed} onBack={onBack}>
      {children}
    </parts.AnimatedScreens>
  );
}
