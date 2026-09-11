import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE, NO_INTEREST_ID, PATHWAY_INTERESTS, interestsForPathway } from './questionnaire';
import { interestLabel } from './lookup';

const q = DEFAULT_QUESTIONNAIRE;

describe('interestsForPathway', () => {
  it('offers what this part of the chain can actually do, before the general options', () => {
    const grower = interestsForPathway(q, 'farm').map((option) => option.id);
    expect(grower[0]).toBe('farm_host_trial');
    expect(grower).toContain('reference_group');
    // A grower is never asked to supply machinery for a demonstration.
    expect(grower).not.toContain('mach_supply_demo');
  });

  it('gives every pathway a way to help with a trial and a way to join the reference group', () => {
    for (const pathway of Object.keys(q.pathways)) {
      const ids = interestsForPathway(q, pathway).map((option) => option.id);
      expect(ids).toContain('reference_group');
      expect((PATHWAY_INTERESTS[pathway] ?? []).length).toBeGreaterThan(0);
    }
  });

  it('always ends with the opt-out, so it is never lost among the options', () => {
    for (const pathway of [null, 'farm', 'processor', 'machinery']) {
      const ids = interestsForPathway(q, pathway).map((option) => option.id);
      expect(ids[ids.length - 1]).toBe(NO_INTEREST_ID);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('falls back to the common list when no role was chosen', () => {
    expect(interestsForPathway(q, null).map((option) => option.id)).toEqual([
      ...q.interestOptions.map((option) => option.id),
      NO_INTEREST_ID,
    ]);
  });
});

describe('interestLabel', () => {
  it('reads the same in an export whichever pathway the id came from', () => {
    expect(interestLabel(q, 'reference_group')).toBe('Joining the project reference group');
    expect(interestLabel(q, 'pro_host_trial')).toBe('Hosting a trial in your packhouse, receival or store');
    expect(interestLabel(q, NO_INTEREST_ID)).toBe('None of these');
    expect(interestLabel(q, 'unknown_id')).toBe('unknown_id');
  });
});
