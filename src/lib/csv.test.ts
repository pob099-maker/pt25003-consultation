import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  it('quotes commas, quotes and newlines', () => {
    const csv = toCsv(['a', 'b'], [{ a: 'one, two', b: 'he said "no"\nthen left' }]);
    expect(csv).toContain('"one, two"');
    expect(csv).toContain('"he said ""no""\nthen left"');
  });

  it('leaves a missing value empty rather than writing undefined', () => {
    expect(toCsv(['a', 'b'], [{ a: 'x' }])).toContain('x,\r\n');
  });

  it('neutralises a leading character a spreadsheet would treat as a formula', () => {
    // Free text comes from the public, so an answer beginning with = must not
    // become an executable cell when the project team opens the export.
    const csv = toCsv(['a'], [{ a: '=HYPERLINK("http://example.invalid")' }]);
    expect(csv).toContain("'=HYPERLINK");
  });
});
