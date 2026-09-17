import { useEffect, useState } from 'react';
import { currentProject } from '../../content/projects';
import { Link, useParams } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { QrCode } from '../../components/QrCode';
import { WorkshopResults } from '../../components/WorkshopResults';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useQuestionnaire } from '../../contexts/QuestionnaireContext';
import { questionById } from '../../content/lookup';
import { useStaffSession } from '../../hooks/useStaffSession';
import { useWorkshopState } from '../../hooks/useWorkshopState';
import {
  choiceHint,
  controlWorkshop,
  joinUrl,
  screenPrompt,
  setWordHidden,
  type LiveWorkshop,
  type WorkshopControl,
} from '../../services/workshops';
import { AdminLogin } from '../admin/AdminLogin';

/**
 * Scales the whole presenter screen with the width of the display. The rest of
 * the site is sized for reading at arm's length; a projector is read from the
 * back of a shed. Every size here is in rem, so moving the root moves them all.
 */
const useProjectorScale = (): void => {
  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.fontSize;
    root.style.fontSize = 'clamp(16px, 0.6vw + 9px, 28px)';
    return () => {
      root.style.fontSize = before;
    };
  }, []);
};

/** The question, sized for the room. Inline, because page heading styles would otherwise win. */
const QUESTION_STYLE = {
  fontSize: 'clamp(1.75rem, 1rem + 1.9vw, 3.5rem)',
  lineHeight: 1.15,
} as const;
/** Facilitator buttons: still big enough to hit, smaller than the content. */
const controlBase = 'inline-flex items-center rounded-lg px-3 py-2 text-meta font-semibold min-h-10';
const controlPrimary = `${controlBase} bg-primary text-white hover:bg-primary/90`;
const controlSecondary = `${controlBase} border border-line-strong bg-surface text-ink hover:bg-sunk`;

const CODE_STYLE = {
  fontSize: 'clamp(2rem, 1rem + 2.2vw, 4rem)',
  lineHeight: 1,
} as const;

