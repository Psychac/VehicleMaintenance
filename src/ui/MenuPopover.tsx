import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'motion/react';
import { spring, fadeMotion } from '../design/tokens';
import { placeMenu, type MenuPlacement } from './gestures';
import type { MenuAction } from './ContextMenu';
import { MotionScope } from './MotionScope';
import { usePress } from './press';

const EDGE_MARGIN = 8;

/** Portal + presence for one row's menu: scales out of the touch point, flips inside the viewport. */
export function MenuHost({ point, actions, onClose }: { point: { x: number; y: number } | null; actions: MenuAction[]; onClose: () => void }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <MotionScope>
      <AnimatePresence>{point && <MenuPopover key="menu" point={point} actions={actions} onClose={onClose} />}</AnimatePresence>
    </MotionScope>,
    document.body
  );
}

function MenuPopover({ point, actions, onClose }: { point: { x: number; y: number }; actions: MenuAction[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<MenuPlacement | null>(null);

  // Measure, then place: so the menu can flip inside the viewport and scale out of the touch point.
  useLayoutEffect(() => {
    // offsetWidth/Height ignore the 0.9 starting scale, so the menu is measured at its real size.
    const el = ref.current!;
    setPlace(placeMenu(point, { w: el.offsetWidth, h: el.offsetHeight }, { w: window.innerWidth, h: window.innerHeight }, EDGE_MARGIN));
  }, [point]);

  // Focus the first item once the menu is visible (a hidden element can't take focus), and give
  // focus back to where it was on close. Escape works from anywhere, not only from inside the menu.
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const onEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('keydown', onEscape);
      previous?.focus?.({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLayoutEffect(() => {
    if (place) ref.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus({ preventScroll: true });
  }, [place]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') items[(i + 1) % items.length]?.focus();
    else if (e.key === 'ArrowUp') items[(i - 1 + items.length) % items.length]?.focus();
    else return;
    e.preventDefault();
  };

  return (
    <>
      <div
        className="ui-menu-scrim"
        onPointerDown={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <m.div
        ref={ref}
        className="ui-menu"
        role="menu"
        onKeyDown={onKey}
        style={place ? { left: place.left, top: place.top, transformOrigin: `${place.originX} ${place.originY}` } : { left: 0, top: 0, visibility: 'hidden' }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={place ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
        exit={{ opacity: 0, scale: 0.96, transition: fadeMotion.exit }}
        transition={{ default: spring.snappy, opacity: fadeMotion.fast }}
      >
        {actions.map((a) => (
          <MenuItem
            key={a.label}
            action={a}
            onSelect={() => {
              onClose();
              a.onSelect();
            }}
          />
        ))}
      </m.div>
    </>
  );
}

function MenuItem({ action, onSelect }: { action: MenuAction; onSelect: () => void }) {
  const press = usePress<HTMLButtonElement>();
  return (
    <button {...press} type="button" role="menuitem" className="ui-menu-item" data-destructive={action.destructive || undefined} onClick={onSelect}>
      {action.label}
    </button>
  );
}
