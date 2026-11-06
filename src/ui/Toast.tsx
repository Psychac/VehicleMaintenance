import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { motionValues, spring } from '../design/tokens';
import { Button } from './Button';
import { haptic } from './haptics';

export interface ToastInput {
  message: string;
  /** e.g. Undo. A toast with an action stays for `undoMs` (5 s); otherwise `toastMs` (4 s). */
  action?: { label: string; onPress: () => void };
  /** `success` and `error` add their haptic. Default is silent. */
  tone?: 'default' | 'success' | 'error';
}

interface ToastItem extends ToastInput {
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
  const [item, setItem] = useState<ToastItem | null>(null);
  const seq = useRef(0);
  const dismiss = useCallback(() => setItem(null), []);

  const show = useCallback((t: ToastInput) => {
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
      {typeof document !== 'undefined' &&
        createPortal(
          <div className="ui-toast-region" aria-live="polite" aria-atomic="true">
            <AnimatePresence mode="popLayout">
              {item && (
                <motion.div
                  key={item.id}
                  className="ui-toast"
                  data-tone={item.tone ?? 'default'}
                  role="status"
                  initial={{ opacity: 0, y: motionValues.enterOffsetMd, scale: motionValues.enterScale }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: motionValues.exitScale, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }}
                  transition={{ default: spring.smooth, opacity: { duration: 0.2, ease: [0.2, 0, 0, 1] } }}
                  drag="y"
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0, bottom: 0.6 }}
                  onDragEnd={(_, info) => (info.offset.y > 24 || info.velocity.y > 300) && dismiss()}
                >
                  <span className="ui-toast-text">{item.message}</span>
                  {item.action && (
                    <Button
                      variant="tertiary"
                      onClick={() => {
                        item.action!.onPress();
                        dismiss();
                      }}
                    >
                      {item.action.label}
                    </Button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}
