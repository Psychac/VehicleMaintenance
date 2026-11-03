import { TABLES, type AllData, type TableName } from './types';

/** What to do when a copied row has the same id as a row already in the target but different contents. */
export type ConflictStrategy = 'keep' | 'overwrite';

export interface MergeReport {
  added: number;
  unchanged: number;
  conflicts: number;
  /** Conflicting rows replaced by the incoming version (0 when the strategy was 'keep'). */
  overwritten: number;
}

type AnyRow = Record<string, unknown> & { id: string };

const IGNORED_FIELDS = new Set(['user_id', 'created_at']);

function norm(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'boolean') return v ? '1' : '0';
  // SQLite returns REAL, Postgres numeric may come back as number or string: compare numerically.
  if (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)))) {
    return String(Number(v));
  }
  return String(v);
}

function sameContents(incoming: AnyRow, existing: AnyRow): boolean {
  return Object.keys(incoming).every((k) => IGNORED_FIELDS.has(k) || norm(incoming[k]) === norm(existing[k]));
}

/**
 * Decides which incoming rows to write: rows whose id isn't in `existing` are added, identical rows are
 * skipped, and rows that exist with different contents follow `strategy`.
 */
export function planMerge(
  existing: AllData,
  incoming: AllData,
  strategy: ConflictStrategy
): { toWrite: AllData; report: MergeReport } {
  const report: MergeReport = { added: 0, unchanged: 0, conflicts: 0, overwritten: 0 };
  const toWrite = {} as AllData;
  for (const t of TABLES) {
    const have = new Map((existing[t] as unknown as AnyRow[]).map((r) => [r.id, r]));
    const rows: AnyRow[] = [];
    for (const row of (incoming[t] ?? []) as unknown as AnyRow[]) {
      const current = have.get(row.id);
      if (!current) {
        report.added++;
        rows.push(row);
      } else if (sameContents(row, current)) {
        report.unchanged++;
      } else {
        report.conflicts++;
        if (strategy === 'overwrite') {
          report.overwritten++;
          rows.push(row);
        }
      }
    }
    (toWrite as Record<TableName, unknown[]>)[t] = rows;
  }
  return { toWrite, report };
}
