-- How a group discussion was held: in a room, on a video call, or as a poll in
-- a regional chat group.
--
-- A chat poll is recorded exactly as a room is. The people who answered the
-- poll are its "present", and the votes for each choice are its hands, so it
-- is reported beside the individual responses and never added to them, like
-- every other group. Each poll asks one question, word for word, with the
-- question's own choices.
--
-- Every record made before this was a room, which is what the default says.
-- The site saves a room without this column, so nothing breaks before it is
-- run; it refuses a video call or a chat poll until it is, rather than let one
-- quietly become a room.
--
-- No new grant is needed: a table's grants cover every column it has, including
-- ones added later (see 0017).

alter table public.consultation_group_records
  add column if not exists held_as text not null default 'room'
    constraint consultation_group_records_held_as_check check (held_as in ('room', 'video', 'chat_poll'));
