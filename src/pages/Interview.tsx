import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { AboutYou } from '../components/AboutYou';
import { InterviewQuestion } from '../components/InterviewQuestion';
import { InterviewNav } from '../components/InterviewNav';
import { InterviewNotes } from '../components/InterviewNotes';
import { LENGTH_ID, lengthAnswer, shortVersion, type FormLength } from '../services/formLength';
import { COVERED_ID, GENERAL_NOTES, coveredEarlier, noteId, toggleCovered } from '../services/interviewNotes';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { StayInvolved } from '../components/StayInvolved';
import { accentPanel, card, choiceRow, choiceRowSelected, primaryButton, secondaryButton } from '../components/ui';
import { NO_INTEREST_ID, interestsForPathway } from '../content/questionnaire';
import { useQuestionnaire } from '../contexts/QuestionnaireContext';
import { useConsultation } from '../hooks/useConsultation';
import { useStaffSession } from '../hooks/useStaffSession';
import { STORAGE_KEYS, readJson, removeKey, writeJson } from '../lib/storage';
import type { ContactFormValues } from '../schemas/consultation';
import { submitContact, submitResponse } from '../services/submit';
import type { CollectionMethod, ConsultationResponse, ContactRecord } from '../types';
import { AdminLogin } from './admin/AdminLogin';

type InterviewMethod = Extract<CollectionMethod, `interview_${string}`>;

interface Setup {
  readonly method: InterviewMethod;
  readonly consent: true;
  /** Absent on a setup saved before short calls existed: that was a full interview. */
  readonly length?: FormLength;
}

const LENGTHS: readonly { id: FormLength; label: string; help: string }[] = [
  { id: 'full', label: 'Full interview', help: 'About ten minutes. Every question for their part of the industry.' },
  {
    id: 'short',
    label: 'Short call',
    help: 'About five minutes. Only the questions asked in every round, so the call still counts towards the baseline, mid-project and final comparison.',
  },
];

const METHODS: readonly { id: InterviewMethod; label: string; help: string }[] = [
  { id: 'interview_in_person', label: 'Face to face', help: 'On farm, in the shed, at a field day.' },
  { id: 'interview_video', label: 'Video call', help: 'Teams, Zoom or similar.' },
  { id: 'interview_phone', label: 'Phone call', help: 'Including a grower on their mobile.' },
];

/**
 * Said aloud before the first question. A spoken yes leaves no other trace,
 * so the interviewer confirms it on screen and the response records it.
 */
const CONSENT_SCRIPT =
  "Thanks for making the time. This is for the Potato Mechanisation Project — we're working out where mechanisation and automation would make the most practical difference, and what the project should take on. It takes about ten minutes. Nothing you say is reported against your name or your business unless you tell me otherwise, and you can skip anything or stop at any time. Are you happy to go ahead?";

const CONTACT_FORM_ID = 'interview-eoi-form';

