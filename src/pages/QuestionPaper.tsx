import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { currentProject } from '../content/projects';
import { useQuestionnaire } from '../contexts/QuestionnaireContext';
import { buildQuestionPaper, type PaperQuestion } from '../services/questionPaper';
import { primaryButton, quietButton, secondaryButton } from '../components/ui';

/**
 * Every question in the consultation, laid out to be read on paper.
 *
 * It is a page of its own rather than a tab, because the point is the printed
 * result: a tab would carry the dashboard's filters, tab strip and figures
 * into the PDF, and this is a document somebody sends to a reference group.
 *
 * No PDF library. The browser already makes them, it embeds the reader's own
 * paper size and fonts, and the alternative is several hundred kilobytes in
 * the bundle to redraw what the print dialog draws for nothing.
 */

const Marker = ({ question }: { question: PaperQuestion }) => (
  <span
    className={`shrink-0 rounded-md border px-2 py-0.5 text-meta font-semibold ${
      question.inShort ? 'border-primary bg-selected text-ink' : 'border-line text-ink-soft'
    }`}
  >
    {question.inShort ? 'Short and full' : 'Full only'}
  </span>
);

const QuestionBlock = ({ question }: { question: PaperQuestion }) => (
  <article className="break-inside-avoid border-t border-line pt-4">
    <div className="flex items-start justify-between gap-3">
      <h3 className="text-body font-semibold text-ink">
        {question.number}. {question.prompt}
      </h3>
      <Marker question={question} />
    </div>
    {question.help !== undefined && <p className="mt-1 text-meta text-ink-soft">{question.help}</p>}
    <p className="mt-1 text-meta text-ink-faint">
      {question.kindLabel}
      {question.required ? ' · must be answered' : ''} · <code>{question.id}</code>
    </p>
    {question.notes.map((note) => (
      <p key={note} className="mt-1 text-meta text-ink-soft">
        {note}
      </p>
    ))}
    {question.scale !== undefined && (
      <p className="mt-1 text-meta text-ink-soft">
        {question.scale.map((point) => `${point.value} ${point.label}`).join(' · ')}
      </p>
    )}
    {question.options.length > 0 && (
      <ul className="mt-2 grid gap-1">
        {question.options.map((option) => (
          <li key={option.id} className="text-body text-ink-soft">
            <span aria-hidden="true" className="text-ink-faint">
              ·{' '}
            </span>
            {option.label}
            {option.help !== undefined && <span className="text-meta text-ink-faint"> ({option.help})</span>}
          </li>
        ))}
      </ul>
    )}
  </article>
);

export const QuestionPaper = () => {
  const questionnaire = useQuestionnaire();
  const paper = useMemo(() => buildQuestionPaper(questionnaire), [questionnaire]);
  const project = currentProject();
  const printed = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Layout>
      <h1 className="prose-measure">{project.name} consultation questions</h1>
      <p className="mt-3 text-body text-ink-soft prose-measure">
        {paper.roundLabel}. Printed {printed} from the wording that is live now, so a copy is out of date the moment a
        question is changed.
      </p>

      <div className="mt-5 flex flex-wrap gap-3 no-print">
        <button type="button" className={primaryButton} onClick={() => window.print()}>
          Save as PDF or print
        </button>
        <Link to="/admin?tab=rounds" className={secondaryButton}>
          Change the wording
        </Link>
      </div>
      <p className="mt-2 text-meta text-ink-soft no-print prose-measure">
        Your browser&rsquo;s print dialog opens. Choose <strong>Save as PDF</strong> as the destination, or print it on
        paper. Nothing on this screen except these buttons goes onto the page.
      </p>

      <section className="mt-5 rounded-xl border border-accent/60 bg-sunk p-5 prose-measure">
        <h2 className="text-subtitle font-semibold">Two versions of the same questions</h2>
        <p className="mt-2 text-ink-soft">
          The short version asks the {paper.shortCount} questions that repeat in every consultation, which is what makes
          one consultation comparable with the next. The full version asks all {paper.fullCount}. The wording is
          identical in both, and somebody who starts short can keep going without losing an answer.
        </p>
        <p className="mt-2 text-meta text-ink-soft">
          Estimated at {paper.shortMinutes} and {paper.fullMinutes} minutes for the longest path, which is{' '}
          {paper.slowestRole.toLowerCase()}. Most people are asked fewer, because the middle of the form depends on the
          role they pick.
        </p>
      </section>

      <section className="mt-6 break-inside-avoid">
        <h2 className="text-subtitle font-semibold">The short version, in order</h2>
        <p className="mt-1 text-meta text-ink-soft">
          Nobody is asked all of these. The middle of the form depends on the role somebody picks, so the branch is
          named where it matters.
        </p>
        <ol className="mt-2 grid gap-1">
          {paper.shortList.map((question) => (
            <li key={question.id} className="text-body text-ink-soft">
              {question.number}. {question.prompt}
              {question.audience !== 'Everybody' && (
                <span className="text-meta text-ink-faint"> · {question.sectionTitle}</span>
              )}
            </li>
          ))}
        </ol>
      </section>

      {paper.sections.map((section) => (
        <section key={section.id} className="mt-8">
          <h2 className="text-subtitle font-semibold">{section.title}</h2>
          <p className="mt-1 text-meta text-ink-faint">Asked of: {section.audience}</p>
          {section.intro !== undefined && <p className="mt-1 text-meta text-ink-soft">{section.intro}</p>}
          <div className="mt-3 grid gap-4">
            {section.questions.map((question) => (
              <QuestionBlock key={question.id} question={question} />
            ))}
          </div>
        </section>
      ))}

      <section className="mt-8 break-inside-avoid">
        <h2 className="text-subtitle font-semibold">After the questions</h2>
        <p className="mt-1 text-meta text-ink-faint">Asked of: Everybody, and every part of it optional</p>
        <p className="mt-2 text-body text-ink-soft">
          Whether they would like to be involved in anything that follows, and how to reach them if so: name,
          organisation, broad role, region, an email address or a phone number, when suits, and anything they want to
          add. It is stored apart from the answers and is never joined back to them.
        </p>
      </section>

      <p className="mt-8 text-meta text-ink-soft no-print">
        <Link to="/admin" className={quietButton}>
          Back to the results
        </Link>
      </p>
    </Layout>
  );
};
