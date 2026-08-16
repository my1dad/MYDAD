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
  account_number text,
  email text,
  phone text,
  profile_photo_url text,
  referred_by_pro_id text,
  account_status text,
  approval_status text,
  workspace_id text not null default 'dollaraday',
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists dad_profiles_username_lower_idx
  on public.dad_profiles (lower(username));

-- Existing projects: add account_number / workspace_id if the table already existed without them
alter table public.dad_profiles
  add column if not exists account_number text;

alter table public.dad_profiles
  add column if not exists workspace_id text not null default 'dollaraday';

create unique index if not exists dad_profiles_account_number_idx
  on public.dad_profiles (account_number)
  where account_number is not null;

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

-- Row Level Security (scoped to workspace dollaraday — not USING (true))
alter table public.dad_bins enable row level security;
alter table public.dad_profiles enable row level security;
alter table public.dad_kv enable row level security;

drop policy if exists "dad_bins_anon_all" on public.dad_bins;
drop policy if exists "dad_kv_anon_all" on public.dad_kv;
drop policy if exists "dad_profiles_anon_all" on public.dad_profiles;

drop policy if exists "dad_bins_select_workspace" on public.dad_bins;
drop policy if exists "dad_bins_insert_workspace" on public.dad_bins;
drop policy if exists "dad_bins_update_workspace" on public.dad_bins;
drop policy if exists "dad_bins_delete_workspace" on public.dad_bins;
create policy "dad_bins_select_workspace" on public.dad_bins
  for select to anon, authenticated using (workspace_id = 'dollaraday');
create policy "dad_bins_insert_workspace" on public.dad_bins
  for insert to anon, authenticated with check (workspace_id = 'dollaraday');
create policy "dad_bins_update_workspace" on public.dad_bins
  for update to anon, authenticated
  using (workspace_id = 'dollaraday') with check (workspace_id = 'dollaraday');
create policy "dad_bins_delete_workspace" on public.dad_bins
  for delete to anon, authenticated using (workspace_id = 'dollaraday');

drop policy if exists "dad_kv_select_workspace" on public.dad_kv;
drop policy if exists "dad_kv_insert_workspace" on public.dad_kv;
drop policy if exists "dad_kv_update_workspace" on public.dad_kv;
drop policy if exists "dad_kv_delete_workspace" on public.dad_kv;
create policy "dad_kv_select_workspace" on public.dad_kv
  for select to anon, authenticated using (workspace_id = 'dollaraday');
create policy "dad_kv_insert_workspace" on public.dad_kv
  for insert to anon, authenticated with check (workspace_id = 'dollaraday');
create policy "dad_kv_update_workspace" on public.dad_kv
  for update to anon, authenticated
  using (workspace_id = 'dollaraday') with check (workspace_id = 'dollaraday');
create policy "dad_kv_delete_workspace" on public.dad_kv
  for delete to anon, authenticated using (workspace_id = 'dollaraday');

drop policy if exists "dad_profiles_select_workspace" on public.dad_profiles;
drop policy if exists "dad_profiles_insert_workspace" on public.dad_profiles;
drop policy if exists "dad_profiles_update_workspace" on public.dad_profiles;
drop policy if exists "dad_profiles_delete_workspace" on public.dad_profiles;
create policy "dad_profiles_select_workspace" on public.dad_profiles
  for select to anon, authenticated using (workspace_id = 'dollaraday');
create policy "dad_profiles_insert_workspace" on public.dad_profiles
  for insert to anon, authenticated with check (workspace_id = 'dollaraday');
create policy "dad_profiles_update_workspace" on public.dad_profiles
  for update to anon, authenticated
  using (workspace_id = 'dollaraday') with check (workspace_id = 'dollaraday');
create policy "dad_profiles_delete_workspace" on public.dad_profiles
  for delete to anon, authenticated using (workspace_id = 'dollaraday');

-- Auto-update updated_at (search_path pinned for security advisor)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
