import { useMemo, useState } from 'react';
import { accentPanel, card, secondaryButton } from '../../components/ui';
import { currentProject, purposeTemplate } from '../../content/projects';
import { useQuestionnaire } from '../../contexts/QuestionnaireContext';
import { questionById } from '../../content/lookup';
import { formEstimates, spoken } from '../../services/estimate';
import { reviewQuestionnaire } from '../../services/plainLanguage';
import { readinessChecks, warnings } from '../../services/readiness';
import type { ConsultationResponse } from '../../types';

const KIND_LABEL: Readonly<Record<string, string>> = {
  jargon: 'Office or trade language',
  'long-sentence': 'Long sentence',
  unexplained: 'Unexplained term',
  'double-question': 'Two questions in one',
};

/**
 * What the wizard's last step does for a project that already exists: the few
 * things that are awkward to fix once people have started answering, checked
 * against the wording as it stands right now.
 */
export const ReadinessPanel = ({ responses }: { responses: readonly ConsultationResponse[] }) => {
  const questionnaire = useQuestionnaire();
  const [showWording, setShowWording] = useState(false);
  const checks = useMemo(() => readinessChecks(questionnaire, responses), [questionnaire, responses]);
  const estimates = useMemo(() => formEstimates(questionnaire), [questionnaire]);
  const findings = useMemo(() => reviewQuestionnaire(questionnaire), [questionnaire]);
  const project = currentProject();
  const purpose = purposeTemplate(project.purpose);
  const needsAttention = warnings(checks);

  return (
    <section className={accentPanel}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-subtitle font-semibold">Before you share the link</h2>
        <span className="text-meta text-ink-soft">
          {needsAttention.length === 0
            ? 'Nothing needs attention'
            : `${needsAttention.length} thing${needsAttention.length === 1 ? '' : 's'} worth a look`}
        </span>
      </div>

      <p className="mt-2 text-meta text-ink-soft">
        <strong className="text-ink">{purpose.label}.</strong> {purpose.consequence}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className={`${card} py-3`}>
          <div className="text-meta text-ink-soft">Short version</div>
          <div className="text-title font-bold">{spoken(estimates.short)}</div>
          <div className="text-meta text-ink-soft">{estimates.short.questions} questions, slowest branch</div>
        </div>
        <div className={`${card} py-3`}>
          <div className="text-meta text-ink-soft">Full version</div>
          <div className="text-title font-bold">{spoken(estimates.full)}</div>
          <div className="text-meta text-ink-soft">{estimates.full.questions} questions, slowest branch</div>
        </div>
      </div>

      <ul className="mt-4 grid gap-2">
        {checks.map((check) => (
          <li key={check.id} className="flex gap-3">
            <span
              aria-hidden="true"
              className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-meta font-bold text-white ${
                check.state === 'pass' ? 'bg-primary' : 'bg-danger'
              }`}
            >
              {check.state === 'pass' ? '✓' : '!'}
            </span>
            <span>
              <span className="block text-body font-medium text-ink">
                <span className="sr-only">{check.state === 'pass' ? 'Fine: ' : 'Worth a look: '}</span>
                {check.title}
              </span>
              <span className="block text-meta text-ink-soft">{check.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      {findings.length > 0 && (
        <div className="mt-4">
          <button type="button" className={secondaryButton} onClick={() => setShowWording(!showWording)}>
            {showWording ? 'Hide the wording notes' : `Show the ${findings.length} wording notes`}
          </button>
          {showWording && (
            <ul className="mt-3 grid gap-3">
              {findings.map((finding, index) => (
                <li key={`${finding.where}-${index}`} className={card}>
                  <div className="text-meta font-semibold uppercase tracking-wide text-ink-faint">
                    {KIND_LABEL[finding.kind] ?? finding.kind} ·{' '}
                    {questionById(questionnaire, finding.where)?.prompt ?? finding.where}
                  </div>
                  <p className="mt-1 text-body text-ink">“{finding.text}”</p>
                  <p className="mt-1 text-meta text-ink-soft">{finding.note}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-meta text-ink-soft">
            These are prompts to think, not rules. Edit any wording below; tracked questions stay locked.
          </p>
        </div>
      )}
    </section>
  );
};
