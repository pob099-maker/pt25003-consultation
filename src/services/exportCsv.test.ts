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
    expect(csv).toContain('Potato grower or business owner');
    expect(csv).not.toContain(',harvest_logistics,');
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
