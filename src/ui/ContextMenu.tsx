import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { spring, fadeMotion } from '../design/tokens';
import { placeMenu, type MenuPlacement } from './gestures';
import { haptic } from './haptics';
import { usePress } from './press';

export interface MenuAction {
  label: string;
  onSelect: () => void;
  /** Destructive actions go last and render in the destructive colour. */
  destructive?: boolean;
}

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 10;
const EDGE_MARGIN = 8;

/**
 * Long-press (touch) or right-click / context-menu key (pointer, keyboard) opens a menu of the
 * item's 3-5 most useful actions (DESIGN.md S6.1). Returns the handlers to spread on the element,
 * the menu node to render once, and `consumeClick()` so the click that ends a long-press doesn't
 * also activate the row.
 */
export function useContextMenu(actions: MenuAction[] | undefined) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const suppress = useRef(false);

  const cancel = () => {
    window.clearTimeout(timer.current);
    start.current = null;
  };
  const open = (x: number, y: number) => {
    haptic('impactMedium');
    suppress.current = true;
    setPoint({ x, y });
  };

  const enabled = !!actions?.length;

  const handlers = enabled
    ? {
        onContextMenu: (e: MouseEvent<HTMLElement>) => {
          e.preventDefault();
          // The keyboard menu key reports 0,0: anchor to the element instead.
          const keyboard = e.clientX === 0 && e.clientY === 0;
          const r = e.currentTarget.getBoundingClientRect();
          open(keyboard ? r.left + r.width / 2 : e.clientX, keyboard ? r.top + r.height / 2 : e.clientY);
        },
        onPointerDown: (e: PointerEvent<HTMLElement>) => {
          suppress.current = false;
          if (e.pointerType === 'mouse') return;
          start.current = { x: e.clientX, y: e.clientY };
          timer.current = window.setTimeout(() => start.current && open(start.current.x, start.current.y), LONG_PRESS_MS);
        },
        onPointerMove: (e: PointerEvent<HTMLElement>) => {
          if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_TOLERANCE) cancel();
        },
        onPointerUp: cancel,
        onPointerCancel: cancel,
      }
    : {};

  const menu =
    typeof document === 'undefined'
      ? null
      : createPortal(
          <AnimatePresence>{point && actions && <MenuPopover key="menu" point={point} actions={actions} onClose={() => setPoint(null)} />}</AnimatePresence>,
          document.body
        );

  const consumeClick = () => {
    if (!suppress.current) return false;
    suppress.current = false;
    return true;
  };

  return { handlers, menu, consumeClick, enabled };
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
      <motion.div
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
      </motion.div>
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
