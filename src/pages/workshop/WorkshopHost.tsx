import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Layout } from '../../components/Layout';
import { accentPanel, card, primaryButton, secondaryButton, textInput } from '../../components/ui';
import { useQuestionnaire } from '../../contexts/QuestionnaireContext';
import { useStaffSession } from '../../hooks/useStaffSession';
import { createWorkshop, listWorkshops, screenPrompt, workshopQuestions, type WorkshopSummary } from '../../services/workshops';
import { AdminLogin } from '../admin/AdminLogin';

const setupSchema = z.object({
  title: z.string().trim().min(1, 'Give the workshop a name people will recognise.').max(160),
  questionIds: z.array(z.string()).min(1, 'Choose at least one question.').max(40),
});

type SetupValues = z.infer<typeof setupSchema>;

const NewWorkshop = ({ staffId }: { staffId: string }) => {
  const questionnaire = useQuestionnaire();
  const navigate = useNavigate();
  const questions = useMemo(() => workshopQuestions(questionnaire), [questionnaire]);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
    // The core questions are the ones a room can usefully answer together.
    defaultValues: {
      title: '',
      questionIds: questions
        .filter((question) => questionnaire.core.some((section) => section.questions.includes(question)))
        .map((question) => question.id),
    },
  });

  const start = async (values: SetupValues): Promise<void> => {
    setError(null);
    const ordered = questions.map((question) => question.id).filter((id) => values.questionIds.includes(id));
    const result = await createWorkshop({
      title: values.title,
      roundId: questionnaire.roundId,
      questionIds: ordered,
      createdBy: staffId,
    });
    if (!result.success) {
      setError(result.error);
      return;
    }
    navigate(`/workshop/${result.data.code}`);
  };

  return (
    <form className={`${card} grid gap-4`} onSubmit={(event) => void handleSubmit(start)(event)} noValidate>
      <h2 className="text-subtitle font-semibold">Start a workshop</h2>
      <div>
        <label htmlFor="workshop-title" className="mb-1 block text-body font-medium">
          Name shown on the screen
        </label>
        <input
          id="workshop-title"
          className={textInput}
          placeholder="For example: Ballarat field day"
          aria-invalid={errors.title !== undefined}
          aria-describedby={errors.title === undefined ? undefined : 'workshop-title-error'}
          {...register('title')}
        />
        {errors.title !== undefined && (
          <p id="workshop-title-error" className="mt-1 text-meta font-medium text-danger">
            {errors.title.message}
          </p>
        )}
      </div>
      <fieldset aria-describedby={errors.questionIds === undefined ? undefined : 'workshop-questions-error'}>
        <legend className="mb-2 text-body font-medium">Questions, in the order they will be shown</legend>
        <ul className="grid gap-2">
          {questions.map((question) => (
            <li key={question.id}>
              <label className="flex items-start gap-3 text-body text-ink">
                <input type="checkbox" value={question.id} className="mt-1 size-5 shrink-0" {...register('questionIds')} />
                <span>{screenPrompt(question)}</span>
              </label>
            </li>
          ))}
        </ul>
        {errors.questionIds !== undefined && (
          <p id="workshop-questions-error" className="mt-1 text-meta font-medium text-danger">
            {errors.questionIds.message}
          </p>
        )}
      </fieldset>
      {error !== null && (
        <p role="alert" className="text-meta font-medium text-danger">
          {error}
        </p>
      )}
      <div>
        <button type="submit" className={primaryButton} disabled={isSubmitting}>
          {isSubmitting ? 'Starting…' : 'Start and show the join code'}
        </button>
      </div>
    </form>
  );
};

/** Where a facilitator starts a live workshop, or goes back to one. */
export const WorkshopHost = () => {
  const staff = useStaffSession();
  const [workshops, setWorkshops] = useState<readonly WorkshopSummary[]>([]);

  useEffect(() => {
    if (staff.userId !== null) void listWorkshops().then(setWorkshops);
  }, [staff.userId]);

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
        <h1>Live workshop</h1>
        <Link to="/admin" className="text-meta text-primary-ink underline underline-offset-4">
          Admin area
        </Link>
      </div>
      <div className="grid gap-5">
        <section className={accentPanel}>
          <p className="text-body text-ink">
            Put a question on the screen, people answer on their phones, and the room sees the result when you
            choose. Each phone&rsquo;s answers are saved as one anonymous response, marked as coming from this
            workshop.
          </p>
          <p className="mt-2 text-meta text-ink-soft">
            Results are never shown until at least five people have answered, so nobody&rsquo;s choice can be
            picked out of a small room.
          </p>
        </section>

        <NewWorkshop staffId={staff.userId} />

        {workshops.length > 0 && (
          <section className={card}>
            <h2 className="text-subtitle font-semibold">Earlier workshops</h2>
            <ul className="mt-3 grid gap-2">
              {workshops.map((workshop) => (
                <li
                  key={workshop.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2 last:border-0"
                >
                  <span>
                    <span className="block text-body text-ink">{workshop.title}</span>
                    <span className="block text-meta text-ink-faint">
                      {workshop.createdAt.slice(0, 10)} · code {workshop.code} · {workshop.questionIds.length}{' '}
                      questions · {workshop.status === 'open' ? 'running' : 'ended'}
                    </span>
                  </span>
                  <Link to={`/workshop/${workshop.code}`} className={secondaryButton}>
                    {workshop.status === 'open' ? 'Present' : 'View'}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Layout>
  );
};
