import { useState } from 'react';
import { currentProject } from '../../content/projects';
import { Link, useParams } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { QrCode } from '../../components/QrCode';
import { TallyBars } from '../../components/TallyBars';
import { ThemeToggle } from '../../components/ThemeToggle';
import { primaryButton, secondaryButton } from '../../components/ui';
import { useQuestionnaire } from '../../contexts/QuestionnaireContext';
import { questionById } from '../../content/lookup';
import { useStaffSession } from '../../hooks/useStaffSession';
import { useWorkshopState } from '../../hooks/useWorkshopState';
import {
  choiceHint,
  controlWorkshop,
  joinUrl,
  tallyRows,
  type LiveWorkshop,
  type WorkshopControl,
  type WorkshopQuestion,
} from '../../services/workshops';
import { AdminLogin } from '../admin/AdminLogin';

const asWorkshopQuestion = (question: ReturnType<typeof questionById>): WorkshopQuestion | null =>
  question !== undefined && (question.kind === 'multi' || question.kind === 'single' || question.kind === 'rank')
    ? question
    : null;

const Stage = ({ live, code, onControl }: { live: LiveWorkshop; code: string; onControl: (c: WorkshopControl) => void }) => {
  const questionnaire = useQuestionnaire();
  const question = asWorkshopQuestion(questionById(questionnaire, live.questionId ?? ''));
  const url = joinUrl(code);
  const last = live.index >= live.questionIds.length - 1;
  const shortUrl = url.replace(/^https?:\/\//, '');

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <section aria-live="polite" className="min-w-0">
        <p className="text-eyebrow uppercase text-ink-faint">
          Question {live.index + 1} of {live.questionIds.length}
        </p>
        {question === null ? (
          <p className="mt-2 text-title text-ink-soft">This question is no longer in the questionnaire.</p>
        ) : (
          <>
            <h2 className="mt-2 font-display text-display font-bold text-ink">{question.guide?.open ?? question.prompt}</h2>
            <p className="mt-2 text-subtitle text-ink-soft">{choiceHint(question)}</p>
          </>
        )}

        <p className="mt-6 text-title font-semibold text-ink">
          {live.answered} {live.answered === 1 ? 'answer' : 'answers'} in
        </p>

        <div className="mt-6">
          {!live.revealed && (
            <p className="text-subtitle text-ink-soft">Results are hidden while people answer.</p>
          )}
          {live.revealed && live.results === null && (
            <p className="text-subtitle text-ink-soft">
              Fewer than {live.minAnswers} people have answered, so the result stays hidden to protect their privacy.
            </p>
          )}
          {live.revealed && live.results !== null && question !== null && (
            <TallyBars rows={tallyRows(question, live.results, live.answered)} answered={live.answered} large />
          )}
        </div>

        <div className="mt-8 flex flex-wrap gap-3 no-print">
          {live.status === 'open' ? (
            <>
              {!live.revealed ? (
                <button type="button" className={primaryButton} onClick={() => onControl({ revealed: true })}>
                  Close voting and show results
                </button>
              ) : (
                <button type="button" className={secondaryButton} onClick={() => onControl({ revealed: false })}>
                  Reopen voting
                </button>
              )}
              {live.index > 0 && (
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() => onControl({ index: live.index - 1, revealed: false })}
                >
                  Previous question
                </button>
              )}
              {!last && (
                <button
                  type="button"
                  className={live.revealed ? primaryButton : secondaryButton}
                  onClick={() => onControl({ index: live.index + 1, revealed: false })}
                >
                  Next question
                </button>
              )}
              <button
                type="button"
                className={secondaryButton}
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
      </section>

      {live.status === 'open' && (
        <aside className="grid content-start justify-items-center gap-3 rounded-xl border border-line bg-surface p-5 text-center">
          <p className="text-body font-semibold text-ink">Scan to join</p>
          <QrCode value={url} label={`QR code linking to ${shortUrl}`} className="w-full max-w-64" />
          <p className="text-meta text-ink-soft">or go to</p>
          <p className="break-all text-body text-ink">{shortUrl.replace(/#\/w\/.*$/, '#/w')}</p>
          <p className="text-meta text-ink-soft">and enter</p>
          <p className="font-display text-display font-extrabold tracking-[0.2em] text-primary-ink">{code}</p>
        </aside>
      )}
    </div>
  );
};

/** The screen the room looks at. Wide, and big enough to read from the back. */
export const WorkshopPresent = () => {
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

  return (
    <div className="min-h-dvh bg-paper px-4 py-6 text-ink sm:px-10 sm:py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b-2 border-accent/60 pb-4 no-print">
        <div>
          <p className="text-eyebrow uppercase text-ink-faint">
            {currentProject().shortName} · {currentProject().reference}
          </p>
          <h1 className="text-title">{state?.found === true ? state.title : 'Workshop'}</h1>
        </div>
        <span className="flex items-center gap-4">
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
          <Stage live={state} code={code.toUpperCase()} onControl={(change) => void control(state.id, change)} />
        )}
      </main>
    </div>
  );
};
