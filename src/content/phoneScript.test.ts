import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from './questionnaire';
import { buildPhoneScript } from './phoneScript';
import { questionById } from './lookup';

const DOC_PATH = 'docs/PHONE-SCRIPT.md';

/**
 * The phone script is generated, not written. Running the tests locally
 * rewrites it, so it cannot fall behind a question that changed; CI only
 * checks, so a stale file committed by hand is caught rather than silently
 * fixed on a machine nobody is watching.
 */
describe('phone script', () => {
  const generated = buildPhoneScript(DEFAULT_QUESTIONNAIRE);

  it('asks every question the form asks, in the same words', () => {
    for (const section of [
      ...DEFAULT_QUESTIONNAIRE.core,
      ...Object.values(DEFAULT_QUESTIONNAIRE.pathways),
      ...DEFAULT_QUESTIONNAIRE.projectDesign,
    ]) {
      for (const question of section.questions) {
        expect(generated).toContain(question.prompt);
      }
    }
  });

  it('reads out every choice, so a caller cannot offer a shorter list than the form', () => {
    const question = questionById(DEFAULT_QUESTIONNAIRE, 'q1_constraints');
    if (question?.kind !== 'multi') throw new Error('expected q1 to be a multi-select');
    for (const option of question.options) {
      expect(generated).toContain(option.label);
    }
  });

  it('tells the caller not to guess a rating nobody has a view on', () => {
    // A guessed 3 is indistinguishable from a considered 3 once it is stored,
    // and it drags every mean towards the middle.
    expect(generated).toContain('"No view" is a fine answer');
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
