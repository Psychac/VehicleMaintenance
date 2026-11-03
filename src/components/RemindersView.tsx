import { useState, type FormEvent } from 'react';
import { currentOdometer, reminderStatus } from '../lib/calc';
import { deleteRow, insertRow, updateRow } from '../lib/db';
import { fmtDate, fmtKm, numOrNull, strOrNull, today } from '../lib/format';
import type { Reminder } from '../lib/types';
import { IconBell, IconPlus } from './icons';
import Modal from './Modal';
import { ReminderBadge, dueText } from './ReminderBadge';
import { confirmDelete, type VehicleScope } from './shared';

const SUGGESTIONS = [
  'Engine oil & filter',
  'Air filter',
  'Cabin filter',
  'Tyre rotation',
  'Brake fluid',
  'Coolant',
  'Battery check',
  'Insurance renewal',
  'Pollution (PUC) certificate',
  'Wheel alignment',
];

export default function RemindersView({
  vehicle,
  fuel,
  service,
  reminders,
  reload,
}: VehicleScope & { reload: () => Promise<void> }) {
  const [editing, setEditing] = useState<Reminder | 'new' | null>(null);
  const [completing, setCompleting] = useState<Reminder | null>(null);
  const odo = currentOdometer(vehicle, fuel, service);
  const todayIso = today();
  const order = { overdue: 0, soon: 1, unknown: 2, ok: 3 };
  const rows = reminders
    .map((r) => ({ r, s: reminderStatus(r, odo, todayIso) }))
    .sort((a, b) => order[a.s.state] - order[b.s.state] || a.r.title.localeCompare(b.r.title));

  return (
    <div className="stack">
      <div className="card-head">
        <div>
          <h2>Reminders</h2>
          <p className="muted small">
            Due by distance, time, or whichever comes first · odometer {fmtKm(odo)}
          </p>
        </div>
        <button className="primary" onClick={() => setEditing('new')}>
          <IconPlus size={16} /> Add reminder
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="empty card">
          <span className="empty-icon">
            <IconBell size={28} />
          </span>
          <h2>No reminders yet</h2>
          <p className="muted">Track oil changes, tyre rotation, insurance renewal and more so nothing sneaks up on you.</p>
          <button className="primary" onClick={() => setEditing('new')}>
            <IconPlus size={16} /> Add a reminder
          </button>
        </div>
      ) : (
        <ul className="list card">
          {rows.map(({ r, s }) => (
            <li key={r.id} className={`status-${s.state}`}>
              <div className="clickable grow" onClick={() => setEditing(r)}>
                <strong>{r.title}</strong>
                <div className="muted small">
                  Every {[r.interval_km && fmtKm(Number(r.interval_km)), r.interval_months && `${r.interval_months} months`]
                    .filter(Boolean)
                    .join(' or ')}
                  {r.last_done_date && ` · last done ${fmtDate(r.last_done_date)}`}
                  {r.last_done_odometer != null && ` at ${fmtKm(Number(r.last_done_odometer))}`}
                </div>
                <div className="small">{dueText(s)}</div>
              </div>
              <div className="col-end">
                <ReminderBadge status={s} />
                <button className="small-btn" onClick={() => setCompleting(r)}>
                  Mark done
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {completing && (
        <DoneForm
          reminder={completing}
          suggestedOdo={odo}
          onClose={() => setCompleting(null)}
          onSaved={async () => {
            setCompleting(null);
            await reload();
          }}
        />
      )}
      {editing && (
        <ReminderForm
          vehicleId={vehicle.id}
          reminder={editing === 'new' ? null : editing}
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

function ReminderForm({
  vehicleId,
  reminder,
  onClose,
  onSaved,
}: {
  vehicleId: string;
  reminder: Reminder | null;
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
      title: String(f.get('title')).trim(),
      interval_km: numOrNull(f.get('interval_km')),
      interval_months: numOrNull(f.get('interval_months')),
      last_done_date: strOrNull(f.get('last_done_date')),
      last_done_odometer: numOrNull(f.get('last_done_odometer')),
      notes: strOrNull(f.get('notes')),
    };
    if (!row.interval_km && !row.interval_months) {
      setErr('Set a distance interval, a time interval, or both.');
      return;
    }
    setBusy(true);
    try {
      if (reminder) await updateRow('reminders', reminder.id, row);
      else await insertRow('reminders', row);
      await onSaved();
    } catch (ex) {
      setErr((ex as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!reminder || !confirmDelete('reminder')) return;
    setBusy(true);
    try {
      await deleteRow('reminders', reminder.id);
      await onSaved();
    } catch (ex) {
      setErr((ex as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={reminder ? 'Edit reminder' : 'Add reminder'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Item
          <input name="title" list="reminder-suggestions" defaultValue={reminder?.title ?? ''} required />
          <datalist id="reminder-suggestions">
            {SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <div className="row">
          <label>
            Every (km)
            <input name="interval_km" type="number" inputMode="numeric" min="0" step="any" defaultValue={reminder?.interval_km ?? ''} />
          </label>
          <label>
            Every (months)
            <input
              name="interval_months"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              defaultValue={reminder?.interval_months ?? ''}
            />
          </label>
        </div>
        <div className="row">
          <label>
            Last done on
            <input name="last_done_date" type="date" defaultValue={reminder?.last_done_date ?? ''} />
          </label>
          <label>
            Last done at (km)
            <input
              name="last_done_odometer"
              type="number"
              inputMode="numeric"
              min="0"
              step="any"
              defaultValue={reminder?.last_done_odometer ?? ''}
            />
          </label>
        </div>
        <label>
          Notes
          <textarea name="notes" rows={2} defaultValue={reminder?.notes ?? ''} placeholder="e.g. 5W-30 synthetic, 3.5 L" />
        </label>
        {err && <p className="form-msg">{err}</p>}
        <div className="form-actions">
          {reminder && (
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

/** Records that a reminder's task was just done, resetting its due distance and date. */
function DoneForm({
  reminder,
  suggestedOdo,
  onClose,
  onSaved,
}: {
  reminder: Reminder;
  suggestedOdo: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await updateRow('reminders', reminder.id, {
        last_done_date: String(f.get('date')),
        last_done_odometer: numOrNull(f.get('odometer')) ?? reminder.last_done_odometer,
      });
      await onSaved();
    } catch (ex) {
      setErr((ex as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={`Mark done: ${reminder.title}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="row">
          <label>
            Date done
            <input name="date" type="date" defaultValue={today()} required />
          </label>
          <label>
            Odometer (km)
            <input
              name="odometer"
              type="number"
              inputMode="numeric"
              min="0"
              step="any"
              defaultValue={suggestedOdo}
            />
          </label>
        </div>
        {err && <p className="form-msg">{err}</p>}
        <div className="form-actions">
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
