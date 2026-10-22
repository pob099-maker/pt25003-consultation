import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { consultationResponseSchema } from '../schemas/consultation';
import { BITE_ID, biteOf, bitesFor } from './bites';
import { beginBite, biteResponse, emptyPhone, finishBite, settlePhone, type BitePhone } from './bitePhone';
import { LINK_CODE_ID } from './linkCode';

const q = DEFAULT_QUESTIONNAIRE;
const [sector, constraints] = bitesFor(q, 'grower');
const codeBite = bitesFor(q, 'grower').find((bite) => bite.questions.some((question) => question.id === LINK_CODE_ID));

const grower: BitePhone = { ...emptyPhone(q.roundId), role: 'grower', regions: ['ballarat'] };

describe('a phone answering bites', () => {
  it('keeps the bite under way, and starts a new one with its own id', () => {
    if (sector === undefined || constraints === undefined) throw new Error('no bites');
    const begun = beginBite(grower, sector);
    expect(begun.current?.biteId).toBe(sector.id);
    expect(beginBite(begun, sector)).toBe(begun);
    const next = beginBite(begun, constraints);
    expect(next.current?.biteId).toBe(constraints.id);
    expect(next.current?.responseId).not.toBe(begun.current?.responseId);
  });

  it('sends only the bite’s own questions, marked, with who they are, as a valid online response', () => {
    if (sector === undefined) throw new Error('no bites');
    const begun = beginBite(grower, sector, new Date('2026-10-22T01:00:00.000Z'));
    const answered: BitePhone = {
      ...begun,
      current:
        begun.current === null
          ? null
          : {
              ...begun.current,
              answers: {
                sector: { kind: 'multi', values: ['grow'] },
                // Left over from somewhere else: never sent with this bite.
                q_trust: { kind: 'multi', values: ['neighbours'] },
              },
            },
    };
    const response = biteResponse(q, answered, sector, 'text', new Date('2026-10-22T01:00:40.000Z'));
    expect(response).not.toBeNull();
    expect(Object.keys(response?.answers ?? {}).sort()).toEqual([BITE_ID, 'sector'].sort());
    expect(biteOf(response?.answers ?? {})).toBe(sector.id);
    expect(response).toMatchObject({ role: 'grower', pathway: 'farm', regions: ['ballarat'], method: 'online', source: 'text' });
    expect(response?.durationSeconds).toBe(40);
    expect(consultationResponseSchema.safeParse(response).success).toBe(true);
  });

  it('still sends a bite left open for days', () => {
    if (sector === undefined) throw new Error('no bites');
    const begun = beginBite(grower, sector, new Date('2026-10-01T00:00:00.000Z'));
    const response = biteResponse(q, begun, sector, null, new Date('2026-10-22T00:00:00.000Z'));
    expect(consultationResponseSchema.safeParse(response).success).toBe(true);
  });

  it('remembers a follow-up code once made, and sends it with every later bite', () => {
    if (codeBite === undefined || sector === undefined) throw new Error('no bites');
    const begun = beginBite(grower, codeBite);
    const made: BitePhone = {
      ...begun,
      current: begun.current === null ? null : { ...begun.current, answers: { [LINK_CODE_ID]: { kind: 'text', value: 'JO14BA' } } },
    };
    const after = finishBite(made, codeBite);
    expect(after.linkCode).toBe('JO14BA');
    expect(after.done).toEqual([codeBite.id]);
    expect(after.current).toBeNull();
    const later = biteResponse(q, beginBite(after, sector), sector, null);
    expect(later?.answers[LINK_CODE_ID]).toEqual({ kind: 'text', value: 'JO14BA' });
  });

  it('starts the list again in a new round, keeping who they are but not the code', () => {
    const used: BitePhone = { ...grower, done: ['core_sector'], linkCode: 'JO14BA' };
    expect(settlePhone(used, q.roundId)).toBe(used);
    const next = settlePhone(used, 'next-round');
    expect(next).toMatchObject({ roundId: 'next-round', role: 'grower', regions: ['ballarat'], done: [], linkCode: null });
  });
});
