import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { haptic, type HapticKind } from './haptics';
import { usePress } from './press';

export function Spinner({ label }: { label?: string }) {
  return (
    <svg
      className="ui-spinner"
      viewBox="0 0 24 24"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" className="ui-spinner-track" />
      <circle cx="12" cy="12" r="9" className="ui-spinner-arc" />
    </svg>
  );
}

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  /** primary: filled accent (one per screen). secondary: tinted. tertiary: label only. destructive: the destructive action itself. */
  variant?: 'primary' | 'secondary' | 'tertiary' | 'destructive';
  /** large = 50, regular = 44. */
  size?: 'large' | 'regular';
  /** Replaces the label with a spinner in place; width stays fixed and the button is disabled. */
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  /** After the label (e.g. a chevron). */
  trailingIcon?: ReactNode;
  /** Defaults: primary → impactLight, destructive → warning, others none. `false` to silence. */
  haptic?: HapticKind | false;
}

const DEFAULT_HAPTIC: Record<NonNullable<ButtonProps['variant']>, HapticKind | false> = {
  primary: 'impactLight',
  secondary: false,
  tertiary: false,
  destructive: 'warning',
};

/**
 * States (S6.4): default, pressed (touch-down: scale + brightness via spring.press), focus-visible
 * ring, hover (hover-capable pointers only), disabled (40%, no press), loading (in place).
 */
export function Button({
  variant = 'primary',
  size = 'regular',
  loading = false,
  fullWidth = false,
  icon,
  trailingIcon,
  haptic: hapticKind,
  disabled,
  onClick,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const inert = disabled || loading;
  const press = usePress<HTMLButtonElement>(inert);
  const kind = hapticKind ?? DEFAULT_HAPTIC[variant];

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (inert) return;
    if (kind) haptic(kind);
    onClick?.(e);
  };

  return (
    <button
      {...rest}
      {...press}
      type={type}
      className="ui-btn"
      data-variant={variant}
      data-size={size}
      data-loading={loading || undefined}
      data-full={fullWidth || undefined}
      disabled={inert}
      aria-busy={loading || undefined}
      onClick={handleClick}
    >
      <span className="ui-btn-label">
        {icon}
        <span className="ui-btn-text">{children}</span>
        {trailingIcon}
      </span>
      {loading && (
        <span className="ui-btn-spinner">
          <Spinner />
        </span>
      )}
    </button>
  );
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  /** Required: icon-only controls must be labelled. */
  label: string;
  icon: ReactNode;
  tone?: 'default' | 'accent' | 'destructive';
  haptic?: HapticKind | false;
}

/** 44 × 44 hit area around a smaller glyph. Press: icon scales to 0.88 and dims to 60%. */
export function IconButton({ label, icon, tone = 'default', haptic: hapticKind = false, disabled, onClick, type = 'button', ...rest }: IconButtonProps) {
  const press = usePress<HTMLButtonElement>(disabled);
  return (
    <button
      {...rest}
      {...press}
      type={type}
      className="ui-icon-btn"
      data-tone={tone}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        if (hapticKind) haptic(hapticKind);
        onClick?.(e);
      }}
    >
      <span className="ui-icon-btn-glyph">{icon}</span>
    </button>
  );
}
