import { useState, type FormEvent } from 'react';
import { IconCar } from '../components/icons';
import { supabase } from '../lib/db';
import { Banner, Button, Sheet, TextField } from '../ui';
import StorageSettings from './StorageSettings';
import { FormStack } from './forms';

/** Sign in or create an account (Supabase mode only). */
export default function Auth() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [storage, setStorage] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email')).trim();
    const password = String(form.get('password'));
    if (!email || password.length < 8) {
      setMessage({ tone: 'error', text: !email ? 'Add your email.' : 'Use at least 8 characters for the password.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    const { data, error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) setMessage({ tone: 'error', text: error.message });
    else if (mode === 'signup' && !data.session) setMessage({ tone: 'info', text: 'Check your email to confirm the account, then sign in.' });
  }

  return (
    <main className="auth">
      <form className="auth-card" noValidate onSubmit={submit}>
        <span className="auth-mark" aria-hidden="true">
          <IconCar size={28} />
        </span>
        <h1 className="t-title1">Vehicle Log</h1>
        <p className="auth-sub">{mode === 'signin' ? 'Sign in to sync your vehicles.' : 'Create an account to sync your vehicles.'}</p>
        <FormStack>
          <TextField label="Email" name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" enterKeyHint="next" required />
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            enterKeyHint="go"
            hint={mode === 'signup' ? 'At least 8 characters' : undefined}
            required
          />
          {message && <Banner tone={message.tone}>{message.text}</Banner>}
          <Button type="submit" size="large" fullWidth loading={busy}>
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
        </FormStack>
        <div className="auth-links">
          <Button variant="tertiary" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? 'Create an account' : 'I have an account'}
          </Button>
          <Button variant="tertiary" onClick={() => setStorage(true)}>
            Change storage
          </Button>
        </div>
      </form>
      <Sheet open={storage} onClose={() => setStorage(false)} title="Storage">
        <StorageSettings />
      </Sheet>
    </main>
  );
}
