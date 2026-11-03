import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { currentOdometer, reminderStatus } from './lib/calc';
import { today } from './lib/format';
import { applyPendingCopy, initDb, isLocalMode, listAll, storageStatus, supabase } from './lib/db';
import type { AllData } from './lib/types';
import Auth from './components/Auth';
import StorageSettings from './components/StorageSettings';
import Overview from './components/Overview';
import FuelView from './components/FuelView';
import ServiceView from './components/ServiceView';
import RemindersView from './components/RemindersView';
import ReportsView from './components/ReportsView';
import SettingsView from './components/SettingsView';
import { IconBell, IconChart, IconCar, IconFuel, IconHome, IconSettings, IconWrench } from './components/icons';

const TABS = [
  ['overview', 'Overview', IconHome],
  ['fuel', 'Fuel', IconFuel],
  ['service', 'Service', IconWrench],
  ['reminders', 'Reminders', IconBell],
  ['reports', 'Reports', IconChart],
  ['settings', 'Settings', IconSettings],
] as const;
type Tab = (typeof TABS)[number][0];

const EMPTY: AllData = { vehicles: [], fuel_logs: [], service_logs: [], reminders: [] };
const VEHICLE_KEY = 'vehicle-log:selected';

function remembered(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(isLocalMode);
  const [initError, setInitError] = useState<string | null>(null);
  const [data, setData] = useState<AllData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTabState] = useState<Tab>(() => {
    const fromHash = window.location.hash.slice(1);
    return TABS.some(([id]) => id === fromHash) ? (fromHash as Tab) : 'overview';
  });
  // `add` asks the destination view to open its "new entry" form straight away.
  const [openNew, setOpenNew] = useState(false);
  const setTab = (t: Tab, add = false) => {
    setTabState(t);
    setOpenNew(add);
    history.replaceState(null, '', `#${t}`);
    window.scrollTo({ top: 0 });
  };
  const [vehicleId, setVehicleId] = useState<string | null>(remembered(VEHICLE_KEY));

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
    // Import data parked by Settings -> Storage "copy my data" before the first read.
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

  const activeVehicles = useMemo(() => data.vehicles.filter((v) => !v.archived), [data.vehicles]);
  const vehicle = activeVehicles.find((v) => v.id === vehicleId) ?? activeVehicles[0] ?? null;

  const selectVehicle = (id: string) => {
    setVehicleId(id);
    try {
      localStorage.setItem(VEHICLE_KEY, id);
    } catch {
      /* per-device convenience only */
    }
  };

  if (initError)
    return (
      <div className="center">
        <p className="banner error">Couldn't open the on-device database: {initError}</p>
        <div className="card">
          <StorageSettings />
        </div>
      </div>
    );
  if (!authReady || (isLocalMode && !dbReady))
    return (
      <div className="center muted">
        <span className="spinner" aria-label="Loading" />
      </div>
    );
  if (!signedIn) return <Auth />;

  const scoped = vehicle
    ? {
        fuel: data.fuel_logs.filter((f) => f.vehicle_id === vehicle.id),
        service: data.service_logs.filter((s) => s.vehicle_id === vehicle.id),
        reminders: data.reminders.filter((r) => r.vehicle_id === vehicle.id),
      }
    : null;

  const needsVehicle = !vehicle && tab !== 'settings';

  const overdueCount = scoped
    ? scoped.reminders.filter((r) => {
        const st = reminderStatus(r, currentOdometer(vehicle!, scoped.fuel, scoped.service), today()).state;
        return st === 'overdue';
      }).length
    : 0;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <IconCar size={20} />
          </span>
          <span className="brand-name">Vehicle Log</span>
        </div>

        {activeVehicles.length > 0 && (
          <label className="vehicle-picker">
            <span className="vehicle-picker-label">Vehicle</span>
            <select aria-label="Vehicle" value={vehicle?.id ?? ''} onChange={(e) => selectVehicle(e.target.value)}>
              {activeVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <nav className="nav" role="tablist" aria-label="Sections">
          {TABS.map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              aria-label={id === 'reminders' && overdueCount ? `${label}, ${overdueCount} overdue` : label}
              className={tab === id ? 'active' : ''}
              onClick={() => setTab(id)}
            >
              <span className="nav-icon">
                <Icon size={22} />
                {id === 'reminders' && overdueCount > 0 && <span className="dot">{overdueCount}</span>}
              </span>
              <span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="content">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">
              <IconCar size={18} />
            </span>
            <span className="brand-name">Vehicle Log</span>
          </div>
          {activeVehicles.length > 0 && (
            <select
              aria-label="Vehicle"
              className="vehicle-select"
              value={vehicle?.id ?? ''}
              onChange={(e) => selectVehicle(e.target.value)}
            >
              {activeVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          )}
        </header>

        <main className="page" key={tab}>
          {isLocalMode && !storageStatus.persistent && (
            <p className="banner error">
              This browser can't save the on-device database ({storageStatus.reason ?? 'OPFS unavailable'}). Data will be
              lost when you close or reload the page — download a backup in Settings. If the app is open in another tab,
              close it and reload.
            </p>
          )}
          {notice && <p className="banner">{notice}</p>}
          {error && <p className="banner error">Couldn't load data: {error}</p>}

          {loading ? (
            <div className="center-inline muted">
              <span className="spinner" aria-label="Loading" />
            </div>
          ) : needsVehicle ? (
            <div className="empty card">
              <span className="empty-icon">
                <IconCar size={28} />
              </span>
              <h2>Add your first vehicle</h2>
              <p className="muted">Create a vehicle to start logging fuel, services and reminders.</p>
              <button className="primary" onClick={() => setTab('settings')}>
                Add a vehicle
              </button>
            </div>
          ) : tab === 'overview' && vehicle && scoped ? (
            <Overview vehicle={vehicle} {...scoped} onNavigate={setTab} />
          ) : tab === 'fuel' && vehicle && scoped ? (
            <FuelView vehicle={vehicle} {...scoped} reload={reload} openNew={openNew} />
          ) : tab === 'service' && vehicle && scoped ? (
            <ServiceView vehicle={vehicle} {...scoped} reload={reload} openNew={openNew} />
          ) : tab === 'reminders' && vehicle && scoped ? (
            <RemindersView vehicle={vehicle} {...scoped} reload={reload} />
          ) : tab === 'reports' && vehicle && scoped ? (
            <ReportsView vehicle={vehicle} {...scoped} />
          ) : (
            <SettingsView data={data} reload={reload} onVehicleAdded={selectVehicle} />
          )}
        </main>
      </div>
    </div>
  );
}
