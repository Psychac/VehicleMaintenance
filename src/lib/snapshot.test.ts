import { beforeEach, describe, expect, it } from 'vitest';
import { loadSnapshot, saveSnapshot } from './snapshot';
import type { AllData } from './types';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  } as Storage;
});

const data: AllData = {
  vehicles: [{ id: 'v', name: 'Car', start_odometer: 0, archived: false }],
  fuel_logs: [],
  service_logs: [],
  reminders: [],
};

describe('snapshot', () => {
  it('round-trips the data', () => {
    saveSnapshot(data);
    expect(loadSnapshot()).toEqual(data);
  });
  it('returns null when nothing is stored or the shape is wrong', () => {
    expect(loadSnapshot()).toBeNull();
    store.set('vehicle-log:snapshot', '{"vehicles":1}');
    expect(loadSnapshot()).toBeNull();
    store.set('vehicle-log:snapshot', 'not json');
    expect(loadSnapshot()).toBeNull();
  });
  it('skips (and clears) a snapshot that is too large to be a cache', () => {
    saveSnapshot(data);
    saveSnapshot({ ...data, fuel_logs: [{ id: 'x'.repeat(2_000_000) } as never] });
    expect(loadSnapshot()).toBeNull();
  });
});
