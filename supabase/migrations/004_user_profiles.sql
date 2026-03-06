-- user_profiles テーブル
create table if not exists public.user_profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "users can select own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "users can insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = id);

create policy "users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = id);
