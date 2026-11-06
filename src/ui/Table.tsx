import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useContextMenu, type MenuAction } from './ContextMenu';

export interface Column<T> {
  key: string;
  label: string;
  /** Numbers and money: right-aligned, tabular figures. */
  numeric?: boolean;
  render: (row: T) => ReactNode;
  /** Makes the column sortable by this value. */
  sort?: (row: T) => string | number;
}

type Sort = { key: string; dir: 'asc' | 'desc' } | null;

/**
 * Desktop data table: sortable headers (asc, desc, back to the given order), hover and selected rows,
 * keyboard (arrows move the selection, Enter opens), right-click menu. Rows are not buttons: the
 * whole row is the target, and selection is announced with aria-selected.
 */
export function DataTable<T>({
  label,
  columns,
  rows,
  rowKey,
  selectedId,
  onSelect,
  menu,
  footer,
}: {
  label: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  selectedId: string | null;
  onSelect: (row: T) => void;
  menu?: (row: T) => MenuAction[];
  footer?: ReactNode;
}) {
  const [sort, setSort] = useState<Sort>(null);

  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key);
    if (!sort || !col?.sort) return rows;
    const get = col.sort;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * dir;
    });
  }, [rows, columns, sort]);

  const toggle = (key: string) =>
    setSort((s) => (!s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null));

  const move = (e: KeyboardEvent<HTMLElement>, i: number) => {
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = sorted[i + step];
    if (!next) return;
    onSelect(next);
    (e.currentTarget.parentElement?.children[i + step] as HTMLElement | undefined)?.focus();
  };

  return (
    <div className="ui-table-wrap">
      <table className="ui-table" aria-label={label}>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th key={c.key} scope="col" data-numeric={c.numeric || undefined} aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : c.sort ? 'none' : undefined}>
                  {c.sort ? (
                    <button type="button" className="ui-th-btn" onClick={() => toggle(c.key)}>
                      {c.label}
                      <span className="ui-sort" data-dir={active ? sort!.dir : undefined} aria-hidden="true" />
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <TableRow key={rowKey(r)} row={r} columns={columns} selected={rowKey(r) === selectedId} onSelect={onSelect} menu={menu?.(r)} onKeyMove={(e) => move(e, i)} />
          ))}
        </tbody>
      </table>
      {footer}
    </div>
  );
}

function TableRow<T>({
  row,
  columns,
  selected,
  onSelect,
  menu,
  onKeyMove,
}: {
  row: T;
  columns: Column<T>[];
  selected: boolean;
  onSelect: (row: T) => void;
  menu?: MenuAction[];
  onKeyMove: (e: KeyboardEvent<HTMLElement>) => void;
}) {
  const ctx = useContextMenu(menu);
  return (
    <tr
      {...ctx.handlers}
      tabIndex={0}
      aria-selected={selected}
      data-selected={selected || undefined}
      onClick={() => {
        if (!ctx.consumeClick()) onSelect(row);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(row);
        } else onKeyMove(e);
      }}
    >
      {columns.map((c) => (
        <td key={c.key} data-numeric={c.numeric || undefined}>
          {c.render(row)}
        </td>
      ))}
    </tr>
  );
}
