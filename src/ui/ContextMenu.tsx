import { createContext, useCallback, useContext, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { haptic } from './haptics';
import { loadMotion, useMotionParts } from './motionLoader';

export interface MenuAction {
  label: string;
  onSelect: () => void;
  /** Destructive actions go last and render in the destructive colour. */
  destructive?: boolean;
}

interface OpenMenu {
  point: { x: number; y: number };
  actions: MenuAction[];
}

const MenuContext = createContext<(m: OpenMenu) => void>(() => {});

/**
 * One menu host for the whole app. Every row used to mount its own portal, animation scope and
 * presence wrapper, which made screens with many rows slow to appear; now a row only registers
 * handlers and asks this host to show its actions.
 */
export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const parts = useMotionParts();
  const [open, setOpen] = useState<OpenMenu | null>(null);
  const show = useCallback((m: OpenMenu) => setOpen(m), []);
  const close = useCallback(() => setOpen(null), []);
  const value = useMemo(() => show, [show]);
  return (
    <MenuContext.Provider value={value}>
      {children}
      {parts && <parts.MenuHost point={open?.point ?? null} actions={open?.actions ?? []} onClose={close} />}
    </MenuContext.Provider>
  );
}

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 10;

/**
 * Long-press (touch) or right-click / context-menu key (pointer, keyboard) opens a menu of the
 * item's 3-5 most useful actions (DESIGN.md S6.1). Returns the handlers to spread on the element and
 * `consumeClick()` so the click that ends a long-press doesn't also activate the row. The menu itself
 * is shown by the shared `ContextMenuProvider`.
 */
export function useContextMenu(actions: MenuAction[] | undefined) {
  const show = useContext(MenuContext);
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const suppress = useRef(false);

  const cancel = () => {
    window.clearTimeout(timer.current);
    start.current = null;
  };
  const open = (x: number, y: number) => {
    void loadMotion();
    haptic('impactMedium');
    suppress.current = true;
    if (actions?.length) show({ point: { x, y }, actions });
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

  const consumeClick = () => {
    if (!suppress.current) return false;
    suppress.current = false;
    return true;
  };

  return { handlers, consumeClick, enabled };
}
