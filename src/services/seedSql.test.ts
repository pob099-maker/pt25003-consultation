import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { allQuestions } from '../content/lookup';
import { buildSeedSql } from './seedSql';
import { seedResponses } from './seed';

const SQL_PATH = 'supabase/seed/test_data.sql';

describe('seed SQL', () => {
  const generated = buildSeedSql(DEFAULT_QUESTIONNAIRE.roundId, DEFAULT_QUESTIONNAIRE.roundLabel);

  it('flags every row as test data, so a real count is never inflated', () => {
    expect(generated).not.toContain('false');
    expect(generated.match(/is_test_data/g)?.length).toBeGreaterThan(0);
  });

  it('escapes an apostrophe rather than ending the string early', () => {
    // "everybody's" in a seeded comment would otherwise break the whole file.
    expect(buildSeedSql("it's", "a label with ' in it")).toContain("'a label with '' in it'");
  });

  it('only answers questions that exist', () => {
    const known = new Set(allQuestions(DEFAULT_QUESTIONNAIRE).map((question) => question.id));
    for (const response of seedResponses()) {
      for (const id of Object.keys(response.answers)) {
        expect(known, `seeded answer for unknown question ${id}`).toContain(id);
      }
    }
  });

  it('matches the committed file', () => {
    const current = existsSync(SQL_PATH) ? readFileSync(SQL_PATH, 'utf8') : '';
    if (current !== generated && process.env.CI === undefined) {
      writeFileSync(SQL_PATH, generated, 'utf8');
      return;
    }
    expect(current, `${SQL_PATH} is out of date — run npm test locally and commit the result`).toBe(generated);
  });
});
