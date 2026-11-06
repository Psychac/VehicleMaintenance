// Runs SQLite off the main thread. Persistence uses OPFS via the SAH-pool VFS,
// which (unlike the plain OPFS VFS) needs no COOP/COEP headers, so any static host works.
import sqlite3InitModule, { type Database } from '@sqlite.org/sqlite-wasm';
import type { AllData, TableName } from '../types';
import { hasVehicleLogTables, Store } from './store';

type Sqlite3 = Awaited<ReturnType<typeof sqlite3InitModule>>;

const scope = self as unknown as {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage(msg: unknown, transfer?: Transferable[]): void;
};

let sqlite3Promise: Promise<Sqlite3> | null = null;
const getSqlite3 = () => (sqlite3Promise ??= sqlite3InitModule());

let store: Store | null = null;

function main(): Store {
  if (!store) throw new Error('Database not open.');
  return store;
}

/** The on-device file allows one open copy at a time; a second one gets one of these errors. */
const LOCKED = /access handle|NoModificationAllowed|locked|in use|another/i;
const LOCK_RETRIES = 6;
const LOCK_RETRY_MS = 500;

async function open(): Promise<{ persistent: boolean; reason?: string; locked?: boolean }> {
  const sqlite3 = await getSqlite3();
  let db: Database | null = null;
  let reason: string | undefined;
  let locked = false;
  // A copy that is closing (or a frozen background instance) usually lets go within a couple of
  // seconds, so retry before giving up on persistent storage.
  for (let attempt = 0; attempt <= LOCK_RETRIES && !db; attempt++) {
    try {
      const pool = await sqlite3.installOpfsSAHPoolVfs({});
      db = new pool.OpfsSAHPoolDb('/vehicle-log.sqlite3');
    } catch (e) {
      reason = (e as Error).message;
      locked = LOCKED.test(String((e as Error).name) + ' ' + reason);
      if (!locked || attempt === LOCK_RETRIES) break;
      await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
    }
  }
  const persistent = !!db;
  // No OPFS (old browser, private window) or still locked: work from a temporary in-memory copy.
  store = new Store(db ?? new sqlite3.oo1.DB(':memory:'));
  return persistent ? { persistent } : { persistent, reason, locked };
}

/** Opens a throwaway in-memory database, optionally loaded from the bytes of a .sqlite file. */
function scratch(sqlite3: Sqlite3, bytes?: Uint8Array): Database {
  const db = new sqlite3.oo1.DB(':memory:');
  if (bytes) {
    const ptr = sqlite3.wasm.allocFromTypedArray(bytes);
    const rc = sqlite3.capi.sqlite3_deserialize(
      db.pointer!,
      'main',
      ptr,
      bytes.length,
      bytes.length,
      sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE
    );
    db.checkRc(rc);
  }
  return db;
}

const handlers: Record<string, (...args: any[]) => unknown> = {
  open,
  listAll: () => main().listAll(),
  insert: (table: TableName, row: Record<string, unknown>) => main().insert(table, row),
  update: (table: TableName, id: string, patch: Record<string, unknown>) => main().update(table, id, patch),
  remove: (table: TableName, id: string) => main().remove(table, id),
  restore: (data: AllData) => main().restore(data),

  /** Builds a standalone .sqlite file from the given data (works for any backend). */
  async buildFile(data: AllData): Promise<Uint8Array> {
    const sqlite3 = await getSqlite3();
    const db = scratch(sqlite3);
    try {
      new Store(db).restore(data);
      return sqlite3.capi.sqlite3_js_db_export(db.pointer!);
    } finally {
      db.close();
    }
  },

  /** Reads all rows out of the bytes of a .sqlite file. */
  async readFile(bytes: Uint8Array): Promise<AllData> {
    const sqlite3 = await getSqlite3();
    let db: Database;
    try {
      db = scratch(sqlite3, bytes);
    } catch {
      throw new Error('Not a SQLite database file.');
    }
    try {
      if (!hasVehicleLogTables(db)) throw new Error('Not a Vehicle Log database.');
      return new Store(db).listAll();
    } finally {
      db.close();
    }
  },
};

scope.onmessage = async (e) => {
  const { id, op, args } = e.data as { id: number; op: string; args: unknown[] };
  try {
    const result = await handlers[op](...args);
    scope.postMessage({ id, ok: true, result }, result instanceof Uint8Array ? [result.buffer] : []);
  } catch (err) {
    scope.postMessage({ id, ok: false, error: (err as Error).message ?? String(err) });
  }
};
