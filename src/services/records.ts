import { currentProject } from '../content/projects';
import { isSafeId } from '../content/lookup';
import { answerSchema } from '../schemas/consultation';
import type { Answer, AnswerMap, CollectionMethod, ConsultationResponse, ContactRecord, RoleId } from '../types';

/**
 * Answers as the admin screens may trust them. Anybody can insert a row with
 * the public key and the database stores whatever JSON arrives, so an answer
 * of the wrong shape is dropped here rather than taking a screen down, and a
 * rating keeps only rows whose ids could be real.
 */
export const cleanAnswers = (raw: unknown): AnswerMap => {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const clean: Record<string, Answer> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isSafeId(id)) continue;
    const parsed = answerSchema.safeParse(value);
    if (!parsed.success) continue;
    const answer = parsed.data as Answer;
    clean[id] =
      answer.kind === 'rating'
        ? { ...answer, values: Object.fromEntries(Object.entries(answer.values).filter(([row]) => isSafeId(row))) }
        : answer;
  }
  return clean;
};

/**
 * Row shapes for the two tables. They are deliberately unrelated: no column
 * on either side points at the other, so a contact record cannot be joined
 * back onto an anonymous answer set by anybody, including an administrator.
 */
export interface ResponseRow {
  id: string;
  project_id?: string;
  round_id: string;
  role: string | null;
  pathway: string | null;
  regions: string[];
  region_other: string;
  answers: AnswerMap;
  started_at: string;
  submitted_at: string;
  duration_seconds: number;
  is_test_data: boolean;
  method: CollectionMethod;
  collected_by: string | null;
  consent_verbal: boolean | null;
  session_id: string | null;
  /** Left out entirely when there is none, so a database a migration behind still takes the row. */
  source?: string | null;
}

export interface ContactRow {
  id: string;
  project_id?: string;
  round_id: string;
  interests: string[];
  name: string;
  organisation: string;
  broad_role: string;
  region: string;
  email: string;
  phone: string;
  preferred_contact_method: string;
  preferred_contact_time: string;
  comments: string;
  submitted_at: string;
  is_test_data: boolean;
  source?: string | null;
}

export const toResponseRow = (response: ConsultationResponse): ResponseRow => ({
  id: response.id,
  project_id: currentProject().id,
  round_id: response.roundId,
  role: response.role,
  pathway: response.pathway,
  regions: [...response.regions],
  region_other: response.regionOther,
  answers: response.answers,
  started_at: response.startedAt,
  submitted_at: response.submittedAt,
  duration_seconds: response.durationSeconds,
  is_test_data: response.isTestData,
  method: response.method,
  collected_by: response.collectedBy,
  consent_verbal: response.consentVerbal,
  session_id: response.sessionId,
  ...(response.source === null ? {} : { source: response.source }),
});

export const fromResponseRow = (row: ResponseRow): ConsultationResponse => ({
  id: row.id,
  roundId: row.round_id,
  role: (row.role as RoleId | null) ?? null,
  pathway: row.pathway,
  regions: row.regions ?? [],
  regionOther: row.region_other ?? '',
  answers: cleanAnswers(row.answers),
  startedAt: row.started_at,
  submittedAt: row.submitted_at,
  durationSeconds: row.duration_seconds ?? 0,
  isTestData: row.is_test_data ?? false,
  // A row written before the column existed was taken online: that was the
  // only way in.
  method: row.method ?? 'online',
  collectedBy: row.collected_by ?? null,
  consentVerbal: row.consent_verbal ?? null,
  sessionId: row.session_id ?? null,
  source: row.source ?? null,
});

export const toContactRow = (contact: ContactRecord): ContactRow => ({
  id: contact.id,
  project_id: currentProject().id,
  round_id: contact.roundId,
  interests: [...contact.interests],
  name: contact.name,
  organisation: contact.organisation,
  broad_role: contact.broadRole,
  region: contact.region,
  email: contact.email,
  phone: contact.phone,
  preferred_contact_method: contact.preferredContactMethod,
  preferred_contact_time: contact.preferredContactTime,
  comments: contact.comments,
  submitted_at: contact.submittedAt,
  is_test_data: contact.isTestData,
  ...(contact.source === null ? {} : { source: contact.source }),
});

export const fromContactRow = (row: ContactRow): ContactRecord => ({
  id: row.id,
  roundId: row.round_id,
  interests: row.interests ?? [],
  name: row.name ?? '',
  organisation: row.organisation ?? '',
  broadRole: row.broad_role ?? '',
  region: row.region ?? '',
  email: row.email ?? '',
  phone: row.phone ?? '',
  preferredContactMethod: row.preferred_contact_method ?? '',
  preferredContactTime: row.preferred_contact_time ?? '',
  comments: row.comments ?? '',
  submittedAt: row.submitted_at,
  isTestData: row.is_test_data ?? false,
  source: row.source ?? null,
});
