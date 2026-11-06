import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { m } from 'motion/react';
import { spring } from '../design/tokens';
import { usePress } from './press';

export interface NavItem<T extends string = string> {
  id: T;
  label: string;
  icon: ComponentType<{ size?: number; filled?: boolean }>;
  /** Small count on the icon (e.g. overdue reminders). Announced in the accessible name. */
  badge?: number;
}

function NavButton<T extends string>({
  item,
  active,
  onSelect,
  variant,
}: {
  item: NavItem<T>;
  active: boolean;
  onSelect: () => void;
  variant: 'tab' | 'side';
}) {
  const press = usePress<HTMLButtonElement>();
  const Icon = item.icon;
  return (
    <button
      {...press}
      type="button"
      className={variant === 'tab' ? 'ui-tab' : 'ui-side-item'}
      data-active={active || undefined}
      aria-current={active ? 'page' : undefined}
      aria-label={item.badge ? `${item.label}, ${item.badge} overdue` : undefined}
      onClick={onSelect}
    >
      <m.span
        className="ui-nav-icon"
        // Selecting plays a small symbol-style pop: the icon settles from 0.86 with spring.snappy.
        key={active ? 'on' : 'off'}
        initial={active ? { scale: 0.86 } : false}
        animate={{ scale: 1 }}
        transition={spring.snappy}
      >
        <Icon size={variant === 'tab' ? 24 : 22} filled={active} />
        {!!item.badge && <span className="ui-nav-badge">{item.badge}</span>}
      </m.span>
      <span className="ui-nav-label">{item.label}</span>
    </button>
  );
}

/**
 * Bottom tab bar (< 900 px) and sidebar (≥ 900 px) from one item list. 3-4 destinations, icon +
 * short label, filled icon when selected, material background. Tapping the active item calls
 * `onReselect` (scroll to top, then pop to root).
 */
export function AppNav<T extends string>({
  items,
  value,
  onChange,
  onReselect,
  sidebarHeader,
  sidebarFooter,
}: {
  items: readonly NavItem<T>[];
  value: T;
  onChange: (id: T) => void;
  onReselect?: (id: T) => void;
  sidebarHeader?: ReactNode;
  sidebarFooter?: ReactNode;
}) {
  const select = (id: T) => (id === value ? onReselect?.(id) : onChange(id));
  return (
    <>
      <nav className="ui-tabbar" aria-label="Sections">
        {items.map((item) => (
          <NavButton key={item.id} item={item} active={item.id === value} onSelect={() => select(item.id)} variant="tab" />
        ))}
      </nav>
      <aside className="ui-sidebar">
        {sidebarHeader}
        <nav className="ui-side-nav" aria-label="Sections">
          {items.map((item) => (
            <NavButton key={item.id} item={item} active={item.id === value} onSelect={() => select(item.id)} variant="side" />
          ))}
        </nav>
        {sidebarFooter}
      </aside>
    </>
  );
}

/**
 * Compact header (one pattern for every screen): title left-aligned with an optional line of
 * context under it, actions at the end. Transparent at the top of the page; gains material and a
 * hairline as soon as content scrolls under it. Pushed screens pass `inline` plus a back button
 * as `leading`. At most two trailing actions.
 */
export function ScreenHeader({
  title,
  inline = false,
  leading,
  trailing,
  subtitle,
}: {
  title: string;
  inline?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** One line of context under the title. */
  subtitle?: string;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScrolled(window.scrollY > 4));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header className="ui-header" data-scrolled={scrolled || undefined} data-inline={inline || undefined}>
      {leading && <div className="ui-header-lead">{leading}</div>}
      <div className="ui-header-text">
        <h1 className="ui-header-title">{title}</h1>
        {subtitle && <p className="ui-header-sub">{subtitle}</p>}
      </div>
      {trailing && <div className="ui-header-trail">{trailing}</div>}
    </header>
  );
}
