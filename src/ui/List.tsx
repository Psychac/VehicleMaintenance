import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, animate, m, useMotionValue, useMotionValueEvent } from 'motion/react';
import { IconChevronRight } from '../components/icons';
import { spring, springs, fadeMotion } from '../design/tokens';
import { useContextMenu, type MenuAction } from './ContextMenu';
import { pastThreshold, resolveDrag } from './gestures';
import { haptic, type HapticKind } from './haptics';
import { usePress } from './press';

const LiveContext = createContext(false);

/**
 * Inset grouped list (S7): rounded group on the grouped background, hairline separators inset to
 * the text, none after the last row. Use `plain` for feeds. Header/footer sit outside the group.
 *
 * `live` is for lists whose rows come and go (history, reminders): removed rows collapse and fade
 * with spring.smooth, siblings slide into the gap, inserted rows ease in. Rows need stable `key`s,
 * and children must be rows (no fragments).
 */
export function ListGroup({
  header,
  footer,
  plain = false,
  live = false,
  children,
  label,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  plain?: boolean;
  live?: boolean;
  children: ReactNode;
  /** Accessible name when there is no visible header. */
  label?: string;
}) {
  return (
    <section className="ui-group" data-plain={plain || undefined}>
      {header && <h3 className="ui-group-header">{header}</h3>}
      <LiveContext.Provider value={live}>
        <ul className="ui-list" aria-label={typeof header === 'string' ? undefined : label}>
          {live ? <AnimatePresence initial={false}>{children}</AnimatePresence> : children}
        </ul>
      </LiveContext.Provider>
      {footer && <p className="ui-group-footer">{footer}</p>}
    </section>
  );
}

export interface SwipeAction {
  label: string;
  icon?: ReactNode;
  /** positive = accent, destructive = destructive colour. */
  tone: 'positive' | 'destructive';
  /** Runs when the swipe commits. The row springs back afterwards unless it has been removed. */
  onCommit: () => void | Promise<void>;
}

export interface RowProps {
  /** 32 px icon/avatar box. Only when it is faster to scan than the word. */
  leading?: ReactNode;
  /** Headline weight. One line, tail ellipsis. */
  title: ReactNode;
  /** Subhead, secondary. Up to two lines. */
  subtitle?: ReactNode;
  /** Trailing value, secondary. */
  value?: ReactNode;
  /** Replaces `value` (e.g. a badge). */
  trailing?: ReactNode;
  /** Makes the row a button with press highlight. */
  onPress?: () => void;
  /** Show a chevron. Only when the row navigates. */
  chevron?: boolean;
  disabled?: boolean;
  selected?: boolean;
  haptic?: HapticKind | false;
  /** Long-press / right-click menu: the item's 3-5 most useful actions, destructive last. */
  menu?: MenuAction[];
  /**
   * Swipe actions (touch and mouse): trailing (swipe left) for destructive, leading (swipe right)
   * for positive. Slow drag past 50% or a flick commits, with a haptic at the threshold. Every
   * swipe action must also exist in `menu` or the row's detail, as a visible alternative.
   */
  swipe?: { leading?: SwipeAction; trailing?: SwipeAction };
  /** Thin line under the subtitle: how much of an interval is used (0-1). Colour follows the tone. */
  progress?: { value: number; tone: 'ok' | 'soon' | 'overdue' };
}

type Handlers = Record<string, ((e: never) => void) | undefined>;

/** Calls every handler registered for the same event, in order. */
function merge(...sets: Handlers[]): Record<string, (e: unknown) => void> {
  const out: Record<string, (e: unknown) => void> = {};
  for (const set of sets) {
    for (const [name, fn] of Object.entries(set)) {
      if (!fn) continue;
      const prev = out[name];
      out[name] = prev ? (e) => (prev(e), (fn as (e: unknown) => void)(e)) : (fn as (e: unknown) => void);
    }
  }
  return out;
}

/**
 * States: default, pressed (highlight on touch-down, fades out over fade.fast), focus-visible ring,
 * hover (pointer devices only), selected (accent label), disabled.
 * Title + subtitle + value is the most a row may carry (3 text styles).
 */
