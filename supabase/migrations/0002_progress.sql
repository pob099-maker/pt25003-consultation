-- Where people stop.
--
-- A consultation response only exists once somebody presses submit, so anyone
-- who gives up at step four leaves no trace at all. That hides the one thing
-- worth knowing while the consultation is still running: whether a branch is
-- too long, and which screen is doing the damage.
--
-- This table holds the shape of a session and nothing said in it. No answers,
-- no free text, no contact details — a row says "somebody on the contractor
-- path reached the priorities step and did not come back", which is exactly
-- the question and not a word more. Storing the partial answers as well was
-- the obvious alternative and is not done on purpose: keeping the views of
-- somebody who chose not to submit them is not ours to do, having told them
-- they may stop at any time.

create table if not exists public.consultation_progress (
  -- Client-generated, unguessable, and never shown to the respondent. It is
  -- what lets a session update its own row without anyone signing in.
  id uuid primary key,
  round_id text not null,
  role text,
  pathway text,
  furthest_step integer not null default 0,
  furthest_step_id text not null default '',
  step_count integer not null default 0,
  completed boolean not null default false,
  started_at timestamptz not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists consultation_progress_round_idx on public.consultation_progress (round_id);
create index if not exists consultation_progress_completed_idx on public.consultation_progress (completed);

alter table public.consultation_progress enable row level security;

-- A respondent may start a row and keep it up to date. They cannot read one,
-- cannot delete one, and cannot touch a row that has already been marked
-- finished — so a completed session is a fact, not something that can be
-- edited afterwards. Ids are random v4 uuids and are never readable, so there
-- is nothing to enumerate.
drop policy if exists consultation_progress_insert on public.consultation_progress;
create policy consultation_progress_insert on public.consultation_progress
  for insert to anon, authenticated
  with check (true);

drop policy if exists consultation_progress_update on public.consultation_progress;
create policy consultation_progress_update on public.consultation_progress
  for update to anon, authenticated
  using (completed = false)
  with check (true);

drop policy if exists consultation_progress_admin_read on public.consultation_progress;
create policy consultation_progress_admin_read on public.consultation_progress
  for select to authenticated
  using (public.is_consultation_admin());

-- Old sessions are noise once the consultation closes. An administrator can
-- clear them without touching a single response:
--   delete from public.consultation_progress;
drop policy if exists consultation_progress_admin_delete on public.consultation_progress;
create policy consultation_progress_admin_delete on public.consultation_progress
  for delete to authenticated
  using (public.is_consultation_admin());
