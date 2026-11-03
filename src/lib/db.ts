import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadConfig } from './config';
import { callSqlite } from './sqlite/client';
import { TABLES, type AllData, type TableName, type Tables } from './types';

type Row<T extends TableName> = Tables[T];
type NewRow<T extends TableName> = Omit<Row<T>, 'id'> & { id?: string };

const config = loadConfig();
const useSupabase = config.backend === 'supabase' && !!config.supabaseUrl && !!config.supabaseKey;

/** Null when the app is using on-device SQLite. */
export const supabase: SupabaseClient | null = useSupabase
  ? createClient(config.supabaseUrl, config.supabaseKey)
  : null;
/** True when data lives in the on-device SQLite database (no account, no server). */
export const isLocalMode = !supabase;

/** Set after initDb() in SQLite mode. `persistent: false` means data is lost on reload. */
export const storageStatus: { persistent: boolean; reason?: string } = { persistent: true };

const LEGACY_PREFIX = 'vehicle-log:';

/** One-time import of data the old localStorage demo mode kept in this browser. */
async function migrateLegacyDemoData(): Promise<void> {
  try {
    if (localStorage.getItem(LEGACY_PREFIX + 'migrated')) return;
    const legacy = {} as Record<TableName, unknown[]>;
    for (const t of TABLES) legacy[t] = JSON.parse(localStorage.getItem(LEGACY_PREFIX + t) ?? '[]');
    localStorage.setItem(LEGACY_PREFIX + 'migrated', '1');
    if (!legacy.vehicles.length) return;
    const existing = await callSqlite<AllData>('listAll');
    if (existing.vehicles.length) return;
    await callSqlite('restore', legacy);
  } catch {
    /* legacy data stays in localStorage untouched; nothing to do */
  }
}

/** Must resolve before the first data call in SQLite mode. A no-op for Supabase. */
export async function initDb(): Promise<void> {
  if (supabase) return;
  Object.assign(storageStatus, await callSqlite<typeof storageStatus>('open'));
  await migrateLegacyDemoData();
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listAll(): Promise<AllData> {
  if (!supabase) return callSqlite<AllData>('listAll');
  const results = await Promise.all(TABLES.map((t) => supabase!.from(t).select('*').order('created_at')));
  results.forEach((r) => fail(r.error));
  const [vehicles, fuel_logs, service_logs, reminders] = results.map((r) => r.data ?? []);
  return { vehicles, fuel_logs, service_logs, reminders } as AllData;
}

export async function insertRow<T extends TableName>(table: T, row: NewRow<T>): Promise<Row<T>> {
  if (!supabase) return callSqlite<Row<T>>('insert', table, row);
  const { data, error } = await supabase.from(table).insert(row).select().single();
  fail(error);
  return data as Row<T>;
}

export async function updateRow<T extends TableName>(
  table: T,
  id: string,
  patch: Partial<Row<T>>
): Promise<void> {
  if (!supabase) return callSqlite('update', table, id, patch);
  const { error } = await supabase.from(table).update(patch).eq('id', id);
  fail(error);
}

export async function deleteRow(table: TableName, id: string): Promise<void> {
  if (!supabase) return callSqlite('remove', table, id);
  const { error } = await supabase.from(table).delete().eq('id', id);
  fail(error);
}

/** Upserts every row of a backup by id; existing rows are overwritten, nothing is deleted. */
export async function restoreAll(data: AllData): Promise<void> {
  // Drop the owner so rows are assigned to whoever is signed in now.
  const rows = {} as AllData;
  for (const t of TABLES) {
    (rows as Record<TableName, unknown[]>)[t] = (data[t] ?? []).map((r) => {
      const { user_id: _owner, ...rest } = r as typeof r & { user_id?: string };
      return rest;
    });
  }
  if (!supabase) return callSqlite('restore', rows);
  for (const table of TABLES) {
    if (!rows[table].length) continue;
    const { error } = await supabase.from(table).upsert(rows[table]);
    fail(error);
  }
}

/** Serialises data (from any backend) into the bytes of a standalone .sqlite file. */
export const dataToSqliteFile = (data: AllData) => callSqlite<Uint8Array>('buildFile', data);

/** Reads the rows out of a .sqlite file produced by dataToSqliteFile / "Download database". */
export const sqliteFileToData = (bytes: Uint8Array) => callSqlite<AllData>('readFile', bytes);
