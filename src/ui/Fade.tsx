import type { ReactNode } from 'react';
import { m } from 'motion/react';
import { fadeMotion } from '../design/tokens';

/**
 * Crossfades between states of the same screen (skeleton → content, Fuel → Service, DESIGN.md S8).
 * Give it a changing `id`; each id fades in over fade.standard. The frame stays the same size as
 * its siblings, so nothing jumps. It only fades: opacity is the one thing that should always animate.
 */
export function Fade({ id, children }: { id: string; children: ReactNode }) {
  return (
    <m.div key={id} className="ui-fade" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fadeMotion.standard}>
      {children}
    </m.div>
  );
}
