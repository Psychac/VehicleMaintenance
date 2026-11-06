import type { SupabaseClient } from '@supabase/supabase-js';
import { loadConfig } from './config';
import { callSqlite } from './sqlite/client';
import { planMerge, type ConflictStrategy, type MergeReport } from './merge';
import { TABLES, type AllData, type TableName, type Tables } from './types';

type Row<T extends TableName> = Tables[T];
type NewRow<T extends TableName> = Omit<Row<T>, 'id'> & { id?: string };

const config = loadConfig();
const useSupabase = config.backend === 'supabase' && !!config.supabaseUrl && !!config.supabaseKey;

/**
 * Null when the app is using on-device SQLite. In Supabase mode it is set by `initDb()`: the
 * client library (~100 KB) is only downloaded when it is actually the chosen storage.
 */
export let supabase: SupabaseClient | null = null;
/** True when data lives in the on-device SQLite database (no account, no server). Known synchronously. */
export const isLocalMode = !useSupabase;

function client(): SupabaseClient {
  if (!supabase) throw new Error('Storage is not ready yet.');
  return supabase;
}

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

let initPromise: Promise<void> | null = null;

/**
 * Must resolve before the first data call. Idempotent, so `main.tsx` can start it before React
 * renders (the SQLite worker and WebAssembly then load in parallel with the UI bundle).
 */
export function initDb(): Promise<void> {
  initPromise ??= (async () => {
    if (useSupabase) {
      const { createClient } = await import('@supabase/supabase-js');
      supabase = createClient(config.supabaseUrl, config.supabaseKey);
      return;
    }
    Object.assign(storageStatus, await callSqlite<typeof storageStatus>('open'));
    await migrateLegacyDemoData();
  })();
  return initPromise;
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listAll(): Promise<AllData> {
  if (isLocalMode) return callSqlite<AllData>('listAll');
  const results = await Promise.all(TABLES.map((t) => client().from(t).select('*').order('created_at')));
  results.forEach((r) => fail(r.error));
  const [vehicles, fuel_logs, service_logs, reminders] = results.map((r) => r.data ?? []);
  return { vehicles, fuel_logs, service_logs, reminders } as AllData;
}

export async function insertRow<T extends TableName>(table: T, row: NewRow<T>): Promise<Row<T>> {
  if (isLocalMode) return callSqlite<Row<T>>('insert', table, row);
  const { data, error } = await client().from(table).insert(row).select().single();
  fail(error);
  return data as Row<T>;
}

export async function updateRow<T extends TableName>(
  table: T,
  id: string,
  patch: Partial<Row<T>>
): Promise<void> {
  if (isLocalMode) return callSqlite('update', table, id, patch);
  const { error } = await client().from(table).update(patch).eq('id', id);
  fail(error);
}

export async function deleteRow(table: TableName, id: string): Promise<void> {
  if (isLocalMode) return callSqlite('remove', table, id);
  const { error } = await client().from(table).delete().eq('id', id);
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
  if (isLocalMode) return callSqlite('restore', rows);
  for (const table of TABLES) {
    if (!rows[table].length) continue;
    const { error } = await client().from(table).upsert(rows[table]);
    fail(error);
  }
}

const PENDING_KEY = 'vehicle-log:pending-copy';

interface PendingCopy {
  strategy: ConflictStrategy;
  data: AllData;
}

/**
 * Reads everything from the active backend and parks it in this browser so the backend we are about to
 * switch to can import it on next load (Supabase needs a signed-in user first, so it can't be written now).
 * Throws if the active backend can't be read; nothing is parked in that case.
 */
export async function stashDataForSwitch(strategy: ConflictStrategy): Promise<number> {
  const data = await listAll();
  const pending: PendingCopy = { strategy, data };
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  return TABLES.reduce((n, t) => n + data[t].length, 0);
}

export function discardPendingCopy(): void {
  localStorage.removeItem(PENDING_KEY);
}

/** Copies rows into the active backend without clobbering by accident; see planMerge. */
export async function mergeAll(data: AllData, strategy: ConflictStrategy): Promise<MergeReport> {
  const { toWrite, report } = planMerge(await listAll(), data, strategy);
  await restoreAll(toWrite);
  return report;
}

/**
 * Imports data parked by stashDataForSwitch into the (now active) backend. Rows are upserted by id, so a
 * retry is harmless. Returns a message to show, or null when nothing was pending. The parked copy is kept
 * on failure so the next load can retry.
 */
export async function applyPendingCopy(): Promise<string | null> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const { data, strategy } = JSON.parse(raw) as PendingCopy;
    const r = await mergeAll(data, strategy);
    localStorage.removeItem(PENDING_KEY);
    const parts = [`${r.added} added`, `${r.unchanged} already present`];
    if (r.conflicts) {
      parts.push(
        strategy === 'overwrite'
          ? `${r.overwritten} existing entries replaced by the copied version`
          : `${r.conflicts} entries differ from what was already here, so the existing version was kept`
      );
    }
    return `Copied your previous data here: ${parts.join(', ')}.`;
  } catch (ex) {
    return `Couldn't copy your previous data yet (${(ex as Error).message}). It will retry on next load.`;
  }
}

/** Serialises data (from any backend) into the bytes of a standalone .sqlite file. */
export const dataToSqliteFile = (data: AllData) => callSqlite<Uint8Array>('buildFile', data);

/** Reads the rows out of a .sqlite file produced by dataToSqliteFile / "Download database". */
export const sqliteFileToData = (bytes: Uint8Array) => callSqlite<AllData>('readFile', bytes);
