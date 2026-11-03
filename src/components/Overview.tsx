import type { ReactNode } from 'react';
import { averageEfficiency, currentOdometer, fuelEfficiency, reminderStatus } from '../lib/calc';
import { fmtDate, fmtDec, fmtKm, fmtMoney, today } from '../lib/format';
import { ReminderBadge, dueText } from './ReminderBadge';
import { IconAlert, IconCheck, IconClock, IconDroplet, IconFuel, IconGauge, IconPlus, IconRoute, IconWallet, IconWrench } from './icons';
import type { VehicleScope } from './shared';

type Tab = 'fuel' | 'service' | 'reminders';

export default function Overview({
  vehicle,
  fuel,
  service,
  reminders,
  onNavigate,
}: VehicleScope & { onNavigate: (t: Tab, add?: boolean) => void }) {
  const odo = currentOdometer(vehicle, fuel, service);
  const rows = fuelEfficiency(fuel);
  const avg = averageEfficiency(rows);
  const last = [...rows].reverse().find((r) => r.efficiency !== null)?.efficiency ?? null;

  const todayIso = today();
  const month = todayIso.slice(0, 7);
  const monthSpend =
    fuel.filter((f) => f.date.startsWith(month)).reduce((s, f) => s + Number(f.total_cost), 0) +
    service.filter((s) => s.date.startsWith(month)).reduce((s, x) => s + Number(x.cost), 0);

  const totalSpend =
    fuel.reduce((s, f) => s + Number(f.total_cost), 0) + service.reduce((s, x) => s + Number(x.cost), 0);
  const driven = odo - (Number(vehicle.start_odometer) || 0);

  const order = { overdue: 0, soon: 1, unknown: 2, ok: 3 };
  const statuses = reminders
    .map((r) => ({ r, s: reminderStatus(r, odo, todayIso) }))
    .sort((a, b) => order[a.s.state] - order[b.s.state]);
  const attention = statuses.filter((x) => x.s.state !== 'ok');

  const recent = [
    ...fuel.map((f) => ({ id: f.id, kind: 'fuel' as const, date: f.date, text: `Fuel · ${fmtDec(Number(f.litres))} L`, cost: Number(f.total_cost) })),
    ...service.map((s) => ({ id: s.id, kind: 'service' as const, date: s.date, text: s.title, cost: Number(s.cost) })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  const details = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');

  return (
    <div className="stack">
      <section className="hero">
        <div className="hero-main">
          <div className="hero-eyebrow">{details || 'Your vehicle'}</div>
          <h1 className="hero-title">{vehicle.name}</h1>
          <div className="hero-meta">
            {vehicle.plate && <span className="plate">{vehicle.plate}</span>}
            <span>{vehicle.fuel_type}</span>
          </div>
        </div>
        <div className="hero-odo">
          <div className="hero-odo-label">Odometer</div>
          <div className="hero-odo-value">{fmtKm(odo)}</div>
        </div>
      </section>

      <div className="quick">
        <button className="primary" onClick={() => onNavigate('fuel', true)}>
          <IconFuel size={18} /> Log fuel
        </button>
        <button onClick={() => onNavigate('service', true)}>
          <IconWrench size={18} /> Log service / expense
        </button>
      </div>

      <section className="stats">
        <Stat
          icon={<IconDroplet size={18} />}
          label="Average"
          value={avg ? `${fmtDec(avg)} km/L` : '—'}
          hint={last ? `last tank ${fmtDec(last)} km/L` : 'needs two fill-ups'}
        />
        <Stat icon={<IconWallet size={18} />} label="This month" value={fmtMoney(monthSpend)} hint="fuel + service" />
        <Stat
          icon={<IconRoute size={18} />}
          label="Cost per km"
          value={driven > 0 && totalSpend > 0 ? fmtMoney(totalSpend / driven) : '—'}
          hint={driven > 0 ? `over ${fmtKm(driven)} tracked` : undefined}
        />
        <Stat icon={<IconGauge size={18} />} label="Total spent" value={fmtMoney(totalSpend)} hint="all time" />
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Needs attention</h2>
            <button className="link" onClick={() => onNavigate('reminders')}>
              All reminders
            </button>
          </div>
          {reminders.length === 0 ? (
            <div className="mini-empty">
              <p className="muted">No reminders yet. Add things like oil change, tyre rotation or insurance renewal.</p>
              <button onClick={() => onNavigate('reminders', true)}>
                <IconPlus size={16} /> Add a reminder
              </button>
            </div>
          ) : attention.length === 0 ? (
            <p className="all-good">
              <IconCheck size={18} /> All {reminders.length} reminders are on track.
            </p>
          ) : (
            <ul className="list">
              {attention.map(({ r, s }) => (
                <li key={r.id} className={`status-${s.state}`}>
                  <span className={`status-icon ${s.state}`}>
                    {s.state === 'overdue' ? <IconAlert size={16} /> : <IconClock size={16} />}
                  </span>
                  <div className="grow">
                    <strong>{r.title}</strong>
                    <div className="muted small">{dueText(s)}</div>
                  </div>
                  <ReminderBadge status={s} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>Recent activity</h2>
          {recent.length === 0 ? (
            <p className="muted">Nothing logged yet. Your latest fill-ups and services will show up here.</p>
          ) : (
            <ul className="list">
              {recent.map((x) => (
                <li key={x.id}>
                  <span className={`status-icon ${x.kind}`}>
                    {x.kind === 'fuel' ? <IconFuel size={16} /> : <IconWrench size={16} />}
                  </span>
                  <div className="grow">
                    {x.text}
                    <div className="muted small">{fmtDate(x.date)}</div>
                  </div>
                  <span className="num">{fmtMoney(x.cost)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="stat card">
      <div className="stat-label">
        <span className="stat-icon">{icon}</span>
        {label}
      </div>
      <div className="stat-value">{value}</div>
      {hint && <div className="muted small">{hint}</div>}
    </div>
  );
}
