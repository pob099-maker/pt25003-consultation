-- Explicit table grants for the Data API.
--
-- From 30 October 2026 Supabase stops granting new tables in "public" to the
-- Data API automatically. Every table here was created before then, so the
-- live database keeps the grants it was given and running this there changes
-- nothing. It is for a database rebuilt from these migrations after that date
-- (a restore into a new project, or a second database for another project),
-- where the tables would otherwise come up with no grants and every request
-- from the site would be refused.
--
-- Each grant is the least that row-level security already allows, so a
-- rebuilt database can do no more than the live one; the policies still decide
-- which rows. Anything a visitor does beyond these goes through the security
-- definer functions (progress, workshop votes, team changes), which run as
-- their owner and need no table grants of their own.
--
-- A new table needs its grants in the same migration that creates it.
-- src/services/migrations.test.ts fails if one is missing.
--
-- Safe to run more than once. Run it in the SQL Editor.

-- Visitors who are not signed in: add a response or a contact, and read the
-- live wording, the project's name and a published scoreboard. Never anything
-- anybody has answered.
grant insert on public.consultation_responses to anon;
grant insert on public.consultation_contacts to anon;
grant select on public.consultation_rounds to anon;
grant select on public.consultation_projects to anon;
grant select on public.consultation_scoreboard_editions to anon;

-- The signed-in team: what each table's policies allow. Most of those policies
-- also require an administrator.
grant select, insert on public.consultation_responses to authenticated;
grant select, insert, delete on public.consultation_contacts to authenticated;
grant select, insert, update, delete on public.consultation_rounds to authenticated;
grant select, insert, update, delete on public.consultation_text_tags to authenticated;
grant select on public.consultation_admins to authenticated;
grant select, delete on public.consultation_progress to authenticated;
grant select, insert, update, delete on public.consultation_group_records to authenticated;
grant select, insert, update, delete on public.consultation_workshops to authenticated;
grant select on public.consultation_workshop_votes to authenticated;
grant select, insert, update, delete on public.consultation_projects to authenticated;
grant select, insert, update, delete on public.consultation_scoreboard_editions to authenticated;
grant select, insert, update, delete on public.consultation_scoreboard_items to authenticated;

-- The server's own key, as Supabase advises. The site never uses it.
grant select, insert, update, delete on
  public.consultation_responses,
  public.consultation_contacts,
  public.consultation_rounds,
  public.consultation_text_tags,
  public.consultation_admins,
  public.consultation_progress,
  public.consultation_group_records,
  public.consultation_workshops,
  public.consultation_workshop_votes,
  public.consultation_projects,
  public.consultation_scoreboard_editions,
  public.consultation_scoreboard_items
to service_role;
