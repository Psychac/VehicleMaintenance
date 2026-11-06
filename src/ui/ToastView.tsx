import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'motion/react';
import { motionValues, spring, fadeMotion } from '../design/tokens';
import { Button } from './Button';
import { MotionScope } from './MotionScope';
import type { ToastItem } from './Toast';

/** Slides in from the bottom edge (above the tab bar), crossfades to a replacement, swipes away. */
export function ToastView({ item, dismiss }: { item: ToastItem | null; dismiss: () => void }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <MotionScope>
      <div className="ui-toast-region" aria-live="polite" aria-atomic="true">
        <AnimatePresence mode="popLayout">
          {item && (
            <m.div
              key={item.id}
              className="ui-toast"
              data-tone={item.tone ?? 'default'}
              role="status"
              initial={{ opacity: 0, y: motionValues.enterOffsetMd, scale: motionValues.enterScale }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: motionValues.exitScale, transition: fadeMotion.exit }}
              transition={{ default: spring.smooth, opacity: fadeMotion.standard }}
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
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </MotionScope>,
    document.body
  );
}
