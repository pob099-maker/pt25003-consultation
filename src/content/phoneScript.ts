import { allSections } from './lookup';
import type { Option, Question, Questionnaire } from '../types';

/**
 * Renders the consultation as something a person can read down the phone.
 *
 * Plenty of the people this is aimed at would rather talk than type, and the
 * offer of a call is made on the landing page. That offer is only worth making
 * if the call collects the same things in the same order — otherwise the
 * phone answers cannot be pooled with the online ones, and the analysis
 * quietly splits into two datasets that do not agree.
 *
 * Generated from the questionnaire rather than written alongside it, so the
 * script cannot drift out of step with the form. See phoneScript.test.ts.
 */

const optionLines = (options: readonly Option[]): string =>
  options.map((option) => `  - ${option.label}${option.help === undefined ? '' : ` — ${option.help}`}`).join('\n');

const questionBlock = (question: Question, index: number): string => {
  const head = `**${index}. ${question.prompt}**`;
  const guideLines: string[] = [];
  if (question.guide?.open !== undefined) guideLines.push(`> Open with: "${question.guide.open}"`);
  if (question.guide?.probe !== undefined) guideLines.push(`> Then probe: "${question.guide.probe}"`);
  const guide = guideLines.length === 0 ? '' : `\n\n${guideLines.join('\n')}`;
  const help = `${guide}${question.help === undefined ? '' : `\n\n_${question.help}_`}`;

  switch (question.kind) {
    case 'multi':
      return `${head}${help}\n\n_Listen first and tick what they raise. If they are stuck, read the list, and note which items only came up after prompting — an unprompted mention is the stronger finding._\n\n${optionLines(question.options)}`;
    case 'single':
      return `${head}${help}\n\n_One answer only._\n\n${optionLines(question.options)}`;
    case 'text':
      return `${head}${help}\n\n_Let them talk. Write it down in their words, not yours._`;
    case 'rating':
      return [
        head,
        help,
        '',
        `_Scale: ${question.scale.map((point) => `${point.value} = ${point.label.toLowerCase()}`).join(', ')}._`,
        '_Read each one, take a number. "No view" is a fine answer — leave it blank rather than guessing._',
        '',
        optionLines(question.rows),
      ].join('\n');
    case 'rank':
      return `${head}${help}\n\n_Read back what they ticked a moment ago, and ask for their top ${question.count} in order._`;
  }
};

export const buildPhoneScript = (questionnaire: Questionnaire): string => {
  const lines: string[] = [];

  lines.push('# Phone script');
  lines.push('');
  lines.push(
    'For taking a consultation over the phone, or in a shed, when somebody would rather talk than fill in a form.',
  );
  lines.push('');
  lines.push(
    'This file is generated from the questions themselves — do not edit it by hand, or the call and the form will stop asking the same things. To change the wording, change it in the admin area or in `src/content/questionnaire.ts`, then run `npm test`.',
  );
  lines.push('');
  lines.push('## Before you start');
  lines.push('');
  lines.push('Say, in your own words:');
  lines.push('');
  lines.push(
    '> Thanks for making the time. This is for the Potato Mechanisation Project — we are trying to work out where mechanisation and automation would make the most practical difference, and what the project should take on. It takes about ten minutes. Nothing you say gets reported against your name or your business unless you tell me otherwise, and you can skip anything you would rather not answer.',
  );
  lines.push('');
  lines.push(
    'Then work down this script and enter the answers into the consultation afterwards, so they sit in the same data as everybody else’s. If you enter it while you talk, tell them that is what you are doing.',
  );
  lines.push('');
  lines.push('## Which perspective');
  lines.push('');
  lines.push('**Which of these best describes you?** _One answer. It decides which section you use below._');
  lines.push('');
  lines.push(optionLines(questionnaire.roles));
  lines.push('');
  lines.push('**Which growing regions are you talking about?** _Optional, more than one is fine._');
  lines.push('');
  lines.push(optionLines(questionnaire.regions));
  lines.push('');

  let n = 0;
  for (const section of questionnaire.core) {
    lines.push(`## ${section.title}`);
    lines.push('');
    if (section.intro !== undefined) {
      lines.push(`_${section.intro}_`);
      lines.push('');
    }
    for (const question of section.questions) {
      n += 1;
      lines.push(questionBlock(question, n));
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('## Role sections — use only the one that matches');
  lines.push('');
  for (const [pathway, section] of Object.entries(questionnaire.pathways)) {
    const roles = questionnaire.roles.filter((role) => role.pathway === pathway).map((role) => role.label);
    lines.push(`### ${section.title}`);
    lines.push('');
    lines.push(`_For: ${roles.join('; ')}._`);
    lines.push('');
    let m = 0;
    for (const question of section.questions) {
      m += 1;
      lines.push(questionBlock(question, m));
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  for (const section of questionnaire.projectDesign) {
    lines.push(`## ${section.title}`);
    lines.push('');
    let k = 0;
    for (const question of section.questions) {
      k += 1;
      lines.push(questionBlock(question, k));
      lines.push('');
    }
  }

  lines.push('## Before you hang up');
  lines.push('');
  lines.push(
    '**Would you like to be involved in any of this?** _Read the list. Ticking something is an expression of interest, not a commitment — say so._',
  );
  lines.push('');
  lines.push(optionLines(questionnaire.interestOptions));
  lines.push('');
  lines.push(
    'If they say yes to anything, take their name, organisation, region, and an email or a phone number, plus when suits for a call. Tell them it is kept separately from their answers and used only for what they picked.',
  );
  lines.push('');
  lines.push('Then thank them, and tell them a summary of what the industry said will come back to them.');
  lines.push('');

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
};

/** Every question id the script must cover, for the drift check. */
export const scriptQuestionIds = (questionnaire: Questionnaire): readonly string[] =>
  allSections(questionnaire).flatMap((section) => section.questions.map((question) => question.id));
