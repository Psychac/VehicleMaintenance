import { useRef, type PointerEvent } from 'react';

/**
 * Touch-down feedback (DESIGN.md S6.1). Sets `data-pressed` on pointer-down so CSS can respond in
 * the same frame, before the finger lifts. It is cleared on release, on dragging off the element,
 * and when the browser takes the gesture over for scrolling (`pointercancel`), so scrolling a list
 * never triggers a row's action.
 *
 * It writes to the DOM directly instead of React state, so a press never causes a re-render.
 */
export function usePress<T extends HTMLElement>(disabled = false) {
  const down = useRef(false);

  const set = (el: T, on: boolean) => {
    if (on) el.setAttribute('data-pressed', 'true');
    else el.removeAttribute('data-pressed');
  };

  return {
    onPointerDown: (e: PointerEvent<T>) => {
      if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
      down.current = true;
      set(e.currentTarget, true);
    },
    onPointerUp: (e: PointerEvent<T>) => {
      down.current = false;
      set(e.currentTarget, false);
    },
    onPointerCancel: (e: PointerEvent<T>) => {
      down.current = false;
      set(e.currentTarget, false);
    },
    // Touch pointers are implicitly captured, so `pointerleave` never fires mid-drag: hit-test instead.
    onPointerMove: (e: PointerEvent<T>) => {
      if (!down.current) return;
      const r = e.currentTarget.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
        down.current = false;
        set(e.currentTarget, false);
      }
    },
    // Finger or cursor left the element: release the press state (the click will not fire).
    onPointerLeave: (e: PointerEvent<T>) => {
      if (down.current) {
        down.current = false;
        set(e.currentTarget, false);
      }
    },
  };
}
