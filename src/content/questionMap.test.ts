import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from './questionnaire';
import { buildQuestionMap } from './questionMap';
import { allQuestions } from './lookup';

const DOC_PATH = 'docs/QUESTION-MAP.md';

describe('question map', () => {
  const generated = buildQuestionMap(DEFAULT_QUESTIONNAIRE);

  it('shows every question, so nothing is refined out of a map that never had it', () => {
    for (const question of allQuestions(DEFAULT_QUESTIONNAIRE)) {
      expect(generated).toContain(question.id);
    }
  });

  it('marks the role question as the branch point and names where each role goes', () => {
    expect(generated).toContain('this is the branch point');
    expect(generated).toContain('Contractor → *Your contracting work*');
  });

  it('nests as headings and bullets, which is what a mind-mapping tool imports', () => {
    expect(generated).toMatch(/^# /m);
    expect(generated).toMatch(/^## /m);
    expect(generated).toMatch(/^- /m);
  });

  it('matches the committed document', () => {
    const current = existsSync(DOC_PATH) ? readFileSync(DOC_PATH, 'utf8') : '';
    if (current !== generated && process.env.CI === undefined) {
      writeFileSync(DOC_PATH, generated, 'utf8');
      return;
    }
    expect(current, `${DOC_PATH} is out of date — run npm test locally and commit the result`).toBe(generated);
  });
});