const SetupScreen = ({ onStart }: { onStart: (setup: Setup) => void }) => {
  const [method, setMethod] = useState<InterviewMethod | null>(null);
  const [consent, setConsent] = useState(false);
  const [length, setLength] = useState<FormLength>('full');
  const [tried, setTried] = useState(false);
  const ready = method !== null && consent;

  return (
    <div className="grid gap-5">
      <fieldset className={card}>
        <legend className="mb-2 text-subtitle font-semibold text-ink">How are you talking to them?</legend>
        <ul className="grid gap-2">
          {METHODS.map((option) => (
            <li key={option.id}>
              <label className={`${choiceRow} cursor-pointer ${method === option.id ? choiceRowSelected : ''}`}>
                <input
                  type="radio"
                  name="method"
                  className="mt-1 size-5 shrink-0 accent-primary"
                  checked={method === option.id}
                  onChange={() => setMethod(option.id)}
                />
                <span>
                  <span className="block text-body text-ink">{option.label}</span>
                  <span className="block text-meta text-ink-soft">{option.help}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className={card}>
        <legend className="mb-2 text-subtitle font-semibold text-ink">How long have they got?</legend>
        <ul className="grid gap-2">
          {LENGTHS.map((option) => (
            <li key={option.id}>
              <label className={`${choiceRow} cursor-pointer ${length === option.id ? choiceRowSelected : ''}`}>
                <input
                  type="radio"
                  name="length"
                  className="mt-1 size-5 shrink-0 accent-primary"
                  checked={length === option.id}
                  onChange={() => setLength(option.id)}
                />
                <span>
                  <span className="block text-body text-ink">{option.label}</span>
                  <span className="block text-meta text-ink-soft">{option.help}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-meta text-ink-soft">You can switch during the call without losing anything.</p>
      </fieldset>

      <section className={accentPanel} aria-labelledby="consent-heading">
        <h2 id="consent-heading" className="text-subtitle font-semibold">
          Read this out first
        </h2>
        <blockquote className="mt-3 border-l-4 border-accent pl-4 text-body text-ink">{CONSENT_SCRIPT}</blockquote>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-body text-ink">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0 accent-primary"
            checked={consent}
            aria-invalid={tried && !consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          <span>I read this out, and they agreed to go ahead.</span>
        </label>
      </section>

      {tried && !ready && (
        <p role="alert" className="text-meta font-medium text-danger">
          {method === null ? 'Choose how you are talking to them. ' : ''}
          {!consent ? 'An interview cannot start without their agreement.' : ''}
        </p>
      )}

      <div>
        <button
          type="button"
          className={primaryButton}
          onClick={() => {
            setTried(true);
            if (method !== null && consent) onStart({ method, consent: true, length });
          }}
        >
          Start the interview
        </button>
      </div>
    </div>
  );
};

const InterviewSession = ({ staffId, email }: { staffId: string; email: string | null }) => {
  const fullQuestionnaire = useQuestionnaire();
  const [setup, setSetup] = useState<Setup | null>(() => readJson<Setup>(STORAGE_KEYS.interviewSetup));
  const length: FormLength = setup?.length ?? 'full';
  const questionnaire = useMemo(
    () => (length === 'short' ? shortVersion(fullQuestionnaire) : fullQuestionnaire),
    [length, fullQuestionnaire],
  );
  const state = useConsultation(questionnaire, { storageKey: STORAGE_KEYS.interviewDraft, trackProgress: false });
  const { draft, step, stepIndex, steps, pathway } = state;
  const [interests, setInterests] = useState<readonly string[]>([]);
  const [roleError, setRoleError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<'sent' | 'queued' | null>(null);

  const startSetup = (next: Setup): void => {
    writeJson(STORAGE_KEYS.interviewSetup, next);
    setSetup(next);
  };

  const abandon = (): void => {
    removeKey(STORAGE_KEYS.interviewSetup);
    state.reset();
    setSetup(null);
    setInterests([]);
  };

  if (saved !== null) {
    return (
      <div className="grid gap-5">
        <section className={accentPanel} role="status">
          <h2 className="text-subtitle font-semibold">Interview saved</h2>
          <p className="mt-2 text-ink-soft">
            {saved === 'sent'
              ? 'It is in the results now, alongside the online responses, marked with how it was collected.'
              : 'There was no connection, so it is held on this device and will be sent next time the page opens with signal. Do not clear this browser before then.'}
          </p>
        </section>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={primaryButton} onClick={() => setSaved(null)}>
            Start another interview
          </button>
          <Link to="/admin" className={secondaryButton}>
            Back to the admin area
          </Link>
        </div>
      </div>
    );
  }

  if (setup === null) return <SetupScreen onStart={startSetup} />;

  const isLastStep = stepIndex === steps.length - 1;
  const totalSteps = pathway === null ? steps.length + 1 : steps.length;
  const covered = coveredEarlier(draft.answers);
  const notesKey = noteId(step.section?.id ?? GENERAL_NOTES);
  const currentNote = draft.answers[notesKey];
  const notes = currentNote?.kind === 'text' ? currentNote.value : '';
  const methodLabel = METHODS.find((option) => option.id === setup.method)?.label ?? setup.method;

  const finish = async (contact: ContactFormValues | null): Promise<void> => {
    setSubmitting(true);
    setError(null);
    const now = new Date();
    const response: ConsultationResponse = {
      id: crypto.randomUUID(),
      roundId: questionnaire.roundId,
      role: draft.role,
      pathway,
      regions: draft.regions,
      regionOther: draft.regionOther,
      answers: { ...draft.answers, [LENGTH_ID]: lengthAnswer(length) },
      startedAt: draft.startedAt,
      submittedAt: now.toISOString(),
      durationSeconds: Math.max(0, Math.round((now.getTime() - new Date(draft.startedAt).getTime()) / 1000)),
      isTestData: false,
      method: setup.method,
      collectedBy: staffId,
      consentVerbal: true,
      sessionId: null,
    };
    const result = await submitResponse(response);
    if (!result.success) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    let queued = result.data === 'queued';
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
      const contactResult = await submitContact(record);
      if (!contactResult.success) {
        setError(contactResult.error);
        setSubmitting(false);
        return;
      }
      queued = queued || contactResult.data === 'queued';
    }
    setSubmitting(false);
    abandon();
    setSaved(queued ? 'queued' : 'sent');
  };

  return (
    <div>
      <p className="mb-4 rounded-lg border border-line bg-sunk px-4 py-2 text-meta text-ink-soft">
        <strong className="text-ink">{length === 'short' ? 'Short call' : 'Interview'}</strong> · {methodLabel} ·
        consent recorded
        {email !== null ? ` · by ${email}` : ''} ·{' '}
        <button
          type="button"
          className="text-primary-ink underline underline-offset-4"
          onClick={() => {
            // Same question ids either way, so every answer so far carries over.
            const next: Setup = { ...setup, length: length === 'short' ? 'full' : 'short' };
            startSetup(next);
            state.goTo(0);
          }}
        >
          {length === 'short'
            ? 'They have more time — switch to the full interview'
            : 'Short on time? Switch to a short call'}
        </button>
      </p>

      <InterviewNav
        steps={steps}
        current={stepIndex}
        answers={draft.answers}
        roleChosen={draft.role !== null}
        onJump={state.goTo}
      />

      <ProgressIndicator current={stepIndex} total={totalSteps} label={step.title} />
      <h2 className="text-title font-bold">{step.title}</h2>

      <div className="mt-5 grid gap-5">
        {stepIndex === 0 && (
          <>
            <div className="rounded-lg border-l-4 border-accent bg-sunk px-4 py-3">
              <p className="text-eyebrow uppercase text-ink-faint">Open with</p>
              <p className="text-subtitle font-semibold text-ink">
                &ldquo;Which part of the industry are you in, and whereabouts?&rdquo;
              </p>
            </div>
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
          </>
        )}

        {step.section?.questions.map((question) => (
          <InterviewQuestion
            key={question.id}
            questionnaire={questionnaire}
            question={question}
            answers={draft.answers}
            onChange={(answer) => state.setAnswer(question.id, answer)}
            mustAsk={length === 'full' && question.tracking === true}
            covered={covered.includes(question.id)}
            onToggleCovered={() => state.setAnswer(COVERED_ID, toggleCovered(draft.answers, question.id))}
          />
        ))}

        <InterviewNotes
          title={step.section === null ? 'general' : step.title}
          value={notes}
          onChange={(value) => state.setAnswer(notesKey, value.length === 0 ? undefined : { kind: 'text', value })}
        />

        {isLastStep && (
          <>
            <p className="rounded-lg border-l-4 border-accent bg-sunk px-4 py-3 text-body text-ink">
              Ask whether they would like to be involved. <strong>Only take their details if they say yes</strong>, and
              tell them it is kept separately from what they have just told you.
            </p>
            <StayInvolved
              interestOptions={interestsForPathway(questionnaire, pathway)}
              contactMethods={questionnaire.contactMethods}
              interests={interests}
              onInterestsChange={setInterests}
              formId={CONTACT_FORM_ID}
              onSubmit={(contact) => void finish(contact)}
            />
          </>
        )}
      </div>

      {error !== null && (
        <p role="alert" className="mt-6 rounded-md border border-danger px-4 py-3 text-body text-danger">
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse sm:justify-start no-print">
        {isLastStep ? (
          <button type="submit" form={CONTACT_FORM_ID} className={primaryButton} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save the interview'}
          </button>
        ) : (
          <button
            type="button"
            className={primaryButton}
            onClick={() => {
              if (stepIndex === 0 && draft.role === null) {
                setRoleError(true);
                return;
              }
              state.next();
            }}
          >
            Next
          </button>
        )}
        {stepIndex > 0 && (
          <button type="button" className={secondaryButton} onClick={state.back} disabled={submitting}>
            Back
          </button>
        )}
        <button
          type="button"
          className={secondaryButton}
          disabled={submitting}
          onClick={() => {
            if (window.confirm('Stop this interview? Nothing from it will be saved.')) abandon();
          }}
        >
          Stop without saving
        </button>
      </div>
    </div>
  );
};

/**
 * One-to-one, video and phone interviews, by project staff, into the same
 * dataset as the online form. Staff only: an interview records who took it.
 */
export const Interview = () => {
  const staff = useStaffSession();

  if (staff.checking) {
    return (
      <Layout>
        <p className="text-ink-soft">Checking your sign-in…</p>
      </Layout>
    );
  }

  if (staff.userId === null) return <AdminLogin onSignedIn={staff.refresh} />;

  return (
    <Layout>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h1>Interview</h1>
        <Link to="/admin" className="text-meta text-primary-ink underline underline-offset-4">
          Admin area
        </Link>
      </div>
      <InterviewSession staffId={staff.userId} email={staff.email} />
    </Layout>
  );
};
