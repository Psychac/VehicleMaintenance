import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { haptic } from './haptics';
import { loadMotion, useMotionParts } from './motionLoader';

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
  const parts = useMotionParts();
  const [n, setN] = useState(0);
  const [shown, setShown] = useState(false);

  const celebrate = useCallback(() => {
    void loadMotion();
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
      {parts && <parts.CompletionView shown={shown} n={n} />}
    </CompletionContext.Provider>
  );
}
