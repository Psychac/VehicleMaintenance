import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { Session } from '@supabase/supabase-js';
import { IconBell, IconCar, IconChevronDown, IconHome, IconList, IconMore } from './components/icons';
import { currentOdometer, reminderStatus } from './lib/calc';
import { today } from './lib/format';
import { applyPendingCopy, initDb, isLocalMode, listAll, storageStatus, supabase } from './lib/db';
import type { AllData, Vehicle } from './lib/types';
import Auth from './screens/Auth';
import Home from './screens/Home';
import Log from './screens/Log';
import { Account, Backup, More, Storage, Vehicles } from './screens/More';
import Reminders from './screens/Reminders';
import Reports from './screens/Reports';
import StorageSettings from './screens/StorageSettings';
import VehiclePicker from './screens/VehiclePicker';
import VehicleSheet from './screens/VehicleSheet';
import { ShellProvider, type Route, type Sub, type Tab } from './screens/shell';
import type { Editing } from './screens/shared';
import {
  AppNav,
  Banner,
  Button,
  EmptyState,
  IconButton,
  ListGroup,
  MotionConfig,
  ScreenHeader,
  Sheet,
  SkeletonRows,
  ToastProvider,
  useDelayedFlag,
  type NavItem,
} from './ui';

const EMPTY: AllData = { vehicles: [], fuel_logs: [], service_logs: [], reminders: [] };
const VEHICLE_KEY = 'vehicle-log:selected';
const TAB_KEY = 'vehicle-log:tab';
const TABS: Tab[] = ['home', 'log', 'reminders', 'more'];
const SUBS: Sub[] = ['reports', 'vehicles', 'backup', 'storage', 'account'];

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
    reports: { tab: 'more', sub: 'reports' },
    settings: { tab: 'more' },
  };
  if (legacy[a]) return legacy[a];
  if (TABS.includes(a as Tab)) return { tab: a as Tab, sub: a === 'more' && SUBS.includes(b as Sub) ? (b as Sub) : undefined };
  const last = remembered(TAB_KEY);
  return { tab: TABS.includes(last as Tab) ? (last as Tab) : 'home' };
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
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <Root />
      </ToastProvider>
    </MotionConfig>
  );
}

function Root() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(isLocalMode);
  const [initError, setInitError] = useState<string | null>(null);
  const [data, setData] = useState<AllData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>(parseRoute);
  const [vehicleId, setVehicleId] = useState<string | null>(remembered(VEHICLE_KEY));
  const [picker, setPicker] = useState(false);
  const [vehicleEdit, setVehicleEdit] = useState<Editing<Vehicle>>(null);
  const [storageSheet, setStorageSheet] = useState(false);
  const online = useOnline();

  // SQLite mode: open the on-device database before anything reads from it.
  const [dbReady, setDbReady] = useState(!isLocalMode);
  useEffect(() => {
    if (!isLocalMode) return;
    initDb()
      .then(() => setDbReady(true))
      .catch((e) => setInitError((e as Error).message));
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signedIn = isLocalMode ? dbReady : !!session;

  const reload = useCallback(async () => {
    try {
      setData(await listAll());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    // Import data parked by Storage "copy my data" before the first read.
    applyPendingCopy()
      .then((msg) => msg && setNotice(msg))
      .finally(reload);
  }, [signedIn, reload]);

  // Refresh when returning to the app so edits made on another device show up.
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && signedIn && reload();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [signedIn, reload]);

  // System back / edge swipe: follow the hash.
  useEffect(() => {
    const onPop = () => setRoute(parseRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((r: Route) => {
    if (r.sub) window.history.pushState({ pushed: true }, '', hashOf(r));
    else window.history.replaceState(null, '', hashOf(r));
    remember(TAB_KEY, r.tab);
    setRoute(r);
    window.scrollTo({ top: 0 });
  }, []);

  const back = useCallback(() => {
    if (window.history.state?.pushed) window.history.back();
    else navigate({ tab: 'more' });
  }, [navigate]);

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

  const booting = !authReady || (isLocalMode && !dbReady && !initError);
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
          <StorageSettings />
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

  if (!signedIn) return <Auth />;

  /* ---------------------------------------------------------------- shell */

  const items: NavItem<Tab>[] = [
    { id: 'home', label: 'Home', icon: IconHome },
    { id: 'log', label: 'Log', icon: IconList },
    { id: 'reminders', label: 'Reminders', icon: IconBell, badge: overdueCount || undefined },
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

  const needsVehicle = !scope && route.tab !== 'more';

  let screen;
  if (needsVehicle) screen = noVehicle(route.tab === 'home' ? 'Home' : route.tab === 'log' ? 'Log' : 'Reminders');
  else if (route.tab === 'home' && scope) screen = <Home scope={scope} loading={loading} reload={reload} />;
  else if (route.tab === 'log' && scope) screen = <Log scope={scope} loading={loading} reload={reload} />;
  else if (route.tab === 'reminders' && scope) screen = <Reminders scope={scope} loading={loading} reload={reload} />;
  else if (route.sub === 'reports') screen = scope ? <Reports scope={scope} loading={loading} /> : noVehicle('Reports');
  else if (route.sub === 'vehicles') screen = <Vehicles vehicles={data.vehicles} />;
  else if (route.sub === 'backup') screen = <Backup data={data} reload={reload} />;
  else if (route.sub === 'storage') screen = <Storage />;
  else if (route.sub === 'account') screen = <Account />;
  else screen = <More data={data} />;

  return (
    <ShellProvider value={{ vehicleButton, switchButton, editVehicle: setVehicleEdit, navigate, back }}>
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
                <Banner tone="warning" action={{ label: 'Back up now', onPress: () => navigate({ tab: 'more', sub: 'backup' }) }}>
                  Your data won't be saved in this browser. Download a backup, and close other Vehicle Log tabs.
                </Banner>
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
          {screen}
        </div>

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
