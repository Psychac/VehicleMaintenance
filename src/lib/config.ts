export type BackendKind = 'sqlite' | 'supabase';

export interface StorageConfig {
  backend: BackendKind;
  supabaseUrl: string;
  supabaseKey: string;
}

const KEY = 'vehicle-log:storage';
const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

/** The saved choice, else Supabase if the build has env config, else on-device SQLite. */
export function loadConfig(): StorageConfig {
  const fallback: StorageConfig = {
    backend: envUrl && envKey ? 'supabase' : 'sqlite',
    supabaseUrl: envUrl,
    supabaseKey: envKey,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<StorageConfig> | null;
    if (!saved) return fallback;
    return {
      backend: saved.backend === 'supabase' ? 'supabase' : 'sqlite',
      supabaseUrl: saved.supabaseUrl || envUrl,
      supabaseKey: saved.supabaseKey || envKey,
    };
  } catch {
    return fallback;
  }
}

export function saveConfig(config: StorageConfig): void {
  localStorage.setItem(KEY, JSON.stringify(config));
}
