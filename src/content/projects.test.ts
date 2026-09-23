import { describe, expect, it } from 'vitest';
import { allQuestions } from './lookup';
import { libraryIds } from './library';
import { DEFAULT_PROJECT_ID, PROJECTS, availableProjects, currentProject, projectFor } from './projects';

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

describe('switching project', () => {
  it('keeps worked examples off a live site', () => {
    // Tests run with the demo flag unset, like the real deployment.
    expect(availableProjects().every((project) => project.example !== true)).toBe(true);
    expect(PROJECTS.REGIONAL?.example).toBe(true);
  });

  it('offers the example alongside the real project once there are two', () => {
    expect(Object.keys(PROJECTS).length).toBeGreaterThan(1);
  });

  it('gives the example project its own questions, from the shared library', () => {
    const regional = PROJECTS.REGIONAL;
    if (regional === undefined) throw new Error('no example project');
    const library = new Set(libraryIds());
    const asked = allQuestions(regional.questionnaire).map((question) => question.id);
    expect(asked.every((id) => library.has(id))).toBe(true);
    expect(asked.length).toBeLessThan(allQuestions(PROJECTS.PT25003?.questionnaire ?? regional.questionnaire).length);
  });

  it('falls back to the deployment project when nothing is chosen', () => {
    expect(currentProject().id).toBe(DEFAULT_PROJECT_ID);
  });
});
