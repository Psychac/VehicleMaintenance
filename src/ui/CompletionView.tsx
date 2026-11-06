import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'motion/react';
import { spring, fadeMotion } from '../design/tokens';
import { MotionScope } from './MotionScope';

/** A disc settles with spring.bouncy while a checkmark draws over 300 ms. Shown by the provider. */
export function CompletionView({ shown, n }: { shown: boolean; n: number }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <MotionScope>
      <div className="ui-completion-region" aria-hidden="true">
        <AnimatePresence>
          {shown && (
            <m.div
              key={n}
              className="ui-completion"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: fadeMotion.exit }}
              transition={{ scale: spring.bouncy, opacity: fadeMotion.fast }}
            >
              <svg viewBox="0 0 24 24" className="ui-completion-check" fill="none">
                <m.path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ ...fadeMotion.draw, delay: 0.1 }}
                />
              </svg>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </MotionScope>,
    document.body
  );
}
