import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, animate, m, useDragControls, useMotionValue, usePresence, useTransform } from 'motion/react';
import { breakpoints, spring, springs, fadeMotion } from '../design/tokens';
import { Button } from './Button';
import { haptic } from './haptics';
import { MotionScope } from './MotionScope';
import { useMediaQuery } from './useMediaQuery';

export interface SheetProps {
  open: boolean;
  /** Called after any dismissal (Cancel, scrim tap, Escape, drag down) once unsaved input is resolved. */
  onClose: () => void;
  title: string;
  /** Right-hand header action: the single primary action of the task. */
  action?: ReactNode;
  children: ReactNode;
  /** Unsaved input: dismissal asks "Discard changes?" instead of closing silently (S7). */
  dirty?: boolean;
  /** Phone only. First entry is where it opens; drag between them. Default: large only. */
  detents?: readonly ('medium' | 'large')[];
  cancelLabel?: string;
}

/** Gap between the top of the screen and a large sheet, so the page behind peeks out. */
const TOP_GAP = 48;
const MEDIUM_FRACTION = 0.6;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Bottom sheet with detents on touch-width screens (spring.smooth, drag-to-dismiss with rubber
 * banding and release-velocity hand-off, scrim that follows the drag); centered dialog from 900 px.
 * Focus is trapped while open and restored on close. Replaces `components/Modal`.
 */
export function SheetImpl(props: SheetProps) {
  const desktop = useMediaQuery(`(min-width: ${breakpoints.desktop}px)`);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <MotionScope>
      <AnimatePresence>{props.open && (desktop ? <Dialog key="dialog" {...props} /> : <BottomSheet key="sheet" {...props} />)}</AnimatePresence>
    </MotionScope>,
    document.body
  );
}

function useSheetBehavior(panel: React.RefObject<HTMLElement>, onClose: () => void, dirty: boolean) {
  const [confirming, setConfirming] = useState(false);

  const attemptClose = () => {
    if (dirty) {
      haptic('warning');
      setConfirming(true);
    } else onClose();
  };
  const attemptRef = useRef(attemptClose);
  attemptRef.current = attemptClose;

  // Scroll lock for the page behind.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Focus trap + Escape + restore.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        attemptRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [panel]);

  return { attemptClose, confirming, keepEditing: () => setConfirming(false) };
}

function Chrome({
  title,
  titleId,
  action,
  cancelLabel = 'Cancel',
  onCancel,
  confirming,
  onKeepEditing,
  onDiscard,
  children,
  grabber,
}: {
  title: string;
  titleId: string;
  action?: ReactNode;
  cancelLabel?: string;
  onCancel: () => void;
  confirming: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
  children: ReactNode;
  grabber?: boolean;
}) {
  return (
    <>
      <header className="ui-sheet-header" data-drag-handle>
        {grabber && <span className="ui-sheet-grabber" aria-hidden="true" />}
        <div className="ui-sheet-bar">
          <div className="ui-sheet-bar-side">
            <Button variant="tertiary" onClick={onCancel}>
              {cancelLabel}
            </Button>
          </div>
          <h2 id={titleId} className="ui-sheet-title">
            {title}
          </h2>
          <div className="ui-sheet-bar-side" data-end>
            {action}
          </div>
        </div>
      </header>
      <div className="ui-sheet-body">{children}</div>
      {confirming && (
        <div className="ui-sheet-discard" role="alertdialog" aria-label="Discard changes?">
          <p className="ui-sheet-discard-text">You have unsaved changes.</p>
          <Button variant="destructive" fullWidth onClick={onDiscard}>
            Discard changes
          </Button>
          <Button variant="secondary" fullWidth onClick={onKeepEditing}>
            Keep editing
          </Button>
        </div>
      )}
    </>
  );
}

