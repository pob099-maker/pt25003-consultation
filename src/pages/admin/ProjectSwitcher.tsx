import { availableProjects, currentProject } from '../../content/projects';
import { selectProject } from '../../lib/projectSelection';
import { textInput } from '../../components/ui';

/**
 * Which project you are working on. One team may run several on this tool,
 * and everything below this choice — responses, contacts, consultations,
 * workshops — belongs to the project named here and to no other.
 *
 * Switching reloads the page, because half the screen is already built from
 * the project's own questions. It only appears when there is more than one.
 */
export const ProjectSwitcher = () => {
  const projects = availableProjects();
  const project = currentProject();
  if (projects.length < 2) return null;

  return (
    <label className="flex items-center gap-2 text-meta text-ink-soft">
      <span>Project</span>
      <select
        className={`${textInput} min-h-10 w-auto py-1`}
        value={project.id}
        onChange={(event) => {
          selectProject(event.target.value);
          window.location.reload();
        }}
      >
        {projects.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
};
