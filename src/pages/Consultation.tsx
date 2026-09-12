import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { QuestionField } from '../components/QuestionField';
import { StayInvolved } from '../components/StayInvolved';
import { choiceRow, choiceRowSelected, primaryButton, secondaryButton, textInput } from '../components/ui';
import { NO_INTEREST_ID, interestsForPathway } from '../content/questionnaire';
import { optionLabel, questionById } from '../content/lookup';
import { useQuestionnaire } from '../contexts/QuestionnaireContext';
import { useConsultation } from '../hooks/useConsultation';
import type { ContactFormValues } from '../schemas/consultation';
import { submitContact, submitResponse } from '../services/submit';
import type { ConsultationResponse, ContactRecord, Option, Questionnaire, RoleId } from '../types';

const CONTACT_FORM_ID = 'eoi-form';

const AboutYou = ({
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

export const Consultation = () => {
  const navigate = useNavigate();
  const questionnaire = useQuestionnaire();
  const state = useConsultation(questionnaire);
  const { draft, step, stepIndex, steps, pathway } = state;
  const [interests, setInterests] = useState<readonly string[]>([]);
  const [roleError, setRoleError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isLastStep = stepIndex === steps.length - 1;
  // Before a role is chosen there is no role-specific section in the list yet.
  // Counting it anyway keeps the total honest: a progress bar that grows from
  // "of 5" to "of 6" the moment somebody answers reads as moving backwards.
  const totalSteps = pathway === null ? steps.length + 1 : steps.length;

  /** Ranking is offered over whatever the respondent ticked in question 1. */
  const rankChoices = useMemo<readonly Option[]>(() => {
    const source = questionById(questionnaire, 'q1_constraints');
    if (source === undefined || source.kind !== 'multi') return [];
    const answer = draft.answers['q1_constraints'];
    if (answer === undefined || answer.kind !== 'multi') return [];
    return source.options.filter((option) => answer.values.includes(option.id));
  }, [draft.answers, questionnaire]);

  /**
   * Question 3 asks about "the one at the top of your list". We know which one
   * that is, so say it — a respondent should never have to scroll back to work
   * out what they are answering about.
   */
  const impactPrompt = useMemo<string | undefined>(() => {
    const ranked = draft.answers['q2_top_three'];
    const top = ranked !== undefined && ranked.kind === 'rank' ? ranked.values[0] : undefined;
    if (top === undefined) return undefined;
    const source = questionById(questionnaire, 'q1_constraints');
    const label = optionLabel(source, top);
    return `Thinking about ${label.toLowerCase()} — what does it actually cost a business?`;
  }, [draft.answers, questionnaire]);

  const handleNext = (): void => {
    if (stepIndex === 0 && draft.role === null) {
      setRoleError(true);
      return;
    }
    setRoleError(false);
    state.next();
  };

  const finish = async (contact: ContactFormValues | null): Promise<void> => {
    setSubmitting(true);
    setSubmitError(null);
    const now = new Date();
    const response: ConsultationResponse = {
      id: crypto.randomUUID(),
      roundId: questionnaire.roundId,
      role: draft.role,
      pathway,
      regions: draft.regions,
      regionOther: draft.regionOther,
      answers: draft.answers,
      startedAt: draft.startedAt,
      submittedAt: now.toISOString(),
      durationSeconds: Math.max(0, Math.round((now.getTime() - new Date(draft.startedAt).getTime()) / 1000)),
      isTestData: false,
    };

    const saved = await submitResponse(response);
    if (!saved.success) {
      setSubmitError(saved.error);
      setSubmitting(false);
      return;
    }

    let contactQueued = false;
    if (contact !== null && interests.length > 0 && !interests.includes(NO_INTEREST_ID)) {
      const record: ContactRecord = {
        id: crypto.randomUUID(),
        roundId: questionnaire.roundId,
        interests,
        name: contact.name,
        organisation: contact.organisation,
        broadRole: contact.broadRole,
        region: contact.region,
        email: contact.email,
        phone: contact.phone,
        preferredContactMethod: contact.preferredContactMethod,
        preferredContactTime: contact.preferredContactTime,
        comments: contact.comments,
        submittedAt: now.toISOString(),
        isTestData: false,
      };
      const savedContact = await submitContact(record);
      if (!savedContact.success) {
        setSubmitError(savedContact.error);
        setSubmitting(false);
        return;
      }
      contactQueued = savedContact.data === 'queued';
    }

    state.reset();
    navigate('/thank-you', {
      replace: true,
      state: { queued: saved.data === 'queued' || contactQueued, sharedContact: contact !== null },
    });
  };

  return (
    <Layout>
      <ProgressIndicator current={stepIndex} total={totalSteps} label={step.title} />

      <h1 className="text-title font-bold">{step.title}</h1>
      {step.intro !== undefined && <p className="prose-measure mt-2 text-ink-soft">{step.intro}</p>}

      <div className="mt-6">
        {stepIndex === 0 && (
          <AboutYou
            questionnaire={questionnaire}
            role={draft.role}
            regions={draft.regions}
            regionOther={draft.regionOther}
            onRole={(role) => {
              setRoleError(false);
              state.setRole(role);
            }}
            onRegions={state.setRegions}
            onRegionOther={state.setRegionOther}
            showRoleError={roleError}
          />
        )}

        {step.section !== null && (
          <div className="grid gap-8">
            {step.section.questions.map((question) => (
              <QuestionField
                key={question.id}
                question={question}
                answer={draft.answers[question.id]}
                rankChoices={question.kind === 'rank' ? rankChoices : undefined}
                promptOverride={question.id === 'q3_impact' ? impactPrompt : undefined}
                onChange={(answer) => state.setAnswer(question.id, answer)}
              />
            ))}
          </div>
        )}

        {isLastStep && (
          <StayInvolved
            interestOptions={interestsForPathway(questionnaire, pathway)}
            contactMethods={questionnaire.contactMethods}
            interests={interests}
            onInterestsChange={setInterests}
            formId={CONTACT_FORM_ID}
            onSubmit={(contact) => void finish(contact)}
          />
        )}
      </div>

      {submitError !== null && (
        <p role="alert" className="mt-6 rounded-md border border-danger px-4 py-3 text-body text-danger">
          {submitError}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse sm:justify-start no-print">
        {isLastStep ? (
          <button type="submit" form={CONTACT_FORM_ID} className={primaryButton} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit consultation'}
          </button>
        ) : (
          <button type="button" className={primaryButton} onClick={handleNext}>
            Next
          </button>
        )}
        {stepIndex > 0 && (
          <button type="button" className={secondaryButton} onClick={state.back} disabled={submitting}>
            Back
          </button>
        )}
        <button type="button" className={secondaryButton} onClick={() => navigate('/')} disabled={submitting}>
          Save and exit
        </button>
      </div>

      <p className="mt-4 text-meta text-ink-faint no-print">
        Your answers are saved on this device as you go. You can close this page and come back to it.
      </p>
    </Layout>
  );
};