function BottomSheet({ onClose, title, action, children, dirty = false, detents = ['large'], cancelLabel }: SheetProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const beh = useSheetBehavior(panel, onClose, dirty);
  const controls = useDragControls();
  const [isPresent, safeToRemove] = usePresence();

  const H = window.innerHeight;
  const largeH = H - TOP_GAP;
  const mediumY = largeH - Math.round(H * MEDIUM_FRACTION);
  const stops = [...new Set(detents.map((d) => (d === 'large' ? 0 : mediumY)))];
  const y = useMotionValue(H);
  const scrimOpacity = useTransform(y, [0, largeH], [1, 0]);

  // Enter, then exit when AnimatePresence says we're leaving. Both are springs from the live value,
  // so a drag in flight is never interrupted by a jump.
  // Runs on mount and whenever the opening detent changes (e.g. a detail view becoming a form).
  useEffect(() => {
    const a = animate(y, stops[0], { type: 'spring', ...springs.smooth, mass: 1 });
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops[0]]);
  useEffect(() => {
    if (isPresent) return;
    animate(y, H, { type: 'spring', ...springs.smooth, mass: 1 }).then(safeToRemove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent]);

  const settle = (velocity: number) => {
    const projected = y.get() + velocity * 0.25;
    const candidates = [...stops, largeH];
    const target = candidates.reduce((best, c) => (Math.abs(c - projected) < Math.abs(best - projected) ? c : best));
    if (target === largeH) {
      if (dirty) {
        // Spring back and ask, rather than discarding silently.
        const home = stops.reduce((b, c) => (Math.abs(c - y.get()) < Math.abs(b - y.get()) ? c : b));
        animate(y, home, { type: 'spring', ...springs.smooth, mass: 1, velocity: 0 });
        beh.attemptClose();
      } else {
        onClose();
      }
      return;
    }
    if (stops.length > 1) haptic('selection');
    animate(y, target, { type: 'spring', ...springs.smooth, mass: 1, velocity });
  };

  return (
    <>
      <m.div className="ui-scrim" style={{ opacity: scrimOpacity }} onClick={beh.attemptClose} aria-hidden="true" />
      <m.div
        ref={panel}
        className="ui-sheet ui-sheet-bottom"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ y, height: largeH }}
        drag="y"
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: H }}
        dragElastic={{ top: 0.08, bottom: 0 }}
        dragMomentum={false}
        onDragEnd={(_, info) => settle(info.velocity.y)}
        onPointerDownCapture={(e) => {
          // Drag from the grabber/header only; the body keeps its own scroll.
          const t = e.target as HTMLElement;
          if (t.closest('[data-drag-handle]') && !t.closest('button, input, select, textarea, a')) controls.start(e);
        }}
      >
        <Chrome
          grabber
          title={title}
          titleId={titleId}
          action={action}
          cancelLabel={cancelLabel}
          onCancel={beh.attemptClose}
          confirming={beh.confirming}
          onKeepEditing={beh.keepEditing}
          onDiscard={onClose}
        >
          {children}
        </Chrome>
      </m.div>
    </>
  );
}

function Dialog({ onClose, title, action, children, dirty = false, cancelLabel }: SheetProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const beh = useSheetBehavior(panel, onClose, dirty);

  return (
    <>
      <m.div
        className="ui-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: fadeMotion.exit }}
        transition={fadeMotion.standard}
        onClick={beh.attemptClose}
        aria-hidden="true"
      />
      <div className="ui-dialog-wrap">
        <m.div
          ref={panel}
          className="ui-sheet ui-sheet-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, transition: fadeMotion.exit }}
          transition={{ default: spring.smooth, opacity: fadeMotion.standard }}
        >
          <Chrome
            title={title}
            titleId={titleId}
            action={action}
            cancelLabel={cancelLabel}
            onCancel={beh.attemptClose}
            confirming={beh.confirming}
            onKeepEditing={beh.keepEditing}
            onDiscard={onClose}
          >
            {children}
          </Chrome>
        </m.div>
      </div>
    </>
  );
}
