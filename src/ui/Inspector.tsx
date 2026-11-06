import type { ReactNode } from 'react';

export interface InspectorItem {
  label: string;
  value: ReactNode;
}

/**
 * Detail panel beside a list or table on wide screens (DESIGN.md S4: sidebar + content + inspector).
 * Selecting a row shows its details here instead of opening a sheet; actions sit at the bottom.
 * With nothing selected it says what will appear (empty state, S8).
 */
export function Inspector({
  title,
  subtitle,
  badge,
  progress,
  items,
  actions,
  emptyTitle = 'Nothing selected',
  emptyMessage = 'Select a row to see its details.',
}: {
  title?: string;
  subtitle?: string;
  badge?: ReactNode;
  progress?: { value: number; tone: 'ok' | 'soon' | 'overdue' };
  items?: InspectorItem[];
  actions?: ReactNode;
  emptyTitle?: string;
  emptyMessage?: string;
}) {
  if (!title) {
    return (
      <aside className="ui-inspector" data-empty aria-label="Details">
        <h2 className="ui-inspector-empty-title">{emptyTitle}</h2>
        <p className="ui-inspector-empty-msg">{emptyMessage}</p>
      </aside>
    );
  }
  return (
    <aside className="ui-inspector" aria-label="Details" aria-live="polite">
      <header className="ui-inspector-head">
        <h2 className="ui-inspector-title">{title}</h2>
        {badge}
      </header>
      {subtitle && <p className="ui-inspector-sub">{subtitle}</p>}
      {progress && (
        <span className="ui-progress" data-tone={progress.tone} aria-hidden="true">
          <span className="ui-progress-fill" style={{ transform: 'scaleX(' + progress.value + ')' }} />
        </span>
      )}
      <dl className="ui-inspector-list">
        {(items ?? []).map((it) => (
          <div key={it.label} className="ui-inspector-item">
            <dt>{it.label}</dt>
            <dd className="tnum">{it.value}</dd>
          </div>
        ))}
      </dl>
      {actions && <div className="ui-inspector-actions">{actions}</div>}
    </aside>
  );
}
