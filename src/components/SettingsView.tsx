import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  dataToSqliteFile,
  deleteRow,
  insertRow,
  isLocalMode,
  restoreAll,
  sqliteFileToData,
  supabase,
  updateRow,
} from '../lib/db';
import { numOrNull, strOrNull, today } from '../lib/format';
import type { AllData, BackupFile, Vehicle } from '../lib/types';
import Modal from './Modal';
import PageHeader from './PageHeader';
import StorageSettings from './StorageSettings';

export default function SettingsView({
  data,
  reload,
  onVehicleAdded,
}: {
  data: AllData;
  reload: () => Promise<void>;
  onVehicleAdded: (id: string) => void;
}) {
  const [editing, setEditing] = useState<Vehicle | 'new' | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  function exportJson() {
    const backup: BackupFile = { app: 'vehicle-log', version: 1, exported_at: new Date().toISOString(), data };
    download(`vehicle-log-${today()}.json`, JSON.stringify(backup, null, 2), 'application/json');
  }

  function exportCsv() {
    const names = new Map(data.vehicles.map((v) => [v.id, v.name]));
    const lines = [['type', 'vehicle', 'date', 'odometer', 'category', 'description', 'litres', 'cost'].join(',')];
    for (const f of data.fuel_logs) {
      lines.push(csv(['fuel', names.get(f.vehicle_id), f.date, f.odometer, 'fuel', f.station ?? '', f.litres, f.total_cost]));
    }
    for (const s of data.service_logs) {
      lines.push(csv(['service', names.get(s.vehicle_id), s.date, s.odometer ?? '', s.category, s.title, '', s.cost]));
    }
    download(`vehicle-log-${today()}.csv`, lines.join('\n'), 'text/csv');
  }

  async function exportSqlite() {
    try {
      const bytes = await dataToSqliteFile(data);
      download(`vehicle-log-${today()}.sqlite`, bytes, 'application/vnd.sqlite3');
    } catch (ex) {
      setMsg(`Export failed: ${(ex as Error).message}`);
    }
  }

  /** Restores a .json backup or a .sqlite database file into the current storage. */
  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      let restored: AllData;
      let when = '';
      if (/\.json$/i.test(file.name)) {
        const parsed = JSON.parse(await file.text()) as BackupFile;
        if (parsed.app !== 'vehicle-log' || !parsed.data) throw new Error('Not a Vehicle Log backup file.');
        restored = parsed.data;
        when = ` from ${parsed.exported_at.slice(0, 10)}`;
      } else {
        restored = await sqliteFileToData(new Uint8Array(await file.arrayBuffer()));
      }
      const counts = Object.entries(restored)
        .map(([k, v]) => `${v.length} ${k.replace('_', ' ')}`)
        .join(', ');
      if (!window.confirm(`Restore ${counts}${when}? Matching entries are overwritten; nothing is deleted.`)) return;
      await restoreAll(restored);
      await reload();
      setMsg('Backup restored.');
    } catch (ex) {
      setMsg(`Restore failed: ${(ex as Error).message}`);
    }
  }

  return (
    <div className="stack">
      <PageHeader title="Settings" subtitle="Vehicles, backup and storage" />
      <section className="card">
        <div className="card-head">
          <h2>Vehicles</h2>
          <button className="primary" onClick={() => setEditing('new')}>
            + Add vehicle
          </button>
        </div>
        {data.vehicles.length === 0 ? (
          <p className="muted">No vehicles yet.</p>
        ) : (
          <ul className="list">
            {data.vehicles.map((v) => (
              <li key={v.id} className="clickable" onClick={() => setEditing(v)}>
                <div>
                  <strong>{v.name}</strong> {v.archived && <span className="tag">archived</span>}
                  <div className="muted small">
                    {[v.year, v.make, v.model, v.plate].filter(Boolean).join(' · ') || 'No details'}
                  </div>
                </div>
                <span className="muted small">{v.fuel_type}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="bento-settings">
      <section className="card">
        <h2>Backup &amp; restore</h2>
        <p className="muted small">
          {isLocalMode
            ? 'Your data is in a SQLite database stored in this browser on this device. Clearing site data deletes it — download a copy regularly.'
            : 'Your data lives in your Supabase database. Export a copy any time, or run the scheduled backup script on your PC (see README).'}
        </p>
        <div className="actions">
          <button onClick={exportSqlite}>Download database (.sqlite)</button>
          <button onClick={exportJson}>Download backup (JSON)</button>
          <button onClick={exportCsv}>Export spreadsheet (CSV)</button>
          <label className="button">
            Restore from file…
            <input type="file" accept=".sqlite,.sqlite3,.db,application/json,.json" hidden onChange={importFile} />
          </label>
        </div>
        {msg && <p className="form-msg">{msg}</p>}
      </section>

      <section className="card">
        <h2>Storage</h2>
        <StorageSettings />
      </section>

      {!isLocalMode && (
        <section className="card">
          <h2>Account</h2>
          <p className="muted small">Signed in as {email ?? '…'}</p>
          <button onClick={() => supabase?.auth.signOut()}>Sign out</button>
        </section>
      )}

      </div>

      {editing && (
        <VehicleForm
          vehicle={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async (id) => {
            setEditing(null);
            await reload();
            if (id) onVehicleAdded(id);
          }}
        />
      )}
    </div>
  );
}

function csv(values: unknown[]) {
  return values
    .map((v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(',');
}

function download(name: string, content: string | Uint8Array, type: string) {
  const url = URL.createObjectURL(new Blob([content as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function VehicleForm({
  vehicle,
  onClose,
  onSaved,
}: {
  vehicle: Vehicle | null;
  onClose: () => void;
  onSaved: (newId?: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const row = {
      name: String(f.get('name')).trim(),
      make: strOrNull(f.get('make')),
      model: strOrNull(f.get('model')),
      year: numOrNull(f.get('year')),
      plate: strOrNull(f.get('plate')),
      fuel_type: String(f.get('fuel_type')),
      start_odometer: numOrNull(f.get('start_odometer')) ?? 0,
      archived: f.get('archived') === 'on',
    };
    setBusy(true);
    try {
      if (vehicle) {
        await updateRow('vehicles', vehicle.id, row);
        await onSaved();
      } else {
        const created = await insertRow('vehicles', row);
        await onSaved(created.id);
      }
    } catch (ex) {
      setErr((ex as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!vehicle) return;
    if (!window.confirm(`Delete ${vehicle.name} and ALL of its fuel, service and reminder records? Consider archiving instead.`))
      return;
    setBusy(true);
    try {
      await deleteRow('vehicles', vehicle.id);
      await onSaved();
    } catch (ex) {
      setErr((ex as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={vehicle ? 'Edit vehicle' : 'Add vehicle'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Name
          <input name="name" defaultValue={vehicle?.name ?? ''} placeholder="e.g. Family car" required />
        </label>
        <div className="row">
          <label>
            Make
            <input name="make" defaultValue={vehicle?.make ?? ''} />
          </label>
          <label>
            Model
            <input name="model" defaultValue={vehicle?.model ?? ''} />
          </label>
        </div>
        <div className="row">
          <label>
            Year
            <input name="year" type="number" min="1900" max="2100" defaultValue={vehicle?.year ?? ''} />
          </label>
          <label>
            Registration
            <input name="plate" defaultValue={vehicle?.plate ?? ''} />
          </label>
        </div>
        <div className="row">
          <label>
            Fuel
            <select name="fuel_type" defaultValue={vehicle?.fuel_type ?? 'petrol'}>
              {['petrol', 'diesel', 'cng', 'electric', 'hybrid'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Odometer when you start tracking (km)
            <input
              name="start_odometer"
              type="number"
              inputMode="numeric"
              min="0"
              step="any"
              defaultValue={vehicle?.start_odometer ?? ''}
              required
            />
          </label>
        </div>
        {vehicle && (
          <label className="check">
            <input name="archived" type="checkbox" defaultChecked={vehicle.archived} />
            Archived (sold / no longer used — hidden from the vehicle picker)
          </label>
        )}
        {err && <p className="form-msg">{err}</p>}
        <div className="form-actions">
          {vehicle && (
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
