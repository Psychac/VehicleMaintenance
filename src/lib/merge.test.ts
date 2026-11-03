import { describe, expect, it } from 'vitest';
import { planMerge } from './merge';
import type { AllData, FuelLog } from './types';

const fuel = (id: string, litres: number, extra: Partial<FuelLog> = {}): FuelLog => ({
  id,
  vehicle_id: 'v1',
  date: '2026-01-01',
  odometer: 100,
  litres,
  total_cost: 100,
  full_tank: false,
  ...extra,
});
const data = (fuel_logs: FuelLog[]): AllData => ({ vehicles: [], fuel_logs, service_logs: [], reminders: [] });

describe('planMerge', () => {
  it('adds new rows and skips identical ones, ignoring storage differences', () => {
    const existing = data([fuel('a', 10, { remaining_litres: null, created_at: 'x' })]);
    const incoming = data([
      fuel('a', 10, { total_cost: '100' as unknown as number, remaining_litres: undefined, created_at: 'y' }),
      fuel('b', 5),
    ]);
    const { toWrite, report } = planMerge(existing, incoming, 'keep');
    expect(report).toEqual({ added: 1, unchanged: 1, conflicts: 0, overwritten: 0 });
    expect(toWrite.fuel_logs.map((r) => r.id)).toEqual(['b']);
  });

  it('keeps the existing row on conflict by default', () => {
    const { toWrite, report } = planMerge(data([fuel('a', 10)]), data([fuel('a', 12)]), 'keep');
    expect(report).toMatchObject({ conflicts: 1, overwritten: 0 });
    expect(toWrite.fuel_logs).toEqual([]);
  });

  it('replaces the existing row on conflict when asked', () => {
    const { toWrite, report } = planMerge(data([fuel('a', 10)]), data([fuel('a', 12)]), 'overwrite');
    expect(report).toMatchObject({ conflicts: 1, overwritten: 1 });
    expect(toWrite.fuel_logs[0].litres).toBe(12);
  });
});
