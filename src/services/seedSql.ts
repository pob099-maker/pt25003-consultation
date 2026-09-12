import type { ConsultationResponse, ContactRecord } from '../types';
import { seedContacts, seedResponses } from './seed';

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

const daysAgo = (iso: string): number => {
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  return Math.max(1, Math.round(days));
};

const responseInsert = (response: ConsultationResponse): string =>
  [
    'insert into public.consultation_responses',
    '  (id, round_id, role, pathway, regions, region_other, answers, started_at, submitted_at, duration_seconds, is_test_data)',
    'values (',
    `  ${quote(response.id)}, ${quote(response.roundId)}, ${quote(response.role ?? '')}, ${quote(response.pathway ?? '')}, ${array(response.regions)}, ${quote(response.regionOther)},`,
    `  ${quote(JSON.stringify(response.answers))}::jsonb,`,
    `  now() - interval '${daysAgo(response.submittedAt)} days' - interval '${response.durationSeconds} seconds',`,
    `  now() - interval '${daysAgo(response.submittedAt)} days',`,
    `  ${response.durationSeconds}, true`,
    ') on conflict (id) do nothing;',
  ].join('\n');

const contactInsert = (contact: ContactRecord): string =>
  [
    'insert into public.consultation_contacts',
    '  (id, round_id, interests, name, organisation, broad_role, region, email, phone,',
    '   preferred_contact_method, preferred_contact_time, comments, submitted_at, is_test_data)',
    'values (',
    `  ${quote(contact.id)}, ${quote(contact.roundId)}, ${array(contact.interests)},`,
    `  ${quote(contact.name)}, ${quote(contact.organisation)}, ${quote(contact.broadRole)}, ${quote(contact.region)},`,
    `  ${quote(contact.email)}, ${quote(contact.phone)}, ${quote(contact.preferredContactMethod)},`,
    `  ${quote(contact.preferredContactTime)}, ${quote(contact.comments)},`,
    `  now() - interval '${daysAgo(contact.submittedAt)} days', true`,
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
    ...seedResponses().map(responseInsert),
    '',
    ...seedContacts().map(contactInsert),
    '',
  ].join('\n');
