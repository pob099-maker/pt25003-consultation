import { useEffect, useMemo, useState } from 'react';
import { accentPanel, card } from '../../components/ui';
import { useQuestionnaire } from '../../contexts/QuestionnaireContext';
import { roleLabel } from '../../content/lookup';
import { compareRounds, THIN, type RoundInfo } from '../../services/change';
import { loadAllRounds } from '../../services/rounds';
import { SlopeChart } from '../../components/SlopeChart';
import { DownloadChartButton } from '../../components/DownloadChartButton';
import { slopeChartSvg } from '../../lib/chartImage';
import { currentProject } from '../../content/projects';
import type { ConsultationResponse } from '../../types';

const STAGE_LABEL: Readonly<Record<RoundInfo['stage'], string>> = {
  pilot: 'Pilot',
  baseline: 'Baseline',
  review: 'Review',
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
export const ChangePanel = ({ responses }: { responses: readonly ConsultationResponse[] }) => {
  const questionnaire = useQuestionnaire();
  const [rounds, setRounds] = useState<readonly RoundInfo[]>([]);

  useEffect(() => {
    let cancelled = false;
    void loadAllRounds().then((loaded) => {
      if (cancelled) return;
      if (loaded.length > 0) {
        setRounds(loaded);
        return;
      }
      // No backend: fall back to whatever rounds the demo data carries.
      const seen = [...new Set(responses.map((response) => response.roundId))];
      setRounds(seen.map((roundId) => ({ roundId, label: roundId, stage: 'baseline' as const })));
    });
    return () => {
      cancelled = true;
    };
  }, [responses]);

  const comparison = useMemo(
    () =>
      compareRounds(
        questionnaire,
        responses.filter((response) => !response.isTestData),
        rounds,
      ),
    [questionnaire, responses, rounds],
  );

  const { columns } = comparison;
  const showCharts = comparison.hasBaseline && comparison.hasReview && columns.length >= 2;
  // Short names for the chart: "Baseline", "Review 1", "Review 2".
  const chartColumns = columns.map((column, index) =>
    column.stage === 'review'
      ? `Review ${columns.slice(0, index + 1).filter((item) => item.stage === 'review').length}`
      : STAGE_LABEL[column.stage],
  );

  return (
    <div className="mt-6 grid gap-5">
      <section className={accentPanel}>
        <h2 className="text-subtitle font-semibold">Change over time</h2>
        <p className="mt-2 text-ink-soft">
          The questions marked as tracked are asked word for word in every round. This compares the baseline with each
          review round, so you can see whether priorities, adoption and barriers have moved.
        </p>
        <p className="mt-2 text-meta text-ink-soft">
          Responses are anonymous, so each round is a separate picture of the industry — this compares pictures, not the
          same people over time. Check <strong>who answered</strong> below before reading a change as a change of mind:
          a different mix of respondents moves the numbers too. Figures from fewer than {THIN} people are greyed.
        </p>
      </section>

      {!comparison.hasBaseline && (
        <p className={`${card} text-ink-soft`}>
          No baseline round yet. When the pilot is finished, go to <strong>Question wording</strong> and press{' '}
          <strong>Start the baseline</strong>. Everything here is measured against it.
        </p>
      )}
      {comparison.hasBaseline && !comparison.hasReview && (
        <p className={`${card} text-ink-soft`}>
          The baseline is collecting. Change appears here once a review round has responses — usually mid-project.
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
                        block.rows.map((row) => ({ label: row.label, values: row.values })),
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
                    input={block.rows.map((row) => ({ label: row.label, values: row.values }))}
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
                          <span className="block font-normal">n = {block.answered[index] ?? 0}</span>
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
                    {block.rows.map((row) => (
                      <tr key={row.id} className="border-b border-line last:border-0">
                        <th scope="row" className="py-2 pr-3 text-left font-normal">
                          {row.label}
                        </th>
                        {row.values.map((value, index) => {
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
                    ))}
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
