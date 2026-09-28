import { useEffect, useMemo, useState } from 'react';
import { useQuestionnaire } from '../../contexts/QuestionnaireContext';
import { currentProject } from '../../content/projects';
import { loadAllRounds, reportingFrame, type RoundConfig } from '../../services/rounds';
import type { ConsultationResponse, Questionnaire } from '../../types';

/**
 * The questionnaire the admin screens and the export report against: every
 * question and every row any round has asked, worded the way the round
 * collecting now words it.
 *
 * Reporting from the round that is collecting now, as these screens used to,
 * would drop the history of anything since stopped or retired: a practice the
 * project moved away from would vanish from the export along with its
 * baseline.
 */
export const useReportingFrame = (responses: readonly ConsultationResponse[]): Questionnaire => {
  const active = useQuestionnaire();
  const [rounds, setRounds] = useState<readonly RoundConfig[]>([]);

  useEffect(() => {
    let cancelled = false;
    void loadAllRounds().then((loaded) => {
      if (!cancelled) setRounds(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Until the rounds arrive, the round collecting now is the best there is.
  return useMemo(
    () =>
      rounds.length === 0 ? active : reportingFrame(currentProject().questionnaire, rounds, active.roundId, responses),
    [rounds, active, responses],
  );
};
