
-- ============ ROLES ============
create type public.app_role as enum ('owner', 'admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('admin', 'owner')
  )
$$;

-- Users may view their own role rows
create policy "Users view own roles" on public.user_roles
for select to authenticated
using (auth.uid() = user_id);

-- Owner may view all role rows
create policy "Owner views all roles" on public.user_roles
for select to authenticated
using (public.has_role(auth.uid(), 'owner'));

-- Only owner may insert/update/delete role rows
create policy "Owner manages roles insert" on public.user_roles
for insert to authenticated
with check (public.has_role(auth.uid(), 'owner'));

create policy "Owner manages roles update" on public.user_roles
for update to authenticated
using (public.has_role(auth.uid(), 'owner'));

create policy "Owner manages roles delete" on public.user_roles
for delete to authenticated
using (
  public.has_role(auth.uid(), 'owner')
  -- never let owner delete their own owner row
  and not (user_id = auth.uid() and role = 'owner')
);

-- ============ ADMIN REQUESTS ============
create type public.admin_request_status as enum ('pending', 'approved', 'rejected');

create table public.admin_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message text,
  status admin_request_status not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_requests enable row level security;

create policy "User views own requests" on public.admin_requests
for select to authenticated
using (auth.uid() = user_id);

create policy "User creates own request" on public.admin_requests
for insert to authenticated
with check (auth.uid() = user_id and status = 'pending');

create policy "Owner views all requests" on public.admin_requests
for select to authenticated
using (public.has_role(auth.uid(), 'owner'));

create policy "Owner updates requests" on public.admin_requests
for update to authenticated
using (public.has_role(auth.uid(), 'owner'));

create trigger trg_admin_requests_updated
before update on public.admin_requests
for each row execute function public.set_updated_at();

-- ============ LIBRARY ============
create type public.library_sound_kind as enum ('bol', 'tanpura', 'taal_loop');

create table public.library_sounds (
  id uuid primary key default gen_random_uuid(),
  kind library_sound_kind not null,
  name text not null,
  description text,
  tags text[] not null default '{}',
  bpm integer,
  scale text,
  category text,
  taal_name text,
  storage_path text not null,
  duration_ms integer,
  is_featured boolean not null default false,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.library_sounds enable row level security;

create policy "Authenticated can view library sounds" on public.library_sounds
for select to authenticated using (true);

create policy "Admins insert library sounds" on public.library_sounds
for insert to authenticated with check (public.is_admin(auth.uid()));

create policy "Admins update library sounds" on public.library_sounds
for update to authenticated using (public.is_admin(auth.uid()));

create policy "Admins delete library sounds" on public.library_sounds
for delete to authenticated using (public.is_admin(auth.uid()));

create trigger trg_library_sounds_updated
before update on public.library_sounds
for each row execute function public.set_updated_at();

create table public.library_taals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  beats integer not null,
  divisions text,
  steps jsonb not null,
  sam integer not null default 1,
  khali integer[] not null default '{}',
  description text,
  tags text[] not null default '{}',
  category text,
  is_featured boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.library_taals enable row level security;

create policy "Authenticated view library taals" on public.library_taals
for select to authenticated using (true);

create policy "Admins insert library taals" on public.library_taals
for insert to authenticated with check (public.is_admin(auth.uid()));

create policy "Admins update library taals" on public.library_taals
for update to authenticated using (public.is_admin(auth.uid()));

create policy "Admins delete library taals" on public.library_taals
for delete to authenticated using (public.is_admin(auth.uid()));

create trigger trg_library_taals_updated
before update on public.library_taals
for each row execute function public.set_updated_at();

-- ============ STORAGE ============
insert into storage.buckets (id, name, public)
values ('sound-library', 'sound-library', false)
on conflict (id) do nothing;

create policy "Authenticated read sound-library" on storage.objects
for select to authenticated
using (bucket_id = 'sound-library');

create policy "Admins upload sound-library" on storage.objects
for insert to authenticated
with check (bucket_id = 'sound-library' and public.is_admin(auth.uid()));

create policy "Admins update sound-library" on storage.objects
for update to authenticated
using (bucket_id = 'sound-library' and public.is_admin(auth.uid()));

create policy "Admins delete sound-library" on storage.objects
for delete to authenticated
using (bucket_id = 'sound-library' and public.is_admin(auth.uid()));
