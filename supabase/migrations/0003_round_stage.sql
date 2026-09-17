-- Where a round sits in the evaluation.
--
--   pilot     internal testing; never compared with anything
--   baseline  the starting point every later round is measured against
--   review    a later round, which also asks what people saw and changed
--
-- The consultation is a baseline-and-review design: the same tracked
-- questions, word for word, at the start, mid-project and at the end. Stage is
-- what tells the change-over-time view which round is the reference, and tells
-- the form whether to ask the follow-up questions.

alter table public.consultation_rounds
  add column if not exists stage text not null default 'baseline';

alter table public.consultation_rounds
  drop constraint if exists consultation_rounds_stage_check;
alter table public.consultation_rounds
  add constraint consultation_rounds_stage_check check (stage in ('pilot', 'baseline', 'review'));

update public.consultation_rounds set stage = 'pilot' where round_id = '2026-pilot';

-- One baseline per consultation. A second one would leave "change since
-- baseline" with two answers to the question "since when?".
create unique index if not exists consultation_rounds_single_baseline
  on public.consultation_rounds (stage)
  where stage = 'baseline';
