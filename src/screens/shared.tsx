import { currentOdometer, reminderStatus, type ReminderStatus } from '../lib/calc';
import { deleteRow, restoreAll, updateRow } from '../lib/db';
import { fmtKm, fmtShortDate, today } from '../lib/format';
import type { AllData, FuelLog, Reminder, ServiceLog, TableName, Tables, Vehicle } from '../lib/types';
import { Badge, type BadgeTone, type ToastInput } from '../ui';

/** Everything a vehicle-scoped screen needs. */
export interface VehicleScope {
  vehicle: Vehicle;
  fuel: FuelLog[];
  service: ServiceLog[];
  reminders: Reminder[];
}

/** Sheets that edit a row: `null` closed, `'new'` creating, or the row being edited. */
export type Editing<T> = T | 'new' | null;

const EMPTY_DATA: AllData = { vehicles: [], fuel_logs: [], service_logs: [], reminders: [] };

/**
 * Deletes a row right away and offers Undo for 5 s (DESIGN.md S6.5: undo beats "Are you sure?").
 * Undo upserts the same row back by id, so nothing is lost even if the page closes in between.
 */
export async function deleteWithUndo<T extends Exclude<TableName, 'vehicles'>>(
  table: T,
  row: Tables[T],
  message: string,
  toast: (t: ToastInput) => void,
  reload: () => Promise<void>
) {
  await deleteRow(table, row.id);
  await reload();
  toast({
    message,
    action: {
      label: 'Undo',
      onPress: async () => {
        await restoreAll({ ...EMPTY_DATA, [table]: [row] });
        await reload();
      },
    },
  });
}

/** Odometer, with the same fallbacks the old screens used. */
export const odometerOf = (s: VehicleScope) => currentOdometer(s.vehicle, s.fuel, s.service);

export interface StatusRow {
  r: Reminder;
  s: ReminderStatus;
}

const ORDER = { overdue: 0, soon: 1, unknown: 2, ok: 3 } as const;

/** Reminders with their status, most urgent first (ties alphabetical). */
export function reminderRows(scope: VehicleScope): StatusRow[] {
  const odo = odometerOf(scope);
  const t = today();
  return scope.reminders
    .map((r) => ({ r, s: reminderStatus(r, odo, t) }))
    .sort((a, b) => ORDER[a.s.state] - ORDER[b.s.state] || a.r.title.localeCompare(b.r.title));
}

const TONE: Record<ReminderStatus['state'], BadgeTone> = { overdue: 'overdue', soon: 'soon', ok: 'ok', unknown: 'neutral' };
const LABEL: Record<ReminderStatus['state'], string> = { overdue: 'Overdue', soon: 'Due soon', ok: 'On track', unknown: 'Not started' };

export function ReminderBadge({ status }: { status: ReminderStatus }) {
  return <Badge tone={TONE[status.state]}>{LABEL[status.state]}</Badge>;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** "1,200 km overdue" / "In 1,200 km · by 12 Dec". */
export function dueText(s: ReminderStatus): string {
  const parts: string[] = [];
  if (s.remainingKm !== null) {
    parts.push(s.remainingKm <= 0 ? `${fmtKm(-s.remainingKm)} overdue` : `In ${fmtKm(s.remainingKm)}`);
  }
  if (s.remainingDays !== null) {
    const d = s.remainingDays;
    parts.push(d <= 0 ? `${plural(-d, 'day')} overdue` : `${parts.length ? 'by' : 'By'} ${fmtShortDate(s.dueDate)}`);
  }
  return parts.length ? parts.join(' · ') : 'Record when it was last done';
}

/** "2019 Honda City" style line, or null. */
export const vehicleDetails = (v: Vehicle) => [v.year, v.make, v.model].filter(Boolean).join(' ') || null;

/**
 * One-tap "done today": stamps today's date and the current odometer on a reminder, plays the
 * completion moment, and offers Undo (restoring exactly what was there before).
 */
export async function markDoneNow(
  r: Reminder,
  odometer: number,
  toast: (t: ToastInput) => void,
  celebrate: () => void,
  reload: () => Promise<void>
) {
  const previous = { last_done_date: r.last_done_date ?? null, last_done_odometer: r.last_done_odometer ?? null };
  await updateRow('reminders', r.id, { last_done_date: today(), last_done_odometer: odometer });
  await reload();
  celebrate();
  toast({
    message: `${r.title} marked done`,
    action: {
      label: 'Undo',
      onPress: async () => {
        await updateRow('reminders', r.id, previous);
        await reload();
      },
    },
  });
}
