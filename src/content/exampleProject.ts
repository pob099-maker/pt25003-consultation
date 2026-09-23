import type { Questionnaire, Section } from '../types';
import { DEFAULT_QUESTIONNAIRE } from './questionnaire';

/**
 * A second project, so the switcher has somewhere to switch to and a
 * colleague can see what "another project on the same tool" actually means.
 *
 * It is built from the shared question library rather than invented: the same
 * question ids, so the two projects could be read side by side, with its own
 * name, its own rounds and a shorter set. Nothing here is a real project yet;
 * PotatoLink Regional would replace it with its own questions.
 */

const keep = (section: Section, ids: readonly string[]): Section => ({
  ...section,
  questions: section.questions.filter((question) => ids.includes(question.id)),
});

const hasQuestions = (section: Section): boolean => section.questions.length > 0;

/** Shorter than PT25003, and with no machinery-supply or technology branches. */
export const REGIONAL_EXAMPLE: Questionnaire = {
  ...DEFAULT_QUESTIONNAIRE,
  roundId: '2027-regional-baseline',
  roundLabel: 'Baseline',
  stage: 'baseline',
  core: DEFAULT_QUESTIONNAIRE.core
    .map((section) =>
      keep(section, ['q1_constraints', 'q2_top_three', 'q5_areas', 'q7_evidence', 'q_trust', 'q_trial']),
    )
    .filter(hasQuestions),
  pathways: Object.fromEntries(
    Object.entries(DEFAULT_QUESTIONNAIRE.pathways).filter(([key]) => ['farm', 'contractor', 'adviser'].includes(key)),
  ),
  projectDesign: DEFAULT_QUESTIONNAIRE.projectDesign
    .map((section) => keep(section, ['pd_formats', 'pd_timing', 'pd_most_useful']))
    .filter(hasQuestions),
  roles: DEFAULT_QUESTIONNAIRE.roles.filter((role) =>
    ['grower', 'farm_manager', 'contractor', 'adviser', 'industry_body'].includes(role.id),
  ),
};
