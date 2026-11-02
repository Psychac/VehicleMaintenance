// Pulls every table from Supabase into a dated JSON file on this PC.
// The file has the same format as the in-app "Download backup", so it can be
// restored from Settings -> Restore from backup.
//
// Usage: npm run backup            (reads .env.backup)
// Schedule daily with scripts/schedule-backup.ps1.

import { createClient } from '@supabase/supabase-js';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TABLES = ['vehicles', 'fuel_logs', 'service_logs', 'reminders'];

async function loadEnv(file) {
  const env = {};
  const text = await readFile(file, 'utf8').catch(() => {
    throw new Error(`Missing ${file}. Copy .env.backup.example to .env.backup and fill it in.`);
  });
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

async function main() {
  const env = { ...(await loadEnv(path.join(root, '.env.backup'))), ...process.env };
  for (const k of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'BACKUP_EMAIL', 'BACKUP_PASSWORD']) {
    if (!env[k]) throw new Error(`${k} is not set in .env.backup`);
  }
  const dir = path.resolve(root, env.BACKUP_DIR || './backups');
  const keep = Number(env.BACKUP_KEEP || 60);

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: env.BACKUP_EMAIL,
    password: env.BACKUP_PASSWORD,
  });
  if (authError) throw new Error(`Sign-in failed: ${authError.message}`);

  const data = {};
  for (const table of TABLES) {
    const { data: rows, error } = await supabase.from(table).select('*').order('created_at');
    if (error) throw new Error(`Reading ${table} failed: ${error.message}`);
    data[table] = rows;
  }
  await supabase.auth.signOut();

  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const file = path.join(dir, `vehicle-log-${stamp}.json`);
  const backup = { app: 'vehicle-log', version: 1, exported_at: new Date().toISOString(), data };
  await writeFile(file, JSON.stringify(backup, null, 2));

  // Keep the newest `keep` backups.
  const old = (await readdir(dir))
    .filter((f) => /^vehicle-log-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse()
    .slice(keep);
  for (const f of old) await rm(path.join(dir, f));

  const counts = TABLES.map((t) => `${data[t].length} ${t}`).join(', ');
  console.log(`Backed up ${counts} -> ${file}${old.length ? ` (pruned ${old.length} old)` : ''}`);
}

main().catch((e) => {
  console.error(`Backup failed: ${e.message}`);
  process.exit(1);
});
