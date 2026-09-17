-- Regional grower-group discussions.
--
-- A show of hands from twelve growers is not twelve responses, and it is not
-- one either. Recording a room as individual rows is the commonest way a
-- mixed-method consultation corrupts its own data, so a group gets a record of
-- its own: how many were in the room, and how many hands went up for each
-- option. It is reported beside the individual responses, never added to them.
--
--   roles   role id -> rough number of that role in the room
--   counts  question id -> option id -> number of hands
--           (for a rating question: how many rated the area 4 or 5;
--            for a ranking: how many put it in their top three)
--   notes   question id -> what the room said, in its own words

create table if not exists public.consultation_group_records (
  id uuid primary key,
  round_id text not null,
  title text not null check (length(title) between 1 and 160),
  region text not null default '',
  held_on date not null,
  present integer not null check (present between 1 and 500),
  roles jsonb not null default '{}'::jsonb,
  counts jsonb not null default '{}'::jsonb,
  notes jsonb not null default '{}'::jsonb,
  collected_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists consultation_group_records_round_idx on public.consultation_group_records (round_id);

alter table public.consultation_group_records enable row level security;

-- Staff only, in every direction. Groups are recorded by the facilitator after
-- the room has talked; the public never writes one. A record is created in the
-- name of whoever creates it, but any administrator may correct it later —
-- the facilitator is often not the person who tidies up the notes.
drop policy if exists consultation_group_records_admin on public.consultation_group_records;

drop policy if exists consultation_group_records_read on public.consultation_group_records;
create policy consultation_group_records_read on public.consultation_group_records
  for select to authenticated
  using (public.is_consultation_admin());

drop policy if exists consultation_group_records_insert on public.consultation_group_records;
create policy consultation_group_records_insert on public.consultation_group_records
  for insert to authenticated
  with check (public.is_consultation_admin() and collected_by = auth.uid());

drop policy if exists consultation_group_records_update on public.consultation_group_records;
create policy consultation_group_records_update on public.consultation_group_records
  for update to authenticated
  using (public.is_consultation_admin())
  with check (public.is_consultation_admin());

drop policy if exists consultation_group_records_delete on public.consultation_group_records;
create policy consultation_group_records_delete on public.consultation_group_records
  for delete to authenticated
  using (public.is_consultation_admin());
