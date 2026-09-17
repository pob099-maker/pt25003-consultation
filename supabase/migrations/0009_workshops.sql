-- Live workshops.
--
-- A facilitator puts one question on the screen, people answer on their own
-- phones after scanning a QR code, and the room sees the result once voting
-- closes. Each person's answers are also saved as one ordinary response,
-- tagged method = 'workshop' with the workshop id as session_id — so a
-- workshop adds individual responses, unlike a group record, which is a room.
--
-- The public never reads either table directly. Everything a phone needs goes
-- through two functions that take the join code, and results are only
-- released once at least five people have answered, so nobody's vote can be
-- read off a small room.

create table if not exists public.consultation_workshops (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  round_id text not null,
  title text not null check (length(title) between 1 and 160),
  status text not null default 'open' check (status in ('open', 'closed')),
  question_ids text[] not null check (cardinality(question_ids) between 1 and 40),
  current_index integer not null default 0 check (current_index >= 0),
  revealed boolean not null default false,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.consultation_workshop_votes (
  workshop_id uuid not null references public.consultation_workshops (id) on delete cascade,
  participant uuid not null,
  question_id text not null,
  choices text[] not null check (cardinality(choices) between 1 and 12),
  created_at timestamptz not null default now(),
  primary key (workshop_id, participant, question_id)
);

alter table public.consultation_workshops enable row level security;
alter table public.consultation_workshop_votes enable row level security;

drop policy if exists consultation_workshops_read on public.consultation_workshops;
create policy consultation_workshops_read on public.consultation_workshops
  for select to authenticated using (public.is_consultation_admin());

drop policy if exists consultation_workshops_insert on public.consultation_workshops;
create policy consultation_workshops_insert on public.consultation_workshops
  for insert to authenticated
  with check (public.is_consultation_admin() and created_by = auth.uid());

drop policy if exists consultation_workshops_update on public.consultation_workshops;
create policy consultation_workshops_update on public.consultation_workshops
  for update to authenticated
  using (public.is_consultation_admin()) with check (public.is_consultation_admin());

drop policy if exists consultation_workshops_delete on public.consultation_workshops;
create policy consultation_workshops_delete on public.consultation_workshops
  for delete to authenticated using (public.is_consultation_admin());

drop policy if exists consultation_workshop_votes_read on public.consultation_workshop_votes;
create policy consultation_workshop_votes_read on public.consultation_workshop_votes
  for select to authenticated using (public.is_consultation_admin());

-- The minimum number of answers before a result is shown to anybody.
create or replace function public.workshop_min_answers()
returns integer language sql immutable as $$ select 5 $$;

-- What a phone or the presenter screen needs, and nothing more.
create or replace function public.workshop_state(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  w public.consultation_workshops;
  q text;
  n integer;
  results jsonb := null;
begin
  select * into w from public.consultation_workshops where code = upper(p_code);
  if not found then
    return jsonb_build_object('found', false);
  end if;
  q := w.question_ids[w.current_index + 1];
  select count(*) into n from public.consultation_workshop_votes
    where workshop_id = w.id and question_id = q;
  if w.revealed and n >= public.workshop_min_answers() then
    select coalesce(jsonb_object_agg(choice, hands), '{}'::jsonb) into results
    from (
      select choice, count(*) as hands
      from public.consultation_workshop_votes, unnest(choices) as choice
      where workshop_id = w.id and question_id = q
      group by choice
    ) tally;
  end if;
  return jsonb_build_object(
    'found', true,
    'id', w.id,
    'title', w.title,
    'roundId', w.round_id,
    'status', w.status,
    'questionIds', to_jsonb(w.question_ids),
    'index', w.current_index,
    'questionId', q,
    'revealed', w.revealed,
    'answered', n,
    'minAnswers', public.workshop_min_answers(),
    'results', results
  );
end;
$$;

create or replace function public.cast_workshop_vote(
  p_code text,
  p_participant uuid,
  p_question_id text,
  p_choices text[]
)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  w public.consultation_workshops;
begin
  select * into w from public.consultation_workshops where code = upper(p_code);
  if not found then return 'not_found'; end if;
  if w.status <> 'open' then return 'closed'; end if;
  if w.question_ids[w.current_index + 1] is distinct from p_question_id then return 'not_current'; end if;
  if w.revealed then return 'revealed'; end if;
  if p_choices is null or cardinality(p_choices) not between 1 and 12
     or exists (select 1 from unnest(p_choices) c where length(c) not between 1 and 60) then
    return 'invalid';
  end if;
  -- A room, not the internet: a ceiling on distinct phones per workshop.
  if (select count(distinct participant) from public.consultation_workshop_votes where workshop_id = w.id) >= 500
     and not exists (select 1 from public.consultation_workshop_votes where workshop_id = w.id and participant = p_participant) then
    return 'full';
  end if;
  insert into public.consultation_workshop_votes (workshop_id, participant, question_id, choices)
  values (w.id, p_participant, p_question_id, p_choices)
  on conflict (workshop_id, participant, question_id)
  do update set choices = excluded.choices, created_at = now();
  return 'ok';
end;
$$;

-- Used by the insert policy below. Anon cannot read the workshops table, so
-- the check has to run with the definer's rights.
create or replace function public.is_workshop(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.consultation_workshops where id = p_id);
$$;

revoke execute on function public.workshop_state(text) from public;
revoke execute on function public.cast_workshop_vote(text, uuid, text, text[]) from public;
revoke execute on function public.is_workshop(uuid) from public;
grant execute on function public.workshop_state(text) to anon, authenticated;
grant execute on function public.cast_workshop_vote(text, uuid, text, text[]) to anon, authenticated;
grant execute on function public.is_workshop(uuid) to anon, authenticated;

-- A response that says it came from a workshop must name one that exists.
drop policy if exists consultation_responses_insert on public.consultation_responses;
create policy consultation_responses_insert on public.consultation_responses
  for insert to anon
  with check (
    is_test_data = false
    and collected_by is null
    and (
      (method = 'online' and session_id is null)
      or (method = 'workshop' and session_id is not null and public.is_workshop(session_id))
    )
  );

drop policy if exists consultation_responses_staff_insert on public.consultation_responses;
create policy consultation_responses_staff_insert on public.consultation_responses
  for insert to authenticated
  with check (
    is_test_data = false
    and (
      (method = 'online' and session_id is null and collected_by is null)
      or (method = 'workshop' and session_id is not null and public.is_workshop(session_id) and collected_by is null)
      or (method like 'interview_%' and collected_by = auth.uid() and public.is_consultation_admin())
    )
  );
