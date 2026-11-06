import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '../design/tokens';
import { haptic } from './haptics';

const CompletionContext = createContext<() => void>(() => {});

/** `const celebrate = useCompletion(); celebrate()` after a meaningful task completes (e.g. a reminder is done). */
export const useCompletion = () => useContext(CompletionContext);

const HOLD_MS = 1000;

/**
 * The one restrained celebration (DESIGN.md S5.4): a checkmark draws over 300 ms inside a disc that
 * settles with spring.bouncy, with a success haptic. No confetti. Only for meaningful completions;
 * ordinary saves stay silent.
 */
export function CompletionProvider({ children }: { children: ReactNode }) {
  const [n, setN] = useState(0);
  const [shown, setShown] = useState(false);

  const celebrate = useCallback(() => {
    haptic('success');
    setN((x) => x + 1);
    setShown(true);
  }, []);

  useEffect(() => {
    if (!shown) return;
    const id = setTimeout(() => setShown(false), HOLD_MS);
    return () => clearTimeout(id);
  }, [shown, n]);

  const value = useMemo(() => celebrate, [celebrate]);

  return (
    <CompletionContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div className="ui-completion-region" aria-hidden="true">
            <AnimatePresence>
              {shown && (
                <motion.div
                  key={n}
                  className="ui-completion"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }}
                  transition={{ scale: spring.bouncy, opacity: { duration: 0.12 } }}
                >
                  <svg viewBox="0 0 24 24" className="ui-completion-check" fill="none">
                    <motion.path
                      d="M5 12.5l4.5 4.5L19 7.5"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.3, delay: 0.1, ease: [0.2, 0, 0, 1] }}
                    />
                  </svg>
                </motion.div>
              )}
            </AnimatePresence>
          </div>,
          document.body
        )}
    </CompletionContext.Provider>
  );
}
