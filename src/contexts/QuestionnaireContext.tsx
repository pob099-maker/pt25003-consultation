import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { currentProject } from '../content/projects';
import { applyRound, reportingFrame, type RoundConfig } from '../services/roundRules';
import { cachedActiveRound, fetchActiveRound, rememberActiveRound } from '../services/rounds';
import type { Questionnaire } from '../types';

/**
 * Where the questions on screen came from.
 * - loading: the server has not answered yet. Showing the round last seen on
 *   this device, or the questions compiled into the app if there is none.
 * - live: the server has said which round is live.
 * - offline: the server could not be reached. Still showing the round last seen.
 */
export type QuestionnaireStatus = 'loading' | 'live' | 'offline';

export interface QuestionnaireState {
  readonly questionnaire: Questionnaire;
  /** The live round itself, when there is one. */
  readonly round: RoundConfig | null;
  readonly status: QuestionnaireStatus;
}

const questionsFor = (round: RoundConfig | null): Questionnaire => {
  const base = currentProject().questionnaire;
  return round === null ? base : applyRound(base, round);
};

const initialState = (): QuestionnaireState => {
  const cached = cachedActiveRound();
  return { questionnaire: questionsFor(cached), round: cached, status: 'loading' };
};

const QuestionnaireContext = createContext<QuestionnaireState>({
  questionnaire: currentProject().questionnaire,
  round: null,
  status: 'loading',
});

export const useQuestionnaire = (): Questionnaire => useContext(QuestionnaireContext).questionnaire;

export const useQuestionnaireState = (): QuestionnaireState => useContext(QuestionnaireContext);

/**
 * Every question the project has, worded the way the live round words them,
 * for anything that looks up a question the live round may not be asking: a
 * workshop or a group record begun in an earlier round, while an interim check
 * asks only a handful.
 */
export const useStableQuestionnaire = (): Questionnaire => {
  const { round } = useContext(QuestionnaireContext);
  return useMemo(
    () => reportingFrame(currentProject().questionnaire, round === null ? [] : [round], round?.roundId ?? null),
    [round],
  );
};

/**
 * Starts from the round last seen on this device, so a reload shows the right
 * questions straight away, then asks the server which round is live. The app
 * is never blocked on that call: with no signal it carries on with what it has.
 */
export const QuestionnaireProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<QuestionnaireState>(initialState);

  useEffect(() => {
    let cancelled = false;
    void fetchActiveRound().then((result) => {
      if (cancelled) return;
      if (result.state === 'live') {
        rememberActiveRound(result.round);
        setState({ questionnaire: questionsFor(result.round), round: result.round, status: 'live' });
      } else {
        setState((current) => ({ ...current, status: 'offline' }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <QuestionnaireContext.Provider value={state}>{children}</QuestionnaireContext.Provider>;
};
