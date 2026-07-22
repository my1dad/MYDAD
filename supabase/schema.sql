-- My Dollar A Day — Supabase cloud schema
-- Run this in Supabase Dashboard → SQL Editor for project payamrkwesnejaruenhm
-- https://supabase.com/dashboard/project/payamrkwesnejaruenhm/sql/new

-- Workspace-scoped data bins (members, contributions, settings, community, etc.)
create table if not exists public.dad_bins (
  workspace_id text not null default 'dollaraday',
  bin_id text not null,
  document jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, bin_id)
);

-- Member / admin login profiles
create table if not exists public.dad_profiles (
  id text primary key,
  username text not null,
  password text not null,
  display_name text not null,
  full_name text,
  role text,
  pro_id text,
  email text,
  phone text,
  profile_photo_url text,
  referred_by_pro_id text,
  account_status text,
  approval_status text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists dad_profiles_username_lower_idx
  on public.dad_profiles (lower(username));

-- Global + per-profile key/value (app settings, notification read state, locale, etc.)
create table if not exists public.dad_kv (
  workspace_id text not null default 'dollaraday',
  scope_key text not null default 'global',
  kv_key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, scope_key, kv_key)
);

-- Expose tables to Data API (required on newer Supabase projects)
grant select, insert, update, delete on public.dad_bins to anon, authenticated, service_role;
grant select, insert, update, delete on public.dad_profiles to anon, authenticated, service_role;
grant select, insert, update, delete on public.dad_kv to anon, authenticated, service_role;

-- Enable Realtime publication (ignore errors if already added)
do $$
begin
  alter publication supabase_realtime add table public.dad_bins;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.dad_profiles;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.dad_kv;
exception when duplicate_object then null;
end $$;

-- Row Level Security
alter table public.dad_bins enable row level security;
alter table public.dad_profiles enable row level security;
alter table public.dad_kv enable row level security;

drop policy if exists "dad_bins_anon_all" on public.dad_bins;
create policy "dad_bins_anon_all" on public.dad_bins
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "dad_profiles_anon_all" on public.dad_profiles;
create policy "dad_profiles_anon_all" on public.dad_profiles
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "dad_kv_anon_all" on public.dad_kv;
create policy "dad_kv_anon_all" on public.dad_kv
  for all to anon, authenticated using (true) with check (true);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists dad_bins_updated_at on public.dad_bins;
create trigger dad_bins_updated_at
  before update on public.dad_bins
  for each row execute function public.set_updated_at();

drop trigger if exists dad_profiles_updated_at on public.dad_profiles;
create trigger dad_profiles_updated_at
  before update on public.dad_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists dad_kv_updated_at on public.dad_kv;
create trigger dad_kv_updated_at
  before update on public.dad_kv
  for each row execute function public.set_updated_at();
