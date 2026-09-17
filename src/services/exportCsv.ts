import { toCsv, type CsvRow } from '../lib/csv';
import { allQuestions, interestLabel, optionLabel, questionById, regionLabel, roleLabel } from '../content/lookup';
import type { ConsultationResponse, ContactRecord, Questionnaire } from '../types';
import type { TagMap } from './tags';
import { coveredEarlier, notesText } from './interviewNotes';

const RESPONSE_FIXED = [
  'response_id',
  'round',
  'submitted_at',
  'duration_minutes',
  'role',
  'pathway',
  'regions',
  'region_other',
  'method',
  'test_data',
  'prompted_items',
  'covered_earlier',
  'interview_notes',
] as const;

const join = (values: readonly string[]): string => values.join('; ');

export const METHOD_LABEL: Readonly<Record<ConsultationResponse['method'], string>> = {
  online: 'Online',
  interview_in_person: 'Interview — in person',
  interview_video: 'Interview — video call',
  interview_phone: 'Interview — phone',
  workshop: 'Workshop',
};

export const responseHeaders = (questionnaire: Questionnaire): readonly string[] => {
  const headers: string[] = [...RESPONSE_FIXED];
  for (const question of allQuestions(questionnaire)) {
    if (question.kind === 'rating') {
      for (const row of question.rows) headers.push(`${question.id}__${row.id}`);
    } else if (question.kind === 'rank') {
      for (let index = 1; index <= question.count; index += 1) headers.push(`${question.id}__${index}`);
    } else {
      headers.push(question.id);
      if (question.kind === 'multi' && question.allowOther === true) headers.push(`${question.id}__other`);
    }
  }
  return headers;
};

export const responseRow = (questionnaire: Questionnaire, response: ConsultationResponse): CsvRow => {
  const row: Record<string, string | number> = {
    response_id: response.id,
    round: response.roundId,
    submitted_at: response.submittedAt,
    duration_minutes: Number((response.durationSeconds / 60).toFixed(1)),
    role: roleLabel(questionnaire, response.role),
    pathway: response.pathway ?? '',
    regions: join(response.regions.map((id) => regionLabel(questionnaire, id))),
    region_other: response.regionOther,
    method: METHOD_LABEL[response.method],
    test_data: response.isTestData ? 'yes' : 'no',
    // One column rather than one per question: an interview marks a handful of
    // items as prompted, and forty mostly-empty columns help nobody.
    prompted_items: join(
      Object.entries(response.answers).flatMap(([questionId, answer]) =>
        answer.kind === 'multi'
          ? (answer.prompted ?? []).map((id) => `${questionId}: ${optionLabel(questionById(questionnaire, questionId), id)}`)
          : [],
      ),
    ),
    // Answered from something said earlier in the conversation, not asked outright.
    covered_earlier: join(coveredEarlier(response.answers)),
    interview_notes: notesText(questionnaire, response.answers),
  };

  for (const question of allQuestions(questionnaire)) {
    const answer = response.answers[question.id];
    if (question.kind === 'rating') {
      for (const ratingRow of question.rows) {
        row[`${question.id}__${ratingRow.id}`] =
          answer !== undefined && answer.kind === 'rating' ? (answer.values[ratingRow.id] ?? '') : '';
      }
      continue;
    }
    if (question.kind === 'rank') {
      for (let index = 1; index <= question.count; index += 1) {
        const id = answer !== undefined && answer.kind === 'rank' ? answer.values[index - 1] : undefined;
        row[`${question.id}__${index}`] = id === undefined ? '' : optionLabel(question, id);
      }
      continue;
    }
    if (answer === undefined) {
      row[question.id] = '';
      if (question.kind === 'multi' && question.allowOther === true) row[`${question.id}__other`] = '';
      continue;
    }
    if (answer.kind === 'multi') {
      row[question.id] = join(answer.values.map((id) => optionLabel(question, id)));
      if (question.kind === 'multi' && question.allowOther === true) row[`${question.id}__other`] = answer.other ?? '';
    } else if (answer.kind === 'single') {
      row[question.id] = optionLabel(question, answer.value);
    } else if (answer.kind === 'text') {
      row[question.id] = answer.value;
    }
  }
  return row;
};

export const responsesCsv = (
  questionnaire: Questionnaire,
  responses: readonly ConsultationResponse[],
): string => toCsv(responseHeaders(questionnaire), responses.map((response) => responseRow(questionnaire, response)));

const CONTACT_HEADERS = [
  'contact_id',
  'round',
  'submitted_at',
  'name',
  'organisation',
  'broad_role',
  'region',
  'email',
  'phone',
  'preferred_contact_method',
  'preferred_contact_time',
  'interests',
  'comments',
  'test_data',
] as const;

export const contactsCsv = (questionnaire: Questionnaire, contacts: readonly ContactRecord[]): string =>
  toCsv(
    CONTACT_HEADERS,
    contacts.map((contact) => ({
      contact_id: contact.id,
      round: contact.roundId,
      submitted_at: contact.submittedAt,
      name: contact.name,
      organisation: contact.organisation,
      broad_role: contact.broadRole,
      region: contact.region,
      email: contact.email,
      phone: contact.phone,
      preferred_contact_method: contact.preferredContactMethod,
      preferred_contact_time: contact.preferredContactTime,
      interests: join(contact.interests.map((id) => interestLabel(questionnaire, id))),
      comments: contact.comments,
      test_data: contact.isTestData ? 'yes' : 'no',
    })),
  );

const FREE_TEXT_HEADERS = ['response_id', 'submitted_at', 'role', 'question_id', 'question', 'themes', 'text'] as const;

export const freeTextCsv = (
  entries: readonly {
    responseId: string;
    submittedAt: string;
    role: string | null;
    questionId: string;
    questionPrompt: string;
    text: string;
  }[],
  tags: TagMap,
  roleName: (role: string | null) => string,
): string =>
  toCsv(
    FREE_TEXT_HEADERS,
    entries.map((entry) => ({
      response_id: entry.responseId,
      submitted_at: entry.submittedAt,
      role: roleName(entry.role),
      question_id: entry.questionId,
      question: entry.questionPrompt,
      themes: join(tags[`${entry.responseId}:${entry.questionId}`] ?? []),
      text: entry.text,
    })),
  );
