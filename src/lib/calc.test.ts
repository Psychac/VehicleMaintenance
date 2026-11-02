import { describe, expect, it } from 'vitest';
import { addMonths, averageEfficiency, costsByCategory, fuelEfficiency, monthlyCosts, reminderStatus } from './calc';
import type { FuelLog, Reminder } from './types';

const fuel = (odometer: number, litres: number, full_tank = true, date = '2026-01-01', total_cost = 100): FuelLog => ({
  id: String(odometer),
  vehicle_id: 'v',
  date,
  odometer,
  litres,
  total_cost,
  full_tank,
});

describe('fuelEfficiency', () => {
  it('computes full-to-full km/L including partial fills in between', () => {
    const rows = fuelEfficiency([fuel(1000, 30), fuel(1200, 10, false), fuel(1500, 15)]);
    expect(rows[0].efficiency).toBeNull();
    expect(rows[1].efficiency).toBeNull();
    expect(rows[2].distance).toBe(500);
    expect(rows[2].efficiency).toBeCloseTo(20); // 500 km / 25 L
  });

  it('ignores partial fills before the first full tank', () => {
    const rows = fuelEfficiency([fuel(900, 5, false), fuel(1000, 30), fuel(1400, 20)]);
    expect(rows[2].efficiency).toBeCloseTo(20);
  });

  it('averages across stretches weighted by distance', () => {
    const rows = fuelEfficiency([fuel(0, 10), fuel(200, 10), fuel(500, 20)]);
    expect(averageEfficiency(rows)).toBeCloseTo(500 / 30);
  });
});

describe('addMonths', () => {
  it('clamps to month end', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2026-03-01', -3)).toBe('2025-12-01');
  });
});

describe('reminderStatus', () => {
  const base: Reminder = {
    id: 'r',
    vehicle_id: 'v',
    title: 'Oil',
    interval_km: 10000,
    interval_months: 6,
    last_done_date: '2026-06-01',
    last_done_odometer: 20000,
  };

  it('is ok when far from both limits', () => {
    expect(reminderStatus(base, 22000, '2026-07-01').state).toBe('ok');
  });
  it('is soon when within 10% of the km interval', () => {
    expect(reminderStatus(base, 29500, '2026-07-01').state).toBe('soon');
  });
  it('is overdue when the date passes even if km remain', () => {
    const s = reminderStatus(base, 21000, '2026-12-05');
    expect(s.state).toBe('overdue');
    expect(s.dueDate).toBe('2026-12-01');
  });
  it('is unknown without a baseline', () => {
    expect(reminderStatus({ ...base, last_done_date: null, last_done_odometer: null }, 0, '2026-07-01').state).toBe(
      'unknown'
    );
  });
});

describe('costs', () => {
  it('buckets spend by month', () => {
    const m = monthlyCosts(
      {
        fuel_logs: [fuel(1, 1, true, '2026-10-05', 50)],
        service_logs: [{ id: 's', vehicle_id: 'v', date: '2026-11-01', category: 'service', title: 'x', cost: 300 }],
      },
      '2026-11',
      3
    );
    expect(m.map((x) => x.month)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(m[1].fuel).toBe(50);
    expect(m[2].other).toBe(300);
  });
  it('groups by category with fuel included', () => {
    const c = costsByCategory([fuel(1, 1, true, '2026-01-01', 40)], [
      { id: 'a', vehicle_id: 'v', date: '2026-01-01', category: 'repair', title: 'x', cost: 100 },
    ]);
    expect(c).toEqual([
      { category: 'repair', total: 100 },
      { category: 'fuel', total: 40 },
    ]);
  });
});
