-- Vehicle Log schema. Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Every row belongs to the signed-in user; row-level security keeps users isolated.

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  make text,
  model text,
  year int,
  plate text,
  fuel_type text default 'petrol',
  start_odometer numeric not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.fuel_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  vehicle_id uuid not null references public.vehicles on delete cascade,
  date date not null,
  odometer numeric not null,
  litres numeric not null,
  total_cost numeric not null default 0,
  full_tank boolean not null default true,
  remaining_litres numeric,
  station text,
  notes text,
  created_at timestamptz not null default now()
);
-- For databases created before remaining_litres existed (safe to re-run):
alter table public.fuel_logs add column if not exists remaining_litres numeric;

create table if not exists public.service_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  vehicle_id uuid not null references public.vehicles on delete cascade,
  date date not null,
  odometer numeric,
  category text not null default 'service',
  title text not null,
  cost numeric not null default 0,
  vendor text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  vehicle_id uuid not null references public.vehicles on delete cascade,
  title text not null,
  interval_km numeric,
  interval_months int,
  last_done_date date,
  last_done_odometer numeric,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists fuel_logs_vehicle_idx on public.fuel_logs (vehicle_id, date);
create index if not exists service_logs_vehicle_idx on public.service_logs (vehicle_id, date);
create index if not exists reminders_vehicle_idx on public.reminders (vehicle_id);

do $$
declare t text;
begin
  foreach t in array array['vehicles', 'fuel_logs', 'service_logs', 'reminders'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t
    );
  end loop;
end $$;
