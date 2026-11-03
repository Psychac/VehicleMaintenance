import type { Database } from '@sqlite.org/sqlite-wasm';
import { TABLES, type AllData, type TableName } from '../types';

/** Columns per table; `bool` columns are stored as 0/1 integers. Mirrors supabase/schema.sql (minus user_id). */
const COLUMNS: Record<TableName, { name: string; bool?: boolean }[]> = {
  vehicles: [
    { name: 'name' },
    { name: 'make' },
    { name: 'model' },
    { name: 'year' },
    { name: 'plate' },
    { name: 'fuel_type' },
    { name: 'start_odometer' },
    { name: 'archived', bool: true },
    { name: 'created_at' },
  ],
  fuel_logs: [
    { name: 'vehicle_id' },
    { name: 'date' },
    { name: 'odometer' },
    { name: 'litres' },
    { name: 'total_cost' },
    { name: 'full_tank', bool: true },
    { name: 'remaining_litres' },
    { name: 'station' },
    { name: 'notes' },
    { name: 'created_at' },
  ],
  service_logs: [
    { name: 'vehicle_id' },
    { name: 'date' },
    { name: 'odometer' },
    { name: 'category' },
    { name: 'title' },
    { name: 'cost' },
    { name: 'vendor' },
    { name: 'notes' },
    { name: 'created_at' },
  ],
  reminders: [
    { name: 'vehicle_id' },
    { name: 'title' },
    { name: 'interval_km' },
    { name: 'interval_months' },
    { name: 'last_done_date' },
    { name: 'last_done_odometer' },
    { name: 'notes' },
    { name: 'created_at' },
  ],
};

const NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

const SCHEMA = `
create table if not exists vehicles (
  id text primary key,
  name text not null,
  make text,
  model text,
  year integer,
  plate text,
  fuel_type text default 'petrol',
  start_odometer real not null default 0,
  archived integer not null default 0,
  created_at text not null default ${NOW}
);
create table if not exists fuel_logs (
  id text primary key,
  vehicle_id text not null references vehicles(id) on delete cascade,
  date text not null,
  odometer real not null,
  litres real not null,
  total_cost real not null default 0,
  full_tank integer not null default 1,
  remaining_litres real,
  station text,
  notes text,
  created_at text not null default ${NOW}
);
create table if not exists service_logs (
  id text primary key,
  vehicle_id text not null references vehicles(id) on delete cascade,
  date text not null,
  odometer real,
  category text not null default 'service',
  title text not null,
  cost real not null default 0,
  vendor text,
  notes text,
  created_at text not null default ${NOW}
);
create table if not exists reminders (
  id text primary key,
  vehicle_id text not null references vehicles(id) on delete cascade,
  title text not null,
  interval_km real,
  interval_months integer,
  last_done_date text,
  last_done_odometer real,
  notes text,
  created_at text not null default ${NOW}
);
create index if not exists fuel_logs_vehicle_idx on fuel_logs (vehicle_id, date);
create index if not exists service_logs_vehicle_idx on service_logs (vehicle_id, date);
create index if not exists reminders_vehicle_idx on reminders (vehicle_id);
`;

type Row = Record<string, unknown>;

/** True if the database already contains all four Vehicle Log tables. */
export function hasVehicleLogTables(db: Database): boolean {
  const found = db.exec({
    sql: `select count(*) from sqlite_master where type = 'table' and name in (${TABLES.map(() => '?').join(',')})`,
    bind: TABLES,
    returnValue: 'resultRows',
    rowMode: 'array',
  }) as unknown[][];
  return found[0]?.[0] === TABLES.length;
}

/** Synchronous data access over one open SQLite database. Runs inside the worker. */
export class Store {
  constructor(private db: Database) {
    db.exec('pragma foreign_keys = on');
    db.exec(SCHEMA);
    this.addMissingColumns();
  }

  /** `create table if not exists` leaves older databases without columns added later. */
  private addMissingColumns(): void {
    const cols = this.select('pragma table_info(fuel_logs)');
    if (!cols.some((c) => c.name === 'remaining_litres')) {
      this.db.exec('alter table fuel_logs add column remaining_litres real');
    }
  }

  private fromDb(table: TableName, row: Row): Row {
    const out = { ...row };
    for (const c of COLUMNS[table]) if (c.bool && out[c.name] != null) out[c.name] = !!out[c.name];
    return out;
  }

  /** Known columns present in `row`, converted to storage values. */
  private toDb(table: TableName, row: Row): [string[], unknown[]] {
    const names: string[] = [];
    const values: unknown[] = [];
    for (const c of COLUMNS[table]) {
      const v = row[c.name];
      if (v === undefined) continue;
      names.push(c.name);
      values.push(c.bool ? (v ? 1 : 0) : v);
    }
    return [names, values];
  }

  private select(sql: string, bind: unknown[] = []): Row[] {
    return this.db.exec({ sql, bind: bind as never, returnValue: 'resultRows', rowMode: 'object' }) as Row[];
  }

  listAll(): AllData {
    const out = {} as Record<TableName, Row[]>;
    for (const t of TABLES) out[t] = this.select(`select * from ${t} order by created_at, rowid`).map((r) => this.fromDb(t, r));
    return out as unknown as AllData;
  }

  insert(table: TableName, row: Row): Row {
    const id = (row.id as string | undefined) ?? crypto.randomUUID();
    const [names, values] = this.toDb(table, row);
    this.db.exec({
      sql: `insert into ${table} (id, ${names.join(', ')}) values (?${', ?'.repeat(names.length)})`,
      bind: [id, ...values] as never,
    });
    return this.fromDb(table, this.select(`select * from ${table} where id = ?`, [id])[0]);
  }

  update(table: TableName, id: string, patch: Row): void {
    const [names, values] = this.toDb(table, patch);
    if (!names.length) return;
    this.db.exec({
      sql: `update ${table} set ${names.map((n) => `${n} = ?`).join(', ')} where id = ?`,
      bind: [...values, id] as never,
    });
  }

  remove(table: TableName, id: string): void {
    this.db.exec({ sql: `delete from ${table} where id = ?`, bind: [id] });
  }

  /** Upserts every row by id inside one transaction; nothing is deleted. */
  restore(data: Partial<AllData>): void {
    this.db.transaction(() => {
      for (const t of TABLES) {
        for (const row of (data[t] ?? []) as unknown as Row[]) {
          const [names, values] = this.toDb(t, row);
          const updates = names.map((n) => `${n} = excluded.${n}`).join(', ');
          this.db.exec({
            sql:
              `insert into ${t} (id, ${names.join(', ')}) values (?${', ?'.repeat(names.length)}) ` +
              `on conflict(id) do update set ${updates}`,
            bind: [row.id, ...values] as never,
          });
        }
      }
    });
  }
}
