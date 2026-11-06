import { useRef, useState, type PointerEvent, type MouseEvent } from 'react';
import { haptic } from './haptics';
import { loadMotion, useMotionParts } from './motionLoader';

export interface MenuAction {
  label: string;
  onSelect: () => void;
  /** Destructive actions go last and render in the destructive colour. */
  destructive?: boolean;
}

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 10;

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
  const parts = useMotionParts();
  const open = (x: number, y: number) => {
    void loadMotion();
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

  // The popover itself lives in the lazily loaded motion chunk; it renders nothing until a point is set.
  const menu = parts && actions?.length ? <parts.MenuHost point={point} actions={actions} onClose={() => setPoint(null)} /> : null;

  const consumeClick = () => {
    if (!suppress.current) return false;
    suppress.current = false;
    return true;
  };

  return { handlers, menu, consumeClick, enabled };
}