export function Row({ leading, title, subtitle, value, trailing, onPress, chevron, disabled, selected, haptic: hapticKind = false, menu: menuActions, swipe, progress }: RowProps) {
  const live = useContext(LiveContext);
  const press = usePress<HTMLButtonElement>(disabled);
  const ctx = useContextMenu(disabled ? undefined : menuActions);

  const itemRef = useRef<HTMLLIElement>(null);
  const x = useMotionValue(0);
  const [width, setWidth] = useState(0);
  const [armed, setArmed] = useState<'leading' | 'trailing' | null>(null);
  // The coloured action panels sit under the row; only show them while the row is displaced, so they
  // never peek out at the row's rounded corners.
  const [revealed, setRevealed] = useState(false);
  useMotionValueEvent(x, 'change', (v) => setRevealed(Math.abs(v) > 1));
  const dragged = useRef(false);
  const canSwipe = !disabled && !!(swipe?.leading || swipe?.trailing);

  useEffect(() => {
    if (!canSwipe || !itemRef.current) return;
    const el = itemRef.current;
    const ro = new ResizeObserver(() => setWidth(el.offsetWidth));
    ro.observe(el);
    setWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, [canSwipe]);

  const body = (
    <>
      {leading && <span className="ui-row-leading">{leading}</span>}
      <span className="ui-row-text">
        <span className="ui-row-title">{title}</span>
        {subtitle && <span className="ui-row-subtitle">{subtitle}</span>}
      </span>
      {trailing ? (
        <span className="ui-row-trailing">{trailing}</span>
      ) : (
        value != null && <span className="ui-row-value tnum">{value}</span>
      )}
      {chevron && (
        <span className="ui-row-chevron" aria-hidden="true">
          <IconChevronRight size={16} />
        </span>
      )}
      {progress && (
        <span className="ui-progress" data-tone={progress.tone} aria-hidden="true">
          <span className="ui-progress-fill" style={{ transform: 'scaleX(' + progress.value + ')' }} />
        </span>
      )}
    </>
  );

  const rowHandlers = merge(onPress ? (press as Handlers) : {}, ctx.handlers as Handlers);

  const content = onPress ? (
    <button
      {...(rowHandlers as object)}
      type="button"
      className="ui-row"
      data-selected={selected || undefined}
      disabled={disabled}
      onClick={() => {
        // A long-press or a swipe must not also activate the row.
        if (ctx.consumeClick() || dragged.current) return;
        if (hapticKind) haptic(hapticKind);
        onPress();
      }}
    >
      {body}
    </button>
  ) : (
    <div {...(rowHandlers as object)} className="ui-row" data-selected={selected || undefined} aria-disabled={disabled || undefined}>
      {body}
    </div>
  );

  const springBack = (velocity = 0) => animate(x, 0, { type: 'spring', ...springs.smooth, mass: 1, velocity });

  const swiped = canSwipe ? (
    <>
      <div className="ui-swipe-under" aria-hidden="true" data-revealed={revealed || undefined}>
        <div className="ui-swipe-action" data-tone={swipe?.leading?.tone} data-side="leading" data-armed={armed === 'leading' || undefined}>
          {swipe?.leading && (
            <span className="ui-swipe-label">
              {swipe.leading.icon}
              {swipe.leading.label}
            </span>
          )}
        </div>
        <div className="ui-swipe-action" data-tone={swipe?.trailing?.tone} data-side="trailing" data-armed={armed === 'trailing' || undefined}>
          {swipe?.trailing && (
            <span className="ui-swipe-label">
              {swipe.trailing.icon}
              {swipe.trailing.label}
            </span>
          )}
        </div>
      </div>
      <m.div
        className="ui-swipe-content"
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: swipe?.trailing ? -width : 0, right: swipe?.leading ? width : 0 }}
        dragElastic={0}
        dragMomentum={false}
        onDragStart={() => {
          dragged.current = true;
        }}
        onDrag={() => {
          const off = x.get();
          const past = pastThreshold(off, width);
          const side = past ? (off < 0 ? 'trailing' : 'leading') : null;
          if (side !== armed) {
            setArmed(side);
            if (side) haptic('impactMedium');
          }
        }}
        onDragEnd={async (_, info) => {
          setTimeout(() => (dragged.current = false), 60);
          const off = x.get();
          const action = off < 0 ? swipe?.trailing : swipe?.leading;
          setArmed(null);
          if (action && resolveDrag(off, info.velocity.x, width) === 'commit') {
            await animate(x, off < 0 ? -width : width, { type: 'spring', ...springs.smooth, mass: 1, velocity: info.velocity.x });
            await action.onCommit();
            springBack();
          } else {
            springBack(info.velocity.x);
          }
        }}
      >
        {content}
      </m.div>
    </>
  ) : (
    content
  );

  const common = { className: 'ui-row-item', 'data-leading': leading ? true : undefined } as const;

  return (
    <>
      {live ? (
        <m.li
          {...common}
          ref={itemRef}
          data-live
          layout="position"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0, transition: { height: spring.smooth, opacity: fadeMotion.exit } }}
          transition={{ default: spring.smooth, opacity: fadeMotion.standard }}
        >
          {swiped}
        </m.li>
      ) : (
        <li {...common} ref={itemRef}>
          {swiped}
        </li>
      )}
      {ctx.menu}
    </>
  );
}
