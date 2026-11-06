const currency = (import.meta.env.VITE_CURRENCY as string | undefined) || 'INR';

const money = new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 });
const num = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const dec = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export const fmtMoney = (v: number) => money.format(v);
export const fmtKm = (v: number) => `${num.format(v)} km`;
export const fmtNum = (v: number) => num.format(v);
export const fmtDec = (v: number) => dec.format(v);

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Parses a form value to a number, or null when blank. */
export function numOrNull(v: FormDataEntryValue | null): number | null {
  if (v === null || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = v === null ? '' : String(v).trim();
  return s === '' ? null : s;
}

const MS_DAY = 86_400_000;

/** Whole days from `iso` to today (negative = in the past). */
export function daysFromToday(iso: string, now: Date = new Date()): number {
  const [y, m, d] = iso.split('-').map(Number);
  const a = Date.UTC(y, m - 1, d);
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / MS_DAY);
}

/** "12 Dec", or "12 Dec 2024" when it isn't this year. */
export function fmtShortDate(iso: string | null | undefined, now: Date = new Date()) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/** Humane dates (DESIGN.md S9): "Today", "Yesterday", "3 days ago", then absolute after 7 days. */
export function fmtRelDate(iso: string | null | undefined, now: Date = new Date()) {
  if (!iso) return '—';
  const diff = daysFromToday(iso, now);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  if (diff < 0 && diff >= -7) return `${-diff} days ago`;
  return fmtShortDate(iso, now);
}
