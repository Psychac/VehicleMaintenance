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
