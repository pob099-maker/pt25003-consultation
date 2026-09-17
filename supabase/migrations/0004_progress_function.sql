-- Record progress through a function, not a table write.
--
-- 0002 let anonymous visitors insert and update consultation_progress
-- directly. The app wrote with an upsert — insert, or update if the row exists
-- — and Postgres requires a caller to be able to READ a table before it will
-- run INSERT ... ON CONFLICT DO UPDATE against it. Anonymous visitors cannot
-- read it, on purpose, so every write was refused. The client swallowed the
-- error, by design, so that tracking could never interrupt somebody answering
-- a question — and so the feature looked finished and recorded nothing.
--
-- Granting anonymous read access would fix the write and open the table to
-- anyone with the public key. Instead the write happens inside a function that
-- runs with the table owner's rights and enforces its own rules:
--
--   * a session can only move forward — furthest_step never goes back
--   * a finished session is a fact — a completed row is never changed again
--   * inputs are bounded, so the function cannot be used to stuff the table
--     with nonsense
--
-- The table itself is closed to anonymous callers entirely.

create or replace function public.record_consultation_progress(
  p_id uuid,
  p_round_id text,
  p_role text,
  p_pathway text,
  p_furthest_step integer,
  p_furthest_step_id text,
  p_step_count integer,
  p_completed boolean,
  p_started_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_id is null
     or p_round_id is null or length(p_round_id) > 80
     or p_furthest_step is null or p_furthest_step < 0 or p_furthest_step > 50
     or p_step_count is null or p_step_count < 0 or p_step_count > 50
     or length(coalesce(p_role, '')) > 40
     or length(coalesce(p_pathway, '')) > 40
     or length(coalesce(p_furthest_step_id, '')) > 60 then
    raise exception 'invalid progress record';
  end if;

  insert into public.consultation_progress as existing
    (id, round_id, role, pathway, furthest_step, furthest_step_id, step_count, completed, started_at, updated_at)
  values
    (p_id, p_round_id, p_role, p_pathway, p_furthest_step, coalesce(p_furthest_step_id, ''),
     p_step_count, coalesce(p_completed, false), coalesce(p_started_at, now()), now())
  on conflict (id) do update set
    role = excluded.role,
    pathway = excluded.pathway,
    furthest_step = greatest(existing.furthest_step, excluded.furthest_step),
    furthest_step_id = case
      when excluded.furthest_step >= existing.furthest_step then excluded.furthest_step_id
      else existing.furthest_step_id
    end,
    step_count = excluded.step_count,
    completed = existing.completed or excluded.completed,
    updated_at = now()
  where existing.completed = false;
end;
$$;

revoke all on function public.record_consultation_progress(uuid, text, text, text, integer, text, integer, boolean, timestamptz) from public;
grant execute on function public.record_consultation_progress(uuid, text, text, text, integer, text, integer, boolean, timestamptz) to anon, authenticated;

-- The direct write policies are no longer used, and a policy that is not used
-- is only a way in.
drop policy if exists consultation_progress_insert on public.consultation_progress;
drop policy if exists consultation_progress_update on public.consultation_progress;
