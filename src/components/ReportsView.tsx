import { useState } from 'react';
import { averageEfficiency, costsByCategory, fuelEfficiency, monthlyCosts, type MonthCost } from '../lib/calc';
import { fmtDate, fmtDec, fmtMoney, today } from '../lib/format';
import PageHeader from './PageHeader';
import type { VehicleScope } from './shared';

const monthLabel = (ym: string, long = false) =>
  new Date(ym + '-01T00:00:00').toLocaleDateString(undefined, long ? { month: 'long', year: 'numeric' } : { month: 'short' });

export default function ReportsView({ fuel, service }: VehicleScope) {
  const [range, setRange] = useState(12);
  const [asTable, setAsTable] = useState(false);
  const months = monthlyCosts({ fuel_logs: fuel, service_logs: service }, today().slice(0, 7), range);
  const first = months[0].month;
  const inRange = <T extends { date: string }>(rows: T[]) => rows.filter((r) => r.date.slice(0, 7) >= first);
  const categories = costsByCategory(inRange(fuel), inRange(service));
  const total = categories.reduce((s, c) => s + c.total, 0);
  const effRows = fuelEfficiency(fuel).filter((r) => r.efficiency !== null && r.date.slice(0, 7) >= first);

  return (
    <div className="stack">
      <PageHeader
        title="Reports"
        subtitle={`${fmtMoney(total)} over ${range} months · ${fmtMoney(total / range)}/month`}
        action={
          <div className="seg" role="group" aria-label="Range">
            {[6, 12, 24].map((n) => (
              <button key={n} className={range === n ? 'active' : ''} onClick={() => setRange(n)}>
                {n} mo
              </button>
            ))}
          </div>
        }
      />

      <div className="bento-reports">
      <section className="card">
        <div className="card-head">
          <h3>Monthly spend</h3>
          <button className="link" onClick={() => setAsTable(!asTable)}>
            {asTable ? 'Show chart' : 'Show table'}
          </button>
        </div>
        {asTable ? <MonthTable months={months} /> : <MonthChart months={months} />}
      </section>

      <section className="card">
        <h3>By category</h3>
        {categories.length === 0 ? (
          <p className="muted">No spending in this period.</p>
        ) : (
          <ul className="bars">
            {categories.map((c) => (
              <li key={c.category}>
                <span className="bar-label">{c.category}</span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ width: `${(c.total / categories[0].total) * 100}%` }} />
                </span>
                <span className="num">
                  {fmtMoney(c.total)} <span className="muted small">{Math.round((c.total / total) * 100)}%</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h3>Fuel efficiency</h3>
        {effRows.length < 2 ? (
          <p className="muted">Log at least three full-tank fill-ups to see a trend.</p>
        ) : (
          <>
            <div className="muted small">Average {fmtDec(averageEfficiency(effRows) ?? 0)} km/L in this period</div>
            <EfficiencyChart rows={effRows.map((r) => ({ date: r.date, value: r.efficiency! }))} />
          </>
        )}
      </section>
      </div>
    </div>
  );
}

const W = 600;
const H = 220;
const PAD = { l: 8, r: 8, t: 12, b: 24 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
}

function MonthChart({ months }: { months: MonthCost[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...months.map((m) => m.fuel + m.other)));
  const plotH = H - PAD.t - PAD.b;
  const slot = (W - PAD.l - PAD.r) / months.length;
  const barW = Math.min(36, slot * 0.6);
  const y = (v: number) => PAD.t + plotH - (v / max) * plotH;
  const GAP = 2;

  return (
    <div className="chart">
      <div className="legend">
        <span>
          <i style={{ background: 'var(--series-1)' }} /> Fuel
        </span>
        <span>
          <i style={{ background: 'var(--series-2)' }} /> Service &amp; other
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Monthly spend, fuel and other costs stacked">
        {[0.5, 1].map((f) => (
          <line key={f} x1={PAD.l} x2={W - PAD.r} y1={y(max * f)} y2={y(max * f)} className="grid" />
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} className="axis" />
        {months.map((m, i) => {
          const x = PAD.l + slot * i + (slot - barW) / 2;
          const fuelH = y(0) - y(m.fuel);
          const otherH = y(0) - y(m.other);
          return (
            <g key={m.month} opacity={hover === null || hover === i ? 1 : 0.55}>
              {m.fuel > 0 && (
                <rect x={x} y={y(m.fuel)} width={barW} height={fuelH} rx={m.other > 0 ? 0 : 4} fill="var(--series-1)" />
              )}
              {m.other > 0 && (
                <rect
                  x={x}
                  y={y(m.fuel + m.other) - (m.fuel > 0 ? GAP : 0)}
                  width={barW}
                  height={Math.max(otherH, 1)}
                  rx={4}
                  fill="var(--series-2)"
                />
              )}
              {(i % Math.ceil(months.length / 12) === 0 || months.length <= 12) && (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" className="tick">
                  {monthLabel(m.month)}
                </text>
              )}
              <rect
                x={PAD.l + slot * i}
                y={PAD.t}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(hover === i ? null : i)}
              />
            </g>
          );
        })}
        <text x={W - PAD.r} y={y(max) - 2} textAnchor="end" className="tick">
          {fmtMoney(max)}
        </text>
      </svg>
      {hover !== null && (
        <div
          className="tooltip"
          style={{ left: `${((PAD.l + slot * (hover + 0.5)) / W) * 100}%` }}
          role="status"
        >
          <strong>{monthLabel(months[hover].month, true)}</strong>
          <div>
            <i style={{ background: 'var(--series-1)' }} /> Fuel {fmtMoney(months[hover].fuel)}
          </div>
          <div>
            <i style={{ background: 'var(--series-2)' }} /> Other {fmtMoney(months[hover].other)}
          </div>
          <div className="muted">Total {fmtMoney(months[hover].fuel + months[hover].other)}</div>
        </div>
      )}
    </div>
  );
}

function MonthTable({ months }: { months: MonthCost[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th className="num">Fuel</th>
            <th className="num">Service &amp; other</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {[...months].reverse().map((m) => (
            <tr key={m.month}>
              <td>{monthLabel(m.month, true)}</td>
              <td className="num">{fmtMoney(m.fuel)}</td>
              <td className="num">{fmtMoney(m.other)}</td>
              <td className="num">{fmtMoney(m.fuel + m.other)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EfficiencyChart({ rows }: { rows: { date: string; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const values = rows.map((r) => r.value);
  const lo = Math.floor(Math.min(...values) * 0.9);
  const hi = Math.ceil(Math.max(...values) * 1.05);
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (rows.length === 1 ? plotW / 2 : (i / (rows.length - 1)) * plotW);
  const y = (v: number) => PAD.t + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
  const path = rows.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r.value)}`).join(' ');

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Fuel efficiency per full tank, km per litre"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * W;
          const i = Math.round(((px - PAD.l) / plotW) * (rows.length - 1));
          setHover(Math.max(0, Math.min(rows.length - 1, i)));
        }}
      >
        <line x1={PAD.l} x2={W - PAD.r} y1={y(hi)} y2={y(hi)} className="grid" />
        <line x1={PAD.l} x2={W - PAD.r} y1={y(lo)} y2={y(lo)} className="axis" />
        <text x={W - PAD.r} y={y(hi) - 2} textAnchor="end" className="tick">
          {hi} km/L
        </text>
        <text x={W - PAD.r} y={y(lo) - 4} textAnchor="end" className="tick">
          {lo}
        </text>
        <path d={path} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" />
        {hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={y(lo)} className="crosshair" />
            <circle cx={x(hover)} cy={y(rows[hover].value)} r={5} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
          </>
        )}
        <text x={PAD.l} y={H - 6} className="tick">
          {fmtDate(rows[0].date)}
        </text>
        <text x={W - PAD.r} y={H - 6} textAnchor="end" className="tick">
          {fmtDate(rows[rows.length - 1].date)}
        </text>
      </svg>
      {hover !== null && (
        <div className="tooltip" style={{ left: `${(x(hover) / W) * 100}%` }} role="status">
          <strong>{fmtDate(rows[hover].date)}</strong>
          <div>{fmtDec(rows[hover].value)} km/L</div>
        </div>
      )}
    </div>
  );
}
