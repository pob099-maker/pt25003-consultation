import type { AnswerMap, ConsultationResponse, ContactRecord, RoleId } from '../types';

/**
 * Row shapes for the two tables. They are deliberately unrelated: no column
 * on either side points at the other, so a contact record cannot be joined
 * back onto an anonymous answer set by anybody, including an administrator.
 */
export interface ResponseRow {
  id: string;
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
}

export interface ContactRow {
  id: string;
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
}

export const toResponseRow = (response: ConsultationResponse): ResponseRow => ({
  id: response.id,
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
});

export const fromResponseRow = (row: ResponseRow): ConsultationResponse => ({
  id: row.id,
  roundId: row.round_id,
  role: (row.role as RoleId | null) ?? null,
  pathway: row.pathway,
  regions: row.regions ?? [],
  regionOther: row.region_other ?? '',
  answers: row.answers ?? {},
  startedAt: row.started_at,
  submittedAt: row.submitted_at,
  durationSeconds: row.duration_seconds ?? 0,
  isTestData: row.is_test_data ?? false,
});

export const toContactRow = (contact: ContactRecord): ContactRow => ({
  id: contact.id,
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
});
