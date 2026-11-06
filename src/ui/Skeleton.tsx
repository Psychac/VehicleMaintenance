import { useEffect, useState } from 'react';
import { motionValues } from '../design/tokens';

/**
 * True only once `active` has stayed true for `delay` ms. Loading UI that flashes for 100 ms looks
 * broken, so anything faster than ~300 ms shows nothing new (S8).
 */
export function useDelayedFlag(active: boolean, delay: number = motionValues.loadingDelayMs): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const id = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(id);
  }, [active, delay]);
  return shown;
}

/** A shimmering block that holds the exact frame of the content that replaces it (no layout shift). */
export function Skeleton({ w = '100%', h = 'var(--space-16)', radius = 'var(--radius-xs)' }: { w?: string; h?: string; radius?: string }) {
  return <span className="ui-skeleton" style={{ width: w, height: h, borderRadius: radius }} aria-hidden="true" />;
}

/** Same frame as a two-line `Row`. */
export function SkeletonRow({ leading = false }: { leading?: boolean }) {
  return (
    <li className="ui-row-item" data-leading={leading || undefined} aria-hidden="true">
      <div className="ui-row">
        {leading && <Skeleton w="var(--space-32)" h="var(--space-32)" radius="var(--radius-sm)" />}
        <span className="ui-row-text">
          <Skeleton w="55%" h="var(--space-16)" />
          <Skeleton w="35%" h="var(--space-12)" />
        </span>
        <Skeleton w="var(--space-48)" h="var(--space-16)" />
      </div>
    </li>
  );
}

/** Wrap in a ListGroup. Announces itself once for assistive tech. */
export function SkeletonRows({ count = 5, leading = false }: { count?: number; leading?: boolean }) {
  return (
    <>
      <li className="ui-sr-only" role="status">
        Loading
      </li>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} leading={leading} />
      ))}
    </>
  );
}
