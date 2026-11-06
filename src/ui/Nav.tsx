import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { layout, spring } from '../design/tokens';
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
      <motion.span
        className="ui-nav-icon"
        // Selecting plays a small symbol-style pop: the icon settles from 0.86 with spring.snappy.
        key={active ? 'on' : 'off'}
        initial={active ? { scale: 0.86 } : false}
        animate={{ scale: 1 }}
        transition={spring.snappy}
      >
        <Icon size={variant === 'tab' ? 24 : 22} filled={active} />
        {!!item.badge && <span className="ui-nav-badge">{item.badge}</span>}
      </motion.span>
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
 * Large title on root screens that collapses into an inline title as the user scrolls; the bar
 * gains material and a hairline at the same moment (transparent at scroll top). Pushed screens
 * use `inline`. At most two trailing actions.
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
  /** One line of context under the large title. */
  subtitle?: string;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(inline);

  useEffect(() => {
    if (inline || !sentinel.current) return;
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), { threshold: 0, rootMargin: `-${layout.navBar}px 0px 0px 0px` });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, [inline]);

  return (
    <>
      <header className="ui-navbar" data-scrolled={scrolled || undefined}>
        <div className="ui-navbar-side">{leading}</div>
        <span className="ui-navbar-title" aria-hidden={!scrolled}>
          {title}
        </span>
        <div className="ui-navbar-side" data-end>
          {trailing}
        </div>
      </header>
      {!inline && (
        <div className="ui-large-title">
          <h1 className="t-large-title">{title}</h1>
          {subtitle && <p className="ui-large-subtitle">{subtitle}</p>}
          <div ref={sentinel} className="ui-sentinel" aria-hidden="true" />
        </div>
      )}
    </>
  );
}
