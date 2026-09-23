import { allQuestions } from '../content/lookup';
import type { Question, Questionnaire } from '../types';

/**
 * A check on the words, for people writing questions that a grower will read
 * on a phone in a shed.
 *
 * It is a prompt to think, never a rule: it says what it noticed and offers
 * plainer wording, and the person writing decides. Nothing here rewrites
 * anything by itself.
 */

/** Office and trade language, with what to say instead. Lower case, whole words. */
const PLAINER: Readonly<Record<string, string>> = {
  workflow: 'the way the job runs',
  'work flow': 'the way the job runs',
  optimise: 'improve',
  optimize: 'improve',
  utilise: 'use',
  utilize: 'use',
  leverage: 'use',
  facilitate: 'help',
  implement: 'put in',
  implementation: 'putting it in',
  interoperability: 'getting different brands to work together',
  'predictive maintenance': 'servicing a part before it breaks',
  'optical sorting': 'cameras that grade as it goes past',
  autonomous: 'driverless',
  'semi-autonomous': 'part-driverless',
  stakeholder: 'the people involved',
  stakeholders: 'the people involved',
  engagement: 'how people take part',
  'value chain': 'the chain from paddock to market',
  synergies: 'what works well together',
  capability: 'what you can do',
  capacity: 'how much you can handle',
  'digital transformation': 'moving to digital tools',
  innovation: 'new ways of doing things',
  paradigm: 'approach',
  holistic: 'whole-farm',
  'best practice': 'what works well',
  metrics: 'numbers',
  kpis: 'targets',
  roi: 'what you get back for what you spend',
  'operational efficiency': 'getting more done for the same effort',
  throughput: 'how much goes through',
  granular: 'detailed',
  robust: 'reliable',
};

/** A sentence longer than this is hard to hold in your head while answering. */
export const LONG_SENTENCE_WORDS = 25;

export type FindingKind = 'jargon' | 'long-sentence' | 'unexplained' | 'double-question';

export interface Finding {
  readonly kind: FindingKind;
  /** The question or option this is about. */
  readonly where: string;
  readonly text: string;
  readonly note: string;
}

const words = (text: string): readonly string[] => text.toLowerCase().match(/[a-z][a-z'-]*/g) ?? [];

/** Jargon found in a piece of text, each with plainer wording. */
export const jargonIn = (text: string): readonly { readonly term: string; readonly plainer: string }[] => {
  const lower = text.toLowerCase();
  const found: { term: string; plainer: string }[] = [];
  for (const [term, plainer] of Object.entries(PLAINER)) {
    const pattern = new RegExp(`(^|[^a-z-])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z-]|$)`);
    if (pattern.test(lower)) found.push({ term, plainer });
  }
  return found;
};

const longestSentence = (text: string): number =>
  Math.max(0, ...text.split(/[.?!]\s+/).map((sentence) => words(sentence).length));

/**
 * Two questions in one box. Asking twice inside one prompt is the giveaway:
 * a second question mark, or a second "what/how/why/which" after the first.
 */
const isDoubleQuestion = (prompt: string): boolean => {
  if (/\?[^?]*\?/.test(prompt)) return true;
  const asks = prompt.toLowerCase().match(/\b(what|how|why|which|when|where|who)\b/g) ?? [];
  return asks.length > 1;
};

const findingsForText = (where: string, text: string, kind: 'prompt' | 'option'): readonly Finding[] => {
  const findings: Finding[] = [];
  for (const { term, plainer } of jargonIn(text)) {
    findings.push({
      kind: 'jargon',
      where,
      text,
      note: `“${term}” is office or trade language. A grower reading this on a phone would follow “${plainer}”.`,
    });
  }
  if (kind === 'prompt' && longestSentence(text) > LONG_SENTENCE_WORDS) {
    findings.push({
      kind: 'long-sentence',
      where,
      text,
      note: `${longestSentence(text)} words in one sentence. Break it in two, or move the detail into the help line underneath.`,
    });
  }
  if (kind === 'prompt' && isDoubleQuestion(text)) {
    findings.push({
      kind: 'double-question',
      where,
      text,
      note: 'Two questions in one. People answer whichever they read last, and the answers cannot be separated afterwards.',
    });
  }
  return findings;
};

/** Everything worth a second look in one question, including its answer options. */
export const reviewQuestion = (question: Question): readonly Finding[] => {
  const where = question.id;
  const findings: Finding[] = [...findingsForText(where, question.prompt, 'prompt')];
  if (question.help !== undefined)
    findings.push(...findingsForText(where, question.help, 'prompt').filter((finding) => finding.kind === 'jargon'));

  const options =
    question.kind === 'multi' || question.kind === 'single'
      ? question.options
      : question.kind === 'rating'
        ? question.rows
        : question.kind === 'rank'
          ? question.fallbackOptions
          : [];

  for (const option of options) {
    const jargon = findingsForText(where, option.label, 'option');
    // An option that explains itself underneath has already done the work.
    if (option.help === undefined) findings.push(...jargon);
    else if (jargon.length > 0 && option.help.trim().length === 0) findings.push(...jargon);
  }

  // A technical-sounding option with nothing under it, even if it dodged the list.
  for (const option of options) {
    if (option.help === undefined && words(option.label).some((word) => word.length >= 14)) {
      findings.push({
        kind: 'unexplained',
        where,
        text: option.label,
        note: 'A long technical word with no note underneath. One plain sentence would save people guessing.',
      });
    }
  }
  return findings;
};

export const reviewQuestionnaire = (questionnaire: Questionnaire): readonly Finding[] =>
  allQuestions(questionnaire).flatMap((question) => reviewQuestion(question));
