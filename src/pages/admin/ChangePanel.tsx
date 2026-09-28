import { useMemo } from 'react';
import { accentPanel, card } from '../../components/ui';
import { useQuestionnaire } from '../../contexts/QuestionnaireContext';
import { roleLabel } from '../../content/lookup';
import { THIN, chartInput, compareRounds, rowHistory, type RoundInfo } from '../../services/change';
import { COLLECTION, ROLE_LABEL } from '../../content/vocabulary';
import { SlopeChart } from '../../components/SlopeChart';
import { DownloadChartButton } from '../../components/DownloadChartButton';
import { slopeChartSvg } from '../../lib/chartImage';
import { currentProject } from '../../content/projects';
import type { ConsultationResponse } from '../../types';

/** What each consultation is, structurally. Its own name does the rest. */
const STAGE_LABEL = ROLE_LABEL;

/** Long project names do not fit a chart column, so the chart uses a short form. */
const shortName = (label: string, roundId: string): string => {
  const trimmed = label.trim();
  if (trimmed.length === 0) return roundId;
  return trimmed.length <= 22 ? trimmed : `${trimmed.slice(0, 21).trimEnd()}…`;
};

const formatValue = (value: number | null, measure: 'share' | 'mean'): string => {
  if (value === null) return '—';
  return measure === 'share' ? `${Math.round(value * 100)}%` : value.toFixed(1);
};

const formatChange = (value: number | null, measure: 'share' | 'mean'): string => {
  if (value === null) return '';
  if (value === 0) return 'no change';
  const sign = value > 0 ? '+' : '−';
  const size = Math.abs(value);
  return measure === 'share' ? `${sign}${Math.round(size * 100)} pts` : `${sign}${size.toFixed(1)}`;
};

/**
 * Baseline against every review, for the questions asked word for word each
 * time. Pilot rounds never appear: they were the team testing the form.
 */
