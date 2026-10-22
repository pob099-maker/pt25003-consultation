import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { AboutYou } from '../components/AboutYou';
import { showRoleQuestion } from '../components/roleQuestion';
import { InterviewQuestion } from '../components/InterviewQuestion';
import { InterviewNav } from '../components/InterviewNav';
import { InterviewNotes } from '../components/InterviewNotes';
import { LENGTH_ID, lengthAnswer, shortVersion, type FormLength } from '../services/formLength';
import { COVERED_ID, GENERAL_NOTES, coveredEarlier, noteId, toggleCovered } from '../services/interviewNotes';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { StayInvolved } from '../components/StayInvolved';
import { accentPanel, card, choiceRow, choiceRowSelected, primaryButton, secondaryButton, textInput } from '../components/ui';
import { NO_INTEREST_ID, interestsForPathway } from '../content/questionnaire';
import { useQuestionnaire, useQuestionnaireState } from '../contexts/QuestionnaireContext';
import { formEstimates, spoken, type FormEstimates } from '../services/estimate';
import { STAY_INVOLVED_ID, useConsultation } from '../hooks/useConsultation';
import { useStaffSession } from '../hooks/useStaffSession';
import { STORAGE_KEYS, readJson, removeKey, writeJson } from '../lib/storage';
import type { ContactFormValues } from '../schemas/consultation';
import { contactDay, submitConsultation } from '../services/submit';
import { isPersonalQuestion } from '../content/lookup';
import type { ConsultationResponse, ContactRecord } from '../types';
import {
  NOTE_LENGTH,
  RING_BACK,
  minutesText,
  pauseCall,
  pausedFor,
  removePaused,
  resumedDraft,
  stillOpen,
  talkingSeconds,
  waitingText,
  type InterviewMethod,
  type InterviewSetup,
  type PausedCall,
  type RingBack,
} from '../services/pausedCalls';
import { AdminLogin } from './admin/AdminLogin';

type Setup = InterviewSetup;

/** The two lengths, with times worked out from the questions actually being asked. */
const lengthsFor = (
  estimates: FormEstimates,
): readonly { id: FormLength; label: string; help: string }[] => [
  {
    id: 'full',
    label: 'Full interview',
    help: `${capitalise(spoken(estimates.full))}. Every question for their part of the industry.`,
  },
  {
    id: 'short',
    label: 'Short call',
    help: `${capitalise(spoken(estimates.short))}. Only the questions asked in every round, so the call still counts towards the baseline, mid-project and final comparison.`,
  },
];

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const METHODS: readonly { id: InterviewMethod; label: string; help: string }[] = [
  { id: 'interview_in_person', label: 'Face to face', help: 'On farm, in the shed, at a field day.' },
  { id: 'interview_video', label: 'Video call', help: 'Teams, Zoom or similar.' },
  { id: 'interview_phone', label: 'Phone call', help: 'Including a grower on their mobile.' },
];

/**
 * Said aloud before the first question. A spoken yes leaves no other trace,
 * so the interviewer confirms it on screen and the response records it.
 */
const consentScript = (length: string): string =>
  `Thanks for making the time. This is for the Potato Mechanisation Project — we're working out where mechanisation and automation would make the most practical difference, and what the project should take on. It takes ${length}. Nothing you say is reported against your name or your business unless you tell me otherwise, and you can skip anything or stop at any time. Are you happy to go ahead?`;

const CONTACT_FORM_ID = 'interview-eoi-form';

/**
 * Paused calls, waiting on this phone for the interviewer who took them. The
 * note is theirs, to find the person again; it never leaves the phone.
 */
