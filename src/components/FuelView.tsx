import { useState, type FormEvent } from 'react';
import { averageEfficiency, currentOdometer, fuelEfficiency } from '../lib/calc';
import { deleteRow, insertRow, updateRow } from '../lib/db';
import { fmtDate, fmtDec, fmtKm, fmtMoney, numOrNull, strOrNull, today } from '../lib/format';
import type { FuelLog } from '../lib/types';
import { IconFuel, IconPlus } from './icons';
import Modal from './Modal';
import PageHeader from './PageHeader';
import { confirmDelete, type VehicleScope } from './shared';

export default function FuelView({
  vehicle,
  fuel,
  service,
  reload,
  openNew,
}: VehicleScope & { reload: () => Promise<void>; openNew?: boolean }) {
  const [editing, setEditing] = useState<FuelLog | 'new' | null>(openNew ? 'new' : null);
  const rows = fuelEfficiency(fuel).reverse();
  const odo = currentOdometer(vehicle, fuel, service);
  const avg = averageEfficiency(rows);

  return (
    <div className="stack">
      <PageHeader
        title="Fuel log"
        subtitle={[
          `${rows.length} fill-up${rows.length === 1 ? '' : 's'}`,
          avg ? `${fmtDec(avg)} km/L avg` : null,
          fmtMoney(rows.reduce((t, r) => t + Number(r.total_cost), 0)),
        ]
          .filter(Boolean)
          .join(' · ')}
        action={
          <button className="primary" onClick={() => setEditing('new')}>
            <IconPlus size={16} /> Add fill-up
          </button>
        }
      />
      {rows.length === 0 ? (
        <div className="empty card">
          <span className="empty-icon">
            <IconFuel size={28} />
          </span>
          <h2>No fill-ups yet</h2>
          <p className="muted">
            Log each fill with the fuel left before filling, or fill to full each time: efficiency is calculated between
            consecutive fills that have a known tank level.
          </p>
          <button className="primary" onClick={() => setEditing('new')}>
            <IconPlus size={16} /> Add your first fill-up
          </button>
        </div>
      ) : (
        <div className="table-wrap card">
          <table className="stack-table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="num">Odometer</th>
                <th className="num">Litres</th>
                <th className="num">Cost</th>
                <th className="num">Per litre</th>
                <th className="num">km/L</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => setEditing(r)}>
                  <td className="cell-main">
                    {fmtDate(r.date)}
                    {!r.full_tank && <span className="tag">partial</span>}
                  </td>
                  <td className="num" data-label="Odometer">{fmtKm(Number(r.odometer))}</td>
                  <td className="num" data-label="Litres">{fmtDec(Number(r.litres))}</td>
                  <td className="num" data-label="Cost">{fmtMoney(Number(r.total_cost))}</td>
                  <td className="num" data-label="Per litre">
                    {Number(r.litres) > 0 ? fmtDec(Number(r.total_cost) / Number(r.litres)) : '—'}
                  </td>
                  <td className="num cell-eff" data-label="km/L">{r.efficiency !== null ? fmtDec(r.efficiency) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <FuelForm
          vehicleId={vehicle.id}
          log={editing === 'new' ? null : editing}
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

function FuelForm({
  vehicleId,
  log,
  suggestedOdo,
  onClose,
  onSaved,
}: {
  vehicleId: string;
  log: FuelLog | null;
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
      odometer: numOrNull(f.get('odometer')) ?? 0,
      litres: numOrNull(f.get('litres')) ?? 0,
      total_cost: numOrNull(f.get('total_cost')) ?? 0,
      full_tank: f.get('full_tank') === 'on',
      remaining_litres: numOrNull(f.get('remaining_litres')),
      station: strOrNull(f.get('station')),
      notes: strOrNull(f.get('notes')),
    };
    setBusy(true);
    try {
      if (log) await updateRow('fuel_logs', log.id, row);
      else await insertRow('fuel_logs', row);
      await onSaved();
    } catch (ex) {
      setErr((ex as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!log || !confirmDelete('fill-up')) return;
    setBusy(true);
    try {
      await deleteRow('fuel_logs', log.id);
      await onSaved();
    } catch (ex) {
      setErr((ex as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={log ? 'Edit fill-up' : 'Add fill-up'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
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
              required
            />
          </label>
        </div>
        <div className="row">
          <label>
            Litres
            <input name="litres" type="number" inputMode="decimal" min="0" step="any" defaultValue={log?.litres ?? ''} required />
          </label>
          <label>
            Total cost
            <input
              name="total_cost"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              defaultValue={log?.total_cost ?? ''}
              required
            />
          </label>
        </div>
        <label>
          Fuel left before filling (litres, optional)
          <input
            name="remaining_litres"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            defaultValue={log?.remaining_litres ?? ''}
            placeholder="from the dashboard display"
          />
        </label>
        <label className="check">
          <input name="full_tank" type="checkbox" defaultChecked={log?.full_tank ?? true} />
          Filled to full tank
        </label>
        <label>
          Station
          <input name="station" defaultValue={log?.station ?? ''} />
        </label>
        <label>
          Notes
          <textarea name="notes" rows={2} defaultValue={log?.notes ?? ''} />
        </label>
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
