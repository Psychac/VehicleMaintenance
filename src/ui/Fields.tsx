import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { shake } from '../design/tokens';
import { haptic } from './haptics';
import { usePress } from './press';

/** Plays the validation shake (3 cycles, 6 pt, 300 ms) with an error haptic. Skipped under Reduce Motion. */
function useErrorFeedback(error: string | null | undefined) {
  const ref = useRef<HTMLElement | null>(null);
  const had = useRef(false);
  useEffect(() => {
    if (error && !had.current) {
      haptic('error');
      const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reduce && ref.current?.animate) {
        const d = shake.distance;
        const frames = Array.from({ length: shake.cycles * 2 + 1 }, (_, i) => ({
          transform: `translateX(${i === 0 || i === shake.cycles * 2 ? 0 : i % 2 ? -d : d}px)`,
        }));
        ref.current.animate(frames, { duration: shake.ms, easing: 'ease-in-out' });
      }
    }
    had.current = !!error;
  }, [error]);
  return ref;
}

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string | null;
  children: (a: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  /** Ref target for the shake. */
  shakeRef: React.MutableRefObject<HTMLElement | null>;
}

/** Label above the control (never a vanishing placeholder), error below with a smooth push (S7). */
function FieldShell({ label, hint, error, children, shakeRef }: FieldShellProps) {
  const id = useId();
  const msgId = `${id}-msg`;
  const text = error || hint;
  return (
    <div className="ui-field">
      <label className="ui-field-label" htmlFor={id}>
        {label}
      </label>
      <div className="ui-field-control" ref={(el) => void (shakeRef.current = el)}>
        {children({ id, describedBy: text ? msgId : undefined, invalid: !!error })}
      </div>
      <div className="ui-field-msg-wrap" data-open={!!text || undefined}>
        <p id={msgId} className="ui-field-msg" data-error={!!error || undefined} aria-live="polite">
          {text}
        </p>
      </div>
    </div>
  );
}

type Validate = (value: string) => string | null;

/** Validates on blur, not on every keystroke. A controlled `error` wins over the built-in check. */
function useBlurValidation(validate: Validate | undefined, required: boolean | undefined, label: string, controlled: string | null | undefined) {
  const [own, setOwn] = useState<string | null>(null);
  const check = (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const v = e.currentTarget.value;
    setOwn(validate ? validate(v) : required && !v.trim() ? `Add ${label.toLowerCase()}` : null);
  };
  const clear = () => own && setOwn(null);
  return { error: controlled !== undefined ? controlled : own, check, clear };
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'> {
  label: string;
  hint?: string;
  error?: string | null;
  validate?: Validate;
}

/** Height 48, elevated2 fill, radius sm, no border at rest, 1.5 pt accent ring on focus. */
export function TextField({ label, hint, error, validate, onBlur, onChange, required, ...input }: TextFieldProps) {
  const v = useBlurValidation(validate, required, label, error);
  const ref = useErrorFeedback(v.error);
  return (
    <FieldShell label={label} hint={hint} error={v.error} shakeRef={ref}>
      {({ id, describedBy, invalid }) => (
        <input
          {...input}
          id={id}
          className="ui-input"
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onBlur={(e) => {
            v.check(e);
            onBlur?.(e);
          }}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            v.clear();
            onChange?.(e);
          }}
        />
      )}
    </FieldShell>
  );
}

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'id'> {
  label: string;
  hint?: string;
  error?: string | null;
}

export function TextArea({ label, hint, error, ...input }: TextAreaProps) {
  const ref = useErrorFeedback(error);
  return (
    <FieldShell label={label} hint={hint} error={error} shakeRef={ref}>
      {({ id, describedBy, invalid }) => (
        <textarea {...input} id={id} className="ui-input ui-textarea" aria-invalid={invalid || undefined} aria-describedby={describedBy} />
      )}
    </FieldShell>
  );
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'id'> {
  label: string;
  hint?: string;
  error?: string | null;
}

/** Native `<select>` (the platform picker wins on phones) in the same frame as `TextField`. */
export function SelectField({ label, hint, error, onChange, children, ...input }: SelectFieldProps) {
  const ref = useErrorFeedback(error);
  return (
    <FieldShell label={label} hint={hint} error={error} shakeRef={ref}>
      {({ id, describedBy, invalid }) => (
        <select
          {...input}
          id={id}
          className="ui-input ui-select"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            haptic('selection');
            onChange?.(e);
          }}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
}

export interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'type' | 'role' | 'children'> {
  label: string;
  /** Secondary line under the label. */
  description?: string;
}

/**
 * Switch row. A real checkbox underneath (`role="switch"`), so it works with FormData and the
 * keyboard. Touch-down stretches the thumb; the change snaps with spring.snappy + selection haptic.
 */
export function Toggle({ label, description, onChange, disabled, ...input }: ToggleProps) {
  const press = usePress<HTMLLabelElement>(disabled);
  return (
    <label {...press} className="ui-toggle" data-disabled={disabled || undefined}>
      <span className="ui-toggle-text">
        <span className="ui-toggle-label">{label}</span>
        {description && <span className="ui-toggle-desc">{description}</span>}
      </span>
      <input
        {...input}
        type="checkbox"
        role="switch"
        className="ui-toggle-input"
        disabled={disabled}
        onChange={(e) => {
          haptic('selection');
          onChange?.(e);
        }}
      />
      <span className="ui-toggle-track" aria-hidden="true">
        <span className="ui-toggle-thumb" />
      </span>
    </label>
  );
}
