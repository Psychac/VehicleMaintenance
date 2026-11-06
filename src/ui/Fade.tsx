import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { fade } from '../design/tokens';

const EASE: [number, number, number, number] = [0.2, 0, 0, 1];

/**
 * Crossfades between states of the same screen (skeleton → content, Fuel → Service, DESIGN.md S8).
 * Give it a changing `id`; each id fades in over fade.standard. The frame stays the same size as
 * its siblings, so nothing jumps. It only fades: opacity is the one thing that should always animate.
 */
export function Fade({ id, children }: { id: string; children: ReactNode }) {
  return (
    <motion.div key={id} className="ui-fade" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: fade.standard.ms / 1000, ease: EASE }}>
      {children}
    </motion.div>
  );
}
