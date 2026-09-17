import { useEffect, useRef, useState } from 'react';
import { currentProject } from '../../content/projects';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Layout } from '../../components/Layout';
import { TallyBars } from '../../components/TallyBars';
import { accentPanel, card, choiceRow, choiceRowSelected, primaryButton, quietButton, textInput } from '../../components/ui';
import { useQuestionnaire } from '../../contexts/QuestionnaireContext';
import { questionById } from '../../content/lookup';
import { useWorkshopState } from '../../hooks/useWorkshopState';
import { submitResponse } from '../../services/submit';
import {
  answersFromVotes,
  castVote,
  choiceHint,
  loadParticipant,
  normaliseCode,
  saveParticipant,
  tallyRows,
  toggleChoice,
  workshopChoices,
  type LiveWorkshop,
  type ParticipantState,
  type VoteOutcome,
} from '../../services/workshops';
import type { RoleId } from '../../types';

const codeSchema = z.object({
  code: z
    .string()
    .transform(normaliseCode)
    .pipe(z.string().length(6, 'The code is six letters and numbers, shown on the screen.')),
});

type CodeValues = z.input<typeof codeSchema>;

const EnterCode = () => {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CodeValues, unknown, z.output<typeof codeSchema>>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  });
  return (
    <form
      className={`${card} grid gap-3`}
      noValidate
      onSubmit={(event) => void handleSubmit((values) => navigate(`/w/${values.code}`))(event)}
    >
      <label htmlFor="join-code" className="text-body font-medium">
        Code on the screen
      </label>
      <input
        id="join-code"
        className={`${textInput} text-center text-title uppercase tracking-[0.3em]`}
        autoComplete="off"
        autoCapitalize="characters"
        aria-invalid={errors.code !== undefined}
        aria-describedby={errors.code === undefined ? undefined : 'join-code-error'}
        {...register('code')}
      />
      {errors.code !== undefined && (
        <p id="join-code-error" className="text-meta font-medium text-danger">
          {errors.code.message}
        </p>
      )}
      <button type="submit" className={primaryButton}>
        Join
      </button>
    </form>
  );
};

const OUTCOME_MESSAGE: Record<Exclude<VoteOutcome, 'ok'>, string> = {
  not_found: 'This workshop no longer exists.',
  closed: 'The workshop has ended.',
  not_current: 'The presenter has moved on. Here is the new question.',
  revealed: 'Voting on this question has closed.',
  invalid: 'Pick at least one answer.',
  full: 'This workshop is full.',
  offline: 'That didn’t send — check your signal and try again.',
};

