-- Projects.
--
-- The tool was built for PT25003, but nothing about a baseline-and-review
-- industry consultation is specific to potato mechanisation. A project layer
-- lets the next extension project run its own rounds on the same database and
-- the same question library, without its responses ever mixing with these.
--
-- PT25003 is project one. Every existing row belongs to it, and the column
-- defaults keep it that way for any client that does not yet send a project.

create table if not exists public.consultation_projects (
  id text primary key check (id ~ '^[A-Z0-9][A-Z0-9-]{1,19}$'),
  name text not null check (length(name) between 1 and 160),
  short_name text not null check (length(short_name) between 1 and 60),
  created_at timestamptz not null default now()
);

insert into public.consultation_projects (id, name, short_name)
values ('PT25003', 'Potato Mechanisation Project', 'Potato Mechanisation')
on conflict (id) do nothing;

alter table public.consultation_projects enable row level security;

-- A project's name is public: it is printed on every page of its consultation.
drop policy if exists consultation_projects_read on public.consultation_projects;
create policy consultation_projects_read on public.consultation_projects
  for select to anon, authenticated using (true);

drop policy if exists consultation_projects_write on public.consultation_projects;
create policy consultation_projects_write on public.consultation_projects
  for all to authenticated
  using (public.is_consultation_admin()) with check (public.is_consultation_admin());

do $$
declare
  t text;
begin
  foreach t in array array[
    'consultation_rounds',
    'consultation_responses',
    'consultation_contacts',
    'consultation_progress',
    'consultation_group_records',
    'consultation_workshops'
  ] loop
    execute format(
      'alter table public.%I add column if not exists project_id text not null default %L
         references public.consultation_projects (id)',
      t, 'PT25003'
    );
    execute format('create index if not exists %I on public.%I (project_id)', t || '_project_idx', t);
  end loop;
end $$;

-- One active round and one baseline per project, not per database.
drop index if exists public.consultation_rounds_single_active;
create unique index if not exists consultation_rounds_single_active
  on public.consultation_rounds (project_id)
  where is_active;

drop index if exists public.consultation_rounds_single_baseline;
create unique index if not exists consultation_rounds_single_baseline
  on public.consultation_rounds (project_id)
  where stage = 'baseline';

-- Progress is written by a function that knows only the round, so the
-- project is taken from the round. A round that does not exist leaves the
-- default in place.
create or replace function public.consultation_progress_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select r.project_id into new.project_id
  from public.consultation_rounds r
  where r.round_id = new.round_id;
  if new.project_id is null then
    new.project_id := 'PT25003';
  end if;
  return new;
end;
$$;

revoke execute on function public.consultation_progress_project() from public, anon, authenticated;

drop trigger if exists consultation_progress_project on public.consultation_progress;
create trigger consultation_progress_project
  before insert on public.consultation_progress
  for each row execute function public.consultation_progress_project();
