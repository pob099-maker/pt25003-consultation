-- The monthly scoreboard: "You said. We heard. We're acting."
--
-- Two tables. Editions are what the public sees: one row per project, month,
-- scope and kind, holding everything the page shows, frozen at publication.
-- Items are the team's register of everything people raised and everything
-- the project has committed to, which only the team can read; a published
-- edition carries its own copy of the items it shows, so the public never
-- reads this table.
--
-- A published edition is fixed. The update and delete policies only reach
-- drafts, so a published month cannot be quietly changed, by the app or by
-- anybody else holding a session. A correction goes in the next edition.
--
-- Run once in the Supabase SQL Editor. It is wrapped in a transaction, so it
-- lands completely or not at all.

begin;

create table if not exists public.consultation_scoreboard_editions (
  id uuid primary key,
  project_id text not null default 'PT25003' references public.consultation_projects (id),
  -- The month an edition reports on, as yyyy-mm.
  period text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  -- 'national', or a region id for a project with regional pages switched on.
  scope text not null default 'national' check (scope ~ '^[a-z0-9-]{1,40}$'),
  -- A monthly update, or the once-a-year playback.
  kind text not null default 'monthly' check (kind in ('monthly', 'annual')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  content jsonb not null default '{}'::jsonb,
  -- Staff identity only: who last edited and who published. Never a respondent.
  updated_by text not null default '' check (length(updated_by) <= 200),
  updated_at timestamptz not null default now(),
  published_by text check (published_by is null or length(published_by) <= 200),
  published_at timestamptz,
  unique (project_id, period, scope, kind),
  check ((status = 'published') = (published_at is not null))
);

create index if not exists consultation_scoreboard_editions_project_idx
  on public.consultation_scoreboard_editions (project_id, status, period desc);

alter table public.consultation_scoreboard_editions enable row level security;

-- Anybody may read a published edition: that is the point of it. Nothing else.
drop policy if exists consultation_scoreboard_editions_public on public.consultation_scoreboard_editions;
create policy consultation_scoreboard_editions_public on public.consultation_scoreboard_editions
  for select to anon
  using (status = 'published');

drop policy if exists consultation_scoreboard_editions_read on public.consultation_scoreboard_editions;
create policy consultation_scoreboard_editions_read on public.consultation_scoreboard_editions
  for select to authenticated
  using (status = 'published' or public.is_consultation_admin());

-- The team starts a month as a draft.
drop policy if exists consultation_scoreboard_editions_insert on public.consultation_scoreboard_editions;
create policy consultation_scoreboard_editions_insert on public.consultation_scoreboard_editions
  for insert to authenticated
  with check (public.is_consultation_admin() and status = 'draft');

-- Only a draft can change, and publishing is the last change it gets.
drop policy if exists consultation_scoreboard_editions_update on public.consultation_scoreboard_editions;
create policy consultation_scoreboard_editions_update on public.consultation_scoreboard_editions
  for update to authenticated
  using (public.is_consultation_admin() and status = 'draft')
  with check (public.is_consultation_admin());

drop policy if exists consultation_scoreboard_editions_delete on public.consultation_scoreboard_editions;
create policy consultation_scoreboard_editions_delete on public.consultation_scoreboard_editions
  for delete to authenticated
  using (public.is_consultation_admin() and status = 'draft');

create table if not exists public.consultation_scoreboard_items (
  id uuid primary key,
  project_id text not null default 'PT25003' references public.consultation_projects (id),
  title text not null check (length(title) between 1 and 200),
  scope text not null default 'national' check (scope ~ '^[a-z0-9-]{1,40}$'),
  stage text not null check (
    stage in ('listening', 'scoped', 'underway', 'delivered', 'not_taken_forward', 'passed_on')
  ),
  owner text not null default '' check (length(owner) <= 60),
  progress text not null default '' check (length(progress) <= 600),
  next_milestone text not null default '' check (length(next_milestone) <= 200),
  milestone_month text check (milestone_month is null or milestone_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  plan_ref text not null default '' check (length(plan_ref) <= 120),
  -- Why it is not being taken forward, or who it was passed to.
  reason text not null default '' check (length(reason) <= 600),
  themes text[] not null default '{}',
  -- Shown among the monthly commitments; the page shows five at most.
  featured boolean not null default false,
  -- [{ "stage": "...", "at": "iso date" }], oldest first.
  history jsonb not null default '[]'::jsonb,
  updated_by text not null default '' check (length(updated_by) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Saying no, or passing it on, always says why or to whom.
  check (stage not in ('not_taken_forward', 'passed_on') or length(trim(reason)) > 0)
);

create index if not exists consultation_scoreboard_items_project_idx
  on public.consultation_scoreboard_items (project_id);

alter table public.consultation_scoreboard_items enable row level security;

drop policy if exists consultation_scoreboard_items_admin on public.consultation_scoreboard_items;
create policy consultation_scoreboard_items_admin on public.consultation_scoreboard_items
  for all to authenticated
  using (public.is_consultation_admin())
  with check (public.is_consultation_admin());

commit;
