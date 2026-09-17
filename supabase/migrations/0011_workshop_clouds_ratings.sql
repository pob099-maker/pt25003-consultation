-- Word clouds and rating scales in live workshops.
--
-- A vote is still a list of short strings:
--   choice questions  option ids                        {harvest, skills}
--   rating questions  row=score                         {harvest_efficiency=4, labour=2}
--   word clouds       what the person typed, up to 3    {labour, "wet harvest"}
--
-- Typed words are counted case-insensitively. A facilitator can hide a word
-- from the screen — somebody will type something rude, or a name — and a
-- hidden word is left out of every result the database hands back, not just
-- the presenter's view. The phone's own response still keeps what was typed.

alter table public.consultation_workshops
  add column if not exists hidden jsonb not null default '{}'::jsonb;

comment on column public.consultation_workshops.hidden is
  'question id -> array of lower-case words hidden from the results';

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
  hidden_words text[];
  results jsonb := null;
begin
  select * into w from public.consultation_workshops where code = upper(p_code);
  if not found then
    return jsonb_build_object('found', false);
  end if;
  q := w.question_ids[w.current_index + 1];
  select count(*) into n from public.consultation_workshop_votes
    where workshop_id = w.id and question_id = q;
  select coalesce(array_agg(value), '{}') into hidden_words
    from jsonb_array_elements_text(coalesce(w.hidden -> q, '[]'::jsonb));
  if w.revealed and n >= public.workshop_min_answers() then
    select coalesce(jsonb_object_agg(choice, hands), '{}'::jsonb) into results
    from (
      select lower(btrim(c)) as choice, count(distinct participant) as hands
      from public.consultation_workshop_votes, unnest(choices) as c
      where workshop_id = w.id and question_id = q
        and lower(btrim(c)) <> all (hidden_words)
      group by lower(btrim(c))
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
    'results', results,
    'hidden', to_jsonb(hidden_words)
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
  if p_choices is null or cardinality(p_choices) not between 1 and 40
     or exists (select 1 from unnest(p_choices) c where length(btrim(c)) not between 1 and 60) then
    return 'invalid';
  end if;
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

alter table public.consultation_workshop_votes
  drop constraint if exists consultation_workshop_votes_choices_check;
alter table public.consultation_workshop_votes
  add constraint consultation_workshop_votes_choices_check check (cardinality(choices) between 1 and 40);

revoke execute on function public.workshop_state(text) from public;
revoke execute on function public.cast_workshop_vote(text, uuid, text, text[]) from public;
grant execute on function public.workshop_state(text) to anon, authenticated;
grant execute on function public.cast_workshop_vote(text, uuid, text, text[]) to anon, authenticated;
