import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { AboutYou } from '../components/AboutYou';
import { CallbackRequest } from '../components/CallbackRequest';
import { QuestionField } from '../components/QuestionField';
import { showRoleQuestion } from '../components/roleQuestion';
import { accentPanel, card, primaryButton, quietButton, secondaryButton } from '../components/ui';
import { choicesFor, promptOverrideFor, rankChoicesFor } from '../content/dynamic';
import { currentProject, offersBites } from '../content/projects';
import { roleLabel } from '../content/lookup';
import { useQuestionnaireState } from '../contexts/QuestionnaireContext';
import { isDemoSite } from '../lib/config';
import { biteFor, bitesFor, biteTime, biteTitle, nextBite, type Bite } from '../services/bites';
import {
  beginBite,
  biteResponse,
  emptyPhone,
  finishBite,
  forgetPhone,
  readPhone,
  savePhone,
  settlePhone,
  type BitePhone,
} from '../services/bitePhone';
import { LINK_CODE_ID } from '../services/linkCode';
import { arrivalSource, forgetArrival } from '../services/sources';
import { submitResponse } from '../services/submit';
import type { Answer, Questionnaire, RoleId } from '../types';

/**
 * One bite of the consultation, opened from a link in a text, a chat group or
 * a QR code. See services/bites.ts for what a bite may and may not change.
 *
 * Who somebody is gets asked once on a phone. After that a bite is its own
 * questions and a Send button, and the screen after it offers the next one,
 * the scoreboard, a call instead, and the code for next time.
 */

const NotOpen = () => (
  <Layout>
    <h1>This link is not open yet</h1>
    <p className="prose-measure mt-3 text-ink-soft">
      The short parts of the consultation have not started. You can still have your say in the full consultation.
    </p>
    <div className="mt-6">
      <Link to="/" className={primaryButton}>
        Go to the consultation
      </Link>
    </div>
  </Layout>
);

const NotYou = ({ onReset }: { onReset: () => void }) => (
  <p className="mt-8 text-meta text-ink-soft">
    Not you?{' '}
    <button type="button" className={quietButton} onClick={onReset}>
      Start again as somebody else
    </button>
    . This phone forgets who answered and which parts were done.
  </p>
);

/** Where to go from here: the next bite, or the end. */
const NextUp = ({ next }: { next: Bite | null }) =>
  next === null ? (
    <p className="mt-3 text-body text-ink">That is every part for you this round. Thanks for every minute.</p>
  ) : (
    <div className="mt-5">
      <Link to={`/b/${next.id}`} className={primaryButton}>
        Got another minute? Do the next one now
      </Link>
      <p className="mt-2 text-meta text-ink-soft">
        Next: {biteTitle(next)}, {biteTime(next.seconds)}.
      </p>
    </div>
  );

const Profile = ({
  questionnaire,
  phone,
  onDone,
}: {
  questionnaire: Questionnaire;
  phone: BitePhone;
  onDone: (role: RoleId, regions: readonly string[], regionOther: string) => void;
}) => {
  const [role, setRole] = useState<RoleId | null>(phone.role);
  const [regions, setRegions] = useState<readonly string[]>(phone.regions);
  const [regionOther, setRegionOther] = useState(phone.regionOther);
  const [roleError, setRoleError] = useState(false);

  return (
    <>
      <p className="text-eyebrow uppercase text-ink-faint">First, two quick questions</p>
      <h1 className="mt-1 text-title font-bold">About your perspective</h1>
      <p className="prose-measure mt-2 text-ink-soft">
        Asked once on this phone, so each short part after this is only its own questions.
      </p>
      <div className="mt-6">
        <AboutYou
          questionnaire={questionnaire}
          role={role}
          regions={regions}
          regionOther={regionOther}
          onRole={(next) => {
            setRoleError(false);
            setRole(next);
          }}
          onRegions={setRegions}
          onRegionOther={setRegionOther}
          showRoleError={roleError}
        />
      </div>
      <div className="mt-8">
        <button
          type="button"
          className={primaryButton}
          onClick={() => {
            if (role === null) {
              setRoleError(true);
              showRoleQuestion();
              return;
            }
            onDone(role, regions, regionOther);
          }}
        >
          Next
        </button>
      </div>
    </>
  );
};

