-- PT25003 consultation schema.
--
-- Two data areas that are deliberately not joinable:
--   consultation_responses  anonymous consultation answers
--   consultation_contacts   voluntary contact and expression-of-interest details
-- Neither table carries a key to the other, so no query — and no administrator
-- — can attach a name to a set of answers.

create table if not exists public.consultation_responses (
  id uuid primary key,
  round_id text not null,
  role text,
  pathway text,
  regions text[] not null default '{}',
  region_other text not null default '',
  answers jsonb not null default '{}'::jsonb,
  started_at timestamptz not null,
  submitted_at timestamptz not null,
  duration_seconds integer not null default 0,
  is_test_data boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists consultation_responses_round_idx on public.consultation_responses (round_id);
create index if not exists consultation_responses_role_idx on public.consultation_responses (role);
create index if not exists consultation_responses_submitted_idx on public.consultation_responses (submitted_at desc);

create table if not exists public.consultation_contacts (
  id uuid primary key,
  round_id text not null,
  interests text[] not null default '{}',
  name text not null default '',
  organisation text not null default '',
  broad_role text not null default '',
  region text not null default '',
  email text not null default '',
  phone text not null default '',
  preferred_contact_method text not null default '',
  preferred_contact_time text not null default '',
  comments text not null default '',
  submitted_at timestamptz not null,
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  -- A contact record with no way to reach the person is not a contact record.
  constraint consultation_contacts_reachable check (length(trim(email)) > 0 or length(trim(phone)) > 0)
);

create index if not exists consultation_contacts_submitted_idx on public.consultation_contacts (submitted_at desc);

-- Wording for a consultation round. Question ids and option ids never change
-- here; only the words attached to them, so historic answers keep their meaning.
create table if not exists public.consultation_rounds (
  round_id text primary key,
  label text not null,
  is_active boolean not null default false,
  overrides jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists consultation_rounds_single_active
  on public.consultation_rounds (is_active)
  where is_active;

-- Thematic tags an administrator puts on a free-text answer.
create table if not exists public.consultation_text_tags (
  response_id uuid not null references public.consultation_responses (id) on delete cascade,
  question_id text not null,
  tags text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (response_id, question_id)
);

-- Who counts as project staff. Rows are added by hand in the Supabase table
-- editor after inviting the person through Authentication → Users.
create table if not exists public.consultation_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  added_at timestamptz not null default now()
);

create or replace function public.is_consultation_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.consultation_admins where user_id = auth.uid());
$$;

alter table public.consultation_responses enable row level security;
alter table public.consultation_contacts enable row level security;
alter table public.consultation_rounds enable row level security;
alter table public.consultation_text_tags enable row level security;
alter table public.consultation_admins enable row level security;

-- Respondents are never signed in. They may add a response and nothing else:
-- no select, no update, no delete, and they cannot pass a row off as test data.
drop policy if exists consultation_responses_insert on public.consultation_responses;
create policy consultation_responses_insert on public.consultation_responses
  for insert to anon, authenticated
  with check (is_test_data = false);

drop policy if exists consultation_responses_admin_read on public.consultation_responses;
create policy consultation_responses_admin_read on public.consultation_responses
  for select to authenticated
  using (public.is_consultation_admin());

drop policy if exists consultation_contacts_insert on public.consultation_contacts;
create policy consultation_contacts_insert on public.consultation_contacts
  for insert to anon, authenticated
  with check (is_test_data = false);

drop policy if exists consultation_contacts_admin_read on public.consultation_contacts;
create policy consultation_contacts_admin_read on public.consultation_contacts
  for select to authenticated
  using (public.is_consultation_admin());

-- A person can ask for their contact record to be removed; an administrator
-- does that on their behalf.
drop policy if exists consultation_contacts_admin_delete on public.consultation_contacts;
create policy consultation_contacts_admin_delete on public.consultation_contacts
  for delete to authenticated
  using (public.is_consultation_admin());

-- The active round's wording has to be readable before anybody signs in,
-- because it is what the public consultation renders.
drop policy if exists consultation_rounds_public_read on public.consultation_rounds;
create policy consultation_rounds_public_read on public.consultation_rounds
  for select to anon, authenticated
  using (true);

drop policy if exists consultation_rounds_admin_write on public.consultation_rounds;
create policy consultation_rounds_admin_write on public.consultation_rounds
  for all to authenticated
  using (public.is_consultation_admin())
  with check (public.is_consultation_admin());

drop policy if exists consultation_text_tags_admin on public.consultation_text_tags;
create policy consultation_text_tags_admin on public.consultation_text_tags
  for all to authenticated
  using (public.is_consultation_admin())
  with check (public.is_consultation_admin());

drop policy if exists consultation_admins_self_read on public.consultation_admins;
create policy consultation_admins_self_read on public.consultation_admins
  for select to authenticated
  using (user_id = auth.uid());
