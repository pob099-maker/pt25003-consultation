/**
 * Which project this browser is looking at.
 *
 * A deployment names a default project (VITE_PROJECT_ID), and that is what a
 * respondent always gets: the link they were sent belongs to one project and
 * nothing in the form can move them to another. Project staff can switch,
 * because one team may run several, and the choice is remembered on the
 * device.
 *
 * Kept out of React state on purpose: services read the current project when
 * they build a query, long before any component renders, so this has to be
 * answerable synchronously from anywhere. Switching reloads the page, which
 * also drops any half-finished draft belonging to the project being left.
 */

const KEY = 'pt25003.project.v1';

const fromStorage = (): string | null => {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

/** A link may name the project, which is how a second project's staff arrive the first time. */
const fromUrl = (): string | null => {
  try {
    const hash = window.location.hash;
    const query = hash.includes('?') ? hash.slice(hash.indexOf('?')) : window.location.search;
    return new URLSearchParams(query).get('project');
  } catch {
    return null;
  }
};

let chosen: string | null | undefined;

/** The project id this browser has chosen, or null to use the deployment's own. */
export const selectedProjectId = (): string | null => {
  if (chosen === undefined) chosen = fromUrl() ?? fromStorage();
  return chosen;
};

export const selectProject = (id: string | null): void => {
  chosen = id;
  try {
    if (id === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, id);
  } catch {
    /* The choice lasts for this page only. */
  }
};
