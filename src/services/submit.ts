import { getSupabase } from '../lib/supabase';
import { STORAGE_KEYS, readJson, writeJson } from '../lib/storage';
import { consultationResponseSchema, contactRecordSchema } from '../schemas/consultation';
import type { ConsultationResponse, ContactRecord, Result } from '../types';
import { toContactRow, toResponseRow } from './records';

export const RESPONSES_TABLE = 'consultation_responses';
export const CONTACTS_TABLE = 'consultation_contacts';

type OutboxItem =
  | { readonly table: typeof RESPONSES_TABLE; readonly row: ReturnType<typeof toResponseRow> }
  | { readonly table: typeof CONTACTS_TABLE; readonly row: ReturnType<typeof toContactRow> };

const readOutbox = (): readonly OutboxItem[] => readJson<OutboxItem[]>(STORAGE_KEYS.outbox) ?? [];

/** Held for later. The same record queued twice is kept once. */
const queue = (item: OutboxItem): void => {
  const others = readOutbox().filter((held) => !(held.table === item.table && held.row.id === item.row.id));
  writeJson(STORAGE_KEYS.outbox, [...others, item]);
};

interface InsertError {
  readonly message: string;
  readonly code?: string;
}

/**
 * Postgres's "that id is already there". The row was stored by an earlier
 * attempt whose reply never arrived, so it is done, not failed. Without this a
 * reply lost on a bad connection left the row retrying from somebody's phone
 * forever, and a resend of the same answers would have been stored twice.
 */
const ALREADY_STORED = '23505';

/** PostgREST's "no such column": the database is a migration behind the code. */
const MISSING_COLUMN = 'PGRST204';

export const outboxSize = (): number => readOutbox().length;

const insertOnce = async (
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  item: OutboxItem,
): Promise<{ error: InsertError | null }> =>
  item.table === RESPONSES_TABLE
    ? supabase.from(RESPONSES_TABLE).insert(item.row)
    : supabase.from(CONTACTS_TABLE).insert(item.row);

/**
 * One insert, with a safety net for a database that is a migration behind the
 * code. If the table has no `source` column yet, the row is sent again without
 * it: the answers matter and the label does not, and without this every
 * labelled response would sit in somebody's outbox failing on each visit.
 *
 * Only that exact error triggers it. Matching the word "source" anywhere used
 * to catch Firefox's network error ("…fetch resource"), which sent a second
 * copy without the label every time a connection dropped.
 */
const insert = async (
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  item: OutboxItem,
): Promise<{ error: InsertError | null }> => {
  const first = await insertOnce(supabase, item);
  if (first.error === null) return first;
  if (first.error.code === ALREADY_STORED) return { error: null };
  const missingSource =
    item.row.source !== undefined && first.error.code === MISSING_COLUMN && /'source'/.test(first.error.message);
  if (!missingSource) return first;
  const row = { ...item.row };
  delete row.source;
  const second = await insertOnce(supabase, { ...item, row } as OutboxItem);
  return second.error?.code === ALREADY_STORED ? { error: null } : second;
};

const send = async (item: OutboxItem): Promise<Result<'sent' | 'queued'>> => {
  const supabase = getSupabase();
  if (supabase === null) {
    // No backend configured, or the browser is offline. Hold the submission
    // on the device rather than discarding it, and try again on next load.
    queue(item);
    return { success: true, data: 'queued' };
  }
  const { error } = await insert(supabase, item);
  if (error !== null) {
    queue(item);
    return { success: true, data: 'queued' };
  }
  return { success: true, data: 'sent' };
};

export const submitResponse = async (response: ConsultationResponse): Promise<Result<'sent' | 'queued'>> => {
  const parsed = consultationResponseSchema.safeParse(response);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'The response could not be validated.' };
  }
  return send({ table: RESPONSES_TABLE, row: toResponseRow(response) });
};

export const submitContact = async (contact: ContactRecord): Promise<Result<'sent' | 'queued'>> => {
  const parsed = contactRecordSchema.safeParse(contact);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'The contact details could not be validated.' };
  }
  return send({ table: CONTACTS_TABLE, row: toContactRow(contact) });
};

/**
 * A finished consultation: the answers, and the contact details if the person
 * left any. The contact is checked before anything is sent, so a missing email
 * or phone is caught while the answers are still unsent, and pressing Submit
 * again never stores the same answers twice. The response also keeps one id
 * for the life of its draft, so even a resend is stored once.
 */
export const submitConsultation = async (
  response: ConsultationResponse,
  contact: ContactRecord | null,
): Promise<Result<{ readonly queued: boolean }>> => {
  if (contact !== null) {
    const checked = contactRecordSchema.safeParse(contact);
    if (!checked.success) {
      return { success: false, error: checked.error.issues[0]?.message ?? 'The contact details could not be validated.' };
    }
  }
  const saved = await submitResponse(response);
  if (!saved.success) return saved;
  if (contact === null) return { success: true, data: { queued: saved.data === 'queued' } };
  const savedContact = await submitContact(contact);
  if (!savedContact.success) return savedContact;
  return { success: true, data: { queued: saved.data === 'queued' || savedContact.data === 'queued' } };
};

/**
 * When a contact record left at the end of a consultation was made, to the
 * day. Sent together, a contact and an answer set would otherwise carry the
 * same time to the millisecond, and anyone holding both exports could join a
 * name to the answers the privacy statement says it is never linked to.
 */
export const contactDay = (now: Date): string => `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;

/**
 * Drains anything held on the device. Called once on app start; safe to call
 * when the outbox is empty or no backend is configured.
 */
export const flushOutbox = async (): Promise<number> => {
  const pending = readOutbox();
  if (pending.length === 0) return 0;
  const supabase = getSupabase();
  if (supabase === null) return pending.length;

  const remaining: OutboxItem[] = [];
  for (const item of pending) {
    const { error } = await insert(supabase, item);
    if (error !== null) remaining.push(item);
  }
  writeJson(STORAGE_KEYS.outbox, remaining);
  return remaining.length;
};
