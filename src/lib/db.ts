import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { TABLES, type AllData, type TableName, type Tables } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Null when no Supabase config is present: the app then runs in local demo mode. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
export const isLocalMode = !supabase;

type Row<T extends TableName> = Tables[T];
type NewRow<T extends TableName> = Omit<Row<T>, 'id'> & { id?: string };

// ---- local demo storage -------------------------------------------------

const LS_PREFIX = 'vehicle-log:';

function localRead<T extends TableName>(table: T): Row<T>[] {
  try {
    return JSON.parse(localStorage.getItem(LS_PREFIX + table) ?? '[]');
  } catch {
    return [];
  }
}

function localWrite<T extends TableName>(table: T, rows: Row<T>[]) {
  localStorage.setItem(LS_PREFIX + table, JSON.stringify(rows));
}

// ---- public API ------------------------------------------------------------

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listAll(): Promise<AllData> {
  if (!supabase) {
    return {
      vehicles: localRead('vehicles'),
      fuel_logs: localRead('fuel_logs'),
      service_logs: localRead('service_logs'),
      reminders: localRead('reminders'),
    };
  }
  const results = await Promise.all(
    TABLES.map((t) => supabase!.from(t).select('*').order('created_at'))
  );
  results.forEach((r) => fail(r.error));
  const [vehicles, fuel_logs, service_logs, reminders] = results.map((r) => r.data ?? []);
  return { vehicles, fuel_logs, service_logs, reminders } as AllData;
}

export async function insertRow<T extends TableName>(table: T, row: NewRow<T>): Promise<Row<T>> {
  if (!supabase) {
    const full = { ...row, id: row.id ?? crypto.randomUUID(), created_at: new Date().toISOString() } as Row<T>;
    localWrite(table, [...localRead(table), full]);
    return full;
  }
  const { data, error } = await supabase.from(table).insert(row).select().single();
  fail(error);
  return data as Row<T>;
}

export async function updateRow<T extends TableName>(
  table: T,
  id: string,
  patch: Partial<Row<T>>
): Promise<void> {
  if (!supabase) {
    localWrite(table, localRead(table).map((r) => (r.id === id ? { ...r, ...patch } : r)));
    return;
  }
  const { error } = await supabase.from(table).update(patch).eq('id', id);
  fail(error);
}

export async function deleteRow(table: TableName, id: string): Promise<void> {
  if (!supabase) {
    localWrite(table, localRead(table).filter((r) => r.id !== id));
    // Mirror the database's cascade for vehicles.
    if (table === 'vehicles') {
      for (const t of ['fuel_logs', 'service_logs', 'reminders'] as const) {
        localWrite(t, localRead(t).filter((r) => r.vehicle_id !== id));
      }
    }
    return;
  }
  const { error } = await supabase.from(table).delete().eq('id', id);
  fail(error);
}

/** Upserts every row of a backup by id; existing rows are overwritten, nothing is deleted. */
export async function restoreAll(data: AllData): Promise<void> {
  for (const table of TABLES) {
    const rows = (data[table] ?? []).map((r) => {
      // Drop the owner so the row is assigned to whoever is signed in now.
      const { user_id: _owner, ...rest } = r as typeof r & { user_id?: string };
      return rest;
    });
    if (!rows.length) continue;
    if (!supabase) {
      const byId = new Map(localRead(table).map((r) => [r.id, r]));
      rows.forEach((r) => byId.set(r.id, r as Row<typeof table>));
      localWrite(table, [...byId.values()]);
      continue;
    }
    const { error } = await supabase.from(table).upsert(rows);
    fail(error);
  }
}
