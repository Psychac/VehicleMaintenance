import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/db';
import { IconCar } from './icons';
import StorageSettings from './StorageSettings';

export default function Auth() {
  const [showStorage, setShowStorage] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email'));
    const password = String(form.get('password'));
    setBusy(true);
    setMessage(null);
    const { data, error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) setMessage(error.message);
    else if (mode === 'signup' && !data.session) setMessage('Check your email to confirm the account, then sign in.');
  }

  return (
    <div className="auth">
      <form className="card form" onSubmit={submit}>
        <div className="brand auth-brand">
          <span className="brand-mark">
            <IconCar size={20} />
          </span>
          <span className="brand-name">Vehicle Log</span>
        </div>
        <p className="muted">{mode === 'signin' ? 'Sign in to sync your vehicles.' : 'Create your account.'}</p>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            minLength={8}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
          />
        </label>
        {message && <p className="form-msg">{message}</p>}
        <button className="primary" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        <button type="button" className="link" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
        <button type="button" className="link" onClick={() => setShowStorage(!showStorage)}>
          Storage settings
        </button>
      </form>
      {showStorage && (
        <div className="card">
          <StorageSettings />
        </div>
      )}
    </div>
  );
}
