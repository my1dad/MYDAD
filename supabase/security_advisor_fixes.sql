-- Security advisor fixes for My Dollar A Day
-- Run in Supabase Dashboard → SQL Editor:
-- https://supabase.com/dashboard/project/payamrkwesnejaruenhm/sql/new
--
-- Clears:
-- 1) function_search_path_mutable on public.set_updated_at
-- 2) rls_policy_always_true on dad_bins / dad_kv / dad_profiles
--
-- Keeps anon/authenticated sync working for workspace `dollaraday`.

-- 1) Pin search_path on the updated_at trigger function
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

-- 2) Scope profiles to the app workspace (default fills existing rows)
alter table public.dad_profiles
  add column if not exists workspace_id text not null default 'dollaraday';

-- 3) Replace always-true ALL policies with workspace-scoped policies
drop policy if exists "dad_bins_anon_all" on public.dad_bins;
drop policy if exists "dad_kv_anon_all" on public.dad_kv;
drop policy if exists "dad_profiles_anon_all" on public.dad_profiles;

-- dad_bins
drop policy if exists "dad_bins_select_workspace" on public.dad_bins;
drop policy if exists "dad_bins_insert_workspace" on public.dad_bins;
drop policy if exists "dad_bins_update_workspace" on public.dad_bins;
drop policy if exists "dad_bins_delete_workspace" on public.dad_bins;

create policy "dad_bins_select_workspace" on public.dad_bins
  for select to anon, authenticated
  using (workspace_id = 'dollaraday');

create policy "dad_bins_insert_workspace" on public.dad_bins
  for insert to anon, authenticated
  with check (workspace_id = 'dollaraday');

create policy "dad_bins_update_workspace" on public.dad_bins
  for update to anon, authenticated
  using (workspace_id = 'dollaraday')
  with check (workspace_id = 'dollaraday');

create policy "dad_bins_delete_workspace" on public.dad_bins
  for delete to anon, authenticated
  using (workspace_id = 'dollaraday');

-- dad_kv
drop policy if exists "dad_kv_select_workspace" on public.dad_kv;
drop policy if exists "dad_kv_insert_workspace" on public.dad_kv;
drop policy if exists "dad_kv_update_workspace" on public.dad_kv;
drop policy if exists "dad_kv_delete_workspace" on public.dad_kv;

create policy "dad_kv_select_workspace" on public.dad_kv
  for select to anon, authenticated
  using (workspace_id = 'dollaraday');

create policy "dad_kv_insert_workspace" on public.dad_kv
  for insert to anon, authenticated
  with check (workspace_id = 'dollaraday');

create policy "dad_kv_update_workspace" on public.dad_kv
  for update to anon, authenticated
  using (workspace_id = 'dollaraday')
  with check (workspace_id = 'dollaraday');

create policy "dad_kv_delete_workspace" on public.dad_kv
  for delete to anon, authenticated
  using (workspace_id = 'dollaraday');

-- dad_profiles
drop policy if exists "dad_profiles_select_workspace" on public.dad_profiles;
drop policy if exists "dad_profiles_insert_workspace" on public.dad_profiles;
drop policy if exists "dad_profiles_update_workspace" on public.dad_profiles;
drop policy if exists "dad_profiles_delete_workspace" on public.dad_profiles;

create policy "dad_profiles_select_workspace" on public.dad_profiles
  for select to anon, authenticated
  using (workspace_id = 'dollaraday');

create policy "dad_profiles_insert_workspace" on public.dad_profiles
  for insert to anon, authenticated
  with check (workspace_id = 'dollaraday');

create policy "dad_profiles_update_workspace" on public.dad_profiles
  for update to anon, authenticated
  using (workspace_id = 'dollaraday')
  with check (workspace_id = 'dollaraday');

create policy "dad_profiles_delete_workspace" on public.dad_profiles
  for delete to anon, authenticated
  using (workspace_id = 'dollaraday');
