import type { ReactNode } from 'react';
import { usePress } from './press';

/**
 * Only for discrete objects (S7): the vehicle hero, a ticket-like summary. Never nest cards, and
 * never put a border, shadow and tinted fill on the same card: this one uses fill + raised shadow.
 * Pressable cards scale to 0.98 on touch-down.
 */
export function Card({
  children,
  hero = false,
  onPress,
  label,
}: {
  children: ReactNode;
  /** 20 padding instead of 16. */
  hero?: boolean;
  onPress?: () => void;
  /** Accessible name for a pressable card. */
  label?: string;
}) {
  const press = usePress<HTMLButtonElement>();
  if (onPress) {
    return (
      <button {...press} type="button" className="ui-card" data-hero={hero || undefined} data-pressable aria-label={label} onClick={onPress}>
        {children}
      </button>
    );
  }
  return (
    <div className="ui-card" data-hero={hero || undefined}>
      {children}
    </div>
  );
}
