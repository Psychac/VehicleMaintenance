import type { AllData } from './types';

const KEY = 'vehicle-log:snapshot';
/** Above this the snapshot is skipped: it is a first-paint cache, not a second database. */
const MAX_CHARS = 1_500_000;

/**
 * The last data the app read, kept so a returning user sees their vehicle on the very first frame
 * (DESIGN.md S11: "cached data shown first") instead of waiting for the SQLite WebAssembly module
 * to load and open. The real read still happens right after and replaces it. On-device mode only.
 */
export function loadSnapshot(): AllData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<AllData>;
    if (!Array.isArray(d.vehicles) || !Array.isArray(d.fuel_logs) || !Array.isArray(d.service_logs) || !Array.isArray(d.reminders)) return null;
    return d as AllData;
  } catch {
    return null;
  }
}

export function saveSnapshot(data: AllData): void {
  try {
    const raw = JSON.stringify(data);
    if (raw.length > MAX_CHARS) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, raw);
  } catch {
    /* storage full or blocked: the app works without it */
  }
}

export function clearSnapshot(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
