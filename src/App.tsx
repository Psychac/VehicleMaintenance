import { Suspense, lazy, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { Session } from '@supabase/supabase-js';
import { IconBell, IconCar, IconChart, IconChevronDown, IconHome, IconList, IconMore } from './components/icons';
import { currentOdometer, reminderStatus } from './lib/calc';
import { today } from './lib/format';
import { applyPendingCopy, initDb, isLocalMode, listAll, storageStatus, supabase } from './lib/db';
import { loadSnapshot, saveSnapshot } from './lib/snapshot';
import type { AllData, Vehicle } from './lib/types';
import Home from './screens/Home';
import Log from './screens/Log';
import Reminders from './screens/Reminders';
import { ScreenTransition, type TransitionKind } from './screens/ScreenTransition';
import { rememberLeaveScroll } from './ui/leaveScroll';
import VehiclePicker from './screens/VehiclePicker';
import VehicleSheet from './screens/VehicleSheet';
import { ShellProvider, type Route, type Sub, type Tab } from './screens/shell';
import type { Editing } from './screens/shared';
import {
  AppNav,
  Banner,
  Button,
  CompletionProvider,
  ContextMenuProvider,
  EmptyState,
  IconButton,
  ListGroup,
  PullToRefresh,
  ScreenHeader,
  Sheet,
  SkeletonRows,
  ToastProvider,
  loadMotionWhenIdle,
  useIsDesktop,
  useShortcuts,
  useDelayedFlag,
  type NavItem,
} from './ui';

// Rarely used screens load on demand (and are prefetched when the browser is idle, below), so the
// first screen's bundle stays small.
const Auth = lazy(() => import('./screens/Auth'));
const Reports = lazy(() => import('./screens/Reports'));
const StorageSettings = lazy(() => import('./screens/StorageSettings'));
const moreScreen = <K extends 'More' | 'Vehicles' | 'Backup' | 'Storage' | 'Account'>(k: K) =>
  lazy(() => import('./screens/More').then((m) => ({ default: m[k] as never })));
const More = moreScreen('More') as unknown as React.ComponentType<{ data: AllData }>;
const Vehicles = moreScreen('Vehicles') as unknown as React.ComponentType<{ vehicles: Vehicle[] }>;
const Backup = moreScreen('Backup') as unknown as React.ComponentType<{ data: AllData; reload: () => Promise<void> }>;
const Storage = moreScreen('Storage') as unknown as React.ComponentType;
const Account = moreScreen('Account') as unknown as React.ComponentType;

const EMPTY: AllData = { vehicles: [], fuel_logs: [], service_logs: [], reminders: [] };
const VEHICLE_KEY = 'vehicle-log:selected';
const TAB_KEY = 'vehicle-log:tab';
const TABS: Tab[] = ['home', 'log', 'reports', 'more'];
const MORE_SUBS: Sub[] = ['vehicles', 'backup', 'storage', 'account'];

function remembered(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* per-device convenience only */
  }
}

/** Reads the route from the URL hash. Old hashes (#overview, #fuel, #settings …) still land somewhere sensible. */
function parseRoute(): Route {
  const [a, b] = window.location.hash.slice(1).split('/');
  const legacy: Record<string, Route> = {
    overview: { tab: 'home' },
    fuel: { tab: 'log' },
    service: { tab: 'log' },
    settings: { tab: 'more' },
    // Reminders used to be a tab; it is now a pushed screen opened from the header bell.
    reminders: { tab: 'home', sub: 'reminders' },
  };
  if (legacy[a]) return legacy[a];
  if (a === 'more' && b === 'reports') return { tab: 'reports' };
  if (TABS.includes(a as Tab)) {
    const sub = b === 'reminders' ? 'reminders' : a === 'more' && MORE_SUBS.includes(b as Sub) ? (b as Sub) : undefined;
    return { tab: a as Tab, sub };
  }
  const last = remembered(TAB_KEY);
  return { tab: TABS.includes(last as Tab) ? (last as Tab) : 'home' };
}

/** Tabs crossfade; going deeper pushes; coming back pops. */
function kindOf(from: Route, to: Route): TransitionKind {
  if (from.tab !== to.tab) return 'tab';
  const a = from.sub ? 1 : 0;
  const b = to.sub ? 1 : 0;
  if (b > a || (b === a && b === 1 && from.sub !== to.sub)) return 'push';
  if (b < a) return 'back';
  return 'tab';
}

