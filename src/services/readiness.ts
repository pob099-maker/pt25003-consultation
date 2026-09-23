import type { ConsultationResponse, Questionnaire } from '../types';
import { FULL_TARGET_MINUTES, SHORT_TARGET_MINUTES, formEstimates, questionsFor, spoken } from './estimate';
import { reviewQuestionnaire } from './plainLanguage';

/**
 * The things that are awkward to fix once people have started answering,
 * checked before the link goes out.
 *
 * Nothing here blocks a launch. Each check says what it found and what it
 * would cost to leave it, because the person launching knows their project
 * and this does not.
 */

export type CheckState = 'pass' | 'warn';

export interface Check {
  readonly id: string;
  readonly state: CheckState;
  readonly title: string;
  readonly detail: string;
}

/** Fewer than this and a round cannot show much change; many more and the short version stops being short. */
const TRACKED_MIN = 4;
const TRACKED_MAX = 8;

export const readinessChecks = (
  questionnaire: Questionnaire,
  responses: readonly ConsultationResponse[] = [],
): readonly Check[] => {
  const checks: Check[] = [];
  const estimates = formEstimates(questionnaire);
  // What one person is asked every round: the shared tracked questions plus
  // the tracked ones on their own branch. Counting all sixteen at once would
  // describe a form nobody fills in.
  const isTracked = (question: { readonly tracking?: boolean }): boolean => question.tracking === true;
  const shared = [...questionnaire.core, ...questionnaire.followUp, ...questionnaire.projectDesign]
    .flatMap((section) => section.questions)
    .filter(isTracked);
  const branchMost = Math.max(
    0,
    ...Object.values(questionnaire.pathways).map((section) => section.questions.filter(isTracked).length),
  );
  const tracked = shared;

  checks.push(
    tracked.length >= TRACKED_MIN && tracked.length <= TRACKED_MAX
      ? {
          id: 'tracked',
          state: 'pass',
          title: `${tracked.length} questions are asked every time${branchMost > 0 ? `, plus up to ${branchMost} on each branch` : ''}`,
          detail: 'Every consultation can be compared with the starting point on these, word for word.',
        }
      : {
          id: 'tracked',
          state: 'warn',
          title:
            tracked.length < TRACKED_MIN
              ? `Only ${tracked.length} question${tracked.length === 1 ? '' : 's'} repeats every time`
              : `${tracked.length} questions repeat every time`,
          detail:
            tracked.length < TRACKED_MIN
              ? 'These are the only questions that can show change later. Four to eight is the usual range.'
              : 'Every one of these is also in the short version, so the short version is no longer short.',
        },
  );

  checks.push(
    estimates.short.minutes <= SHORT_TARGET_MINUTES
      ? {
          id: 'short-length',
          state: 'pass',
          title: `The short version takes ${spoken(estimates.short)}`,
          detail: `${estimates.short.questions} questions for the branch that takes longest.`,
        }
      : {
          id: 'short-length',
          state: 'warn',
          title: `The short version takes ${spoken(estimates.short)}`,
          detail: `It is meant to be the quick way in, under ${SHORT_TARGET_MINUTES} minutes. Ask fewer questions every time, or shorten a rating grid.`,
        },
  );

  checks.push(
    estimates.full.minutes <= FULL_TARGET_MINUTES
      ? {
          id: 'full-length',
          state: 'pass',
          title: `The full version takes ${spoken(estimates.full)}`,
          detail: `${estimates.full.questions} questions for the branch that takes longest.`,
        }
      : {
          id: 'full-length',
          state: 'warn',
          title: `The full version takes ${spoken(estimates.full)}`,
          detail: `Most people stop around ${FULL_TARGET_MINUTES} minutes on a phone. Move a written question to the interview, where it is answered better anyway.`,
        },
  );

  // A written question after another written question is where people give up.
  const adjacentText = [...questionnaire.core, ...questionnaire.projectDesign].some((section) =>
    section.questions.some(
      (question, index) => question.kind === 'text' && section.questions[index + 1]?.kind === 'text',
    ),
  );
  checks.push(
    adjacentText
      ? {
          id: 'typing',
          state: 'warn',
          title: 'Two written questions sit back to back',
          detail: 'Typing twice in a row on a phone is where people leave. Put a tick-box question between them.',
        }
      : {
          id: 'typing',
          state: 'pass',
          title: 'No two written questions in a row',
          detail: 'Typing is broken up by questions people can answer with a tap.',
        },
  );

  const findings = reviewQuestionnaire(questionnaire);
  checks.push(
    findings.length === 0
      ? {
          id: 'plain-language',
          state: 'pass',
          title: 'The wording reads plainly',
          detail: 'Nothing flagged as office or trade language.',
        }
      : {
          id: 'plain-language',
          state: 'warn',
          title: `${findings.length} wording${findings.length === 1 ? '' : 's'} worth a second look`,
          detail: 'Jargon, a long sentence or a technical term with nothing explaining it. See the list below.',
        },
  );

  const thinBranch = questionnaire.roles
    .map((role) => ({
      role,
      count: questionsFor(questionnaire, role.id).length - questionsFor(questionnaire, null).length,
    }))
    .filter((entry) => entry.count < 1);
  checks.push(
    thinBranch.length === 0
      ? {
          id: 'branches',
          state: 'pass',
          title: 'Every part of the industry has questions of its own',
          detail: 'Nobody is asked about a shed or a paddock they do not have.',
        }
      : {
          id: 'branches',
          state: 'warn',
          title: `${thinBranch.length} role${thinBranch.length === 1 ? ' has' : 's have'} no questions of their own`,
          detail: thinBranch.map((entry) => entry.role.label).join(', '),
        },
  );

  const testRows = responses.filter((response) => response.isTestData).length;
  const pilotRows = responses.filter(
    (response) => !response.isTestData && response.roundId !== questionnaire.roundId,
  ).length;
  checks.push(
    testRows === 0
      ? {
          id: 'test-data',
          state: 'pass',
          title: 'No test responses in the results',
          detail:
            pilotRows > 0
              ? `${pilotRows} response${pilotRows === 1 ? '' : 's'} sit in earlier consultations, which is as it should be.`
              : 'Nothing to clear before it starts.',
        }
      : {
          id: 'test-data',
          state: 'warn',
          title: `${testRows} test response${testRows === 1 ? '' : 's'} are still in the results`,
          detail:
            'They are excluded from change over time, but they will flatter your response count. Clear them before you share the link.',
        },
  );

  return checks;
};

export const warnings = (checks: readonly Check[]): readonly Check[] =>
  checks.filter((check) => check.state === 'warn');
