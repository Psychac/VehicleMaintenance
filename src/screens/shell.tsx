import { createContext, useContext, type ReactNode } from 'react';
import type { Vehicle } from '../lib/types';

export type Tab = 'home' | 'log' | 'reminders' | 'more';
export type Sub = 'reports' | 'vehicles' | 'backup' | 'storage' | 'account';
export interface Route {
  tab: Tab;
  /** A pushed screen under the tab (only `more` has any). */
  sub?: Sub;
}

export interface ShellApi {
  /** Compact "current vehicle" button for screen headers; opens the vehicle picker. */
  vehicleButton: ReactNode;
  /** Icon-only version for Home, whose large title already is the vehicle name. */
  switchButton: ReactNode;
  editVehicle: (v: Vehicle | 'new') => void;
  navigate: (r: Route) => void;
  /** Pops a pushed screen (browser history, so the system back gesture agrees). */
  back: () => void;
}

const ShellContext = createContext<ShellApi | null>(null);
export const ShellProvider = ShellContext.Provider;

export function useShell(): ShellApi {
  const v = useContext(ShellContext);
  if (!v) throw new Error('useShell must be used inside <ShellProvider>');
  return v;
}
