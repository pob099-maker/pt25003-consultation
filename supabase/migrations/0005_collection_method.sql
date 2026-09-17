-- How each response was collected.
--
-- The consultation is taken online, and also by project staff in one-to-one
-- conversations, on video calls, and by phone. All of it lands in the same
-- table against the same questions, which is what makes it poolable — but
-- people tell a person different things than they tell a form, so the method
-- is recorded on every response and every report can split by it.
--
--   online              the respondent filled it in themselves
--   interview_in_person a staff member, face to face
--   interview_video     a staff member, on Teams or similar
--   interview_phone     a staff member, by phone
--   workshop            a participant in a live session, on their own phone
--
-- collected_by is the staff member for an interview — staff identity, never a
-- respondent's — so an interviewer effect can be checked for. It is readable
-- only by administrators, like everything else on the row.
--
-- consent_verbal records that the interviewer read the consent statement and
-- the person agreed, since a spoken yes leaves no other trace.
--
-- session_id ties a workshop answer to its session. It is filled in by the
-- workshop migration; the column is added now so the shape is settled once.

alter table public.consultation_responses
  add column if not exists method text not null default 'online',
  add column if not exists collected_by uuid,
  add column if not exists consent_verbal boolean,
  add column if not exists session_id uuid;

alter table public.consultation_responses
  drop constraint if exists consultation_responses_method_check;
alter table public.consultation_responses
  add constraint consultation_responses_method_check
  check (method in ('online', 'interview_in_person', 'interview_video', 'interview_phone', 'workshop'));

-- An interview needs a spoken consent and a named interviewer; an online
-- response has neither. Enforced here as well as in the app, because the
-- insert is open to the public key and the app is not the only possible caller.
alter table public.consultation_responses
  drop constraint if exists consultation_responses_interview_check;
alter table public.consultation_responses
  add constraint consultation_responses_interview_check
  check (
    method not like 'interview_%'
    or (consent_verbal is true and collected_by is not null)
  );

-- The anonymous insert policy stays as it was, with one addition: nobody using
-- the public key can claim to be an interviewer. Interviews come only from a
-- signed-in administrator, recorded as themselves.
drop policy if exists consultation_responses_insert on public.consultation_responses;
create policy consultation_responses_insert on public.consultation_responses
  for insert to anon
  with check (is_test_data = false and method in ('online', 'workshop') and collected_by is null);

drop policy if exists consultation_responses_staff_insert on public.consultation_responses;
create policy consultation_responses_staff_insert on public.consultation_responses
  for insert to authenticated
  with check (
    is_test_data = false
    and (
      (method in ('online', 'workshop') and collected_by is null)
      or (method like 'interview_%' and collected_by = auth.uid() and public.is_consultation_admin())
    )
  );

create index if not exists consultation_responses_method_idx on public.consultation_responses (method);
