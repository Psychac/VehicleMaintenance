import type { ReactNode } from 'react';
import { IconChevronRight } from '../components/icons';
import { haptic, type HapticKind } from './haptics';
import { usePress } from './press';

/**
 * Inset grouped list (S7): rounded group on the grouped background, hairline separators inset to
 * the text, none after the last row. Use `plain` for feeds. Header/footer sit outside the group.
 */
export function ListGroup({
  header,
  footer,
  plain = false,
  children,
  label,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  plain?: boolean;
  children: ReactNode;
  /** Accessible name when there is no visible header. */
  label?: string;
}) {
  return (
    <section className="ui-group" data-plain={plain || undefined}>
      {header && <h3 className="ui-group-header">{header}</h3>}
      <ul className="ui-list" aria-label={typeof header === 'string' ? undefined : label}>
        {children}
      </ul>
      {footer && <p className="ui-group-footer">{footer}</p>}
    </section>
  );
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
}

/**
 * States: default, pressed (highlight on touch-down, fades out over fade.fast), focus-visible ring,
 * hover (pointer devices only), selected (accent label), disabled.
 * Title + subtitle + value is the most a row may carry (3 text styles).
 */
export function Row({ leading, title, subtitle, value, trailing, onPress, chevron, disabled, selected, haptic: hapticKind = false }: RowProps) {
  const press = usePress<HTMLButtonElement>(disabled);

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
    </>
  );

  return (
    <li className="ui-row-item" data-leading={leading ? true : undefined}>
      {onPress ? (
        <button
          {...press}
          type="button"
          className="ui-row"
          data-selected={selected || undefined}
          disabled={disabled}
          onClick={() => {
            if (hapticKind) haptic(hapticKind);
            onPress();
          }}
        >
          {body}
        </button>
      ) : (
        <div className="ui-row" data-selected={selected || undefined} aria-disabled={disabled || undefined}>
          {body}
        </div>
      )}
    </li>
  );
}
