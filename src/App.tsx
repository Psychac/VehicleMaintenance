import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { initDb, isLocalMode, listAll, storageStatus, supabase } from './lib/db';
import type { AllData } from './lib/types';
import Auth from './components/Auth';
import StorageSettings from './components/StorageSettings';
import Overview from './components/Overview';
import FuelView from './components/FuelView';
import ServiceView from './components/ServiceView';
import RemindersView from './components/RemindersView';
import ReportsView from './components/ReportsView';
import SettingsView from './components/SettingsView';

const TABS = [
  ['overview', 'Overview'],
  ['fuel', 'Fuel'],
  ['service', 'Service'],
  ['reminders', 'Reminders'],
  ['reports', 'Reports'],
  ['settings', 'Settings'],
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
  const [tab, setTabState] = useState<Tab>(() => {
    const fromHash = window.location.hash.slice(1);
    return TABS.some(([id]) => id === fromHash) ? (fromHash as Tab) : 'overview';
  });
  const setTab = (t: Tab) => {
    setTabState(t);
    history.replaceState(null, '', `#${t}`);
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
    if (signedIn) reload();
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
  if (!authReady || (isLocalMode && !dbReady)) return <div className="center muted">Loading…</div>;
  if (!signedIn) return <Auth />;

  const scoped = vehicle
    ? {
        fuel: data.fuel_logs.filter((f) => f.vehicle_id === vehicle.id),
        service: data.service_logs.filter((s) => s.vehicle_id === vehicle.id),
        reminders: data.reminders.filter((r) => r.vehicle_id === vehicle.id),
      }
    : null;

  const needsVehicle = !vehicle && tab !== 'settings';

  return (
    <div className="app">
      <header className="topbar">
        <h1>Vehicle Log</h1>
        {activeVehicles.length > 0 && (
          <select
            aria-label="Vehicle"
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

      <nav className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {isLocalMode && !storageStatus.persistent && (
        <p className="banner error">
          This browser can't save the on-device database ({storageStatus.reason ?? 'OPFS unavailable'}). Data will be lost
          when you close or reload the page — download a backup in Settings. If the app is open in another tab, close it
          and reload.
        </p>
      )}
      {error && <p className="banner error">Couldn't load data: {error}</p>}

      <main>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : needsVehicle ? (
          <div className="empty">
            <p>Add your first vehicle to get started.</p>
            <button className="primary" onClick={() => setTab('settings')}>
              Add a vehicle
            </button>
          </div>
        ) : tab === 'overview' && vehicle && scoped ? (
          <Overview vehicle={vehicle} {...scoped} onNavigate={setTab} />
        ) : tab === 'fuel' && vehicle && scoped ? (
          <FuelView vehicle={vehicle} {...scoped} reload={reload} />
        ) : tab === 'service' && vehicle && scoped ? (
          <ServiceView vehicle={vehicle} {...scoped} reload={reload} />
        ) : tab === 'reminders' && vehicle && scoped ? (
          <RemindersView vehicle={vehicle} {...scoped} reload={reload} />
        ) : tab === 'reports' && vehicle && scoped ? (
          <ReportsView vehicle={vehicle} {...scoped} />
        ) : (
          <SettingsView data={data} reload={reload} onVehicleAdded={selectVehicle} />
        )}
      </main>
    </div>
  );
}
