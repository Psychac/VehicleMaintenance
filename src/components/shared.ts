import type { FuelLog, Reminder, ServiceLog, Vehicle } from '../lib/types';

export interface VehicleScope {
  vehicle: Vehicle;
  fuel: FuelLog[];
  service: ServiceLog[];
  reminders: Reminder[];
}

export function confirmDelete(what: string) {
  return window.confirm(`Delete this ${what}? This can't be undone.`);
}
