import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { seedContacts, seedResponses } from './seed';
import { contactsCsv, responseHeaders, responsesCsv } from './exportCsv';

const q = DEFAULT_QUESTIONNAIRE;

describe('responsesCsv', () => {
  it('gives every question its own column, and every rating row its own', () => {
    const headers = responseHeaders(q);
    expect(headers).toContain('q1_constraints');
    expect(headers).toContain('q1_constraints__other');
    expect(headers).toContain('q5_areas__harvest_efficiency');
    expect(headers).toContain('q2_top_three__1');
    expect(headers).toContain('q2_top_three__3');
    // Duplicated headers would silently drop a column in a spreadsheet.
    expect(new Set(headers).size).toBe(headers.length);
  });

  it('writes one row per response, with labels rather than ids', () => {
    const csv = responsesCsv(q, seedResponses());
    const lines = csv.trimEnd().split('\r\n');
    expect(lines).toHaveLength(seedResponses().length + 1);
    expect(csv).toContain('Grower: business owner');
    expect(csv).not.toContain(',harvest_logistics,');
  });

  it('gives the row somebody named two columns: where they are at, and what it was', () => {
    const headers = responseHeaders(q);
    expect(headers).toContain('farm_practices__other');
    expect(headers).toContain('farm_practices__other_what');
    const first = seedResponses()[0];
    if (first === undefined) throw new Error('no seeded response');
    const csv = responsesCsv(q, [
      { ...first, answers: { farm_practices: { kind: 'rating', values: { other: 3 }, other: 'Weeding robot' } } },
    ]);
    expect(csv).toContain('Weeding robot');
  });

  it("puts a question's own box in a column of its own, beside the answer", () => {
    const [first] = seedResponses();
    if (first === undefined) throw new Error('no seeded response');
    const csv = responsesCsv(DEFAULT_QUESTIONNAIRE, [
      { ...first, answers: { farm_outcome: { kind: 'single', value: 'stopped', note: 'Drone scouting' } } },
    ]);
    expect(csv).toContain('farm_outcome__note');
    expect(csv).toContain('Drone scouting');
    expect(csv).not.toContain('quote_ok');
  });

  it('never reads a row id as something every object already has', () => {
    const first = seedResponses()[0];
    const farm = q.pathways.farm;
    if (first === undefined || farm === undefined) throw new Error('no seeded response or farm section');
    const odd = {
      ...q,
      pathways: {
        ...q.pathways,
        farm: {
          ...farm,
          questions: farm.questions.map((question) =>
            question.id === 'farm_practices' && question.kind === 'rating'
              ? { ...question, rows: [...question.rows, { id: 'constructor', label: 'Odd' }] }
              : question,
          ),
        },
      },
    };
    const csv = responsesCsv(odd, [{ ...first, answers: { farm_practices: { kind: 'rating', values: { guidance: 4 } } } }]);
    expect(csv).not.toContain('native code');
  });

  it('marks test data so it can be filtered out of a spreadsheet too', () => {
    expect(responsesCsv(q, seedResponses())).toContain('yes');
  });

  it('produces a header row even with no responses', () => {
    const csv = responsesCsv(q, []);
    expect(csv.trimEnd().split('\r\n')).toHaveLength(1);
  });
});

describe('contactsCsv', () => {
  it('exports contact details separately, with no response id anywhere', () => {
    const csv = contactsCsv(q, seedContacts());
    expect(csv).toContain('test.alex@example.invalid');
    expect(csv).not.toContain('response_id');
    expect(csv).toContain('Hosting a trial or demonstration on your farm');
    expect(csv).toContain('Joining the project reference group');
  });
});