/** Fills the screen with the presenter view; Esc or the same button leaves. */
const FullScreenButton = () => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const update = (): void => setOn(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  if (!document.fullscreenEnabled) return null;
  return (
    <button
      type="button"
      className="text-meta text-primary-ink underline underline-offset-4"
      onClick={() => void (on ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
    >
      {on ? 'Exit full screen' : 'Full screen'}
    </button>
  );
};

const Stage = ({
  live,
  code,
  onControl,
  onHideWord,
}: {
  live: LiveWorkshop;
  code: string;
  onControl: (c: WorkshopControl) => void;
  onHideWord: (word: string, hide: boolean) => void;
}) => {
  const questionnaire = useQuestionnaire();
  const question = questionById(questionnaire, live.questionId ?? '') ?? null;
  const url = joinUrl(code);
  const last = live.index >= live.questionIds.length - 1;
  const shortUrl = url.replace(/^https?:\/\//, '');
  const joinPath = shortUrl.replace(/#\/w\/.*$/, '#/w');
  const showJoinPanel = live.status === 'open' && !live.revealed;

  return (
    // While people are answering, the join panel takes a column. Once results
    // are up it shrinks to a line, and the chart gets the whole width.
    <div className={`grid gap-8 ${showJoinPanel ? 'lg:grid-cols-[1fr_minmax(16rem,22vw)]' : ''}`}>
      <section aria-live="polite" className="min-w-0">
        {/* The facilitator's controls sit beside the counter, so they never fall below a short projector. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-eyebrow uppercase text-ink-faint">
            Question {live.index + 1} of {live.questionIds.length}
          </p>
          <div className="flex flex-wrap justify-end gap-2 no-print">
            {live.status === 'open' ? (
              <>
                {!live.revealed ? (
                  <button type="button" className={controlPrimary} onClick={() => onControl({ revealed: true })}>
                    Close voting and show results
                  </button>
                ) : (
                  <button type="button" className={controlSecondary} onClick={() => onControl({ revealed: false })}>
                    Reopen voting
                  </button>
                )}
                {live.index > 0 && (
                  <button
                    type="button"
                    className={controlSecondary}
                    onClick={() => onControl({ index: live.index - 1, revealed: false })}
                  >
                    Previous question
                  </button>
                )}
                {!last && (
                  <button
                    type="button"
                    className={live.revealed ? controlPrimary : controlSecondary}
                    onClick={() => onControl({ index: live.index + 1, revealed: false })}
                  >
                    Next question
                  </button>
                )}
                <button
                  type="button"
                  className={controlSecondary}
                  onClick={() => {
                    if (window.confirm('End the workshop? Phones will save their answers and stop taking votes.')) {
                      onControl({ status: 'closed', revealed: true });
                    }
                  }}
                >
                  End workshop
                </button>
              </>
            ) : (
              <p className="text-body text-ink">
                This workshop has ended. Answers from every phone still open were saved as responses.
              </p>
            )}
          </div>
        </div>
        {question === null ? (
          <p className="mt-2 text-title text-ink-soft">This question is no longer in the questionnaire.</p>
        ) : (
          <>
            <h2 className="mt-2 font-display font-bold text-ink" style={QUESTION_STYLE}>
              {screenPrompt(question)}
            </h2>
            <p className="mt-3 text-title font-normal text-ink-soft">{choiceHint(question)}</p>
          </>
        )}

        {live.status === 'open' && live.revealed && (
          <p className="mt-3 text-subtitle font-normal text-ink-soft">
            Join at {joinPath} with code{' '}
            <strong className="font-display tracking-[0.15em] text-primary-ink">{code}</strong>
          </p>
        )}
        <p className="mt-4 text-title font-semibold text-ink">
          {live.answered} {live.answered === 1 ? 'answer' : 'answers'} in
        </p>

        <div className="mt-4">
          {!live.revealed && <p className="text-subtitle text-ink-soft">Results are hidden while people answer.</p>}
          {live.revealed && live.results === null && (
            <p className="text-subtitle text-ink-soft">
              Fewer than {live.minAnswers} people have answered, so the result stays hidden to protect their privacy.
            </p>
          )}
          {live.revealed && live.results !== null && question !== null && (
            <WorkshopResults
              question={question}
              results={live.results}
              answered={live.answered}
              large
              heading={{
                title: screenPrompt(question),
                note: `${live.answered} people answered · ${live.title} · ${new Date().toLocaleDateString('en-AU', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}`,
              }}
              onHideWord={
                question.kind === 'text'
                  ? (word) => {
                      if (window.confirm(`Hide "${word}" from the screen and every phone?`)) onHideWord(word, true);
                    }
                  : undefined
              }
            />
          )}
          {question?.kind === 'text' && live.revealed && live.results !== null && (
            <p className="mt-3 text-meta text-ink-soft no-print">
              Click a word to hide it.
              {live.hidden.length > 0 && (
                <>
                  {' '}
                  Hidden:{' '}
                  {live.hidden.map((word) => (
                    <button
                      key={word}
                      type="button"
                      className="mr-2 underline underline-offset-4"
                      title="Show it again"
                      onClick={() => onHideWord(word, false)}
                    >
                      {word}
                    </button>
                  ))}
                </>
              )}
            </p>
          )}
        </div>
      </section>

      {showJoinPanel && (
        <aside className="grid content-start justify-items-center gap-2 rounded-xl border border-line bg-surface p-5 text-center">
          <p className="text-body font-semibold text-ink">Scan to join</p>
          <QrCode
            value={url}
            label={`QR code linking to ${shortUrl}`}
            className="aspect-square w-full"
            style={{ maxHeight: '45vh' }}
          />
          <p className="text-meta text-ink-soft">or go to</p>
          <p className="break-all text-body text-ink">{joinPath}</p>
          <p className="text-meta text-ink-soft">and enter</p>
          <p className="font-display font-extrabold tracking-[0.15em] text-primary-ink" style={CODE_STYLE}>
            {code}
          </p>
        </aside>
      )}
    </div>
  );
};

/** The screen the room looks at. Wide, and big enough to read from the back. */
export const WorkshopPresent = () => {
  useProjectorScale();
  const staff = useStaffSession();
  const { code = '' } = useParams();
  const { state, offline, refresh } = useWorkshopState(staff.userId === null ? undefined : code);
  const [error, setError] = useState<string | null>(null);

  if (staff.checking) {
    return (
      <Layout>
        <p className="text-ink-soft">Checking your sign-in…</p>
      </Layout>
    );
  }
  if (staff.userId === null) return <AdminLogin onSignedIn={staff.refresh} />;

  const control = async (id: string, change: WorkshopControl): Promise<void> => {
    setError(null);
    const result = await controlWorkshop(id, change);
    if (!result.success) setError(result.error);
    await refresh();
  };

  const hideWord = async (id: string, questionId: string, word: string, hide: boolean): Promise<void> => {
    setError(null);
    const result = await setWordHidden(id, questionId, word, hide);
    if (!result.success) setError(result.error);
    await refresh();
  };

  return (
    <div className="min-h-dvh bg-paper px-4 py-4 text-ink sm:px-10 sm:py-5">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b-2 border-accent/60 pb-4 no-print">
        <div>
          <p className="text-eyebrow uppercase text-ink-faint">
            {currentProject().shortName} · {currentProject().reference}
          </p>
          <h1 className="text-title">{state?.found === true ? state.title : 'Workshop'}</h1>
        </div>
        <span className="flex items-center gap-4">
          <FullScreenButton />
          <Link to="/workshop" className="text-meta text-primary-ink underline underline-offset-4">
            All workshops
          </Link>
          <ThemeToggle />
        </span>
      </header>
      <main>
        {offline && (
          <p role="status" className="mb-4 text-meta text-danger">
            Can&rsquo;t reach the server. Retrying…
          </p>
        )}
        {error !== null && (
          <p role="alert" className="mb-4 text-meta font-medium text-danger">
            {error}
          </p>
        )}
        {state === null && <p className="text-ink-soft">Loading…</p>}
        {state?.found === false && <p className="text-body">No workshop has the code {code}.</p>}
        {state?.found === true && (
          <Stage
            live={state}
            code={code.toUpperCase()}
            onControl={(change) => void control(state.id, change)}
            onHideWord={(word, hide) => void hideWord(state.id, state.questionId ?? '', word, hide)}
          />
        )}
      </main>
    </div>
  );
};
