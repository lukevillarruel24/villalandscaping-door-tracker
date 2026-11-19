-- =====================================================================
-- Villa Doors: database setup
-- Paste this whole file into Supabase > SQL Editor > New query, then Run.
--
-- BEFORE YOU RUN: scroll to the bottom and put your email and your
-- rep's email in the "team_members" insert. Only those emails can see
-- or change anything in the app.
-- =====================================================================

-- ---------- Team allowlist ----------
create table if not exists public.team_members (
  email text primary key,
  added_at timestamptz not null default now()
);

create or replace function public.is_team()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------- Profiles (names shown in the app) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for any users that already exist
insert into public.profiles (id, full_name, email)
select id, coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1)), email
from auth.users
on conflict (id) do nothing;

-- ---------- updated_at helper ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- Doors (every house pinned on the map) ----------
create table if not exists public.doors (
  id uuid primary key default gen_random_uuid(),
  lat double precision not null,
  lng double precision not null,
  address text,
  status text not null default 'not_home'
    check (status in ('lead', 'maybe', 'not_home', 'not_interested', 'come_back')),
  notes text,
  contact_id uuid,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Visits (each knock, so you can see history) ----------
create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  door_id uuid not null references public.doors (id) on delete cascade,
  status text not null
    check (status in ('lead', 'maybe', 'not_home', 'not_interested', 'come_back')),
  note text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists visits_door_idx on public.visits (door_id);
create index if not exists visits_created_idx on public.visits (created_at);

-- ---------- Contacts (leads and clients) ----------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  door_id uuid references public.doors (id) on delete set null,
  stage text not null default 'lead' check (stage in ('lead', 'client', 'lost')),
  name text not null,
  phone text,
  email text,
  address text,
  lat double precision,
  lng double precision,
  services text[] not null default '{}',
  budget text,
  best_time text,
  notes text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  converted_at timestamptz
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'doors_contact_fk') then
    alter table public.doors
      add constraint doors_contact_fk foreign key (contact_id)
      references public.contacts (id) on delete set null;
  end if;
end $$;

-- ---------- Notes on a lead/client ----------
create table if not exists public.contact_notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  body text not null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Job photos ----------
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  path text not null,
  caption text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Estimates ----------
create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  number serial,
  title text not null default 'Estimate',
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined')),
  tax_rate numeric not null default 0,
  notes text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Start estimate numbers at #1001 (only on a fresh database)
do $$
begin
  if not exists (select 1 from public.estimates) then
    perform setval(pg_get_serial_sequence('public.estimates', 'number'), 1000, true);
  end if;
end $$;

create table if not exists public.estimate_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates (id) on delete cascade,
  description text not null default '',
  qty numeric not null default 1,
  unit text,
  unit_price numeric not null default 0,
  position int not null default 0
);
create index if not exists estimate_items_est_idx on public.estimate_items (estimate_id);

-- ---------- updated_at triggers ----------
drop trigger if exists doors_updated on public.doors;
create trigger doors_updated before update on public.doors
  for each row execute function public.set_updated_at();
drop trigger if exists contacts_updated on public.contacts;
create trigger contacts_updated before update on public.contacts
  for each row execute function public.set_updated_at();
drop trigger if exists estimates_updated on public.estimates;
create trigger estimates_updated before update on public.estimates
  for each row execute function public.set_updated_at();

-- ---------- Security: only team members can read or write ----------
alter table public.team_members enable row level security;
alter table public.profiles enable row level security;
alter table public.doors enable row level security;
alter table public.visits enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_notes enable row level security;
alter table public.photos enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_items enable row level security;

drop policy if exists "team reads team" on public.team_members;
create policy "team reads team" on public.team_members
  for select to authenticated using (public.is_team());

drop policy if exists "team reads profiles" on public.profiles;
create policy "team reads profiles" on public.profiles
  for select to authenticated using (public.is_team());
drop policy if exists "edit own profile" on public.profiles;
create policy "edit own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['doors','visits','contacts','contact_notes','photos','estimates','estimate_items']
  loop
    execute format('drop policy if exists "team full access" on public.%I', t);
    execute format(
      'create policy "team full access" on public.%I for all to authenticated using (public.is_team()) with check (public.is_team())',
      t
    );
  end loop;
end $$;

-- ---------- Photo storage bucket (private) ----------
insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', false)
on conflict (id) do nothing;

drop policy if exists "team reads photos" on storage.objects;
create policy "team reads photos" on storage.objects
  for select to authenticated using (bucket_id = 'job-photos' and public.is_team());
drop policy if exists "team uploads photos" on storage.objects;
create policy "team uploads photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'job-photos' and public.is_team());
drop policy if exists "team deletes photos" on storage.objects;
create policy "team deletes photos" on storage.objects
  for delete to authenticated using (bucket_id = 'job-photos' and public.is_team());

-- ---------- Live updates (pins show up on both phones right away) ----------
do $$
begin
  begin
    alter publication supabase_realtime add table public.doors;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.contacts;
  exception when duplicate_object then null;
  end;
end $$;

-- =====================================================================
-- YOUR TEAM: replace these two emails with yours and your rep's.
-- To add someone later, run:  insert into public.team_members (email) values ('them@example.com');
-- =====================================================================
insert into public.team_members (email) values
  ('YOUR-EMAIL@example.com'),
  ('REP-EMAIL@example.com')
on conflict (email) do nothing;
