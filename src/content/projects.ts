import { config } from '../lib/config';
import type { Questionnaire } from '../types';
import { DEFAULT_QUESTIONNAIRE } from './questionnaire';

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
  /** Every round of the project starts from this, then applies its overrides. */
  readonly questionnaire: Questionnaire;
}

export const PROJECTS: Readonly<Record<string, ProjectDefinition>> = {
  PT25003: {
    id: 'PT25003',
    name: 'Potato Mechanisation Project',
    shortName: 'Potato Mechanisation',
    reference: 'PT25003',
    questionnaire: DEFAULT_QUESTIONNAIRE,
  },
};

export const DEFAULT_PROJECT_ID = 'PT25003';

/** An unknown id falls back to project one rather than a blank page. */
export const projectFor = (id: string): ProjectDefinition =>
  PROJECTS[id] ?? (PROJECTS[DEFAULT_PROJECT_ID] as ProjectDefinition);

export const currentProject = (): ProjectDefinition => projectFor(config.projectId);
