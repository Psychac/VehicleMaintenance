import type { ReminderStatus } from '../lib/calc';
import { fmtDate, fmtKm } from '../lib/format';

const LABEL = { overdue: '⚠ Overdue', soon: '◷ Due soon', ok: '✓ OK', unknown: '? Not tracked' } as const;

export function ReminderBadge({ status }: { status: ReminderStatus }) {
  return <span className={`badge ${status.state}`}>{LABEL[status.state]}</span>;
}

/** "in 1,200 km or 40 days" / "1,200 km overdue" style summary. */
export function dueText(s: ReminderStatus): string {
  const parts: string[] = [];
  if (s.remainingKm !== null) {
    parts.push(s.remainingKm <= 0 ? `${fmtKm(-s.remainingKm)} overdue` : `in ${fmtKm(s.remainingKm)}`);
  }
  if (s.remainingDays !== null) {
    const d = s.remainingDays;
    parts.push(d <= 0 ? `${-d} days overdue (${fmtDate(s.dueDate)})` : `by ${fmtDate(s.dueDate)} (${d} days)`);
  }
  return parts.length ? parts.join(' · ') : 'Record when it was last done to start tracking';
}
