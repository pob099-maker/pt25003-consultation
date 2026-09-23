import { Navigate, useParams } from 'react-router-dom';
import { PROJECTS } from '../content/projects';
import { isDemoSite } from '../lib/config';
import { selectProject, selectedProjectId } from '../lib/projectSelection';

/**
 * A short link for a project's own respondents: /#/p/regional.
 *
 * It names the project, remembers it on that device and hands the person to
 * the ordinary landing page, so nothing after the first click carries a
 * parameter. A project of its own will eventually get its own address, and
 * this link keeps working when it does.
 *
 * An unknown project, or a worked example on a live site, is ignored rather
 * than argued with: the person lands on the consultation this site is for.
 */
export const ProjectLink = () => {
  const { projectId } = useParams();
  const wanted = (projectId ?? '').toUpperCase();
  const project = PROJECTS[wanted];
  const allowed = project !== undefined && (project.example !== true || isDemoSite());

  if (allowed && selectedProjectId() !== project.id) {
    selectProject(project.id);
    // Everything below is built from the project's own questions, so the
    // cleanest way in is a fresh start on the landing page.
    window.location.replace(`${window.location.pathname}#/`);
    window.location.reload();
    return null;
  }

  return <Navigate to="/" replace />;
};
