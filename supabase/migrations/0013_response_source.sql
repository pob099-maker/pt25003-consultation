-- Which labelled link a response or a contact record arrived by: the
-- magazine, a newsletter, a link sent direct to a grower, or one passed on by
-- somebody who took part. It is how a project learns which channels get
-- traction, and how the next project decides where to put its effort.
--
-- A channel, never a person. The app only ever writes a code from the fixed
-- list in src/services/sources.ts, or 'other' for anything it does not
-- recognise, so a link made for one grower cannot attach a name to an
-- anonymous set of answers. The length cap here is the database's half of
-- that: an anonymous caller can skip the app, but not this.
--
-- Nullable and without a default: anything that did not come in by a labelled
-- link, and every row written before this migration, is simply unlabelled.
-- The app sends the column only when it has a value, and falls back to sending
-- the row without it if this migration has not been run yet, so running it is
-- safe before or after the deploy.

alter table public.consultation_responses add column if not exists source text;
alter table public.consultation_contacts add column if not exists source text;

alter table public.consultation_responses drop constraint if exists consultation_responses_source_length;
alter table public.consultation_responses
  add constraint consultation_responses_source_length check (source is null or length(source) <= 40);

alter table public.consultation_contacts drop constraint if exists consultation_contacts_source_length;
alter table public.consultation_contacts
  add constraint consultation_contacts_source_length check (source is null or length(source) <= 40);

create index if not exists consultation_responses_source_idx on public.consultation_responses (source);
