import { describe, expect, it } from 'vitest';
import { allQuestions } from './lookup';
import { libraryIds } from './library';
import { DEFAULT_PROJECT_ID, PROJECTS, currentProject, projectFor } from './projects';

describe('projects', () => {
  it('serves PT25003 when no project is configured', () => {
    expect(currentProject().id).toBe(DEFAULT_PROJECT_ID);
  });

  it('falls back to project one for an unknown id', () => {
    expect(projectFor('NOPE').id).toBe(DEFAULT_PROJECT_ID);
  });

  it('keys every project by its own id', () => {
    for (const [key, project] of Object.entries(PROJECTS)) expect(project.id).toBe(key);
  });

  it('only asks questions that are in the shared library', () => {
    const library = new Set(libraryIds());
    for (const project of Object.values(PROJECTS)) {
      for (const question of allQuestions(project.questionnaire)) expect(library.has(question.id)).toBe(true);
    }
  });
});
