import type { ConsultationResponse, ContactRecord } from '../types';
import { SEED_DAYS_AGO, seedContacts, seedResponses } from './seed';

/**
 * Renders the seeded test data as SQL, so the rows loaded into a Supabase
 * project and the rows the app shows in demo mode come from one definition.
 * They used to be two hand-maintained copies, which is fine until a question
 * id changes in one of them and the admin screens quietly show answers that
 * no longer match any question.
 */

const quote = (text: string): string => `'${text.replaceAll("'", "''")}'`;

const array = (values: readonly string[]): string =>
  values.length === 0 ? `'{}'::text[]` : `array[${values.map(quote).join(',')}]::text[]`;

const responseInsert = (response: ConsultationResponse, daysAgo: number): string =>
  [
    'insert into public.consultation_responses',
    '  (id, round_id, role, pathway, regions, region_other, answers, started_at, submitted_at, duration_seconds, is_test_data)',
    'values (',
    `  ${quote(response.id)}, ${quote(response.roundId)}, ${quote(response.role ?? '')}, ${quote(response.pathway ?? '')}, ${array(response.regions)}, ${quote(response.regionOther)},`,
    `  ${quote(JSON.stringify(response.answers))}::jsonb,`,
    `  now() - interval '${daysAgo} days' - interval '${response.durationSeconds} seconds',`,
    `  now() - interval '${daysAgo} days',`,
    `  ${response.durationSeconds}, true`,
    ') on conflict (id) do nothing;',
  ].join('\n');

const contactInsert = (contact: ContactRecord, daysAgo: number): string =>
  [
    'insert into public.consultation_contacts',
    '  (id, round_id, interests, name, organisation, broad_role, region, email, phone,',
    '   preferred_contact_method, preferred_contact_time, comments, submitted_at, is_test_data)',
    'values (',
    `  ${quote(contact.id)}, ${quote(contact.roundId)}, ${array(contact.interests)},`,
    `  ${quote(contact.name)}, ${quote(contact.organisation)}, ${quote(contact.broadRole)}, ${quote(contact.region)},`,
    `  ${quote(contact.email)}, ${quote(contact.phone)}, ${quote(contact.preferredContactMethod)},`,
    `  ${quote(contact.preferredContactTime)}, ${quote(contact.comments)},`,
    `  now() - interval '${daysAgo} days', true`,
    ') on conflict (id) do nothing;',
  ].join('\n');

export const buildSeedSql = (roundId: string, roundLabel: string): string =>
  [
    '-- Seeded TEST DATA for the PT25003 consultation.',
    '--',
    '-- GENERATED from src/services/seed.ts — do not edit by hand; run `npm test` instead.',
    '--',
    '-- Every row has is_test_data = true. The admin area hides these by default, so a',
    '-- response count shown to the project team is never inflated by them. Clear them',
    '-- before the consultation goes live:',
    '--   delete from public.consultation_responses where is_test_data;',
    '--   delete from public.consultation_contacts  where is_test_data;',
    '',
    'insert into public.consultation_rounds (round_id, label, is_active)',
    `values (${quote(roundId)}, ${quote(roundLabel)}, true)`,
    'on conflict (round_id) do nothing;',
    '',
    ...seedResponses().map((response, index, all) => responseInsert(response, SEED_DAYS_AGO.response(index, all.length))),
    '',
    ...seedContacts().map((contact, index) => contactInsert(contact, SEED_DAYS_AGO.contacts[index] ?? 1)),
    '',
  ].join('\n');
