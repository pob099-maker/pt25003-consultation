-- Managing the project team from inside the tool.
--
-- Until now, giving somebody access meant creating them in Supabase and then
-- pasting their user id into consultation_admins by hand. People are still
-- invited from the Supabase dashboard — sending an invitation needs a key that
-- must never reach a browser — but granting and removing access now happens in
-- the admin area, by email address.
--
-- Both functions run with the table owner's rights and check for themselves
-- that the caller is already an administrator. Two guards:
--   * nobody can remove their own access, so nobody locks themselves out
--     mid-task
--   * the last administrator cannot be removed, so the project is never left
--     with nobody able to see its own results

-- Administrators can see who else is on the team.
drop policy if exists consultation_admins_team_read on public.consultation_admins;
create policy consultation_admins_team_read on public.consultation_admins
  for select to authenticated
  using (public.is_consultation_admin());

create or replace function public.grant_consultation_admin(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  if not public.is_consultation_admin() then
    raise exception 'only an administrator can add people to the team';
  end if;

  select id into target from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if target is null then
    return 'not_found';
  end if;

  insert into public.consultation_admins (user_id, email)
  values (target, lower(trim(p_email)))
  on conflict (user_id) do nothing;

  return 'granted';
end;
$$;

create or replace function public.revoke_consultation_admin(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_consultation_admin() then
    raise exception 'only an administrator can remove people from the team';
  end if;
  if p_user_id = auth.uid() then
    return 'cannot_remove_self';
  end if;
  if (select count(*) from public.consultation_admins) <= 1 then
    return 'last_admin';
  end if;

  delete from public.consultation_admins where user_id = p_user_id;
  return 'revoked';
end;
$$;

revoke all on function public.grant_consultation_admin(text) from public;
revoke all on function public.revoke_consultation_admin(uuid) from public;
grant execute on function public.grant_consultation_admin(text) to authenticated;
grant execute on function public.revoke_consultation_admin(uuid) to authenticated;
