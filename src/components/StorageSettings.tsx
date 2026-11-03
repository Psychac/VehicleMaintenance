import { useState, type FormEvent } from 'react';
import { createClient } from '@supabase/supabase-js';
import { loadConfig, saveConfig, type BackendKind } from '../lib/config';

/** Chooses where data lives: on this device (SQLite) or in the user's own Supabase project. */
export default function StorageSettings() {
  const saved = loadConfig();
  const [backend, setBackend] = useState<BackendKind>(saved.backend);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const supabaseUrl = String(f.get('url') ?? '').trim();
    const supabaseKey = String(f.get('key') ?? '').trim();
    setBusy(true);
    setMsg(null);
    if (backend === 'supabase') {
      try {
        // A missing table errors; a reachable project with RLS just returns no rows.
        const { error } = await createClient(supabaseUrl, supabaseKey).from('vehicles').select('id').limit(1);
        if (error) throw new Error(error.message);
      } catch (ex) {
        setMsg(`Couldn't connect: ${(ex as Error).message}. Did you run supabase/schema.sql in that project?`);
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
      <p className="muted small">
        Switching doesn't move your data. Before you switch, download a database or JSON backup and restore it afterwards.
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
