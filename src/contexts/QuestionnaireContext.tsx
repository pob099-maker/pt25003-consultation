import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { activeQuestionnaire } from '../services/rounds';
import type { Questionnaire } from '../types';

const QuestionnaireContext = createContext<Questionnaire>(DEFAULT_QUESTIONNAIRE);

export const useQuestionnaire = (): Questionnaire => useContext(QuestionnaireContext);

/**
 * Serves the questionnaire compiled into the bundle immediately, then swaps in
 * the active round's wording if the backend has one. The app is never blocked
 * on that call: an unreachable backend simply means the built-in wording.
 */
export const QuestionnaireProvider = ({ children }: { children: ReactNode }) => {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire>(DEFAULT_QUESTIONNAIRE);

  useEffect(() => {
    let cancelled = false;
    void activeQuestionnaire().then((loaded) => {
      if (!cancelled) setQuestionnaire(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <QuestionnaireContext.Provider value={questionnaire}>{children}</QuestionnaireContext.Provider>;
};
