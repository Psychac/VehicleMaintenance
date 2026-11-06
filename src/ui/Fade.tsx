import type { ReactNode } from 'react';

/**
 * Crossfades between states of the same screen (skeleton → content, Fuel → Service, DESIGN.md S8).
 * Give it a changing `id`; each id fades in over fade.standard (CSS only: opacity, no JS). The
 * frame stays the same size as its siblings, so nothing jumps.
 */
export function Fade({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div key={id} className="ui-fade">
      {children}
    </div>
  );
}