const Joining = ({ live, onJoin }: { live: LiveWorkshop; onJoin: (role: RoleId | null) => void }) => {
  const questionnaire = useQuestionnaire();
  const [role, setRole] = useState<RoleId | null>(null);
  return (
    <div className="grid gap-5">
      <section className={accentPanel}>
        <h2 className="text-subtitle font-semibold">{live.title}</h2>
        <p className="mt-2 text-body text-ink">
          Answer each question as it comes up on the screen. You won&rsquo;t be asked your name.
        </p>
        <p className="mt-2 text-meta text-ink-soft">
          Your answers are saved as one anonymous response to the {currentProject().reference} consultation. The room only sees totals,
          and only once at least {live.minAnswers} people have answered.{' '}
          <Link to="/privacy" className={quietButton}>
            Privacy
          </Link>
        </p>
      </section>
      <fieldset className={card}>
        <legend className="text-body font-semibold">
          Which best describes you? <span className="font-normal text-ink-soft">— optional</span>
        </legend>
        <ul className="mt-3 grid gap-2">
          {questionnaire.roles.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                aria-pressed={role === option.id}
                className={`${choiceRow} ${role === option.id ? choiceRowSelected : ''}`}
                onClick={() => setRole(role === option.id ? null : option.id)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      </fieldset>
      <div>
        <button type="button" className={primaryButton} onClick={() => onJoin(role)}>
          Join the workshop
        </button>
      </div>
    </div>
  );
};

const Voting = ({
  live,
  code,
  me,
  onVoted,
  onLeave,
}: {
  live: LiveWorkshop;
  code: string;
  me: ParticipantState;
  onVoted: (questionId: string, choices: readonly string[]) => void;
  onLeave: () => void;
}) => {
  const questionnaire = useQuestionnaire();
  const found = questionById(questionnaire, live.questionId ?? '');
  const question = found !== undefined && found.kind !== 'text' && found.kind !== 'rating' ? found : null;
  const sent = live.questionId === null ? undefined : me.votes[live.questionId];
  const [picked, setPicked] = useState<readonly string[]>(sent ?? []);
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // A new question clears the choices and any message from the last one.
  useEffect(() => {
    setPicked(live.questionId === null ? [] : (me.votes[live.questionId] ?? []));
    setMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on a question change
  }, [live.questionId]);

  if (question === null || live.questionId === null) {
    return <p className="text-body text-ink-soft">Waiting for the next question…</p>;
  }

  const send = async (): Promise<void> => {
    setSending(true);
    const outcome = await castVote(code, me.participant, question.id, picked);
    setSending(false);
    if (outcome === 'ok') {
      onVoted(question.id, picked);
      setMessage(null);
    } else {
      setMessage(OUTCOME_MESSAGE[outcome]);
    }
  };

  const unchanged = sent !== undefined && sent.join('|') === picked.join('|');

  return (
    <div className="grid gap-4" aria-live="polite">
      <p className="text-eyebrow uppercase text-ink-faint">
        Question {live.index + 1} of {live.questionIds.length}
      </p>
      <h2 className="text-subtitle font-semibold text-ink">{question.guide?.open ?? question.prompt}</h2>

      {live.revealed ? (
        <section className={card}>
          {live.results === null ? (
            <p className="text-body text-ink-soft">
              Voting has closed. Fewer than {live.minAnswers} people answered, so the result isn&rsquo;t shown.
            </p>
          ) : (
            <TallyBars rows={tallyRows(question, live.results, live.answered)} answered={live.answered} />
          )}
        </section>
      ) : (
        <>
          <p className="text-meta text-ink-soft">{choiceHint(question)}</p>
          <ul className="grid gap-2">
            {workshopChoices(question).map((option) => {
              const position = picked.indexOf(option.id);
              const on = position >= 0;
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    className={`${choiceRow} ${on ? choiceRowSelected : ''}`}
                    onClick={() => setPicked((current) => toggleChoice(question, current, option.id))}
                  >
                    {question.kind === 'rank' && on && (
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-meta font-bold text-white">
                        {position + 1}
                      </span>
                    )}
                    <span>{option.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {message !== null && (
            <p role="alert" className="text-meta font-medium text-danger">
              {message}
            </p>
          )}
          {sent !== undefined && unchanged ? (
            <p role="status" className="text-body font-medium text-ink">
              Answer sent. Watch the screen — you can change it until results are shown.
            </p>
          ) : (
            <div>
              <button
                type="button"
                className={primaryButton}
                disabled={picked.length === 0 || sending}
                onClick={() => void send()}
              >
                {sending ? 'Sending…' : sent === undefined ? 'Send my answer' : 'Update my answer'}
              </button>
            </div>
          )}
        </>
      )}

      {Object.keys(me.votes).length > 0 && (
        <p className="mt-4 text-meta text-ink-soft">
          Leaving early?{' '}
          <button type="button" className={quietButton} onClick={onLeave}>
            Save my answers and finish
          </button>
        </p>
      )}
    </div>
  );
};

/** The phone screen. Reached by the QR code, or by typing the code. */
export const WorkshopJoin = () => {
  const { code: rawCode } = useParams();
  const code = normaliseCode(rawCode ?? '');
  const questionnaire = useQuestionnaire();
  const { state, offline } = useWorkshopState(code.length === 6 ? code : undefined);
  const [me, setMe] = useState<ParticipantState | null>(() => (code.length === 6 ? loadParticipant(code) : null));
  const [saveError, setSaveError] = useState<string | null>(null);
  const submitting = useRef(false);

  const update = (next: ParticipantState): void => {
    saveParticipant(code, next);
    setMe(next);
  };

  const finish = async (live: LiveWorkshop, current: ParticipantState): Promise<void> => {
    if (submitting.current || current.submitted) return;
    const answers = answersFromVotes(questionnaire, current.votes);
    if (Object.keys(answers).length === 0) {
      update({ ...current, submitted: true });
      return;
    }
    submitting.current = true;
    const now = new Date();
    const role = questionnaire.roles.find((option) => option.id === current.role);
    const result = await submitResponse({
      id: crypto.randomUUID(),
      roundId: live.roundId,
      role: role?.id ?? null,
      pathway: role?.pathway ?? null,
      regions: [],
      regionOther: '',
      answers,
      startedAt: current.startedAt,
      submittedAt: now.toISOString(),
      durationSeconds: Math.max(0, Math.round((now.getTime() - Date.parse(current.startedAt)) / 1000)),
      isTestData: false,
      method: 'workshop',
      collectedBy: null,
      consentVerbal: null,
      sessionId: live.id,
    });
    submitting.current = false;
    if (result.success) update({ ...current, submitted: true });
    else setSaveError(result.error);
  };

  // When the presenter ends the workshop, every open phone saves itself.
  useEffect(() => {
    if (state?.found === true && state.status === 'closed' && me !== null && !me.submitted) void finish(state, me);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish is stable in effect
  }, [state, me]);

  let body;
  if (code.length !== 6) {
    body = (
      <>
        <p className="mb-4 text-body">Enter the code shown on the presenter&rsquo;s screen.</p>
        <EnterCode />
      </>
    );
  } else if (state === null) {
    body = <p className="text-ink-soft">{offline ? 'Can’t reach the workshop. Retrying…' : 'Joining…'}</p>;
  } else if (!state.found) {
    body = (
      <>
        <p className="mb-4 text-body">No workshop has the code {code}. Check the screen and try again.</p>
        <EnterCode />
      </>
    );
  } else if (me?.submitted === true) {
    body = (
      <section className={accentPanel}>
        <h2 className="text-subtitle font-semibold">Thanks — your answers are saved</h2>
        <p className="mt-2 text-body text-ink">
          If you&rsquo;d like to say more, the full consultation takes about ten minutes and asks about your own
          operation.
        </p>
        <p className="mt-4">
          <Link to="/" className={primaryButton}>
            Go to the full consultation
          </Link>
        </p>
      </section>
    );
  } else if (state.status === 'closed') {
    body =
      me === null ? (
        <p className="text-body">This workshop has ended. Thanks for coming.</p>
      ) : (
        <p className="text-ink-soft">{saveError ?? 'Saving your answers…'}</p>
      );
  } else if (me === null) {
    body = (
      <Joining
        live={state}
        onJoin={(role) =>
          update({
            participant: crypto.randomUUID(),
            role,
            startedAt: new Date().toISOString(),
            votes: {},
            submitted: false,
          })
        }
      />
    );
  } else {
    body = (
      <Voting
        live={state}
        code={code}
        me={me}
        onVoted={(questionId, choices) => update({ ...me, votes: { ...me.votes, [questionId]: choices } })}
        onLeave={() => void finish(state, me)}
      />
    );
  }

  return (
    <Layout>
      <h1 className="mb-4">Workshop</h1>
      {offline && state !== null && (
        <p role="status" className="mb-3 text-meta text-danger">
          Signal lost. Retrying…
        </p>
      )}
      {body}
    </Layout>
  );
};
