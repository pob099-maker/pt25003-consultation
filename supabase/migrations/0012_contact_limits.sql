-- Limits on what an anonymous caller can put in the contacts table, and how
-- often.
--
-- Everything the app validates with Zod runs in the caller's browser, so it
-- binds the form and nobody else. The anon key ships in the public bundle and
-- the insert policy accepts any row, which was tolerable while a contact record
-- only sat in a table. It stopped being tolerable when a row started sending an
-- email: one loop of REST inserts exhausts the sending quota for the day, and
-- after that a real request to be rung reaches nobody.
--
-- These are the caps the browser already applies, restated where they cannot be
-- skipped, plus a ceiling on how many call-backs can arrive in an hour.
--
-- Before running this: replace REPLACE_WITH_NOTIFY_SECRET at the bottom with
-- the NOTIFY_SECRET you set on the Edge Function. It is not in this file
-- because this repository is public.

alter table public.consultation_contacts
  drop constraint if exists consultation_contacts_lengths;

alter table public.consultation_contacts
  add constraint consultation_contacts_lengths check (
    length(name) <= 120
    and length(organisation) <= 160
    and length(broad_role) <= 120
    and length(region) <= 120
    and length(email) <= 200
    and length(phone) <= 40
    and length(preferred_contact_method) <= 20
    and length(preferred_contact_time) <= 200
    and length(comments) <= 2000
    and length(round_id) <= 80
    and coalesce(array_length(interests, 1), 0) <= 20
  );

-- How many call-back requests may arrive in an hour before the table starts
-- refusing them. Set well above any real day: the consultation is going to a
-- few hundred people, and more than this in an hour is somebody hammering the
-- endpoint, not an industry that suddenly wants a phone call.
create or replace function public.consultation_contacts_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent integer;
begin
  if not (new.interests @> array['callback']::text[]) then
    return new;
  end if;

  select count(*) into recent
  from public.consultation_contacts
  where interests @> array['callback']::text[]
    and created_at > now() - interval '1 hour';

  if recent >= 30 then
    -- Deliberately unhelpful to a script and readable in the logs. The app
    -- turns any insert failure into "saved on this device", so a person caught
    -- by this keeps their request and it goes through on the next try.
    raise exception 'Too many call-back requests in the last hour';
  end if;

  return new;
end;
$$;

drop trigger if exists consultation_contacts_rate_limit on public.consultation_contacts;

create trigger consultation_contacts_rate_limit
before insert on public.consultation_contacts
for each row execute function public.consultation_contacts_rate_limit();

-- The notification webhook only ever cared about call-backs, so stop waking the
-- function for every expression of interest. The function keeps its own check:
-- this is the gate, that is the guard.
drop trigger if exists notify_callback on public.consultation_contacts;

create trigger notify_callback
after insert on public.consultation_contacts
for each row
when (new.interests @> array['callback']::text[])
execute function supabase_functions.http_request(
  'https://ihwwrtfuyhakcjkuaucz.supabase.co/functions/v1/notify-callback',
  'POST',
  '{"Content-Type":"application/json","x-callback-secret":"REPLACE_WITH_NOTIFY_SECRET"}',
  '{}',
  '5000'
);
