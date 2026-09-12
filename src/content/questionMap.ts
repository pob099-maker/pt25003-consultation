import { DOMAIN_TO_AREAS } from './questionnaire';
import { optionLabel, questionById } from './lookup';
import type { Option, Question, Questionnaire } from '../types';

/**
 * Renders the questionnaire as a nested Markdown outline for mind-mapping
 * tools — Markmap, XMind, MindNode and Freeplane all import headings plus
 * bullets as a tree.
 *
 * The point is to see the shape of the thing: where a respondent's path
 * branches, how long each branch is, and which taxonomies are repeated in
 * three slightly different forms. That is very hard to see reading a source
 * file top to bottom, and it is what you want in front of you when deciding
 * what to cut.
 *
 * Generated rather than drawn, so the map is never a picture of last month's
 * questionnaire.
 */

const kindLabel = (question: Question): string => {
  switch (question.kind) {
    case 'multi':
      return `tick any${question.allowOther === true ? ' + other' : ''}`;
    case 'single':
      return 'one only';
    case 'text':
      return 'open text';
    case 'rating':
      return `rate 1-5 × ${question.rows.length}`;
    case 'rank':
      return `pick top ${question.count}`;
  }
};

/** Rough seconds a question costs, for the branch totals. */
const cost = (question: Question): number => {
  switch (question.kind) {
    case 'multi':
      return 20 + question.options.length * 1.5;
    case 'single':
      return 12;
    case 'text':
      return 45;
    case 'rating':
      return question.rows.length * 7;
    case 'rank':
      return 25;
  }
};

const bullets = (options: readonly Option[]): string => options.map((option) => `- ${option.label}`).join('\n');

const optionsOf = (question: Question): readonly Option[] => {
  if (question.kind === 'multi' || question.kind === 'single') return question.options;
  if (question.kind === 'rating') return question.rows;
  if (question.kind === 'rank') return question.fallbackOptions;
  return [];
};

const questionNode = (question: Question, depth: number): string => {
  const heading = '#'.repeat(depth);
  const lines = [`${heading} ${question.prompt}`, '', `\`${question.id}\` · ${kindLabel(question)}`, ''];
  const options = optionsOf(question);
  if (options.length > 0 && question.kind !== 'rank') {
    lines.push(bullets(options), '');
  }
  if (question.kind === 'rank') {
    lines.push(`- drawn from whatever was ticked in \`${question.sourceQuestionId}\``, '');
  }
  return lines.join('\n');
};

const minutes = (seconds: number): string => `${Math.round((seconds / 60) * 10) / 10} min`;

export const buildQuestionMap = (questionnaire: Questionnaire): string => {
  const lines: string[] = [];

  const coreSeconds = questionnaire.core.flatMap((s) => s.questions).reduce((sum, q) => sum + cost(q), 0);
  const designSeconds = questionnaire.projectDesign.flatMap((s) => s.questions).reduce((sum, q) => sum + cost(q), 0);

  lines.push(`# ${questionnaire.roundLabel}`, '');
  lines.push(
    'Generated from `src/content/questionnaire.ts` — do not edit by hand. Import into Markmap, XMind, MindNode or Freeplane to see the branch structure.',
    '',
  );

  lines.push('## 1. Everybody — who you are', '');
  lines.push('### Which of these best describes you?', '', '`role` · one only, required · **this is the branch point**', '');
  lines.push(
    questionnaire.roles.map((role) => `- ${role.label} → *${questionnaire.pathways[role.pathway]?.title ?? role.pathway}*`).join('\n'),
    '',
  );
  lines.push('### Which regions?', '', '`regions` · tick any + other', '');
  lines.push(bullets(questionnaire.regions), '');

  let n = 1;
  for (const section of questionnaire.core) {
    n += 1;
    lines.push(`## ${n}. Everybody — ${section.title}`, '');
    for (const question of section.questions) lines.push(questionNode(question, 3));
  }

  lines.push(`## ${n + 1}. One branch only — by role`, '');
  for (const [pathway, section] of Object.entries(questionnaire.pathways)) {
    const roles = questionnaire.roles.filter((role) => role.pathway === pathway);
    const seconds = section.questions.reduce((sum, q) => sum + cost(q), 0);
    lines.push(`### ${section.title}`, '');
    lines.push(
      `${roles.map((role) => role.label).join('; ')} · ${section.questions.length} questions · about ${minutes(seconds)}`,
      '',
    );
    for (const question of section.questions) lines.push(questionNode(question, 4));
  }

  for (const section of questionnaire.projectDesign) {
    lines.push(`## ${n + 2}. Everybody — ${section.title}`, '');
    for (const question of section.questions) lines.push(questionNode(question, 3));
  }

  lines.push(`## ${n + 3}. Everybody — optional: stay involved`, '');
  lines.push('### Would you be interested in any of the following?', '', '`interests` · tick any', '');
  lines.push('#### Offered to everyone', '', bullets(questionnaire.interestOptions), '');
  for (const [pathway, options] of Object.entries(questionnaire.pathwayInterests)) {
    lines.push(`#### Only on the ${questionnaire.pathways[pathway]?.title ?? pathway} branch`, '', bullets(options), '');
  }
  lines.push('### If anything is ticked', '', '- Name, organisation, broad role, region', '- Email or phone (at least one)', '- Preferred method and time', '- Comments', '');

  lines.push('## Crosswalk: constraint named → priority areas rated', '');
  lines.push(
    'The two lists are different axes — where the trouble is, and what could be done about it. This is the stated mapping between them, so "did the people who named harvesting also rate harvest technology highly?" is one query rather than a judgement call made differently by each analyst.',
    '',
  );
  const constraintQuestion = questionById(questionnaire, 'q1_constraints');
  const areaQuestion = questionById(questionnaire, 'q5_areas');
  for (const [domain, areas] of Object.entries(DOMAIN_TO_AREAS)) {
    lines.push(`### ${optionLabel(constraintQuestion, domain)}`, '');
    lines.push(bullets(areas.map((area) => ({ id: area, label: optionLabel(areaQuestion, area) }))), '');
  }

  lines.push('## Branch lengths', '');
  lines.push(`- Shared by everyone: about ${minutes(coreSeconds + designSeconds)}`, '');
  for (const section of Object.values(questionnaire.pathways)) {
    const seconds = section.questions.reduce((sum, q) => sum + cost(q), 0);
    lines.push(`- ${section.title} branch: about ${minutes(seconds)} → total ${minutes(coreSeconds + designSeconds + seconds)}`);
  }
  lines.push('');
  lines.push(
    '_Estimates only: 1.5 seconds per option read, 45 for an open box, 7 per rating row. Useful for comparing branches against each other, not for promising a number to a respondent._',
    '',
  );

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
};
