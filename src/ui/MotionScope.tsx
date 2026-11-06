import type { ReactNode } from 'react';
import { LazyMotion, MotionConfig } from 'motion/react';

const loadFeatures = () => import('./motionFeatures').then((r) => r.default);

/**
 * Every motion-driven part renders inside one of these: it honours the OS Reduce Motion setting and
 * provides the drag/layout/presence features to `m` components. Lives in the lazily loaded chunk.
 */
export function MotionScope({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadFeatures} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}
