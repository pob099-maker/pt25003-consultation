import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { allQuestions } from '../content/lookup';
import { shortVersion } from './formLength';
import { buildQuestionPaper } from './questionPaper';

const paper = buildQuestionPaper(DEFAULT_QUESTIONNAIRE);
const asked = paper.sections.flatMap((section) => section.questions);

describe('buildQuestionPaper', () => {
  it('carries every question the questionnaire asks, and the two screens around them', () => {
    for (const question of allQuestions(DEFAULT_QUESTIONNAIRE)) {
      expect(asked.some((entry) => entry.id === question.id)).toBe(true);
    }
    // Role and region are asked on their own screen, not inside a section. A
    // paper without them would not be the questionnaire.
    expect(asked.map((entry) => entry.id).slice(0, 2)).toEqual(['role', 'regions']);
    expect(paper.fullCount).toBe(allQuestions(DEFAULT_QUESTIONNAIRE).length + 2);
  });

  it('marks the short version by deriving it, not by restating the rule', () => {
    const shortIds = new Set(allQuestions(shortVersion(DEFAULT_QUESTIONNAIRE)).map((question) => question.id));
    for (const entry of asked) {
      if (entry.id === 'role' || entry.id === 'regions') {
        expect(entry.inShort).toBe(true);
        continue;
      }
      expect(entry.inShort).toBe(shortIds.has(entry.id));
    }
    expect(paper.shortCount).toBe(shortIds.size + 2);
    expect(paper.shortCount).toBeLessThan(paper.fullCount);
    expect(paper.shortList.map((entry) => entry.number)).toEqual([...paper.shortList].map((entry) => entry.number).sort((a, b) => a - b));
  });

  it('numbers continuously, so a number points at one question', () => {
    expect(asked.map((entry) => entry.number)).toEqual(asked.map((_, index) => index + 1));
    expect(new Set(asked.map((entry) => entry.id)).size).toBe(asked.length);
  });

  it('says who is asked each section, naming the roles a branch belongs to', () => {
    const everybody = paper.sections.filter((section) => section.audience === 'Everybody');
    expect(everybody.length).toBeGreaterThan(1);
    const farm = paper.sections.find((section) => section.id === 'farm');
    expect(farm?.audience).toContain('Potato grower');
    expect(farm?.audience).toContain('Farm manager');
    const followUp = paper.sections.find((section) => section.id === DEFAULT_QUESTIONNAIRE.followUp[0]?.id);
    expect(followUp?.audience).toContain('review');
  });

  it('describes a question the way the person answering meets it', () => {
    const constraints = asked.find((entry) => entry.id === 'q1_constraints');
    expect(constraints?.kindLabel).toBe("Any number of answers, plus an 'other' box");
    expect(constraints?.options.length).toBeGreaterThan(5);

    const areas = asked.find((entry) => entry.id === 'q5_areas');
    expect(areas?.kindLabel).toBe('Each line rated 1 to 5');
    expect(areas?.scale).toHaveLength(5);

    const role = asked.find((entry) => entry.id === 'role');
    expect(role?.required).toBe(true);
  });

  it('explains a question whose choices come from an earlier answer', () => {
    const topThree = asked.find((entry) => entry.id === 'q2_top_three');
    expect(topThree?.kindLabel).toBe('3 of them, in order');
    expect(topThree?.notes.join(' ')).toContain('ticked');
    // The fallback list is printed, because somebody who ticked nothing sees it.
    expect(topThree?.options.length).toBeGreaterThan(0);
  });

  it('follows the wording it is given, so an edited round prints as edited', () => {
    const edited = {
      ...DEFAULT_QUESTIONNAIRE,
      roundLabel: 'Baseline',
      core: DEFAULT_QUESTIONNAIRE.core.map((section) => ({
        ...section,
        questions: section.questions.map((question) =>
          question.id === 'q1_constraints' ? { ...question, prompt: 'Changed on the wording tab' } : question,
        ),
      })),
    };
    const reprinted = buildQuestionPaper(edited);
    expect(reprinted.roundLabel).toBe('Baseline');
    expect(
      reprinted.sections.flatMap((section) => section.questions).find((entry) => entry.id === 'q1_constraints')?.prompt,
    ).toBe('Changed on the wording tab');
  });
});
