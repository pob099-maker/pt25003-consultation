import { useMemo } from 'react';
import { useQuestionnaire } from '../../contexts/QuestionnaireContext';
import { currentProject } from '../../content/projects';
import { reportingFrame, type RoundConfig } from '../../services/rounds';
import type { ConsultationResponse, Questionnaire } from '../../types';

/**
 * The questionnaire the admin screens and the export report against: every
 * question and every row any round has asked, worded the way the round
 * collecting now words it, plus anything the answers point at that no round
 * defines any more.
 *
 * Built from the questions every round starts from, never from the round that
 * is collecting now. An interim check asks only a handful, and reporting from
 * it, even for the moment the rounds take to load, would drop every other
 * answer from the export.
 */
export const useReportingFrame = (
  responses: readonly ConsultationResponse[],
  rounds: readonly RoundConfig[],
): Questionnaire => {
  const active = useQuestionnaire();
  return useMemo(
    () => reportingFrame(currentProject().questionnaire, rounds, active.roundId, responses),
    [rounds, active.roundId, responses],
  );
};
