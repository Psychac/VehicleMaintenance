import { useState, type FormEvent } from 'react';
import { loadConfig, saveConfig, type BackendKind } from '../lib/config';
import { discardPendingCopy, isLocalMode, stashDataForSwitch } from '../lib/db';
import { Banner, Button, SelectField, Segmented, TextField, Toggle } from '../ui';
import { FormStack } from './forms';

/** Columns the app reads and writes; a Supabase project missing any of them has an outdated schema. */
const REQUIRED_COLUMNS: Record<string, string> = {
  vehicles: 'id,name,make,model,year,plate,fuel_type,start_odometer,archived,created_at',
  fuel_logs: 'id,vehicle_id,date,odometer,litres,total_cost,full_tank,remaining_litres,station,notes,created_at',
  service_logs: 'id,vehicle_id,date,odometer,category,title,cost,vendor,notes,created_at',
  reminders: 'id,vehicle_id,title,interval_km,interval_months,last_done_date,last_done_odometer,notes,created_at',
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
      const { createClient } = await import('@supabase/supabase-js');
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
            : `Couldn't connect. ${err.message}. Did you run supabase/schema.sql in that project?`
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
        setMsg(`Couldn't read your current data to copy it. ${(ex as Error).message}. Turn off "Copy my data" to switch anyway, then restore from a backup file.`);
        setBusy(false);
        return;
      }
    }
    saveConfig({ backend, supabaseUrl, supabaseKey });
    window.location.reload();
  }

  return (
    <form noValidate onSubmit={submit}>
      <FormStack>
        <Segmented
          label="Where your data lives"
          value={backend}
          onChange={setBackend}
          options={[
            { value: 'sqlite', label: 'This device' },
            { value: 'supabase', label: 'Supabase' },
          ]}
        />
        <p className="form-note">
          {backend === 'sqlite'
            ? 'Private, works offline, no account. Stored in this browser.'
            : 'Sign in and sync across devices, using your own Supabase project.'}
        </p>
        {backend === 'supabase' && (
          <>
            <TextField label="Project URL" name="url" type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="https://xxxx.supabase.co" defaultValue={saved.supabaseUrl} required />
            <TextField label="Anon (public) key" name="key" autoCapitalize="none" autoCorrect="off" defaultValue={saved.supabaseKey} required />
          </>
        )}
        {switching && (
          <>
            <Toggle label="Copy my data" description="Copies once. The two places don't stay in sync, and the old copy is left untouched." name="copy" defaultChecked />
            <SelectField label="If an entry already exists there" name="strategy" defaultValue="keep">
              <option value="keep">Keep what's already there</option>
              <option value="overwrite">Replace it with the copied version</option>
            </SelectField>
            {backend === 'supabase' && <p className="form-note">Your data is imported after you sign in.</p>}
          </>
        )}
        {!switching && <p className="form-note">Download a backup before you change these settings.</p>}
        {msg && <Banner tone="error">{msg}</Banner>}
        <Button type="submit" size="large" fullWidth loading={busy}>
          {backend === 'supabase' ? 'Test and save' : 'Save'}
        </Button>
      </FormStack>
    </form>
  );
}
