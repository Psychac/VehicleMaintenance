import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { beforeAll, describe, expect, it } from 'vitest';
import { hasVehicleLogTables, Store } from './store';

let sqlite3: Awaited<ReturnType<typeof sqlite3InitModule>>;
beforeAll(async () => {
  sqlite3 = await sqlite3InitModule();
});

const fresh = () => new Store(new sqlite3.oo1.DB(':memory:'));

describe('Store', () => {
  it('round-trips rows and converts booleans', () => {
    const s = fresh();
    const v = s.insert('vehicles', { name: 'Car', start_odometer: 100, archived: false });
    expect(v.archived).toBe(false);
    expect(typeof v.id).toBe('string');
    expect(v.created_at).toBeTruthy();
    s.insert('fuel_logs', { vehicle_id: v.id, date: '2026-01-01', odometer: 200, litres: 10, total_cost: 5, full_tank: false });
    const all = s.listAll();
    expect(all.fuel_logs[0].full_tank).toBe(false);
    expect(all.vehicles).toHaveLength(1);
  });

  it('updates and cascades deletes', () => {
    const s = fresh();
    const v = s.insert('vehicles', { name: 'Car', start_odometer: 0, archived: false });
    s.insert('reminders', { vehicle_id: v.id, title: 'Oil' });
    s.update('vehicles', v.id as string, { name: 'Truck', archived: true });
    expect(s.listAll().vehicles[0]).toMatchObject({ name: 'Truck', archived: true });
    s.remove('vehicles', v.id as string);
    expect(s.listAll().reminders).toHaveLength(0);
  });

  it('restore upserts by id and ignores unknown columns', () => {
    const s = fresh();
    const v = s.insert('vehicles', { name: 'Car', start_odometer: 0, archived: false });
    s.restore({
      vehicles: [{ id: v.id, name: 'Renamed', start_odometer: 5, archived: false, user_id: 'x' } as never],
    });
    const all = s.listAll();
    expect(all.vehicles).toHaveLength(1);
    expect(all.vehicles[0].name).toBe('Renamed');
  });

  it('exports to a file and detects the tables', () => {
    const s = fresh();
    expect(hasVehicleLogTables(new sqlite3.oo1.DB(':memory:'))).toBe(false);
    const db = new sqlite3.oo1.DB(':memory:');
    new Store(db);
    expect(hasVehicleLogTables(db)).toBe(true);
    expect(s).toBeTruthy();
  });
});
