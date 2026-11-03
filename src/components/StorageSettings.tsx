import { useState, type FormEvent } from 'react';
import { createClient } from '@supabase/supabase-js';
import { loadConfig, saveConfig, type BackendKind } from '../lib/config';
import { discardPendingCopy, isLocalMode, stashDataForSwitch } from '../lib/db';

/** Columns the app reads and writes; a Supabase project missing any of them has an outdated schema. */
const REQUIRED_COLUMNS: Record<string, string> = {
  vehicles: 'id,name,make,model,year,plate,fuel_type,start_odometer,archived,created_at',
  fuel_logs: 'id,vehicle_id,date,odometer,litres,total_cost,full_tank,remaining_litres,station,notes,created_at',
  service_logs: 'id,vehicle_id,date,odometer,category,title,cost,vendor,notes,created_at',
  reminders:
    'id,vehicle_id,title,interval_km,interval_months,last_done_date,last_done_odometer,notes,created_at',
};

/** Chooses where data lives: on this device (SQLite) or in the user's own Supabase project. */
export default function StorageSettings() {
  const saved = loadConfig();
  const [backend, setBackend] = useState<BackendKind>(saved.backend);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const switching = backend !== (isLocalMode ? 'sqlite' : 'supabase');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const supabaseUrl = String(f.get('url') ?? '').trim();
    const supabaseKey = String(f.get('key') ?? '').trim();
    setBusy(true);
    setMsg(null);
    if (backend === 'supabase') {
      const client = createClient(supabaseUrl, supabaseKey);
      try {
        // A missing table or column errors; a reachable project with RLS just returns no rows.
        for (const [table, cols] of Object.entries(REQUIRED_COLUMNS)) {
          const { error } = await client.from(table).select(cols).limit(1);
          if (error) throw new Error(error.message);
        }
      } catch (ex) {
        const err = ex as Error;
        setMsg(
          /column/i.test(err.message)
            ? `Connected, but that project's schema is out of date (${err.message}). Run the latest supabase/schema.sql in its SQL editor, then try again.`
            : `Couldn't connect: ${err.message}. Did you run supabase/schema.sql in that project?`
        );
        setBusy(false);
        return;
      }
    }
    discardPendingCopy();
    if (switching && f.get('copy') === 'on') {
      try {
        await stashDataForSwitch(f.get('strategy') === 'overwrite' ? 'overwrite' : 'keep');
      } catch (ex) {
        setMsg(
          `Couldn't read your current data to copy it: ${(ex as Error).message}. ` +
            'Untick "Copy my data" to switch anyway and restore from a backup file instead.'
        );
        setBusy(false);
        return;
      }
    }
    saveConfig({ backend, supabaseUrl, supabaseKey });
    window.location.reload();
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="check">
        <input type="radio" checked={backend === 'sqlite'} onChange={() => setBackend('sqlite')} />
        This device (SQLite) — private, works offline, no account
      </label>
      <label className="check">
        <input type="radio" checked={backend === 'supabase'} onChange={() => setBackend('supabase')} />
        Supabase — sign in and sync across devices
      </label>
      {backend === 'supabase' && (
        <>
          <label>
            Project URL
            <input name="url" type="url" defaultValue={saved.supabaseUrl} placeholder="https://xxxx.supabase.co" required />
          </label>
          <label>
            Anon (public) key
            <input name="key" defaultValue={saved.supabaseKey} required />
          </label>
        </>
      )}
      {switching && (
        <>
          <label className="check">
            <input name="copy" type="checkbox" defaultChecked />
            Copy my data to the new location
          </label>
          <label>
            If the same entry already exists there with different details
            <select name="strategy" defaultValue="keep">
              <option value="keep">Keep what's already there (safe)</option>
              <option value="overwrite">Replace it with the copied version</option>
            </select>
          </label>
        </>
      )}
      <p className="muted small">
        {switching
          ? "Data is copied once; the two locations don't stay in sync afterwards, and the old copy is left untouched. " +
            (backend === 'supabase' ? "It's imported after you sign in. " : '') +
            "If the current location can't be read, restore from a backup file instead."
          : 'Download a database or JSON backup first if you change these settings.'}
      </p>
      {msg && <p className="form-msg">{msg}</p>}
      <div className="form-actions">
        <button className="primary" disabled={busy}>
          {busy ? 'Checking…' : backend === 'supabase' ? 'Test & save' : 'Save'}
        </button>
      </div>
    </form>
  );
}
