import { config, isDemoSite } from '../lib/config';
import { selectedProjectId } from '../lib/projectSelection';
import { REGIONAL_EXAMPLE } from './exampleProject';
import type { Questionnaire } from '../types';
import { DEFAULT_QUESTIONNAIRE } from './questionnaire';

/**
 * What a project is running the tool for. It decides which rounds are
 * offered and what the results screens promise: a one-off consultation has
 * nothing to compare itself with, and saying so beats an empty chart.
 */
export type ProjectPurpose = 'tracked_rounds' | 'one_off' | 'event_feedback';

export interface PurposeTemplate {
  readonly id: ProjectPurpose;
  readonly label: string;
  /** One line, in the words a project manager would use. */
  readonly what: string;
  /** What choosing it costs or buys, said plainly. */
  readonly consequence: string;
  /** Which round stages this project can start. */
  readonly stages: readonly ('baseline' | 'review')[];
}

export const PURPOSES: readonly PurposeTemplate[] = [
  {
    id: 'tracked_rounds',
    label: 'Measures change over time',
    what: 'Ask where things stand now, then ask the same questions again part-way through and at the end.',
    consequence:
      'Lets you say what changed and by how much. The repeat questions are fixed once the starting point takes its first response.',
    stages: ['baseline', 'review'],
  },
  {
    id: 'one_off',
    label: 'One-off consultation',
    what: 'Ask what matters once, to set priorities or scope a piece of work.',
    consequence:
      'Nothing repeats, so there is no change to show later. Written questions are worth more here than anywhere else.',
    stages: ['baseline'],
  },
  {
    id: 'event_feedback',
    label: 'Feedback after each event',
    what: 'Short and repeated, run after a field day or workshop.',
    consequence: 'Compares one event with another rather than one year with another. Keep it under three minutes.',
    stages: ['review'],
  },
];

export const purposeTemplate = (purpose: ProjectPurpose): PurposeTemplate =>
  PURPOSES.find((template) => template.id === purpose) ?? (PURPOSES[0] as PurposeTemplate);

/**
 * A consultation project. The database keeps each project's rounds,
 * responses, contacts, groups and workshops apart by `project_id`; this is
 * the part that lives in code — the words on the page and the questionnaire
 * each round starts from.
 *
 * To add a project: add an entry here (and a row in consultation_projects
 * with the same id), then deploy with VITE_PROJECT_ID set to it.
 */
export interface ProjectDefinition {
  /** Matches consultation_projects.id. */
  readonly id: string;
  /** "Potato Mechanisation Project" */
  readonly name: string;
  /** Header title: "Potato Mechanisation" */
  readonly shortName: string;
  /** The funding body's reference, shown in the header and footer. */
  readonly reference: string;
  /** What the project is measuring, and so which rounds it runs. */
  readonly purpose: ProjectPurpose;
  /** Every round of the project starts from this, then applies its overrides. */
  readonly questionnaire: Questionnaire;
  /**
   * A worked example rather than a real project. Offered only on the
   * demonstration site, so nobody can collect real answers into it.
   */
  readonly example?: boolean;
}

export const PROJECTS: Readonly<Record<string, ProjectDefinition>> = {
  PT25003: {
    id: 'PT25003',
    name: 'Potato Mechanisation Project',
    shortName: 'Potato Mechanisation',
    reference: 'PT25003',
    purpose: 'tracked_rounds',
    questionnaire: DEFAULT_QUESTIONNAIRE,
  },
  REGIONAL: {
    id: 'REGIONAL',
    name: 'Regional program (example)',
    shortName: 'Regional program',
    reference: 'EXAMPLE',
    purpose: 'tracked_rounds',
    questionnaire: REGIONAL_EXAMPLE,
    example: true,
  },
};

export const DEFAULT_PROJECT_ID = 'PT25003';

/** An unknown id falls back to project one rather than a blank page. */
export const projectFor = (id: string): ProjectDefinition =>
  PROJECTS[id] ?? (PROJECTS[DEFAULT_PROJECT_ID] as ProjectDefinition);

/**
 * The projects this person can switch between: everything in the registry,
 * minus the worked examples unless this is the demonstration site.
 */
export const availableProjects = (): readonly ProjectDefinition[] =>
  Object.values(PROJECTS).filter((project) => project.example !== true || isDemoSite());

/**
 * What this browser is looking at: the project chosen by project staff, or the
 * one this deployment was built for. A chosen project that no longer exists,
 * or an example on a live site, falls back to the deployment's own.
 */
export const currentProject = (): ProjectDefinition => {
  const chosen = selectedProjectId();
  const picked = chosen === null ? undefined : PROJECTS[chosen];
  if (picked !== undefined && (picked.example !== true || isDemoSite())) return picked;
  return projectFor(config.projectId);
};
