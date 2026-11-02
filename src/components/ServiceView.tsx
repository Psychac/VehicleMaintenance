import { useState, type FormEvent } from 'react';
import { currentOdometer } from '../lib/calc';
import { deleteRow, insertRow, updateRow } from '../lib/db';
import { fmtDate, fmtKm, fmtMoney, numOrNull, strOrNull, today } from '../lib/format';
import { SERVICE_CATEGORIES, type Reminder, type ServiceLog } from '../lib/types';
import Modal from './Modal';
import { confirmDelete, type VehicleScope } from './shared';

export default function ServiceView({
  vehicle,
  fuel,
  service,
  reminders,
  reload,
}: VehicleScope & { reload: () => Promise<void> }) {
  const [editing, setEditing] = useState<ServiceLog | 'new' | null>(null);
  const [filter, setFilter] = useState('all');
  const odo = currentOdometer(vehicle, fuel, service);
  const rows = service
    .filter((s) => filter === 'all' || s.category === filter)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="stack">
      <div className="card-head">
        <h2>Service &amp; expenses</h2>
        <button className="primary" onClick={() => setEditing('new')}>
          + Add entry
        </button>
      </div>
      <select aria-label="Category filter" value={filter} onChange={(e) => setFilter(e.target.value)} className="filter">
        <option value="all">All categories</option>
        {SERVICE_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {rows.length === 0 ? (
        <p className="muted card">No entries yet. Log services, repairs, tyres, insurance and other running costs here.</p>
      ) : (
        <ul className="list card">
          {rows.map((s) => (
            <li key={s.id} className="clickable" onClick={() => setEditing(s)}>
              <div>
                <strong>{s.title}</strong> <span className="tag">{s.category}</span>
                <div className="muted small">
                  {fmtDate(s.date)}
                  {s.odometer != null && ` · ${fmtKm(Number(s.odometer))}`}
                  {s.vendor && ` · ${s.vendor}`}
                </div>
                {s.notes && <div className="small">{s.notes}</div>}
              </div>
              <span className="num">{fmtMoney(Number(s.cost))}</span>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <ServiceForm
          vehicleId={vehicle.id}
          log={editing === 'new' ? null : editing}
          reminders={reminders}
          suggestedOdo={odo}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}
    </div>
  );
}

function ServiceForm({
  vehicleId,
  log,
  reminders,
  suggestedOdo,
  onClose,
  onSaved,
}: {
  vehicleId: string;
  log: ServiceLog | null;
  reminders: Reminder[];
  suggestedOdo: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const row = {
      vehicle_id: vehicleId,
      date: String(f.get('date')),
      odometer: numOrNull(f.get('odometer')),
      category: String(f.get('category')),
      title: String(f.get('title')).trim(),
      cost: numOrNull(f.get('cost')) ?? 0,
      vendor: strOrNull(f.get('vendor')),
      notes: strOrNull(f.get('notes')),
    };
    const completes = f.getAll('completes').map(String);
    setBusy(true);
    try {
      if (log) await updateRow('service_logs', log.id, row);
      else await insertRow('service_logs', row);
      // Reset the interval of every reminder this job takes care of.
      for (const id of completes) {
        await updateRow('reminders', id, {
          last_done_date: row.date,
          ...(row.odometer !== null ? { last_done_odometer: row.odometer } : {}),
        });
      }
      await onSaved();
    } catch (ex) {
      setErr((ex as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!log || !confirmDelete('entry')) return;
    setBusy(true);
    try {
      await deleteRow('service_logs', log.id);
      await onSaved();
    } catch (ex) {
      setErr((ex as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={log ? 'Edit entry' : 'Add service / expense'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          What was done
          <input name="title" defaultValue={log?.title ?? ''} placeholder="e.g. 10,000 km service" required />
        </label>
        <div className="row">
          <label>
            Category
            <select name="category" defaultValue={log?.category ?? 'service'}>
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cost
            <input name="cost" type="number" inputMode="decimal" min="0" step="any" defaultValue={log?.cost ?? ''} required />
          </label>
        </div>
        <div className="row">
          <label>
            Date
            <input name="date" type="date" defaultValue={log?.date ?? today()} required />
          </label>
          <label>
            Odometer (km)
            <input
              name="odometer"
              type="number"
              inputMode="numeric"
              min="0"
              step="any"
              defaultValue={log?.odometer ?? ''}
              placeholder={`last ${suggestedOdo}`}
            />
          </label>
        </div>
        <label>
          Garage / vendor
          <input name="vendor" defaultValue={log?.vendor ?? ''} />
        </label>
        <label>
          Notes
          <textarea name="notes" rows={2} defaultValue={log?.notes ?? ''} />
        </label>
        {reminders.length > 0 && (
          <fieldset>
            <legend>This takes care of (resets the reminder)</legend>
            {reminders.map((r) => (
              <label key={r.id} className="check">
                <input type="checkbox" name="completes" value={r.id} />
                {r.title}
              </label>
            ))}
          </fieldset>
        )}
        {err && <p className="form-msg">{err}</p>}
        <div className="form-actions">
          {log && (
            <button type="button" className="danger" onClick={remove} disabled={busy}>
              Delete
            </button>
          )}
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
