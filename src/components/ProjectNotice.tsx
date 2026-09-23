import { currentProject } from '../content/projects';
import { config } from '../lib/config';
import { selectProject, selectedProjectId } from '../lib/projectSelection';

/**
 * A strip that appears only when this device is set to a project other than
 * the one this site was built for. Staff switch projects; respondents never
 * do, so they never see it. Without it, a staff member who switched in the
 * admin area could look at the public form and think it was the wrong
 * questionnaire.
 */
export const ProjectNotice = () => {
  const chosen = selectedProjectId();
  if (chosen === null || chosen === config.projectId) return null;
  const project = currentProject();
  if (project.id === config.projectId) return null;

  return (
    <p className="bg-sunk px-4 py-2 text-center text-meta text-ink no-print">
      You are looking at <strong>{project.name}</strong>. If that is not the consultation you were sent,{' '}
      <button
        type="button"
        className="underline underline-offset-4"
        onClick={() => {
          selectProject(null);
          window.location.reload();
        }}
      >
        switch back
      </button>
    </p>
  );
};
