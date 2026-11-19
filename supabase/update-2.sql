-- =====================================================================
-- Villa Doors: update 2
-- Adds: "No Soliciting" status, follow-up dates, lead source, team settings
-- (daily goal), and lets the phone pick IDs so offline pins sync safely.
-- Safe to run more than once.
-- =====================================================================

-- New door status: no_soliciting
alter table public.doors drop constraint if exists doors_status_check;
alter table public.doors add constraint doors_status_check
  check (status in ('lead', 'maybe', 'not_home', 'not_interested', 'come_back', 'no_soliciting'));
alter table public.visits drop constraint if exists visits_status_check;
alter table public.visits add constraint visits_status_check
  check (status in ('lead', 'maybe', 'not_home', 'not_interested', 'come_back', 'no_soliciting'));

-- Follow-ups
alter table public.doors add column if not exists follow_up_at timestamptz;
alter table public.contacts add column if not exists follow_up_at timestamptz;

-- Where a lead came from (door knock, referral, ads...)
alter table public.contacts add column if not exists source text;
update public.contacts set source = 'Door knock' where source is null and door_id is not null;

create index if not exists doors_follow_up_idx on public.doors (follow_up_at) where follow_up_at is not null;
create index if not exists contacts_follow_up_idx on public.contacts (follow_up_at) where follow_up_at is not null;

-- Team settings (daily door goal, etc.)
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
drop policy if exists "team full access" on public.settings;
create policy "team full access" on public.settings
  for all to authenticated using (public.is_team()) with check (public.is_team());
insert into public.settings (key, value) values ('daily_goal', '{"doors": 50}')
on conflict (key) do nothing;

-- Access for signed-in users (row security still applies)
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
