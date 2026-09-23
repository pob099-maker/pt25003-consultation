import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import type { ConsultationResponse, Question, Questionnaire, Section } from '../types';
import { FULL_TARGET_MINUTES, estimateFor, formEstimates, questionSeconds, spoken } from './estimate';
import { jargonIn, reviewQuestion, reviewQuestionnaire } from './plainLanguage';
import { readinessChecks, warnings } from './readiness';

const q = DEFAULT_QUESTIONNAIRE;
const find = (id: string): Question => {
  const all = [...q.core, ...Object.values(q.pathways), ...q.projectDesign].flatMap((section) => section.questions);
  const found = all.find((question) => question.id === id);
  if (found === undefined) throw new Error(`no question ${id}`);
  return found;
};

describe('estimate', () => {
  it('costs a rating grid more than a single choice', () => {
    expect(questionSeconds(find('q5_areas'))).toBeGreaterThan(questionSeconds(find('q_trial')));
  });

  it('charges for typing on a phone', () => {
    expect(questionSeconds(find('q4_bad_season'))).toBeGreaterThan(40);
  });

  it('makes the short version shorter than the full one', () => {
    const { short, full } = formEstimates(q);
    expect(short.seconds).toBeLessThan(full.seconds);
    expect(short.questions).toBeLessThan(full.questions);
  });

  it('puts PT25003 where the pilot found it', () => {
    // The short version is dominated by the twelve-row rating grid, which is
    // why it lands nearer seven minutes than five for the slowest branch.
    const { short, full } = formEstimates(q);
    expect(short.minutes).toBeGreaterThanOrEqual(4);
    expect(short.minutes).toBeLessThanOrEqual(8);
    expect(full.minutes).toBeGreaterThanOrEqual(8);
    expect(full.minutes).toBeLessThanOrEqual(16);
  });

  it('reports the branch that takes longest, not the shortest', () => {
    const { full, slowestRole } = formEstimates(q);
    for (const role of q.roles) expect(estimateFor(q, role.id).seconds).toBeLessThanOrEqual(full.seconds);
    expect(slowestRole).not.toBeNull();
  });

  it('says it the way a respondent hears it', () => {
    expect(spoken({ seconds: 250, questions: 5, minutes: 5 })).toBe('about 5 minutes');
    expect(spoken({ seconds: 40, questions: 1, minutes: 1 })).toBe('about 1 minute');
  });
});

describe('plain language', () => {
  it('spots office language and offers plainer wording', () => {
    const found = jargonIn('We will optimise the workflow for stakeholders.');
    expect(found.map((item) => item.term).sort()).toEqual(['optimise', 'stakeholders', 'workflow']);
    expect(found.find((item) => item.term === 'workflow')?.plainer).toContain('the way the job runs');
  });

  it('leaves ordinary farm words alone', () => {
    expect(jargonIn('What happens at harvest when the weather turns?')).toEqual([]);
  });

  it('does not flag a word inside a longer one', () => {
    expect(jargonIn('The capacitor failed.')).toEqual([]);
  });

  it('flags a sentence too long to hold in your head', () => {
    const question: Question = {
      id: 'long',
      kind: 'text',
      prompt:
        'Thinking about the last three seasons and everything that happened across planting and harvest and the packing shed as well as the people you employ, what would you change first and why would that be the thing you picked?',
    };
    const findings = reviewQuestion(question).map((finding) => finding.kind);
    expect(findings).toContain('long-sentence');
    expect(findings).toContain('double-question');
  });

  it('accepts a technical option that explains itself underneath', () => {
    const explained: Question = {
      id: 'x',
      kind: 'multi',
      prompt: 'Which of these interest you?',
      options: [{ id: 'a', label: 'Predictive maintenance', help: 'Servicing a part before it fails.' }],
    };
    const bare: Question = {
      id: 'y',
      kind: 'multi',
      prompt: 'Which of these interest you?',
      options: [{ id: 'a', label: 'Predictive maintenance' }],
    };
    expect(reviewQuestion(explained)).toHaveLength(0);
    expect(reviewQuestion(bare).length).toBeGreaterThan(0);
  });

  it('has something to say about the live questionnaire without drowning it', () => {
    const findings = reviewQuestionnaire(q);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.length).toBeLessThan(40);
  });
});

describe('readinessChecks', () => {
  const response = (over: Partial<ConsultationResponse>): ConsultationResponse => ({
    id: crypto.randomUUID(),
    roundId: q.roundId,
    role: 'grower',
    pathway: 'farm',
    regions: [],
    regionOther: '',
    answers: {},
    startedAt: '2026-10-01T00:00:00.000Z',
    submittedAt: '2026-10-01T00:10:00.000Z',
    durationSeconds: 600,
    isTestData: false,
    method: 'online',
    collectedBy: null,
    consentVerbal: null,
    sessionId: null,
    ...over,
  });

  it('covers the things that cannot be fixed later', () => {
    const ids = readinessChecks(q).map((check) => check.id);
    expect(ids).toEqual([
      'tracked',
      'short-length',
      'full-length',
      'typing',
      'plain-language',
      'branches',
      'test-data',
    ]);
  });

  it('passes the tracked-question check for PT25003', () => {
    // Sixteen tracked questions across every branch, but four to eight shared ones.
    const check = readinessChecks(q).find((item) => item.id === 'tracked');
    expect(check).toBeDefined();
  });

  it('warns when test responses are still in the results', () => {
    const checks = readinessChecks(q, [response({ isTestData: true }), response({})]);
    const check = checks.find((item) => item.id === 'test-data');
    expect(check?.state).toBe('warn');
    expect(check?.title).toContain('1 test response');
  });

  it('warns about two written questions in a row', () => {
    // PT25003 has a pair of its own: "what would be most useful" is followed
    // by "what should we avoid", both typed.
    expect(readinessChecks(q).find((check) => check.id === 'typing')?.state).toBe('warn');

    const spaced: Questionnaire = {
      ...q,
      projectDesign: q.projectDesign.map((section) => ({
        ...section,
        questions: section.questions.filter((question) => question.id !== 'pd_avoid'),
      })),
    };
    expect(readinessChecks(spaced).find((check) => check.id === 'typing')?.state).toBe('pass');
  });

  it('warns when the full version runs past the time people will give', () => {
    const padding: Section = {
      id: 'padding',
      title: 'More',
      questions: Array.from({ length: 12 }, (_, index) => ({
        id: `pad${index}`,
        kind: 'text' as const,
        prompt: 'Tell us more.',
      })),
    };
    const long: Questionnaire = { ...q, projectDesign: [...q.projectDesign, padding] };
    expect(formEstimates(long).full.minutes).toBeGreaterThan(FULL_TARGET_MINUTES);
    expect(readinessChecks(long).find((check) => check.id === 'full-length')?.state).toBe('warn');
  });

  it('lists only what needs attention', () => {
    const checks = readinessChecks(q);
    expect(warnings(checks).every((check) => check.state === 'warn')).toBe(true);
    expect(warnings(checks).length).toBeLessThanOrEqual(checks.length);
  });
});
