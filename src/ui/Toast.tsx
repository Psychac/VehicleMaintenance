import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motionValues } from '../design/tokens';
import { haptic } from './haptics';
import { loadMotion, useMotionParts } from './motionLoader';

export interface ToastInput {
  message: string;
  /** e.g. Undo. A toast with an action stays for `undoMs` (5 s); otherwise `toastMs` (4 s). */
  action?: { label: string; onPress: () => void };
  /** `success` and `error` add their haptic. Default is silent. */
  tone?: 'default' | 'success' | 'error';
}

export interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

/** `const toast = useToast(); toast({ message: 'Fill-up deleted', action: { label: 'Undo', onPress } })` */
export const useToast = () => useContext(ToastContext);

/**
 * One toast at a time; a new one replaces the old with a crossfade (S7). Slides in from the edge
 * nearest its cause (the bottom, above the tab bar), auto-dismisses, swipes away.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const parts = useMotionParts();
  const [item, setItem] = useState<ToastItem | null>(null);
  const seq = useRef(0);
  const dismiss = useCallback(() => setItem(null), []);

  const show = useCallback((t: ToastInput) => {
    void loadMotion();
    if (t.tone === 'success') haptic('success');
    if (t.tone === 'error') haptic('error');
    setItem({ ...t, id: ++seq.current });
  }, []);

  useEffect(() => {
    if (!item) return;
    const id = setTimeout(dismiss, item.action ? motionValues.undoMs : motionValues.toastMs);
    return () => clearTimeout(id);
  }, [item, dismiss]);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {parts && <parts.ToastView item={item} dismiss={dismiss} />}
    </ToastContext.Provider>
  );
}
