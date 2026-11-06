import type { AllData, FuelLog, Reminder, ServiceLog, Vehicle } from './types';

/** Highest odometer reading known for a vehicle. */
export function currentOdometer(vehicle: Vehicle, fuel: FuelLog[], service: ServiceLog[]): number {
  let max = Number(vehicle.start_odometer) || 0;
  for (const f of fuel) if (f.vehicle_id === vehicle.id) max = Math.max(max, Number(f.odometer));
  for (const s of service) if (s.vehicle_id === vehicle.id && s.odometer != null) max = Math.max(max, Number(s.odometer));
  return max;
}

export interface FuelRow extends FuelLog {
  /** km/L for this fill, computed full-tank to full-tank; null when it can't be known. */
  efficiency: number | null;
  distance: number | null;
}

/**
 * Two ways to get km/L for the stretch ending at a fill-up:
 * - Tank level: when this and the previous fill both record the litres left before filling, fuel burned
 *   is (previous remaining + previous litres) - this remaining. Preferred when available, but only as
 *   accurate as those readings.
 * - Full-tank method: when a full fill-up follows an earlier full fill-up, the distance between them
 *   divided by all litres added after the earlier one (partial fills included).
 */
export function fuelEfficiency(logs: FuelLog[]): FuelRow[] {
  const sorted = [...logs].sort((a, b) => Number(a.odometer) - Number(b.odometer) || a.date.localeCompare(b.date));
  let lastFullOdo: number | null = null;
  let litresSince = 0;
  let prev: FuelLog | null = null;
  return sorted.map((log) => {
    const odo = Number(log.odometer);
    const litres = Number(log.litres);
    let efficiency: number | null = null;
    let distance: number | null = null;
    if (lastFullOdo !== null) {
      litresSince += litres;
      if (log.full_tank) {
        distance = odo - lastFullOdo;
        efficiency = distance > 0 && litresSince > 0 ? distance / litresSince : null;
      }
    }
    if (prev && prev.remaining_litres != null && log.remaining_litres != null) {
      const burned = Number(prev.remaining_litres) + Number(prev.litres) - Number(log.remaining_litres);
      distance = odo - Number(prev.odometer);
      efficiency = distance > 0 && burned > 0 ? distance / burned : null;
    }
    prev = log;
    if (log.full_tank) {
      lastFullOdo = odo;
      litresSince = 0;
    }
    return { ...log, efficiency, distance };
  });
}

/** Overall km/L across every complete full-to-full stretch. */
export function averageEfficiency(rows: FuelRow[]): number | null {
  let km = 0;
  let litres = 0;
  for (const r of rows) {
    if (r.efficiency && r.distance) {
      km += r.distance;
      litres += r.distance / r.efficiency;
    }
  }
  return litres > 0 ? km / litres : null;
}

export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + 'T00:00:00').getTime();
  const b = new Date(toIso + 'T00:00:00').getTime();
  return Math.round((b - a) / 86_400_000);
}

export type ReminderState = 'overdue' | 'soon' | 'ok' | 'unknown';

export interface ReminderStatus {
  state: ReminderState;
  dueKm: number | null;
  dueDate: string | null;
  remainingKm: number | null;
  remainingDays: number | null;
}

export const SOON_DAYS = 30;

/** Due when either the distance or the time interval runs out, whichever comes first. */
export function reminderStatus(r: Reminder, odometer: number, todayIso: string): ReminderStatus {
  const dueKm =
    r.interval_km && r.last_done_odometer != null ? Number(r.last_done_odometer) + Number(r.interval_km) : null;
  const dueDate = r.interval_months && r.last_done_date ? addMonths(r.last_done_date, Number(r.interval_months)) : null;
  const remainingKm = dueKm !== null ? dueKm - odometer : null;
  const remainingDays = dueDate !== null ? daysBetween(todayIso, dueDate) : null;

  if (remainingKm === null && remainingDays === null) {
    return { state: 'unknown', dueKm, dueDate, remainingKm, remainingDays };
  }
  const soonKm = Math.max(500, Number(r.interval_km ?? 0) * 0.1);
  let state: ReminderState = 'ok';
  if ((remainingKm !== null && remainingKm <= 0) || (remainingDays !== null && remainingDays <= 0)) state = 'overdue';
  else if ((remainingKm !== null && remainingKm <= soonKm) || (remainingDays !== null && remainingDays <= SOON_DAYS))
    state = 'soon';
  return { state, dueKm, dueDate, remainingKm, remainingDays };
}

export interface MonthCost {
  month: string; // YYYY-MM
  fuel: number;
  other: number;
}

/** Spend per calendar month for the `count` months ending with `endMonth`. */
export function monthlyCosts(data: Pick<AllData, 'fuel_logs' | 'service_logs'>, endMonth: string, count = 12): MonthCost[] {
  const months: MonthCost[] = [];
  for (let i = count - 1; i >= 0; i--) months.push({ month: addMonths(endMonth + '-01', -i).slice(0, 7), fuel: 0, other: 0 });
  const idx = new Map(months.map((m, i) => [m.month, i]));
  for (const f of data.fuel_logs) {
    const i = idx.get(f.date.slice(0, 7));
    if (i !== undefined) months[i].fuel += Number(f.total_cost);
  }
  for (const s of data.service_logs) {
    const i = idx.get(s.date.slice(0, 7));
    if (i !== undefined) months[i].other += Number(s.cost);
  }
  return months;
}

export function costsByCategory(fuel: FuelLog[], service: ServiceLog[]): { category: string; total: number }[] {
  const totals = new Map<string, number>();
  const fuelTotal = fuel.reduce((s, f) => s + Number(f.total_cost), 0);
  if (fuelTotal) totals.set('fuel', fuelTotal);
  for (const s of service) totals.set(s.category, (totals.get(s.category) ?? 0) + Number(s.cost));
  return [...totals.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
}

/**
 * How much of a reminder's interval is used, 0-1 (1 = due or overdue). Uses whichever of the
 * distance and time intervals is further along. Null when nothing is being tracked yet.
 */
export function reminderProgress(r: Reminder, s: ReminderStatus): { value: number; tone: 'ok' | 'soon' | 'overdue' } | null {
  const used: number[] = [];
  if (s.remainingKm !== null && r.interval_km) used.push((Number(r.interval_km) - s.remainingKm) / Number(r.interval_km));
  if (s.remainingDays !== null && r.interval_months) {
    const total = Number(r.interval_months) * 30.4375;
    used.push((total - s.remainingDays) / total);
  }
  if (!used.length) return null;
  return {
    value: Math.min(1, Math.max(0, Math.max(...used))),
    tone: s.state === 'overdue' ? 'overdue' : s.state === 'soon' ? 'soon' : 'ok',
  };
}
