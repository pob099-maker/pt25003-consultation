import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { REGIONAL_EXAMPLE } from '../content/exampleProject';
import { consultationResponseSchema } from '../schemas/consultation';
import type { ConsultationResponse, Question, Questionnaire, RoleId } from '../types';
import {
  BITE_ID,
  BITE_SECONDS,
  biteAnswer,
  biteFor,
  biteOf,
  biteSlots,
  biteTime,
  bitesFor,
  nextBite,
  splitBites,
} from './bites';
import { questionsFor } from './estimate';
import { shortVersion } from './formLength';
import { cleanAnswers } from './records';
import { applyRound, type RoundDefinition } from './roundRules';

const q = DEFAULT_QUESTIONNAIRE;

const round = (stage: RoundDefinition['stage'], overrides: RoundDefinition['overrides']): RoundDefinition => ({
  roundId: `${stage}-round`,
  label: stage,
  stage,
  overrides,
});

/** Every kind of round a link could be opened in, and the second project too. */
const CASES: readonly (readonly [string, Questionnaire])[] = [
  ['the baseline', q],
  ['an interim check', { ...q, stage: 'interim' }],
  ['a review', { ...q, stage: 'review' }],
  [
    'a review that adds a row to a watch list',
    applyRound(q, round('review', { q5_areas: { addedOptions: [{ id: 'new_area', label: 'A new area' }] } })),
  ],
  ['the example project', REGIONAL_EXAMPLE],
];

const rolesOf = (questionnaire: Questionnaire): readonly (RoleId | null)[] => [
  null,
  ...questionnaire.roles.map((role) => role.id),
];

/** A question without the rows it was asked with, to compare the rest of it. */
const withoutRows = (question: Question): Record<string, unknown> =>
  Object.fromEntries(Object.entries(question).filter(([key]) => key !== 'rows' && key !== 'allowOther'));

describe('bites get to the same place as the short version', () => {
  for (const [label, questionnaire] of CASES) {
    for (const role of rolesOf(questionnaire)) {
      it(`asks everything the short version asks, word for word, in ${label}, for ${role ?? 'nobody yet'}`, () => {
        const expected = questionsFor(shortVersion(questionnaire), role);
        const asked = bitesFor(questionnaire, role).flatMap((bite) => bite.questions);

        // The same questions, in the same order, once each: a split list's
        // parts sit next to each other and are joined back up here.
        const order = asked.map((question) => question.id).filter((id, index, ids) => ids[index - 1] !== id);
        expect(order).toEqual(expected.map((question) => question.id));

        for (const question of expected) {
          const parts = asked.filter((part) => part.id === question.id);
          if (parts.length === 1) {
            // The very object the short version asks, not a copy that could drift.
            expect(parts[0]).toBe(question);
            continue;
          }
          // Only a rating list is ever split, and only by its rows.
          expect(question.kind).toBe('rating');
          if (question.kind !== 'rating') continue;
          const rows = parts.flatMap((part) => (part.kind === 'rating' ? part.rows : []));
          expect(rows).toEqual(question.rows);
          for (const part of parts) expect(withoutRows(part)).toEqual(withoutRows(question));
          // The row somebody names for themselves is offered once, at the end.
          const offers = parts.map((part) => part.kind === 'rating' && part.allowOther === true);
          expect(offers).toEqual(parts.map((_, index) => question.allowOther === true && index === parts.length - 1));
        }
      });
    }
  }

  it('keeps a ranking in the same bite as the list it ranks', () => {
    for (const [, questionnaire] of CASES) {
      for (const role of rolesOf(questionnaire)) {
        for (const bite of bitesFor(questionnaire, role)) {
          for (const question of bite.questions) {
            if (question.kind !== 'rank') continue;
            const inSection = shortVersion(questionnaire).core.some((section) =>
              section.questions.some((other) => other.id === question.sourceQuestionId),
            );
            if (inSection) expect(bite.questions.map((other) => other.id)).toContain(question.sourceQuestionId);
          }
        }
      }
    }
  });

  it('keeps every bite of the live questions within the limit', () => {
    for (const role of rolesOf(q)) {
      for (const bite of bitesFor({ ...q, stage: 'review' }, role)) expect(bite.seconds).toBeLessThanOrEqual(BITE_SECONDS);
    }
  });

  it('follows each role down its own pathway', () => {
    const farm = bitesFor(q, 'grower').filter((bite) => bite.block === 'pathway');
    const contractor = bitesFor(q, 'contractor').filter((bite) => bite.block === 'pathway');
    expect(farm.flatMap((bite) => bite.questions.map((question) => question.id))).toContain('farm_practices');
    expect(contractor.flatMap((bite) => bite.questions.map((question) => question.id))).toContain('con_practices');
    expect(contractor.flatMap((bite) => bite.questions.map((question) => question.id))).not.toContain('farm_practices');
    // An adviser's short version has nothing of its own, so neither do their bites.
    expect(bitesFor(q, 'adviser').some((bite) => bite.block === 'pathway')).toBe(false);
  });

  it('asks what people saw and changed only in a round that asks it', () => {
    expect(bitesFor(q, 'grower').some((bite) => bite.block === 'followUp')).toBe(false);
    expect(bitesFor({ ...q, stage: 'review' }, 'grower').some((bite) => bite.block === 'followUp')).toBe(true);
  });
});

