import type { ReactNode } from 'react';

export interface StatItem {
  label: string;
  value: ReactNode;
}

/**
 * Compact figures as a two-column block: label over value, divided by hairlines, no card around it.
 * For a handful of related numbers (a summary), where a list of rows would waste the width.
 */
export function StatGrid({ header, footer, items }: { header?: ReactNode; footer?: ReactNode; items: StatItem[] }) {
  return (
    <section className="ui-group">
      {header && <h3 className="ui-group-header">{header}</h3>}
      <dl className="ui-stats">
        {items.map((it) => (
          <div key={it.label} className="ui-stat">
            <dt>{it.label}</dt>
            <dd className="tnum">{it.value}</dd>
          </div>
        ))}
      </dl>
      {footer && <p className="ui-group-footer">{footer}</p>}
    </section>
  );
}
