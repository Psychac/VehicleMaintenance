import { useRef, useState, type PointerEvent } from 'react';
import { averageEfficiency, costsByCategory, fuelEfficiency, monthlyCosts, type MonthCost } from '../lib/calc';
import { fmtDate, fmtDec, fmtMoney, today } from '../lib/format';
import { ListGroup, ScreenHeader, Segmented, Skeleton, haptic } from '../ui';
import type { VehicleScope } from './shared';
import { useShell } from './shell';

const monthLabel = (ym: string, long = false) =>
  new Date(ym + '-01T00:00:00').toLocaleDateString(undefined, long ? { month: 'long', year: 'numeric' } : { month: 'short' });

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Range = '6' | '12' | '24';

/** Spend by month and category, and mileage trend. Charts are scrubbable by finger with a tick per data point. */
export default function Reports({ scope, loading }: { scope: VehicleScope; loading: boolean }) {
  const shell = useShell();
  const { fuel, service } = scope;
  const [range, setRange] = useState<Range>('12');
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const n = Number(range);

  const months = monthlyCosts({ fuel_logs: fuel, service_logs: service }, today().slice(0, 7), n);
  const first = months[0].month;
  const inRange = <T extends { date: string }>(rows: T[]) => rows.filter((r) => r.date.slice(0, 7) >= first);
  const categories = costsByCategory(inRange(fuel), inRange(service));
  const total = categories.reduce((s, c) => s + c.total, 0);
  const effRows = fuelEfficiency(fuel).filter((r) => r.efficiency !== null && r.date.slice(0, 7) >= first);

  return (
    <>
      <ScreenHeader
        title="Reports"
        subtitle={total > 0 ? `${fmtMoney(total)} over ${n} months · ${fmtMoney(total / n)} a month` : `Nothing spent in the last ${n} months`}
        trailing={
          <>
            {shell.vehicleButton}
            {shell.bellButton}
          </>
        }
      />
      <div className="screen">
        <Segmented
          label="Range"
          value={range}
          onChange={setRange}
          options={[
            { value: '6', label: '6 months' },
            { value: '12', label: '12 months' },
            { value: '24', label: '24 months' },
          ]}
        />

        {loading ? (
          <Skeleton h="calc(var(--space-80) * 3)" radius="var(--radius-lg)" />
        ) : (
          <>
            <section className="report-block" aria-labelledby="r-spend">
              <div className="report-head">
                <h2 id="r-spend" className="t-title3">
                  Monthly spend
                </h2>
                <Segmented
                  label="Display"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'chart', label: 'Chart' },
                    { value: 'table', label: 'Table' },
                  ]}
                />
              </div>
              {view === 'table' ? <MonthTable months={months} /> : <MonthChart months={months} />}
            </section>

            <section className="report-block" aria-labelledby="r-cat">
              <h2 id="r-cat" className="t-title3">
                By category
              </h2>
              {categories.length === 0 ? (
                <p className="report-empty">No spending in this period.</p>
              ) : (
                <ul className="bars">
                  {categories.map((c) => (
                    <li key={c.category}>
                      <span className="bar-label">{cap(c.category)}</span>
                      <span className="bar-track">
                        <span className="bar-fill" style={{ width: `${(c.total / categories[0].total) * 100}%` }} />
                      </span>
                      <span className="bar-value tnum">
                        {fmtMoney(c.total)} <span className="bar-pct">{Math.round((c.total / total) * 100)}%</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="report-block" aria-labelledby="r-eff">
              <h2 id="r-eff" className="t-title3">
                Mileage
              </h2>
              {effRows.length < 2 ? (
                <p className="report-empty">Needs 3 full-tank fill-ups.</p>
              ) : (
                <>
                  <p className="report-sub">{fmtDec(averageEfficiency(effRows) ?? 0)} km/L average in this period</p>
                  <EfficiencyChart rows={effRows.map((r) => ({ date: r.date, value: r.efficiency! }))} />
                </>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- charts */
// SVG geometry (viewBox units), not design values.
const W = 600;
const H = 220;
const PAD = { l: 8, r: 8, t: 32, b: 28 };
const GAP = 2;

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
}

/** Pointer scrubbing shared by both charts: maps x to a data index, ticks once per new point. */
function useScrub(count: number, indexAt: (xRatio: number) => number) {
  const [index, setIndex] = useState<number | null>(null);
  const last = useRef<number | null>(null);
  const update = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.max(0, Math.min(count - 1, indexAt((e.clientX - box.left) / box.width)));
    if (i !== last.current) {
      last.current = i;
      haptic('selection');
      setIndex(i);
    }
  };
  const end = () => {
    last.current = null;
    setIndex(null);
  };
  return { index, handlers: { onPointerDown: update, onPointerMove: update, onPointerLeave: end, onPointerCancel: end } };
}

function MonthChart({ months }: { months: MonthCost[] }) {
  const max = niceMax(Math.max(...months.map((m) => m.fuel + m.other)));
  const plotH = H - PAD.t - PAD.b;
  const slot = (W - PAD.l - PAD.r) / months.length;
  const barW = Math.min(36, slot * 0.6);
  const y = (v: number) => PAD.t + plotH - (v / max) * plotH;
  const scrub = useScrub(months.length, (r) => Math.floor((r * W - PAD.l) / slot));
  const hover = scrub.index;

  return (
    <div className="chart">
      <div className="legend">
        <span>
          <i className="series-1" /> Fuel
        </span>
        <span>
          <i className="series-2" /> Service and other
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Monthly spend, fuel and other costs stacked. The table view has the same numbers." {...scrub.handlers}>
        <line x1={PAD.l} x2={W - PAD.r} y1={y(max / 2)} y2={y(max / 2)} className="grid" />
        <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} className="axis" />
        {months.map((m, i) => {
          const x = PAD.l + slot * i + (slot - barW) / 2;
          return (
            <g key={m.month} opacity={hover === null || hover === i ? 1 : 0.45}>
              {m.fuel > 0 && <rect x={x} y={y(m.fuel)} width={barW} height={y(0) - y(m.fuel)} rx={m.other > 0 ? 0 : 4} className="series-1" />}
              {m.other > 0 && (
                <rect x={x} y={y(m.fuel + m.other) - (m.fuel > 0 ? GAP : 0)} width={barW} height={Math.max(y(0) - y(m.other), 1)} rx={4} className="series-2" />
              )}
              {(i % Math.ceil(months.length / 12) === 0 || months.length <= 12) && (
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" className="tick">
                  {monthLabel(m.month)}
                </text>
              )}
            </g>
          );
        })}
        <text x={W - PAD.r} y={y(max) - 8} textAnchor="end" className="tick">
          {fmtMoney(max)}
        </text>
      </svg>
      {hover !== null && (
        <div className="tooltip" style={{ left: `${((PAD.l + slot * (hover + 0.5)) / W) * 100}%` }} role="status">
          <strong>{monthLabel(months[hover].month, true)}</strong>
          <div className="tnum">Fuel {fmtMoney(months[hover].fuel)}</div>
          <div className="tnum">Other {fmtMoney(months[hover].other)}</div>
          <div className="tooltip-total tnum">Total {fmtMoney(months[hover].fuel + months[hover].other)}</div>
        </div>
      )}
    </div>
  );
}

function MonthTable({ months }: { months: MonthCost[] }) {
  return (
    <ListGroup label="Monthly spend">
      {[...months].reverse().map((m) => (
        <li key={m.month} className="ui-row-item">
          <div className="ui-row table-row">
            <span className="ui-row-text">
              <span className="ui-row-title">{monthLabel(m.month, true)}</span>
              <span className="ui-row-subtitle tnum">
                Fuel {fmtMoney(m.fuel)} · Other {fmtMoney(m.other)}
              </span>
            </span>
            <span className="ui-row-value tnum">{fmtMoney(m.fuel + m.other)}</span>
          </div>
        </li>
      ))}
    </ListGroup>
  );
}

function EfficiencyChart({ rows }: { rows: { date: string; value: number }[] }) {
  const values = rows.map((r) => r.value);
  const lo = Math.floor(Math.min(...values) * 0.9);
  const hi = Math.ceil(Math.max(...values) * 1.05);
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (rows.length === 1 ? plotW / 2 : (i / (rows.length - 1)) * plotW);
  const y = (v: number) => PAD.t + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
  const path = rows.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r.value)}`).join(' ');
  const scrub = useScrub(rows.length, (r) => Math.round(((r * W - PAD.l) / plotW) * (rows.length - 1)));
  const hover = scrub.index;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Fuel efficiency per full tank, kilometres per litre" {...scrub.handlers}>
        <line x1={PAD.l} x2={W - PAD.r} y1={y(hi)} y2={y(hi)} className="grid" />
        <line x1={PAD.l} x2={W - PAD.r} y1={y(lo)} y2={y(lo)} className="axis" />
        <text x={W - PAD.r} y={y(hi) - 8} textAnchor="end" className="tick">
          {hi} km/L
        </text>
        <text x={W - PAD.r} y={y(lo) - 6} textAnchor="end" className="tick">
          {lo}
        </text>
        <path d={path} className="line" />
        {hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={y(lo)} className="crosshair" />
            <circle cx={x(hover)} cy={y(rows[hover].value)} r={5} className="dot" />
          </>
        )}
        <text x={PAD.l} y={H - 8} className="tick">
          {fmtDate(rows[0].date)}
        </text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" className="tick">
          {fmtDate(rows[rows.length - 1].date)}
        </text>
      </svg>
      {hover !== null && (
        <div className="tooltip" style={{ left: `${(x(hover) / W) * 100}%` }} role="status">
          <strong>{fmtDate(rows[hover].date)}</strong>
          <div className="tnum">{fmtDec(rows[hover].value)} km/L</div>
        </div>
      )}
    </div>
  );
}