describe('bite links', () => {
  it('give a shared section the same id for everybody, and number a role’s own', () => {
    const grower = bitesFor(q, 'grower');
    const adviser = bitesFor(q, 'adviser');
    const shared = grower.filter((bite) => bite.block !== 'pathway').map((bite) => bite.id);
    expect(adviser.map((bite) => bite.id)).toEqual(shared);
    expect(grower.filter((bite) => bite.block === 'pathway').map((bite) => bite.id)).toEqual(
      grower.filter((bite) => bite.block === 'pathway').map((_, index) => `pathway_${index + 1}`),
    );
    expect(new Set(grower.map((bite) => bite.id)).size).toBe(grower.length);
  });

  it('opens each role’s own bite from one pathway link, or says there is nothing in it for them', () => {
    expect(biteFor(q, 'grower', 'pathway_1')?.sectionId).toBe('farm');
    expect(biteFor(q, 'contractor', 'pathway_1')?.sectionId).toBe('contractor');
    expect(biteFor(q, 'adviser', 'pathway_1')).toBeNull();
    expect(biteFor(q, 'grower', 'no_such_bite')).toBeNull();
  });

  it('lists a link for every bite anybody can be sent', () => {
    const slots = biteSlots(q);
    const ids = slots.map((slot) => slot.id);
    for (const role of rolesOf(q)) for (const bite of bitesFor(q, role)) expect(ids).toContain(bite.id);
    const firstOwn = slots.find((slot) => slot.id === 'pathway_1');
    expect(firstOwn?.nothingFor).toContain('adviser');
    expect(firstOwn?.asks.find((ask) => ask.pathway === 'farm')?.roles).toEqual(['grower', 'farm_manager']);
  });

  it('suggests the next bite this phone has not sent', () => {
    const [first, second] = bitesFor(q, 'grower');
    expect(nextBite(q, 'grower', [])?.id).toBe(first?.id);
    expect(nextBite(q, 'grower', [first?.id ?? ''])?.id).toBe(second?.id);
    expect(nextBite(q, 'grower', bitesFor(q, 'grower').map((bite) => bite.id))).toBeNull();
  });

  it('says how long, the way it is said aloud', () => {
    expect(biteTime(38)).toBe('about 40 seconds');
    expect(biteTime(60)).toBe('about a minute');
    expect(biteTime(86)).toBe('about a minute and a half');
  });
});

describe('bites in the results', () => {
  const response = (answers: ConsultationResponse['answers']): ConsultationResponse => ({
    id: crypto.randomUUID(),
    roundId: q.roundId,
    role: 'grower',
    pathway: 'farm',
    regions: ['ballarat'],
    regionOther: '',
    answers,
    startedAt: '2026-10-22T01:00:00.000Z',
    submittedAt: '2026-10-22T01:01:00.000Z',
    durationSeconds: 60,
    isTestData: false,
    method: 'online',
    collectedBy: null,
    consentVerbal: null,
    sessionId: null,
    source: 'text',
  });

  it('are marked so that nothing counting people ever counts them', () => {
    const whole = response({ sector: { kind: 'multi', values: ['grow'] } });
    const bite = response({ sector: { kind: 'multi', values: ['grow'] }, [BITE_ID]: biteAnswer('core_sector') });
    const split = splitBites([whole, bite]);
    expect(split.whole).toEqual([whole]);
    expect(split.bites).toEqual([bite]);
    expect(biteOf(bite.answers)).toBe('core_sector');
    expect(biteOf(whole.answers)).toBeNull();
  });

  it('pass the same checks as any online response, and keep their marker when read back', () => {
    const bite = response({ [BITE_ID]: biteAnswer('core_priorities_1') });
    expect(consultationResponseSchema.safeParse(bite).success).toBe(true);
    expect(biteOf(cleanAnswers(bite.answers))).toBe('core_priorities_1');
  });
});
