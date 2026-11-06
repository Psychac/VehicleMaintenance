import type { ReactNode } from 'react';
import { IconAlert, IconInfo, IconOffline } from '../components/icons';
import { Button } from './Button';

/**
 * Empty states (S8). `first-use` says what will appear and offers the one action that fills it.
 * `filtered` has no illustration: it names the query, suggests a fix and offers to clear.
 */
export function EmptyState({
  variant = 'first-use',
  icon,
  title,
  message,
  action,
}: {
  variant?: 'first-use' | 'filtered';
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void; icon?: ReactNode };
}) {
  return (
    <div className="ui-empty" data-variant={variant}>
      {variant === 'first-use' && icon && <span className="ui-empty-icon">{icon}</span>}
      <h2 className="ui-empty-title">{title}</h2>
      {message && <p className="ui-empty-message">{message}</p>}
      {action && (
        <Button variant={variant === 'first-use' ? 'primary' : 'tertiary'} size={variant === 'first-use' ? 'large' : 'regular'} icon={action.icon} onClick={action.onPress}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

const BANNER_ICON = { info: <IconInfo size={18} />, warning: <IconAlert size={18} />, error: <IconAlert size={18} />, offline: <IconOffline size={18} /> } as const;

/**
 * Persistent but quiet inline banner (S8). Plain cause + one action. `error` and `warning` are
 * announced assertively; `info`/`offline` politely.
 */
export function Banner({
  tone = 'info',
  children,
  action,
  onDismiss,
}: {
  tone?: 'info' | 'warning' | 'error' | 'offline';
  children: ReactNode;
  action?: { label: string; onPress: () => void };
  onDismiss?: () => void;
}) {
  return (
    <div className="ui-banner" data-tone={tone} role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}>
      <span className="ui-banner-icon">{BANNER_ICON[tone]}</span>
      <p className="ui-banner-text">{children}</p>
      {action && (
        <Button variant="tertiary" onClick={action.onPress}>
          {action.label}
        </Button>
      )}
      {onDismiss && (
        <Button variant="tertiary" onClick={onDismiss}>
          Dismiss
        </Button>
      )}
    </div>
  );
}
