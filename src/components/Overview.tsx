import { averageEfficiency, currentOdometer, fuelEfficiency, reminderStatus } from '../lib/calc';
import { fmtDate, fmtDec, fmtKm, fmtMoney, today } from '../lib/format';
import { ReminderBadge, dueText } from './ReminderBadge';
import type { VehicleScope } from './shared';

type Tab = 'fuel' | 'service' | 'reminders';

export default function Overview({
  vehicle,
  fuel,
  service,
  reminders,
  onNavigate,
}: VehicleScope & { onNavigate: (t: Tab) => void }) {
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
    ...fuel.map((f) => ({ id: f.id, date: f.date, text: `Fuel · ${fmtDec(Number(f.litres))} L`, cost: Number(f.total_cost) })),
    ...service.map((s) => ({ id: s.id, date: s.date, text: s.title, cost: Number(s.cost) })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  return (
    <div className="stack">
      <section className="stats">
        <Stat label="Odometer" value={fmtKm(odo)} />
        <Stat
          label="Average"
          value={avg ? `${fmtDec(avg)} km/L` : '—'}
          hint={last ? `last tank ${fmtDec(last)} km/L` : undefined}
        />
        <Stat label="This month" value={fmtMoney(monthSpend)} />
        <Stat
          label="Cost per km"
          value={driven > 0 && totalSpend > 0 ? fmtMoney(totalSpend / driven) : '—'}
          hint={driven > 0 ? `over ${fmtKm(driven)} tracked` : undefined}
        />
      </section>

      <div className="actions">
        <button className="primary" onClick={() => onNavigate('fuel')}>
          + Fuel
        </button>
        <button onClick={() => onNavigate('service')}>+ Service / expense</button>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Needs attention</h2>
          <button className="link" onClick={() => onNavigate('reminders')}>
            All reminders
          </button>
        </div>
        {reminders.length === 0 ? (
          <p className="muted">No reminders yet. Add things like oil change, tyre rotation or insurance renewal.</p>
        ) : attention.length === 0 ? (
          <p className="muted">All {reminders.length} reminders are on track.</p>
        ) : (
          <ul className="list">
            {attention.map(({ r, s }) => (
              <li key={r.id}>
                <div>
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
          <p className="muted">Nothing logged yet.</p>
        ) : (
          <ul className="list">
            {recent.map((x) => (
              <li key={x.id}>
                <div>
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
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat card">
      <div className="muted small">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="muted small">{hint}</div>}
    </div>
  );
}
