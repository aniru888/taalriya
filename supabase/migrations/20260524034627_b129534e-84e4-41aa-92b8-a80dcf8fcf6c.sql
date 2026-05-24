
-- Subscription tier enum
create type public.subscription_tier as enum ('free', 'premium');

-- Profiles table (synced from auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  tier public.subscription_tier not null default 'free',
  settings jsonb not null default '{}'::jsonb,
  favorites text[] not null default '{}',
  total_practice_ms bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles are insertable by owner"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id);

-- Custom taals saved per user
create table public.user_taals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  beats integer not null,
  divisions text,
  steps jsonb not null,
  sam integer not null default 1,
  khali integer[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_taals enable row level security;

create policy "Taals viewable by owner"
  on public.user_taals for select using (auth.uid() = user_id);
create policy "Taals insertable by owner"
  on public.user_taals for insert with check (auth.uid() = user_id);
create policy "Taals updatable by owner"
  on public.user_taals for update using (auth.uid() = user_id);
create policy "Taals deletable by owner"
  on public.user_taals for delete using (auth.uid() = user_id);

-- updated_at trigger fn
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger user_taals_set_updated_at before update on public.user_taals
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
