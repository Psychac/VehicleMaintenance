import { useState, type FormEvent, type ReactNode } from 'react';
import { Banner, Button, haptic } from '../ui';

/**
 * Shared behaviour for the entry sheets: busy flag, dirty flag (drives "Discard changes?"),
 * per-field errors (shown on submit, then cleared as the user fixes the field) and a plain
 * failure message that never leads with a raw error.
 */
export function useEntryForm() {
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);

  /** Returns true when every required field has a value; otherwise sets field errors. */
  const requireFields = (f: FormData, rules: Record<string, string>) => {
    const next: Record<string, string> = {};
    for (const [name, message] of Object.entries(rules)) if (!String(f.get(name) ?? '').trim()) next[name] = message;
    setErrors(next);
    if (Object.keys(next).length) {
      haptic('error');
      return false;
    }
    return true;
  };

  /** Runs `work`; on success fires the success haptic, on failure keeps the sheet open with a message. */
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setFailure(null);
    try {
      await work();
      haptic('success');
    } catch (e) {
      setFailure((e as Error).message || 'Unknown error');
      setBusy(false);
    }
  };

  const submit = (handler: (f: FormData) => Promise<void> | void) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void handler(new FormData(e.currentTarget));
  };

  return {
    busy,
    dirty,
    errors,
    failure,
    setBusy,
    markDirty: () => setDirty(true),
    clearError: (name: string) => setErrors((prev) => (prev[name] ? { ...prev, [name]: '' } : prev)),
    requireFields,
    run,
    submit,
  };
}

/** Header action shared by every entry sheet: submits the sheet's form, spinner in place while saving. */
export function SaveButton({ form, busy, label = 'Save' }: { form: string; busy: boolean; label?: string }) {
  return (
    <Button type="submit" form={form} loading={busy}>
      {label}
    </Button>
  );
}

/** Plain-language save failure, shown inside the sheet next to the cause. */
export function FailureBanner({ message, what }: { message: string | null; what: string }) {
  if (!message) return null;
  return (
    <Banner tone="error">
      Couldn't {what}. {message}
    </Banner>
  );
}

/** Groups form fields with the 12 pt rhythm used inside every sheet. */
export function FormStack({ children }: { children: ReactNode }) {
  return <div className="form-stack">{children}</div>;
}

/**
 * Counter that increments each time `value` goes from closed (`null`) to open. Use it as a React
 * `key` so every opening starts with fresh form state, while the closing sheet keeps its own state
 * until its exit animation ends.
 */
export function useOpenKey<T>(value: T | null): number {
  const [s, set] = useState<{ n: number; prev: T | null }>({ n: 0, prev: null });
  if (value !== s.prev) set({ n: value !== null && s.prev === null ? s.n + 1 : s.n, prev: value });
  return s.n;
}
