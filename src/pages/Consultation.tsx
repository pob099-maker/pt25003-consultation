import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { QuestionField } from '../components/QuestionField';
import { StayInvolved } from '../components/StayInvolved';
import { primaryButton, secondaryButton } from '../components/ui';
import { AboutYou } from '../components/AboutYou';
import { showRoleQuestion } from '../components/roleQuestion';
import { KEEP_IN_TOUCH_ID, NO_INTEREST_ID, interestsForPathway } from '../content/questionnaire';
import { choicesFor, promptOverrideFor, rankChoicesFor } from '../content/dynamic';
import { useQuestionnaire } from '../contexts/QuestionnaireContext';
import { STAY_INVOLVED_ID, useConsultation } from '../hooks/useConsultation';
import type { ContactFormValues } from '../schemas/consultation';
import { contactDay, submitConsultation } from '../services/submit';
import { LENGTH_ID, lengthAnswer, shortVersion } from '../services/formLength';
import { arrivalSource, forgetArrival } from '../services/sources';
import { estimateFor } from '../services/estimate';
import { accentPanel } from '../components/ui';
import type { ConsultationResponse, ContactRecord } from '../types';

const CONTACT_FORM_ID = 'eoi-form';

export const Consultation = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const short = params.get('quick') === '1';
  const full = useQuestionnaire();
  // The short version asks only the questions repeated in every round. Ids are
  // the same in both, so switching part-way keeps every answer already given.
  const questionnaire = useMemo(() => (short ? shortVersion(full) : full), [short, full]);
  const state = useConsultation(questionnaire, { length: short ? 'short' : 'full' });
  const { draft, step, stepIndex, steps, pathway } = state;
  const [interests, setInterests] = useState<readonly string[]>([]);
  // Held on the page between the contact step and Submit, never in the saved
  // draft: a name and a number are not left behind on a shared phone.
  const [contact, setContact] = useState<ContactFormValues | null>(null);
  const [roleError, setRoleError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Opens the session record, so somebody who looks at the first screen and
  // leaves is counted as a start rather than never existing.
  useEffect(() => {
    state.ping(0, false);
    // Once per visit: this is a funnel entry, not a step change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLastStep = stepIndex === steps.length - 1;
  const contactStep = steps.findIndex((candidate) => candidate.id === STAY_INVOLVED_ID);
  const isContactStep = stepIndex === contactStep;
  // What the full version would add for this person's own role, rather than
  // a number typed in once and never updated as the questions grew.
  const extraMinutes = useMemo(
    () => estimateFor(full, draft.role).minutes - estimateFor(shortVersion(full), draft.role).minutes,
    [full, draft.role],
  );
  /** The last step of questions before "stay involved", where the short version offers the rest. */
  const isLastContentStep = contactStep > 0 && stepIndex === contactStep - 1;
  const [upgrading, setUpgrading] = useState(false);

  /** Switch to the full version and go to the first thing not yet answered. */
  const continueToFull = (): void => {
    setUpgrading(true);
    setParams({});
  };

  useEffect(() => {
    if (!upgrading || short) return;
    setUpgrading(false);
    const next = steps.findIndex(
      (candidate) =>
        candidate.section !== null &&
        candidate.section.questions.some((question) => draft.answers[question.id] === undefined),
    );
    state.goTo(next === -1 ? steps.length - 1 : next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once the switch has taken effect
  }, [upgrading, short, steps]);
  // Before a role is chosen there is no role-specific section in the list yet.
  // Counting it anyway keeps the total honest: a progress bar that grows from
  // "of 5" to "of 6" the moment somebody answers reads as moving backwards.
  const totalSteps = pathway === null ? steps.length + 1 : steps.length;

  /** Ranking is offered over whatever the respondent ticked in question 1. */
  const rankChoices = useMemo(() => rankChoicesFor(questionnaire, draft.answers), [draft.answers, questionnaire]);

  const handleNext = (): void => {
    if (stepIndex === 0 && draft.role === null) {
      setRoleError(true);
      showRoleQuestion();
      return;
    }
    setRoleError(false);
    state.next();
  };

  const finish = async (contact: ContactFormValues | null): Promise<void> => {
    setSubmitting(true);
    setSubmitError(null);
    const now = new Date();
    const arrival = arrivalSource(now);
    const response: ConsultationResponse = {
      // The draft's own id: pressing Submit again, or a resend from the
      // outbox, stores these answers once however many times they are sent.
      id: draft.responseId,
      roundId: questionnaire.roundId,
      role: draft.role,
      pathway,
      regions: draft.regions,
      regionOther: draft.regionOther,
      answers: { ...draft.answers, [LENGTH_ID]: lengthAnswer(short ? 'short' : 'full') },
      startedAt: draft.startedAt,
      submittedAt: now.toISOString(),
      durationSeconds: Math.max(0, Math.round((now.getTime() - new Date(draft.startedAt).getTime()) / 1000)),
      isTestData: false,
      method: 'online',
      collectedBy: null,
      consentVerbal: null,
      sessionId: null,
      source: arrival,
    };

    // Details can come without anything ticked; they are kept as "happy to be contacted".
    const wantsContact = contact !== null && !interests.includes(NO_INTEREST_ID);
    const record: ContactRecord | null =
      contact === null || !wantsContact
        ? null
        : {
            id: crypto.randomUUID(),
            roundId: questionnaire.roundId,
            interests: interests.length > 0 ? interests : [KEEP_IN_TOUCH_ID],
            name: contact.name,
            organisation: contact.organisation,
            broadRole: contact.broadRole,
            region: contact.region,
            email: contact.email,
            phone: contact.phone,
            preferredContactMethod: contact.preferredContactMethod,
            preferredContactTime: contact.preferredContactTime,
            comments: contact.comments,
            // To the day, and with no link label: sent together with the answers,
            // a shared timestamp or label would let anyone holding both exports
            // join this name to answers the privacy statement says it is never
            // linked to.
            submittedAt: contactDay(now),
            isTestData: false,
            source: null,
          };

    // The contact details are checked before anything is sent, so a problem
    // with them never leaves the answers stored and the person resubmitting.
    const saved = await submitConsultation(response, record);
    if (!saved.success) {
      setSubmitError(saved.error);
      setSubmitting(false);
      return;
    }

    state.ping(steps.length - 1, true);

    // The next person on the same phone starts clean. The response already
    // carries its label, queued or sent.
    forgetArrival();
    state.reset();
    navigate('/thank-you', {
      replace: true,
      state: { queued: saved.data.queued, sharedContact: record !== null },
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
                promptOverride={promptOverrideFor(questionnaire, question, draft.answers)}
                choices={choicesFor(question, draft.answers)}
                onChange={(answer) => state.setAnswer(question.id, answer)}
              />
            ))}
          </div>
        )}

        {short && isLastContentStep && (
          <section className={`${accentPanel} mt-8`} aria-labelledby="more-questions">
            <h2 id="more-questions" className="text-subtitle font-semibold">
              That is the short version, thank you
            </h2>
            <p className="mt-2 text-body text-ink">
              If you have {extraMinutes > 0 ? `about ${extraMinutes} more minutes` : 'a few more minutes'}, the full
              version asks about your own operation, what you have tried already, and what gets in the way. It is the part that helps us most, and the answers you have given
              already count either way.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button type="button" className={primaryButton} onClick={continueToFull}>
                Yes, keep going
              </button>
              <button type="button" className={secondaryButton} onClick={state.next}>
                No thanks, that will do
              </button>
            </div>
          </section>
        )}

        {isContactStep && (
          <StayInvolved
            interestOptions={interestsForPathway(questionnaire, pathway)}
            contactMethods={questionnaire.contactMethods}
            interests={interests}
            onInterestsChange={setInterests}
            formId={CONTACT_FORM_ID}
            initial={contact}
            onSubmit={(values) => {
              setContact(values);
              if (isLastStep) void finish(values);
              else state.next();
            }}
          />
        )}
      </div>

      {submitError !== null && (
        <p role="alert" className="mt-6 rounded-md border border-danger px-4 py-3 text-body text-danger">
          {submitError}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse sm:justify-start no-print">
        {/* Each button keeps its own key. Without one React reuses the same
            element, and a Next pressed on the page before the contact step
            turns into that step's submit button during the press: the browser
            then submits the new form, and the contact step is skipped. */}
        {isContactStep ? (
          // The details are checked before moving on, as they were before Submit.
          <button key="contact" type="submit" form={CONTACT_FORM_ID} className={primaryButton} disabled={submitting}>
            {isLastStep ? (submitting ? 'Submitting…' : 'Submit consultation') : 'Next'}
          </button>
        ) : isLastStep ? (
          <button key="submit" type="button" className={primaryButton} disabled={submitting} onClick={() => void finish(contact)}>
            {submitting ? 'Submitting…' : 'Submit consultation'}
          </button>
        ) : (
          // On the short version's last page the choice above is the way on.
          !(short && isLastContentStep) && (
            <button key="next" type="button" className={primaryButton} onClick={handleNext}>
              Next
            </button>
          )
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