export const ChangePanel = ({
  responses,
  rounds: loaded,
}: {
  responses: readonly ConsultationResponse[];
  /** Every round, loaded once with the rest of the admin data and refreshed with it. */
  rounds: readonly RoundInfo[];
}) => {
  const questionnaire = useQuestionnaire();
  // Each round's own additions and stopped rows are applied to the questions
  // every round starts from, so the comparison knows what each one asked.
  const base = currentProject().questionnaire;
  const rounds = useMemo((): readonly RoundInfo[] => {
    if (loaded.length > 0) return loaded;
    // No rounds recorded: fall back to whatever rounds the responses carry.
    const seen = [...new Set(responses.map((response) => response.roundId))];
    return seen.map((roundId) => ({ roundId, label: roundId, stage: 'baseline' as const }));
  }, [loaded, responses]);

  const comparison = useMemo(
    () =>
      compareRounds(
        base,
        responses.filter((response) => !response.isTestData),
        rounds,
      ),
    [base, responses, rounds],
  );

  const { columns } = comparison;
  const showCharts = comparison.hasBaseline && comparison.hasReview && columns.length >= 2;
  // Short names for the chart: "Baseline", "Review 1", "Review 2".
  // Each column is called whatever the project called that consultation.
  const chartColumns = columns.map((column) => shortName(column.label, column.roundId));

  return (
    <div className="mt-6 grid gap-5">
      <section className={accentPanel}>
        <h2 className="text-subtitle font-semibold">Change over time</h2>
        <p className="mt-2 text-ink-soft">
          The repeat questions are asked word for word every time. This compares the starting point with each follow-up,
          so you can see whether priorities, adoption and barriers have moved.
        </p>
        <p className="mt-2 text-meta text-ink-soft">
          Responses are anonymous, so each consultation is a separate picture of the industry. This compares pictures,
          not the same people over time. Check <strong>who answered</strong> below before reading a change as a change
          of mind: a different mix of respondents moves the numbers too. Figures from fewer than {THIN} people are
          greyed.
        </p>
        <p className="mt-2 text-meta text-ink-soft">
          Something added part-way through is compared from the {COLLECTION.one} that first asked it, and says so. An
          interim check can be where something starts, but it never moves a starting point that already exists.
        </p>
      </section>

      {!comparison.hasBaseline && (
        <p className={`${card} text-ink-soft`}>
          No starting point yet. When you have finished practising, go to <strong>Question wording</strong> and press{' '}
          <strong>Start the starting point</strong>. Everything here is measured against it.
        </p>
      )}
      {comparison.hasBaseline && !comparison.hasReview && (
        <p className={`${card} text-ink-soft`}>
          {columns.at(-1)?.stage === 'interim'
            ? 'An interim check is collecting.'
            : 'The starting point is collecting.'}{' '}
          Change appears here once a follow-up has responses, usually part-way through the project.
        </p>
      )}

      {columns.length > 0 && (
        <>
          <section className={`${card} overflow-x-auto`}>
            <h3 className="text-subtitle font-semibold">Who answered</h3>
            <table className="mt-3 w-full text-body">
              <thead>
                <tr className="border-b border-line text-left text-meta text-ink-soft">
                  <th scope="col" className="py-2 pr-3">
                    Role
                  </th>
                  {columns.map((column) => (
                    <th key={column.roundId} scope="col" className="py-2 pl-3 text-right">
                      {STAGE_LABEL[column.stage]}
                      <span className="block font-normal">{column.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.composition.map((row) => (
                  <tr key={row.role} className="border-b border-line last:border-0">
                    <th scope="row" className="py-2 pr-3 text-left font-normal">
                      {roleLabel(questionnaire, row.role === 'not given' ? null : row.role)}
                    </th>
                    {row.counts.map((count, index) => (
                      <td key={columns[index]?.roundId} className="py-2 pl-3 text-right">
                        {count}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row" className="py-2 pr-3 text-left font-semibold">
                    Total
                  </th>
                  {columns.map((column) => (
                    <td key={column.roundId} className="py-2 pl-3 text-right font-semibold">
                      {column.respondents}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </section>

          {comparison.blocks.map((block) => (
            <section key={block.questionId} className={`${card} overflow-x-auto`}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="text-subtitle font-semibold">{block.prompt}</h3>
                {showCharts && (
                  <DownloadChartButton
                    name={`change-${block.questionId}`}
                    build={(palette) =>
                      slopeChartSvg(
                        {
                          title: block.prompt,
                          note: `${
                            block.measure === 'share' ? 'Share of those who answered' : 'Mean rating, 1 to 5'
                          } · ${chartColumns.map((name, index) => `${name} n = ${block.answered[index] ?? 0}`).join(', ')} · ${
                            currentProject().reference
                          }`,
                        },
                        chartInput(block.rows),
                        chartColumns,
                        block.measure,
                        palette,
                      )
                    }
                  />
                )}
              </div>
              <p className="mt-1 text-meta text-ink-soft">
                {block.measure === 'share'
                  ? 'Share of the people who answered this question.'
                  : 'Mean rating, 1 to 5, among the people who rated each area.'}
                {showCharts && ' Gold-brown lines rose most, slate lines fell most; the highest three are in dark ink.'}
              </p>
              {showCharts && (
                <div className="mt-3">
                  <SlopeChart
                    input={chartInput(block.rows)}
                    columns={chartColumns}
                    measure={block.measure}
                    label={`${block.prompt}: change from baseline`}
                  />
                </div>
              )}
              <details open={!showCharts} className="mt-3">
                <summary className="cursor-pointer text-meta font-semibold text-primary-ink">The numbers</summary>
                <table className="mt-3 w-full text-body">
                  <thead>
                    <tr className="border-b border-line text-left text-meta text-ink-soft">
                      <th scope="col" className="py-2 pr-3" />
                      {columns.map((column, index) => (
                        <th key={column.roundId} scope="col" className="py-2 pl-3 text-right">
                          {STAGE_LABEL[column.stage]}
                          <span className="block font-normal">
                            {block.asked[index] === true ? `n = ${block.answered[index] ?? 0}` : 'not asked'}
                          </span>
                        </th>
                      ))}
                      {comparison.hasBaseline && comparison.hasReview && (
                        <th scope="col" className="py-2 pl-3 text-right">
                          Change
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row) => {
                      const history = rowHistory(row, columns);
                      return (
                        <tr key={row.id} className="border-b border-line last:border-0">
                          <th scope="row" className="py-2 pr-3 text-left font-normal">
                            {row.label}
                            {history !== null && <span className="block text-meta text-ink-soft">{history}</span>}
                          </th>
                          {row.values.map((value, index) => {
                            if (row.asked[index] !== true) {
                              return (
                                <td key={columns[index]?.roundId} className="py-2 pl-3 text-right text-meta text-ink-faint">
                                  not asked
                                </td>
                              );
                            }
                            const thin = (block.answered[index] ?? 0) < THIN;
                            return (
                              <td
                                key={columns[index]?.roundId}
                                className={`py-2 pl-3 text-right ${thin ? 'text-ink-faint' : ''}`}
                              >
                                {formatValue(value, block.measure)}
                              </td>
                            );
                          })}
                          {comparison.hasBaseline && comparison.hasReview && (
                            <td className="py-2 pl-3 text-right font-semibold">
                              {formatChange(row.change, block.measure)}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </details>
            </section>
          ))}
        </>
      )}
    </div>
  );
};
