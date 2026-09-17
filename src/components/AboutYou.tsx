import { choiceRow, choiceRowSelected, textInput } from './ui';
import type { Questionnaire, RoleId } from '../types';

/**
 * Role and region — the branch point. Shared by the online form and the
 * interviewer screen, so both route people down the same questions.
 */
export const AboutYou = ({
  questionnaire,
  role,
  regions,
  regionOther,
  onRole,
  onRegions,
  onRegionOther,
  showRoleError,
}: {
  questionnaire: Questionnaire;
  role: RoleId | null;
  regions: readonly string[];
  regionOther: string;
  onRole: (role: RoleId) => void;
  onRegions: (regions: readonly string[]) => void;
  onRegionOther: (value: string) => void;
  showRoleError: boolean;
}) => {
  const toggleRegion = (id: string): void => {
    if (id === 'no_say') {
      onRegions(regions.includes('no_say') ? [] : ['no_say']);
      return;
    }
    const without = regions.filter((value) => value !== 'no_say');
    onRegions(without.includes(id) ? without.filter((value) => value !== id) : [...without, id]);
  };

  return (
    <div className="grid gap-8">
      <fieldset aria-describedby={showRoleError ? 'role-error' : undefined}>
        <legend className="mb-1 text-subtitle font-semibold text-ink">
          Which perspective best reflects your experience?
        </legend>
        <p className="mb-3 text-meta text-ink-soft">Required. Choose the one that fits best.</p>
        {showRoleError && (
          <p id="role-error" className="mb-3 text-meta font-medium text-danger" role="alert">
            Please choose a perspective so we only ask you relevant questions.
          </p>
        )}
        <ul className="grid gap-2">
          {questionnaire.roles.map((option) => (
            <li key={option.id}>
              <label className={`${choiceRow} cursor-pointer ${role === option.id ? choiceRowSelected : ''}`}>
                <input
                  type="radio"
                  name="role"
                  className="mt-1 size-5 shrink-0 accent-primary"
                  checked={role === option.id}
                  aria-invalid={showRoleError}
                  onChange={() => onRole(option.id)}
                />
                <span className="text-body text-ink">{option.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-subtitle font-semibold text-ink">
          Which potato production region or regions are most relevant to your experience?
        </legend>
        <p className="mb-3 text-meta text-ink-soft">Optional. Choose as many as apply.</p>
        <ul className="grid gap-2">
          {questionnaire.regions.map((option) => {
            const checked = regions.includes(option.id);
            return (
              <li key={option.id}>
                <label className={`${choiceRow} cursor-pointer ${checked ? choiceRowSelected : ''}`}>
                  <input
                    type="checkbox"
                    className="mt-1 size-5 shrink-0 accent-primary"
                    checked={checked}
                    onChange={() => toggleRegion(option.id)}
                  />
                  <span className="text-body text-ink">{option.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {regions.includes('other') && (
          <div className="mt-3">
            <label htmlFor="region-other" className="mb-1 block text-meta text-ink-soft">
              Which other region?
            </label>
            <input
              id="region-other"
              className={textInput}
              value={regionOther}
              maxLength={200}
              onChange={(event) => onRegionOther(event.target.value)}
            />
          </div>
        )}
      </fieldset>
    </div>
  );
};