const CallsToFinish = ({
  calls,
  onResume,
  onDiscard,
}: {
  calls: readonly PausedCall[];
  onResume: (call: PausedCall) => void;
  onDiscard: (call: PausedCall) => void;
}) => {
  const { questionnaire, status } = useQuestionnaireState();
  return (
    <section className={card} aria-labelledby="calls-to-finish">
      <h2 id="calls-to-finish" className="text-subtitle font-semibold text-ink">
        Calls to finish
      </h2>
      <p className="mt-1 text-meta text-ink-soft">
        Paused calls wait here, on this phone, until you finish them. Nothing from them has been sent.
      </p>
      <ul className="mt-3 grid gap-3">
        {calls.map((call) => {
          const open = stillOpen(call, questionnaire.roundId, status === 'live');
          const method = METHODS.find((option) => option.id === call.setup.method)?.label ?? call.setup.method;
          return (
            <li key={call.id} className="rounded-lg border border-line-strong bg-surface p-4">
              <p className="text-body font-semibold text-ink">{call.note.length > 0 ? call.note : 'No note left'}</p>
              <p className="mt-1 text-meta text-ink-soft">
                {call.setup.length === 'short' ? 'Short call' : 'Full interview'} · {method} · step {call.stepNumber} of{' '}
                {call.stepCount} · {minutesText(call.activeSeconds)}
              </p>
              <p className="mt-1 text-meta text-ink-soft">
                {waitingText(call)}. Picks up at: {call.stepTitle}.
              </p>
              {!open && (
                <p className="mt-1 text-meta font-medium text-danger">
                  Taken in a round that has since closed, so it cannot be finished now.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {open && (
                  <button type="button" className={primaryButton} onClick={() => onResume(call)}>
                    Pick up where you left off
                  </button>
                )}
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() => {
                    if (window.confirm('Throw this paused call away? Nothing from it has been sent, and it cannot be got back.'))
                      onDiscard(call);
                  }}
                >
                  Throw it away
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

/** Pausing a call: when to ring back, and a note to find them again. */
const PausePanel = ({
  stepTitle,
  contactTaken,
  onPause,
  onCancel,
}: {
  stepTitle: string;
  contactTaken: boolean;
  onPause: (note: string, ringBack: RingBack) => void;
  onCancel: () => void;
}) => {
  const [ringBack, setRingBack] = useState<RingBack>('days');
  const [note, setNote] = useState('');
  // The button that opened this has gone, so take focus to the panel.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <section className={`${accentPanel} mt-8 no-print`} aria-labelledby="pause-heading">
      <h2 id="pause-heading" ref={headingRef} tabIndex={-1} className="text-subtitle font-semibold">
        Pause, and ring back later
      </h2>
      <p className="mt-2 text-ink-soft">
        Stopped at: {stepTitle}. Everything so far is kept on this phone, and nothing is sent until the call is finished.
      </p>
      {contactTaken && (
        <p className="mt-2 text-body text-ink">
          The contact details you took are not kept with a paused call. Take them again when you ring back.
        </p>
      )}
      <fieldset className="mt-4">
        <legend className="mb-2 text-body font-semibold text-ink">When to ring back</legend>
        <ul className="grid gap-2 sm:grid-cols-2">
          {RING_BACK.map((option) => (
            <li key={option.id}>
              <label className={`${choiceRow} cursor-pointer ${ringBack === option.id ? choiceRowSelected : ''}`}>
                <input
                  type="radio"
                  name="ring-back"
                  className="mt-1 size-5 shrink-0 accent-primary"
                  checked={ringBack === option.id}
                  onChange={() => setRingBack(option.id)}
                />
                <span className="text-body text-ink">{option.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <div className="mt-4">
        <label htmlFor="pause-note" className="mb-1 block text-body font-semibold text-ink">
          A note to find them again
        </label>
        <input
          id="pause-note"
          className={textInput}
          maxLength={NOTE_LENGTH}
          value={note}
          placeholder="Such as the district, a good time, who to ask for"
          aria-describedby="pause-note-help"
          onChange={(event) => setNote(event.target.value)}
        />
        <p id="pause-note-help" className="mt-1 text-meta text-ink-soft">
          Kept on this phone only. Never sent with the answers, and wiped when the call is finished.
        </p>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button type="button" className={primaryButton} onClick={() => onPause(note.trim(), ringBack)}>
          Pause the call
        </button>
        <button type="button" className={secondaryButton} onClick={onCancel}>
          Keep going
        </button>
      </div>
    </section>
  );
};

const SetupScreen = ({
  onStart,
  paused,
  notice,
  onResume,
  onDiscard,
}: {
  onStart: (setup: Setup) => void;
  paused: readonly PausedCall[];
  /** Said once, after a call was paused. */
  notice: string | null;
  onResume: (call: PausedCall) => void;
  onDiscard: (call: PausedCall) => void;
}) => {
  const setupQuestionnaire = useQuestionnaire();
  const estimates = useMemo(() => formEstimates(setupQuestionnaire), [setupQuestionnaire]);
  const lengths = lengthsFor(estimates);
  const [method, setMethod] = useState<InterviewMethod | null>(null);
  const [consent, setConsent] = useState(false);
  const [length, setLength] = useState<FormLength>('full');
  const [tried, setTried] = useState(false);
  const ready = method !== null && consent;

  return (
    <div className="grid gap-5">
      {notice !== null && (
        <p className={accentPanel} role="status">
          {notice}
        </p>
      )}
      {paused.length > 0 && <CallsToFinish calls={paused} onResume={onResume} onDiscard={onDiscard} />}

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
          {lengths.map((option) => (
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
        <blockquote className="mt-3 border-l-4 border-accent pl-4 text-body text-ink">{consentScript(spoken(length === 'short' ? estimates.short : estimates.full))}</blockquote>
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

const InterviewSession = ({
  staffId,
  email,
  resumed,
  onResume,
}: {
  staffId: string;
  email: string | null;
  /** Just picked up from a pause, so say so on the first screen. */
  resumed: boolean;
  /** Called once a paused call is back in place, to start again from it. */
  onResume: () => void;
}) => {
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
  const [contact, setContact] = useState<ContactFormValues | null>(null);
  const [roleError, setRoleError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<'sent' | 'queued' | null>(null);
  const [paused, setPaused] = useState<readonly PausedCall[]>(() => pausedFor(staffId));
  const [pausing, setPausing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showResumed, setShowResumed] = useState(resumed);

  const startSetup = (next: Setup): void => {
    writeJson(STORAGE_KEYS.interviewSetup, next);
    setSetup(next);
  };

  const abandon = (): void => {
    removeKey(STORAGE_KEYS.interviewSetup);
    state.reset();
    setSetup(null);
    setInterests([]);
    setContact(null);
    setPausing(false);
    setShowResumed(false);
  };

  /** Back into the draft's own place, then a fresh start from it, the way a reload resumes. */
  const resume = (call: PausedCall): void => {
    removePaused(call.id);
    writeJson(STORAGE_KEYS.interviewDraft, resumedDraft(call));
    writeJson(STORAGE_KEYS.interviewSetup, call.setup);
    onResume();
  };

  const discard = (call: PausedCall): void => {
    removePaused(call.id);
    setPaused(pausedFor(staffId));
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

  if (setup === null) {
    return (
      <SetupScreen
        onStart={(next) => {
          setNotice(null);
          startSetup(next);
        }}
        paused={paused}
        notice={notice}
        onResume={resume}
        onDiscard={discard}
      />
    );
  }

  const isLastStep = stepIndex === steps.length - 1;
  const isContactStep = steps[stepIndex]?.id === STAY_INVOLVED_ID;
  const totalSteps = pathway === null ? steps.length + 1 : steps.length;
  const covered = coveredEarlier(draft.answers);
  const notesKey = noteId(step.section?.id ?? GENERAL_NOTES);
  const currentNote = draft.answers[notesKey];
  const notes = currentNote?.kind === 'text' ? currentNote.value : '';
  const methodLabel = METHODS.find((option) => option.id === setup.method)?.label ?? setup.method;

  const pause = (note: string, ringBack: RingBack): void => {
    const now = new Date();
    pauseCall({
      id: draft.responseId,
      staffId,
      setup,
      draft,
      note,
      ringBack,
      pausedAt: now.toISOString(),
      activeSeconds: talkingSeconds(draft, now),
      stepTitle: step.title,
      stepNumber: stepIndex + 1,
      stepCount: totalSteps,
    });
    abandon();
    setPaused(pausedFor(staffId));
    setNotice('Paused. It is waiting under Calls to finish, on this phone. Nothing has been sent.');
    window.scrollTo({ top: 0 });
  };

  const finish = async (contact: ContactFormValues | null): Promise<void> => {
    setSubmitting(true);
    setError(null);
    const now = new Date();
    const response: ConsultationResponse = {
      // The draft's own id, so saving twice stores the interview once.
      id: draft.responseId,
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
      // An interview never came in by a link; the method says how it did.
      source: null,
    };
    const wantsContact = contact !== null && interests.length > 0 && !interests.includes(NO_INTEREST_ID);
    const record: ContactRecord | null =
      contact === null || !wantsContact
        ? null
        : {
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
            // To the day: see the online form for why.
            submittedAt: contactDay(now),
            isTestData: false,
            source: null,
          };
    const result = await submitConsultation(response, record);
    if (!result.success) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    abandon();
    setSaved(result.data.queued ? 'queued' : 'sent');
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

      {showResumed && (
        <p className={`${accentPanel} mb-4`} role="status">
          Picking up where you left off, at {step.title}. Remind them who you are, and that they can still skip anything
          or stop.
        </p>
      )}

      <InterviewNav
        steps={steps}
        current={stepIndex}
        answers={draft.answers}
        roleChosen={draft.role !== null}
        onJump={(index) => {
          setShowResumed(false);
          state.goTo(index);
        }}
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
            mustAsk={length === 'full' && question.tracking === true && !isPersonalQuestion(question)}
            covered={covered.includes(question.id)}
            onToggleCovered={() => state.setAnswer(COVERED_ID, toggleCovered(draft.answers, question.id))}
          />
        ))}

        <InterviewNotes
          title={step.section === null ? 'general' : step.title}
          value={notes}
          onChange={(value) => state.setAnswer(notesKey, value.length === 0 ? undefined : { kind: 'text', value })}
        />

        {isContactStep && (
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
              initial={contact}
              onSubmit={(values) => {
                setContact(values);
                if (isLastStep) void finish(values);
                else state.next();
              }}
            />
          </>
        )}
      </div>

      {error !== null && (
        <p role="alert" className="mt-6 rounded-md border border-danger px-4 py-3 text-body text-danger">
          {error}
        </p>
      )}

      {pausing ? (
        <PausePanel
          stepTitle={step.title}
          contactTaken={contact !== null}
          onPause={pause}
          onCancel={() => setPausing(false)}
        />
      ) : (
      <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse sm:justify-start no-print">
        {/* Own keys, so a Next never turns into the contact form's submit
            button mid-press and skips that step. See Consultation.tsx. */}
        {isContactStep ? (
          <button key="contact" type="submit" form={CONTACT_FORM_ID} className={primaryButton} disabled={submitting}>
            {isLastStep ? (submitting ? 'Saving…' : 'Save the interview') : 'Next'}
          </button>
        ) : isLastStep ? (
          <button key="save" type="button" className={primaryButton} disabled={submitting} onClick={() => void finish(contact)}>
            {submitting ? 'Saving…' : 'Save the interview'}
          </button>
        ) : (
          <button
            key="next"
            type="button"
            className={primaryButton}
            onClick={() => {
              if (stepIndex === 0 && draft.role === null) {
                setRoleError(true);
                showRoleQuestion();
                return;
              }
              setShowResumed(false);
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
        <button type="button" className={secondaryButton} disabled={submitting} onClick={() => setPausing(true)}>
          Pause, ring back later
        </button>
      </div>
      )}
    </div>
  );
};

/**
 * One-to-one, video and phone interviews, by project staff, into the same
 * dataset as the online form. Staff only: an interview records who took it.
 */
export const Interview = () => {
  const staff = useStaffSession();
  // A picked-up call starts the session again from the draft put back in its
  // place, exactly as a reload would, so nothing of the call before it lingers.
  const [session, setSession] = useState(0);
  const [resumed, setResumed] = useState(false);

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
      <InterviewSession
        key={session}
        staffId={staff.userId}
        email={staff.email}
        resumed={resumed}
        onResume={() => {
          setResumed(true);
          setSession((value) => value + 1);
        }}
      />
    </Layout>
  );
};
