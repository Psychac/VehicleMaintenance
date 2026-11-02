# Vehicle Log

Track fuel, mileage (km/L), services, expenses and maintenance reminders for multiple vehicles.
Installable on your phone (PWA), synced through a free Supabase database, with daily backups to your PC.

## Features

- **Multiple vehicles**: switch from the top bar; archive sold vehicles.
- **Fuel log**: km/L calculated full-tank to full-tank; partial fills are counted correctly.
- **Service & expenses**: services, repairs, tyres, insurance, tax and more, with categories.
- **Reminders**: due by distance, by time, or whichever comes first (e.g. oil every 10,000 km or 12 months).
  Logging a service can reset the reminders it covers.
- **Reports**: monthly spend (chart or table), spend by category, fuel-efficiency trend.
- **Backups**: JSON/CSV export and restore in the app, plus a scheduled backup script for Windows.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test
```

Without Supabase settings the app runs in **demo mode** and stores data in this browser only.

## 1. Create the database (Supabase, free tier)

1. Sign up at <https://supabase.com> and create a new project. Pick a region close to you.
2. Open **SQL Editor → New query**, paste the contents of [supabase/schema.sql](supabase/schema.sql) and click **Run**.
3. In **Project Settings → API**, copy the **Project URL** and the **anon public** key.
4. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
   `VITE_CURRENCY` sets the display currency (default `INR`).
5. Run `npm run dev`, create your account, and sign in.

The anon key is safe to ship in the website: row-level security in the schema means each signed-in user can
only read and write their own rows.

**Email confirmation:** Supabase sends a confirmation email on sign-up by default. Since you're the only user,
you can turn it off under **Authentication → Sign In / Providers → Email → Confirm email**. If you keep it on,
set **Authentication → URL Configuration → Site URL** to your deployed URL so the email link points there.

**Stop strangers signing up:** once your account exists, disable **Authentication → Sign In / Providers →
Allow new users to sign up**.

## 2. Host the website (free)

The app is a static site. Any of these work; Vercel shown here:

1. Push this folder to a GitHub repository (private is fine).
2. On <https://vercel.com>, **Add New → Project**, import the repo. Framework preset: **Vite**.
3. Under **Environment Variables**, add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_CURRENCY`.
4. Deploy. Every push to the main branch redeploys.

Netlify or Cloudflare Pages: build command `npm run build`, output directory `dist`, same environment variables.

**On your phone:** open the site and choose *Add to Home screen* (Android Chrome / iOS Safari Share menu).
It opens full screen like an app. Data refreshes whenever you switch back to it.

## 3. Back up to your PC

### Manual

**Settings → Download backup (JSON)** saves everything. **Restore from backup…** loads a backup file back in
(it overwrites matching entries and never deletes anything). **Export spreadsheet (CSV)** gives you a file you
can open in Excel.

### Automatic daily backup (Windows)

1. Copy `.env.backup.example` to `.env.backup` and fill in the Supabase URL, anon key, and your app email and
   password. This file is git-ignored; it stays on your PC.
2. Test it: `npm run backup` → writes `backups/vehicle-log-YYYY-MM-DD.json`.
3. Schedule it (runs daily at 21:00, or at next start-up if the PC was off):

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\schedule-backup.ps1
   # different time: ... -File scripts\schedule-backup.ps1 -Time "08:30"
   ```

Old backups beyond `BACKUP_KEEP` (default 60) are deleted. Put `BACKUP_DIR` inside OneDrive/Google Drive if you
also want an off-PC copy. Output is logged to `backups/backup.log`.

A side benefit: Supabase pauses free projects after about a week with no activity. The daily backup counts as
activity and keeps it awake. (If it does pause, resume it from the Supabase dashboard; no data is lost.)

### Restoring after a disaster

If the Supabase project is lost: create a new project, run `supabase/schema.sql`, update the URLs and keys,
sign up again, then use **Settings → Restore from backup…** with your latest JSON file.

## Project layout

| Path | Purpose |
|---|---|
| `src/lib/calc.ts` | Efficiency, reminder due-status and cost calculations (unit-tested) |
| `src/lib/db.ts` | Data access: Supabase, or localStorage in demo mode |
| `src/components/` | Screens: Overview, Fuel, Service, Reminders, Reports, Settings |
| `supabase/schema.sql` | Tables and row-level security |
| `scripts/backup.mjs` | Local backup script |
| `scripts/schedule-backup.ps1` | Registers the daily Windows scheduled task |
