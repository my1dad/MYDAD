-- Optional: add account_number to live dad_profiles (schema has it; production may not).
-- Run in Supabase SQL Editor if account numbers should sync to cloud:
-- https://supabase.com/dashboard/project/payamrkwesnejaruenhm/sql/new

alter table public.dad_profiles
  add column if not exists account_number text;

create unique index if not exists dad_profiles_account_number_idx
  on public.dad_profiles (account_number)
  where account_number is not null;
