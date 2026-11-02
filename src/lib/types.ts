export interface Vehicle {
  id: string;
  name: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  plate?: string | null;
  fuel_type?: string | null;
  start_odometer: number;
  archived: boolean;
  created_at?: string;
}

export interface FuelLog {
  id: string;
  vehicle_id: string;
  date: string; // YYYY-MM-DD
  odometer: number;
  litres: number;
  total_cost: number;
  full_tank: boolean;
  station?: string | null;
  notes?: string | null;
  created_at?: string;
}

export const SERVICE_CATEGORIES = [
  'service',
  'repair',
  'tyres',
  'insurance',
  'tax/registration',
  'cleaning',
  'other',
] as const;

export interface ServiceLog {
  id: string;
  vehicle_id: string;
  date: string;
  odometer?: number | null;
  category: string;
  title: string;
  cost: number;
  vendor?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface Reminder {
  id: string;
  vehicle_id: string;
  title: string;
  interval_km?: number | null;
  interval_months?: number | null;
  last_done_date?: string | null;
  last_done_odometer?: number | null;
  notes?: string | null;
  created_at?: string;
}

export interface Tables {
  vehicles: Vehicle;
  fuel_logs: FuelLog;
  service_logs: ServiceLog;
  reminders: Reminder;
}
export type TableName = keyof Tables;
export const TABLES: TableName[] = ['vehicles', 'fuel_logs', 'service_logs', 'reminders'];

export type AllData = { [K in TableName]: Tables[K][] };

export interface BackupFile {
  app: 'vehicle-log';
  version: 1;
  exported_at: string;
  data: AllData;
}