export const BitePage = () => {
  const { biteId = '' } = useParams();
  const { questionnaire, status } = useQuestionnaireState();
  const [phone, setPhone] = useState<BitePhone>(() => readPhone(questionnaire.roundId));
  const [editingProfile, setEditingProfile] = useState(false);
  const [sent, setSent] = useState<{ readonly biteId: string; readonly queued: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => savePhone(phone), [phone]);

  // Once the server has said which round is live, this phone's list belongs to it.
  useEffect(() => {
    if (status === 'live') setPhone((current) => settlePhone(current, questionnaire.roundId));
  }, [status, questionnaire.roundId]);

  // A link to the next bite opens on this same page, so start it at the top.
  useEffect(() => {
    setError(null);
    window.scrollTo({ top: 0 });
  }, [biteId]);

  const bite = useMemo(
    () => (phone.role === null ? null : biteFor(questionnaire, phone.role, biteId)),
    [questionnaire, phone.role, biteId],
  );
  const alreadyDone = bite !== null && phone.done.includes(bite.id);

  useEffect(() => {
    if (bite !== null && !alreadyDone) setPhone((current) => beginBite(current, bite));
  }, [bite, alreadyDone]);

  const reset = (): void => {
    forgetPhone();
    setPhone(emptyPhone(questionnaire.roundId));
    setSent(null);
    setEditingProfile(false);
  };

  if (!offersBites(currentProject())) return <NotOpen />;

  if (sent !== null && sent.biteId === biteId) {
    const next = nextBite(questionnaire, phone.role, phone.done);
    // The code for next time is offered on its own as well, unless it is next anyway.
    const codeBite = bitesFor(questionnaire, phone.role).find(
      (candidate) => candidate.questions.some((question) => question.id === LINK_CODE_ID),
    );
    const offerCode =
      phone.linkCode === null && codeBite !== undefined && !phone.done.includes(codeBite.id) && next?.id !== codeBite.id;
    return (
      <Layout>
        <h1>Done. Thanks.</h1>
        <p className="prose-measure mt-3 text-body text-ink">
          {isDemoSite()
            ? 'This is the demonstration, so nothing was sent.'
            : sent.queued
              ? 'Your answers are saved on this phone and will be sent the next time it has signal. Please do not clear your browser before then.'
              : 'Your answers are in.'}
        </p>
        <NextUp next={next} />

        <ul className={`${card} mt-8 grid gap-4`}>
          <li>
            <Link to="/scoreboard" className="font-semibold text-primary-ink underline underline-offset-4">
              See what people have said so far
            </Link>
            <span className="block text-meta text-ink-soft">The monthly scoreboard: what we heard, and what we are doing about it.</span>
          </li>
          {offerCode && codeBite !== undefined && (
            <li>
              <Link to={`/b/${codeBite.id}`} className="font-semibold text-primary-ink underline underline-offset-4">
                Want us to compare your answers next time?
              </Link>
              <span className="block text-meta text-ink-soft">
                Make your follow-up code, {biteTime(codeBite.seconds)}. Still no name.
              </span>
            </li>
          )}
        </ul>

        <section className={`${accentPanel} mt-6`} aria-labelledby="talk-heading">
          <h2 id="talk-heading" className="text-subtitle font-semibold">
            Rather talk it through?
          </h2>
          <CallbackRequest />
        </section>

        <NotYou onReset={reset} />
      </Layout>
    );
  }

  if (phone.role === null || editingProfile) {
    return (
      <Layout>
        <Profile
          questionnaire={questionnaire}
          phone={phone}
          onDone={(role, regions, regionOther) => {
            setPhone((current) => ({
              ...current,
              role,
              regions,
              regionOther,
              // A different part of the industry is asked different things.
              current: current.role === role ? current.current : null,
            }));
            setEditingProfile(false);
            window.scrollTo({ top: 0 });
          }}
        />
      </Layout>
    );
  }

  if (bite === null || alreadyDone) {
    const next = nextBite(questionnaire, phone.role, phone.done);
    return (
      <Layout>
        <h1>
          {alreadyDone
            ? 'You have answered this one'
            : biteId.startsWith('pathway_')
              ? 'Nothing in this one for you'
              : 'This link has changed'}
        </h1>
        <p className="prose-measure mt-3 text-ink-soft">
          {alreadyDone
            ? 'It was sent from this phone already, so it is counted. Thanks.'
            : biteId.startsWith('pathway_')
              ? 'This part asks about other parts of the industry, so there is nothing in it for you.'
              : 'The questions have moved on since this link was sent.'}
        </p>
        <NextUp next={next} />
        <NotYou onReset={reset} />
      </Layout>
    );
  }

  const current = phone.current?.biteId === bite.id ? phone.current : null;
  const answers = current?.answers ?? {};
  const answeredSomething = bite.questions.some((question) => answers[question.id] !== undefined);

  const setAnswer = (questionId: string, answer: Answer | undefined): void =>
    setPhone((state) => {
      // Begun here as well as on opening: the round settling can clear a bite
      // begun a moment before the server answered.
      const started = beginBite(state, bite);
      const begun = started.current;
      if (begun === null) return state;
      const next = { ...begun.answers };
      if (answer === undefined) delete next[questionId];
      else next[questionId] = answer;
      return { ...started, current: { ...begun, answers: next } };
    });

  const send = async (): Promise<void> => {
    setError(null);
    if (!answeredSomething) {
      setError('Nothing to send yet. Answer what you like, then press Send.');
      return;
    }
    const now = new Date();
    const response = biteResponse(questionnaire, phone, bite, arrivalSource(now), now);
    if (response === null) return;
    setSending(true);
    // The demonstration has no database, so nothing is sent, and nothing is
    // left in this browser's outbox waiting for one.
    const saved = isDemoSite() ? ({ success: true, data: 'sent' } as const) : await submitResponse(response);
    setSending(false);
    if (!saved.success) {
      setError(saved.error);
      return;
    }
    // The next link opened on this phone is credited to its own channel.
    forgetArrival();
    setPhone((state) => finishBite(state, bite));
    setSent({ biteId: bite.id, queued: saved.data === 'queued' });
    window.scrollTo({ top: 0 });
  };

  return (
    <Layout>
      <p className="text-eyebrow uppercase text-ink-faint">
        One short part of the consultation · {biteTime(bite.seconds)}
      </p>
      <h1 className="mt-1 text-title font-bold">{biteTitle(bite)}</h1>
      {bite.intro !== undefined && bite.part === 1 && <p className="prose-measure mt-2 text-ink-soft">{bite.intro}</p>}
      <p className="mt-3 text-meta text-ink-soft">
        Answering as {roleLabel(questionnaire, phone.role)}.{' '}
        <button type="button" className={quietButton} onClick={() => setEditingProfile(true)}>
          Change
        </button>
      </p>

      <div className="mt-6 grid gap-8">
        {bite.questions.map((question) => (
          <QuestionField
            key={question.id}
            question={question}
            answer={answers[question.id]}
            rankChoices={question.kind === 'rank' ? rankChoicesFor(questionnaire, answers) : undefined}
            promptOverride={promptOverrideFor(questionnaire, question, answers)}
            choices={choicesFor(question, answers)}
            onChange={(answer) => setAnswer(question.id, answer)}
          />
        ))}
      </div>

      {error !== null && (
        <p role="alert" className="mt-6 rounded-md border border-danger px-4 py-3 text-body text-danger">
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button type="button" className={primaryButton} disabled={sending} onClick={() => void send()}>
          {sending ? 'Sending…' : 'Send'}
        </button>
        <Link to="/" className={secondaryButton}>
          I would rather do the whole consultation
        </Link>
      </div>
      <p className="mt-4 text-meta text-ink-soft">
        No sign-up and no names. Your answers are reported as totals, like every other answer to the consultation.{' '}
        <Link to="/privacy" className="underline underline-offset-4">
          Privacy statement
        </Link>
      </p>
    </Layout>
  );
};
