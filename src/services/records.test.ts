import { describe, expect, it } from 'vitest';
import { cleanAnswers } from './records';

describe('cleanAnswers', () => {
  it('drops answers of the wrong shape instead of taking a screen down', () => {
    const clean = cleanAnswers({
      q6_first_opportunities: { kind: 'text', value: null },
      farm_practices: { kind: 'rating', values: null },
      q1_constraints: { kind: 'multi', values: ['harvest'] },
    });
    expect(Object.keys(clean)).toEqual(['q1_constraints']);
  });

  it('keeps only rating rows whose ids could be real', () => {
    const clean = cleanAnswers(
      JSON.parse('{"q5_areas":{"kind":"rating","values":{"training":4,"constructor":3,"__proto__":2}}}'),
    );
    const rating = clean.q5_areas;
    expect(rating?.kind === 'rating' ? Object.keys(rating.values) : []).toEqual(['training']);
  });

  it('treats anything that is not an object as no answers at all', () => {
    expect(cleanAnswers(null)).toEqual({});
    expect(cleanAnswers([1, 2])).toEqual({});
  });
});
