-- The team functions were refusing anonymous callers from inside, but anonymous
-- callers could still reach them: Supabase grants EXECUTE on new functions to
-- the anon role by default, and revoking from PUBLIC does not remove that. The
-- check inside each function is the real guard; this makes the public key
-- unable to call them at all, so the guard is never the only thing standing.

revoke execute on function public.grant_consultation_admin(text) from anon;
revoke execute on function public.revoke_consultation_admin(uuid) from anon;
