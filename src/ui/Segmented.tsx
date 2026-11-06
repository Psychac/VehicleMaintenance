import { useRef, type KeyboardEvent } from 'react';
import { motion } from 'motion/react';
import { spring } from '../design/tokens';
import { haptic } from './haptics';
import { usePress } from './press';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/**
 * The selection pill slides between segments with spring.snappy (a single transform-only element,
 * interruptible and following rapid taps) and fires a selection haptic. Arrow keys move selection.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (v: T, focusIndex?: number) => {
    if (v !== value) {
      haptic('selection');
      onChange(v);
    }
    if (focusIndex !== undefined) refs.current[focusIndex]?.focus();
  };

  const onKey = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + options.length) % options.length;
    select(options[next].value, next);
  };

  return (
    <div className="ui-seg" role="radiogroup" aria-label={label} style={{ ['--n' as string]: options.length }}>
      {/* One pill, moved by transform only. initial={false}: it is already in place on mount, so it can never fly in. */}
      <motion.span
        className="ui-seg-pill"
        aria-hidden="true"
        initial={false}
        animate={{ x: `${Math.max(0, options.findIndex((o) => o.value === value)) * 100}%` }}
        transition={spring.snappy}
      />
      {options.map((o, i) => (
        <Segment
          key={o.value}
          active={o.value === value}
          label={o.label}
          buttonRef={(el) => (refs.current[i] = el)}
          onSelect={() => select(o.value)}
          onKeyDown={(e) => onKey(e, i)}
        />
      ))}
    </div>
  );
}

function Segment({
  active,
  label,
  buttonRef,
  onSelect,
  onKeyDown,
}: {
  active: boolean;
  label: string;
  buttonRef: (el: HTMLButtonElement | null) => void;
  onSelect: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
}) {
  const press = usePress<HTMLButtonElement>();
  return (
    <button
      {...press}
      ref={buttonRef}
      type="button"
      role="radio"
      aria-checked={active}
      tabIndex={active ? 0 : -1}
      className="ui-seg-item"
      data-active={active || undefined}
      onClick={onSelect}
      onKeyDown={onKeyDown}
    >
      <span className="ui-seg-label">{label}</span>
    </button>
  );
}
