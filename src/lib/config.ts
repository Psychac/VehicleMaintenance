export type BackendKind = 'sqlite' | 'supabase';

export interface StorageConfig {
  backend: BackendKind;
  supabaseUrl: string;
  supabaseKey: string;
}

const KEY = 'vehicle-log:storage';

/** The saved choice, else on-device SQLite. */
export function loadConfig(): StorageConfig {
  const fallback: StorageConfig = { backend: 'sqlite', supabaseUrl: '', supabaseKey: '' };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<StorageConfig> | null;
    if (!saved) return fallback;
    return {
      backend: saved.backend === 'supabase' ? 'supabase' : 'sqlite',
      supabaseUrl: saved.supabaseUrl ?? '',
      supabaseKey: saved.supabaseKey ?? '',
    };
  } catch {
    return fallback;
  }
}

export function saveConfig(config: StorageConfig): void {
  localStorage.setItem(KEY, JSON.stringify(config));
}
