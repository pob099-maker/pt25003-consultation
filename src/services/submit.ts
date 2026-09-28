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

const queue = (item: OutboxItem): void => {
  writeJson(STORAGE_KEYS.outbox, [...readOutbox(), item]);
};

export const outboxSize = (): number => readOutbox().length;

const insertOnce = async (
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  item: OutboxItem,
): Promise<{ error: { message: string } | null }> =>
  item.table === RESPONSES_TABLE
    ? supabase.from(RESPONSES_TABLE).insert(item.row)
    : supabase.from(CONTACTS_TABLE).insert(item.row);

/**
 * One insert, with a safety net for a database that is a migration behind the
 * code. If the table has no `source` column yet, the row is sent again without
 * it: the answers matter and the label does not, and without this every
 * labelled response would sit in somebody's outbox failing on each visit.
 */
const insert = async (
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  item: OutboxItem,
): Promise<{ error: { message: string } | null }> => {
  const first = await insertOnce(supabase, item);
  if (first.error === null || item.row.source === undefined || !/source/i.test(first.error.message)) return first;
  const row = { ...item.row };
  delete row.source;
  return insertOnce(supabase, { ...item, row } as OutboxItem);
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
