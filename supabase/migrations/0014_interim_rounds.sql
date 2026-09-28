-- Interim checks: a short consultation between the full ones, for when the
-- project's focus shifts part-way through. It asks only what the team ticks,
-- usually the practices the project has just taken on, and it is the starting
-- point for anything first asked in it.
--
--   pilot     internal testing; never compared with anything
--   baseline  the starting point every later round is measured against
--   interim   a short check between the full rounds; a start, never an end
--   review    a later round, which also asks what people saw and changed
--
-- Its own stage rather than a review with fewer questions, so the
-- change-over-time view never mistakes it for the end of a comparison, and
-- never for a second baseline. Nothing already stored changes.

alter table public.consultation_rounds
  drop constraint if exists consultation_rounds_stage_check;
alter table public.consultation_rounds
  add constraint consultation_rounds_stage_check check (stage in ('pilot', 'baseline', 'interim', 'review'));
