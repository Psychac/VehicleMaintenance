import { createContext, useContext, useRef, type ReactNode } from 'react';
import { IconChevronRight } from '../components/icons';
import { useContextMenu, type MenuAction } from './ContextMenu';
import { hasFinePointer } from './desktop';
import { haptic, type HapticKind } from './haptics';
import { useMotionParts } from './motionLoader';
import { usePress } from './press';

const LiveContext = createContext(false);

/**
 * Inset grouped list (S7): rounded group on the grouped background, hairline separators inset to
 * the text, none after the last row. Use `plain` for feeds. Header/footer sit outside the group.
 *
 * `live` is for lists whose rows come and go (history, reminders): removed rows collapse and fade
 * with spring.smooth, siblings slide into the gap, inserted rows ease in. Rows need stable `key`s,
 * and children must be rows (no fragments). The animation code loads after first paint; until then
 * rows simply appear and disappear.
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
  const parts = useMotionParts();
  const animated = live && parts !== null;
  return (
    <section className="ui-group" data-plain={plain || undefined}>
      {header && <h3 className="ui-group-header">{header}</h3>}
      <LiveContext.Provider value={animated}>
        <ul className="ui-list" aria-label={typeof header === 'string' ? undefined : label}>
          {animated && parts ? <parts.LiveBoundary>{children}</parts.LiveBoundary> : children}
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
  const parts = useMotionParts();
  const press = usePress<HTMLButtonElement>(disabled);
  const ctx = useContextMenu(disabled ? undefined : menuActions);
  const dragged = useRef(false);
  // Swipe is a touch gesture; with a mouse the same actions are in the right-click menu and the detail panel.
  const canSwipe = !disabled && !!(swipe?.leading || swipe?.trailing) && !hasFinePointer();

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

  // Swipe needs the motion code; until it has loaded the row is simply not swipeable (the same
  // actions are in the long-press menu and the row's detail).
  const swiped =
    canSwipe && swipe && parts ? (
      <parts.SwipeLayer swipe={swipe} dragged={dragged}>
        {content}
      </parts.SwipeLayer>
    ) : (
      content
    );

  return live && parts ? (
    <parts.LiveItem leading={!!leading}>{swiped}</parts.LiveItem>
  ) : (
    <li className="ui-row-item" data-leading={leading ? true : undefined}>
      {swiped}
    </li>
  );
}
