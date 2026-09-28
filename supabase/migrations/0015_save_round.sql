-- Saving a round is one step, not three.
--
-- The admin screen used to switch every other round off and then write the
-- new one. When the database refused the write (a second starting point, a
-- code that belongs to another project) or the connection dropped in between,
-- the project was left with no live round at all, and the public form fell
-- back to the questions compiled into the app, filing answers under a round
-- nobody had started. Inside one function the two happen together or not at
-- all.
--
-- Security invoker: the row-level security that already limits rounds to
-- administrators applies to everything the function does, so it grants
-- nothing the table did not.

create or replace function public.save_consultation_round(
  p_round_id text,
  p_project_id text,
  p_label text,
  p_stage text,
  p_is_active boolean,
  p_overrides jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if exists (
    select 1 from public.consultation_rounds
    where round_id = p_round_id and project_id <> p_project_id
  ) then
    raise exception 'The short code "%" belongs to a round in another project. Choose a different one.', p_round_id;
  end if;

  if p_is_active then
    update public.consultation_rounds
       set is_active = false
     where project_id = p_project_id
       and round_id <> p_round_id
       and is_active;
  end if;

  insert into public.consultation_rounds (round_id, project_id, label, stage, is_active, overrides)
  values (p_round_id, p_project_id, p_label, p_stage, p_is_active, coalesce(p_overrides, '{}'::jsonb))
  on conflict (round_id) do update
     set label = excluded.label,
         stage = excluded.stage,
         is_active = excluded.is_active,
         overrides = excluded.overrides;
end;
$$;

revoke all on function public.save_consultation_round(text, text, text, text, boolean, jsonb) from public;
grant execute on function public.save_consultation_round(text, text, text, text, boolean, jsonb) to authenticated;
