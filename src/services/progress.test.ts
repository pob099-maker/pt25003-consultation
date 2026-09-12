import { describe, expect, it } from 'vitest';
import { summariseProgress, type ProgressRow } from './progress';

const row = (over: Partial<ProgressRow>): ProgressRow => ({
  id: crypto.randomUUID(),
  round_id: '2026-round-1',
  role: 'grower',
  pathway: 'farm',
  furthest_step: 0,
  furthest_step_id: 'about_you',
  step_count: 7,
  completed: false,
  started_at: '2026-09-12T00:00:00.000Z',
  updated_at: '2026-09-12T00:05:00.000Z',
  ...over,
});

describe('summariseProgress', () => {
  it('counts starts and finishes', () => {
    const summary = summariseProgress([
      row({ completed: true }),
      row({ completed: true }),
      row({ completed: false }),
      row({ completed: false }),
    ]);
    expect(summary.started).toBe(4);
    expect(summary.completed).toBe(2);
    expect(summary.completionRate).toBe(0.5);
  });

  it('counts a step as a wall only for the sessions that stopped there', () => {
    // Every finisher passes through the priorities step. If those counted as
    // stopping there, the busiest step would always look like the worst one.
    const summary = summariseProgress([
      row({ furthest_step: 6, furthest_step_id: 'stay_involved', completed: true }),
      row({ furthest_step: 6, furthest_step_id: 'stay_involved', completed: true }),
      row({ furthest_step: 3, furthest_step_id: 'core_priorities', completed: false }),
    ]);
    const priorities = summary.dropOff.find((step) => step.stepId === 'core_priorities');
    const end = summary.dropOff.find((step) => step.stepId === 'stay_involved');
    expect(priorities?.stopped).toBe(1);
    expect(end?.stopped).toBe(0);
    expect(end?.reached).toBe(2);
  });

  it('orders the funnel by step, not by size', () => {
    const summary = summariseProgress([
      row({ furthest_step: 4, furthest_step_id: 'farm' }),
      row({ furthest_step: 1, furthest_step_id: 'core_constraints' }),
      row({ furthest_step: 1, furthest_step_id: 'core_constraints' }),
    ]);
    expect(summary.dropOff.map((step) => step.stepId)).toEqual(['core_constraints', 'farm']);
  });

  it('compares branches, which is the point of recording the pathway', () => {
    const summary = summariseProgress([
      row({ pathway: 'farm', completed: true }),
      row({ pathway: 'farm', completed: true }),
      row({ pathway: 'processor', completed: false }),
      row({ pathway: 'processor', completed: false }),
      row({ pathway: 'processor', completed: true }),
    ]);
    expect(summary.byPathway[0]?.pathway).toBe('processor');
    expect(summary.byPathway.find((p) => p.pathway === 'farm')?.rate).toBe(1);
    expect(summary.byPathway.find((p) => p.pathway === 'processor')?.rate).toBe(0.33);
  });

  it('says nothing rather than dividing by zero before anyone has started', () => {
    const summary = summariseProgress([]);
    expect(summary.started).toBe(0);
    expect(summary.completionRate).toBe(0);
    expect(summary.dropOff).toHaveLength(0);
  });
});
