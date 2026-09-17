import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { groupQuestions, groupRecordSchema, groupsCsv, summariseGroups, type GroupRecord } from './groups';

const q = DEFAULT_QUESTIONNAIRE;

const group = (over: Partial<GroupRecord>): GroupRecord => ({
  id: crypto.randomUUID(),
  roundId: '2026-pilot',
  title: 'Ballarat grower group',
  region: 'Ballarat',
  heldOn: '2026-10-01',
  present: 10,
  roles: {},
  counts: {},
  notes: {},
  collectedBy: '22222222-2222-4222-8222-222222222222',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...over,
});

describe('groupRecordSchema', () => {
  it('accepts a sensible record', () => {
    expect(groupRecordSchema.safeParse(group({ counts: { q1_constraints: { harvest: 7 } } })).success).toBe(true);
  });

  it('refuses more hands than people in the room', () => {
    const result = groupRecordSchema.safeParse(group({ present: 10, counts: { q1_constraints: { harvest: 12 } } }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toContain('more than the 10 people');
  });

  it('refuses a room with nobody in it', () => {
    expect(groupRecordSchema.safeParse(group({ present: 0 })).success).toBe(false);
  });
});

describe('summariseGroups', () => {
  it('shares by the people who were asked, not every group', () => {
    // Asked at one meeting of 10; a second meeting of 20 never heard the
    // question. The share is 7 of 10, not 7 of 30.
    const summary = summariseGroups(
      q,
      [group({ present: 10, counts: { q1_constraints: { harvest: 7 } } }), group({ present: 20 })],
      'q1_constraints',
    );
    expect(summary.groups).toBe(1);
    expect(summary.people).toBe(10);
    const harvest = summary.rows.find((row) => row.id === 'harvest');
    expect(harvest?.hands).toBe(7);
    expect(harvest?.share).toBe(0.7);
  });

  it('adds hands across groups that were asked', () => {
    const summary = summariseGroups(
      q,
      [
        group({ present: 10, counts: { q1_constraints: { harvest: 7 } } }),
        group({ present: 15, counts: { q1_constraints: { harvest: 3, skills: 9 } } }),
      ],
      'q1_constraints',
    );
    expect(summary.people).toBe(25);
    expect(summary.rows.find((row) => row.id === 'harvest')?.hands).toBe(10);
    expect(summary.rows[0]?.id).toBe('harvest');
  });

  it('treats a question never put to any group as empty, not as zero support', () => {
    const summary = summariseGroups(q, [group({})], 'q7_evidence');
    expect(summary.groups).toBe(0);
    expect(summary.people).toBe(0);
  });
});

describe('groupQuestions', () => {
  it('leaves out the role branches, because a room is mixed', () => {
    const ids = groupQuestions(q).map((question) => question.id);
    expect(ids).toContain('q1_constraints');
    expect(ids).not.toContain('farm_pressure');
  });
});

describe('groupsCsv', () => {
  it('writes one row per group, question and option', () => {
    const csv = groupsCsv(q, [
      group({ counts: { q1_constraints: { harvest: 7, skills: 2 } }, notes: { q4_bad_season: 'Late harvest' } }),
    ]);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(4); // header + two options + one note
    expect(csv).toContain('Harvesting');
    expect(csv).toContain('Late harvest');
  });
});
