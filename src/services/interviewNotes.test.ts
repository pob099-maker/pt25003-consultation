import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { consultationResponseSchema } from '../schemas/consultation';
import type { AnswerMap, ConsultationResponse } from '../types';
import { freeTextEntries } from './analysis';
import { responseHeaders, responseRow } from './exportCsv';
import {
  COVERED_ID,
  GENERAL_NOTES,
  coveredEarlier,
  isNoteId,
  noteId,
  noteLabel,
  notesText,
  sectionStatus,
  toggleCovered,
} from './interviewNotes';

const q = DEFAULT_QUESTIONNAIRE;
const firstSection = q.core[0];
if (firstSection === undefined) throw new Error('no core section');

const interview = (answers: AnswerMap): ConsultationResponse => ({
  id: crypto.randomUUID(),
  roundId: q.roundId,
  role: 'grower',
  pathway: 'farm',
  regions: [],
  regionOther: '',
  answers,
  startedAt: '2026-10-01T00:00:00.000Z',
  submittedAt: '2026-10-01T00:20:00.000Z',
  durationSeconds: 1200,
  isTestData: false,
  method: 'interview_phone',
  collectedBy: '22222222-2222-4222-8222-222222222222',
  consentVerbal: true,
  sessionId: null,
});

describe('interview notes', () => {
  const answers: AnswerMap = {
    [noteId(firstSection.id)]: { kind: 'text', value: '"Harvest is where we lose the season"' },
    [noteId(GENERAL_NOTES)]: { kind: 'text', value: 'Runs 400 ha with his brother.' },
    q1_constraints: { kind: 'multi', values: ['harvest'] },
  };

  it('uses ids that no question can have', () => {
    expect(isNoteId(noteId(firstSection.id))).toBe(true);
    expect(q.core.flatMap((section) => section.questions).some((question) => isNoteId(question.id))).toBe(false);
  });

  it('labels a note by the section it was taken in', () => {
    expect(noteLabel(q, noteId(firstSection.id))).toBe(`Interview notes — ${firstSection.title}`);
    expect(noteLabel(q, noteId(GENERAL_NOTES))).toBe('Interview notes');
  });

  it('shows notes in the comments tab, labelled', () => {
    const entries = freeTextEntries(q, [interview(answers)]);
    expect(entries.map((entry) => entry.questionPrompt)).toContain(`Interview notes — ${firstSection.title}`);
  });

  it('puts every note in one export column', () => {
    const response = interview(answers);
    expect(responseHeaders(q)).toContain('interview_notes');
    const row = responseRow(q, response);
    expect(row.interview_notes).toContain('Harvest is where we lose the season');
    expect(row.interview_notes).toContain('Runs 400 ha');
    expect(notesText(q, {})).toBe('');
  });

  it('is still a valid response', () => {
    expect(consultationResponseSchema.safeParse(interview(answers)).success).toBe(true);
  });
});

describe('came up earlier', () => {
  it('toggles a question on and off, and clears itself when empty', () => {
    const on = toggleCovered({}, 'q3_impact');
    expect(on).toEqual({ kind: 'multi', values: ['q3_impact'] });
    const answers: AnswerMap = on === undefined ? {} : { [COVERED_ID]: on };
    expect(coveredEarlier(answers)).toEqual(['q3_impact']);
    expect(toggleCovered(answers, 'q3_impact')).toBeUndefined();
  });

  it('is exported so an analyst can tell a confirmed answer from an asked one', () => {
    const row = responseRow(q, interview({ [COVERED_ID]: { kind: 'multi', values: ['q3_impact', 'q4_bad_season'] } }));
    expect(row.covered_earlier).toBe('q3_impact; q4_bad_season');
  });
});

describe('sectionStatus', () => {
  it('reads untouched, started and done from the answers', () => {
    expect(sectionStatus(firstSection, {}, false)).toBe('untouched');
    const [first, ...rest] = firstSection.questions;
    if (first === undefined) throw new Error('empty section');
    const one: AnswerMap = { [first.id]: { kind: 'text', value: 'x' } };
    expect(sectionStatus(firstSection, one, false)).toBe(rest.length === 0 ? 'done' : 'started');
    const all: AnswerMap = Object.fromEntries(
      firstSection.questions.map((question) => [question.id, { kind: 'text', value: 'x' } as const]),
    );
    expect(sectionStatus(firstSection, all, false)).toBe('done');
  });

  it('counts a section with only notes as started', () => {
    expect(sectionStatus(firstSection, { [noteId(firstSection.id)]: { kind: 'text', value: 'x' } }, false)).toBe(
      'started',
    );
  });
});
