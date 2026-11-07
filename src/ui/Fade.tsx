import { useRef, type ReactNode } from 'react';

/**
 * Crossfades between states of the same screen (skeleton → content, Fuel → Service, DESIGN.md S8).
 * Give it a changing `id`; each id fades in over fade.standard (CSS only: opacity, no JS). The
 * frame stays the same size as its siblings, so nothing jumps.
 *
 * The first state a Fade shows does not animate: the screen layer around it is already fading or
 * sliding in, and a second opacity animation on top forces the whole (on desktop, very large)
 * screen to be composited twice per frame, which made route transitions stutter.
 */
export function Fade({ id, children }: { id: string; children: ReactNode }) {
  const first = useRef(id);
  const changed = useRef(false);
  if (id !== first.current) changed.current = true;
  return (
    <div key={id} className="ui-fade" data-first={changed.current ? undefined : true}>
      {children}
    </div>
  );
}