const hashOf = (r: Route) => `#${r.tab}${r.sub ? `/${r.sub}` : ''}`;

function useOnline(): boolean {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener('online', notify);
      window.addEventListener('offline', notify);
      return () => {
        window.removeEventListener('online', notify);
        window.removeEventListener('offline', notify);
      };
    },
    () => navigator.onLine,
    () => true
  );
}

export default function App() {
  return (
    <ToastProvider>
      <CompletionProvider>
        <ContextMenuProvider>
          <Root />
        </ContextMenuProvider>
      </CompletionProvider>
    </ToastProvider>
  );
}

function Root() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(isLocalMode);
  const [initError, setInitError] = useState<string | null>(null);
  // On-device mode paints the last known data on the first frame; the real read replaces it.
  const [snapshot] = useState(() => (isLocalMode ? loadSnapshot() : null));
  const [data, setData] = useState<AllData>(snapshot ?? EMPTY);
  const [loading, setLoading] = useState(!snapshot);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [nav, setNav] = useState<{ route: Route; kind: TransitionKind }>(() => ({ route: parseRoute(), kind: 'tab' }));
  const route = nav.route;
  const go = useCallback((next: Route) => setNav((prev) => ({ route: next, kind: kindOf(prev.route, next) })), []);
  const [vehicleId, setVehicleId] = useState<string | null>(remembered(VEHICLE_KEY));
  const [picker, setPicker] = useState(false);
  const [vehicleEdit, setVehicleEdit] = useState<Editing<Vehicle>>(null);
  const [storageSheet, setStorageSheet] = useState(false);
  const online = useOnline();

  // Open storage before anything reads from it (started early from main.tsx; this just awaits it).
  const [dbReady, setDbReady] = useState(false);
  useEffect(() => {
    initDb()
      .then(() => setDbReady(true))
      .catch((e) => setInitError((e as Error).message));
  }, []);

  useEffect(() => {
    if (isLocalMode || !dbReady || !supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [dbReady]);

  const signedIn = isLocalMode ? dbReady || !!snapshot : !!session;

  const reload = useCallback(async () => {
    try {
      const fresh = await listAll();
      setData(fresh);
      if (isLocalMode) saveSnapshot(fresh);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!signedIn || !dbReady) return;
    // Import data parked by Storage "copy my data" before the first read.
    applyPendingCopy()
      .then((msg) => msg && setNotice(msg))
      .finally(reload);
  }, [signedIn, dbReady, reload]);

  // Fetch the on-demand screens once the first screen is up and the browser is idle.
  useEffect(() => {
    if (!signedIn) return;
    // The animation code arrives once the first screen is up; it is also requested on demand.
    loadMotionWhenIdle();
    const run = () => {
      void import('./screens/Reports');
      void import('./screens/More');
      void import('./screens/StorageSettings');
    };
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const id = idle ? idle(run) : window.setTimeout(run, 1500);
    return () => (idle ? undefined : window.clearTimeout(id));
  }, [signedIn]);

  // Refresh when returning to the app so edits made on another device show up.
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && signedIn && dbReady && reload();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [signedIn, dbReady, reload]);

  // System back / edge swipe: follow the hash.
  useEffect(() => {
    const onPop = () => go(parseRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [go]);

  const navigate = useCallback((r: Route) => {
    if (r.sub) window.history.pushState({ pushed: true }, '', hashOf(r));
    else window.history.replaceState(null, '', hashOf(r));
    remember(TAB_KEY, r.tab);
    rememberLeaveScroll();
    go(r);
    window.scrollTo({ top: 0 });
  }, [go]);

  const back = useCallback(() => {
    if (window.history.state?.pushed) window.history.back();
    else navigate({ tab: route.tab });
  }, [navigate, route.tab]);

  const isDesktop = useIsDesktop();
  useShortcuts(
    {
      '1': () => navigate({ tab: 'home' }),
      '2': () => navigate({ tab: 'log' }),
      '3': () => navigate({ tab: 'reports' }),
      '4': () => navigate({ tab: 'more' }),
      r: () => navigate({ tab: route.tab, sub: 'reminders' }),
    },
    isDesktop && signedIn
  );

  const activeVehicles = useMemo(() => data.vehicles.filter((v) => !v.archived), [data.vehicles]);
  const vehicle = activeVehicles.find((v) => v.id === vehicleId) ?? activeVehicles[0] ?? null;

  const selectVehicle = useCallback((id: string) => {
    setVehicleId(id);
    remember(VEHICLE_KEY, id);
  }, []);

  const scope = useMemo(
    () =>
      vehicle
        ? {
            vehicle,
            fuel: data.fuel_logs.filter((f) => f.vehicle_id === vehicle.id),
            service: data.service_logs.filter((s) => s.vehicle_id === vehicle.id),
            reminders: data.reminders.filter((r) => r.vehicle_id === vehicle.id),
          }
        : null,
    [vehicle, data]
  );

  const overdueCount = scope
    ? scope.reminders.filter((r) => reminderStatus(r, currentOdometer(scope.vehicle, scope.fuel, scope.service), today()).state === 'overdue').length
    : 0;

  const booting = !authReady || (isLocalMode && !dbReady && !snapshot && !initError);
  const showBootSkeleton = useDelayedFlag(booting);

  /* ---------------------------------------------------------- pre-app states */

  if (initError)
    return (
      <main className="auth">
        <div className="auth-card">
          <h1 className="t-title2">Couldn't open your data</h1>
          <p className="auth-sub">Close any other Vehicle Log tabs, then reload. Your data is still on this device.</p>
          <div className="form-stack">
            <Button size="large" fullWidth onClick={() => window.location.reload()}>
              Reload
            </Button>
            <Button variant="secondary" size="large" fullWidth onClick={() => setStorageSheet(true)}>
              Change storage
            </Button>
            <details className="details">
              <summary>Details</summary>
              <p>{initError}</p>
            </details>
          </div>
        </div>
        <Sheet open={storageSheet} onClose={() => setStorageSheet(false)} title="Storage">
          <Suspense fallback={null}>
            <StorageSettings />
          </Suspense>
        </Sheet>
      </main>
    );

  if (booting)
    return showBootSkeleton ? (
      <div className="boot" aria-busy="true">
        <ListGroup label="Loading">
          <SkeletonRows count={5} />
        </ListGroup>
      </div>
    ) : (
      <div className="boot" aria-busy="true" />
    );

  if (!signedIn)
    return (
      <Suspense fallback={null}>
        <Auth />
      </Suspense>
    );

  /* ---------------------------------------------------------------- shell */

  const items: NavItem<Tab>[] = [
    { id: 'home', label: 'Home', icon: IconHome },
    { id: 'log', label: 'Log', icon: IconList },
    { id: 'reports', label: 'Reports', icon: IconChart },
    { id: 'more', label: 'More', icon: IconMore },
  ];

  const vehicleButton = vehicle ? (
    <span className="vehicle-btn">
      <Button variant="tertiary" trailingIcon={<IconChevronDown size={16} />} aria-label={`Switch vehicle. Current: ${vehicle.name}`} onClick={() => setPicker(true)}>
        {vehicle.name}
      </Button>
    </span>
  ) : null;
  const switchButton = vehicle ? <IconButton label={`Switch vehicle. Current: ${vehicle.name}`} tone="accent" icon={<IconCar size={22} />} onClick={() => setPicker(true)} /> : null;

  const bellButton = scope ? (
    <span className="bell">
      <IconButton
        label={overdueCount ? `Reminders, ${overdueCount} overdue` : 'Reminders'}
        tone="accent"
        icon={<IconBell size={22} />}
        onClick={() => navigate({ tab: route.tab, sub: 'reminders' })}
      />
      {overdueCount > 0 && (
        <span className="bell-badge" aria-hidden="true">
          {overdueCount}
        </span>
      )}
    </span>
  ) : null;

  const entryCount = (v: Vehicle | null) =>
    v ? data.fuel_logs.filter((x) => x.vehicle_id === v.id).length + data.service_logs.filter((x) => x.vehicle_id === v.id).length + data.reminders.filter((x) => x.vehicle_id === v.id).length : 0;

  const noVehicle = (title: string) => (
    <>
      <ScreenHeader title={title} />
      <div className="screen">
        <EmptyState
          icon={<IconCar size={56} />}
          title="Add your first vehicle"
          message="Then log fuel, services and reminders."
          action={{ label: 'Add vehicle', onPress: () => setVehicleEdit('new') }}
        />
      </div>
    </>
  );

  const needsVehicle = !scope && (route.tab !== 'more' || route.sub === 'reminders');
  const TITLES = { home: 'Home', log: 'Log', reports: 'Reports', more: 'Reminders' } as const;

  let screen;
  if (needsVehicle) screen = noVehicle(route.sub === 'reminders' ? 'Reminders' : TITLES[route.tab]);
  else if (route.sub === 'reminders' && scope) screen = <Reminders scope={scope} loading={loading} reload={reload} />;
  else if (route.tab === 'home' && scope) screen = <Home scope={scope} loading={loading} reload={reload} />;
  else if (route.tab === 'log' && scope) screen = <Log scope={scope} loading={loading} reload={reload} />;
  else if (route.tab === 'reports' && scope) screen = <Reports scope={scope} loading={loading} />;
  else if (route.sub === 'vehicles') screen = <Vehicles vehicles={data.vehicles} />;
  else if (route.sub === 'backup') screen = <Backup data={data} reload={reload} />;
  else if (route.sub === 'storage') screen = <Storage />;
  else if (route.sub === 'account') screen = <Account />;
  else screen = <More data={data} />;

  return (
    <ShellProvider value={{ vehicleButton, switchButton, bellButton, editVehicle: setVehicleEdit, navigate, back }}>
      <div className="app">
        <AppNav
          items={items}
          value={route.tab}
          onChange={(tab) => navigate({ tab })}
          onReselect={() => {
            if (window.scrollY > 4) window.scrollTo({ top: 0, behavior: 'smooth' });
            else if (route.sub) back();
          }}
          sidebarHeader={
            <div className="brand">
              <span className="brand-mark" aria-hidden="true">
                <IconCar size={20} />
              </span>
              <span className="t-headline">Vehicle Log</span>
            </div>
          }
        />

        <div className="main">
          {(isLocalMode && !storageStatus.persistent) || (!isLocalMode && !online) || notice || error ? (
            <div className="banners">
              {isLocalMode && !storageStatus.persistent && (
                storageStatus.locked ? (
                  <Banner tone="warning" action={{ label: 'Retry', onPress: () => window.location.reload() }}>
                    Vehicle Log is open in another tab or window, so this copy can't save your data. Close the other one, then retry.
                  </Banner>
                ) : (
                  <Banner tone="warning" action={{ label: 'Back up now', onPress: () => navigate({ tab: 'more', sub: 'backup' }) }}>
                    This browser can't save data on this device, so changes are lost when you close the app. Back up to keep them.
                  </Banner>
                )
              )}
              {!isLocalMode && !online && <Banner tone="offline">You're offline. Changes can't be saved until you reconnect.</Banner>}
              {notice && (
                <Banner tone="info" onDismiss={() => setNotice(null)}>
                  {notice}
                </Banner>
              )}
              {error && (
                <Banner tone="error" action={{ label: 'Retry', onPress: reload }}>
                  Couldn't load your data.
                </Banner>
              )}
            </div>
          ) : null}
          <ScreenTransition routeKey={`${route.tab}/${route.sub ?? ''}`} kind={nav.kind} pushed={!!route.sub} onBack={back}>
            <Suspense fallback={null}>{screen}</Suspense>
          </ScreenTransition>
        </div>
        <PullToRefresh onRefresh={reload} />

        <VehiclePicker
          open={picker}
          vehicles={activeVehicles}
          selectedId={vehicle?.id ?? null}
          onSelect={selectVehicle}
          onAdd={() => {
            setPicker(false);
            setVehicleEdit('new');
          }}
          onClose={() => setPicker(false)}
        />
        <VehicleSheet
          editing={vehicleEdit}
          entryCount={entryCount(vehicleEdit && vehicleEdit !== 'new' ? vehicleEdit : null)}
          onClose={() => setVehicleEdit(null)}
          onCreated={(id) => {
            selectVehicle(id);
            navigate({ tab: 'home' });
          }}
          reload={reload}
        />
      </div>
    </ShellProvider>
  );
}
