import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { STORAGE_KEYS, readJson, removeKey, writeJson } from '../lib/storage';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import type { Answer, AnswerMap, Questionnaire, RoleId, Section } from '../types';

export interface Draft {
  readonly startedAt: string;
  readonly roundId: string;
  readonly role: RoleId | null;
  readonly regions: readonly string[];
  readonly regionOther: string;
  readonly answers: AnswerMap;
  readonly stepIndex: number;
}

const emptyDraft = (questionnaire: Questionnaire): Draft => ({
  startedAt: new Date().toISOString(),
  roundId: questionnaire.roundId,
  role: null,
  regions: [],
  regionOther: '',
  answers: {},
  stepIndex: 0,
});

export interface Step {
  readonly id: string;
  readonly title: string;
  readonly intro?: string;
  readonly section: Section | null;
}

const ABOUT_YOU: Step = {
  id: 'about_you',
  title: 'About your perspective',
  intro: 'Two quick questions so the consultation only asks you about things you actually work with.',
  section: null,
};

const STAY_INVOLVED: Step = { id: 'stay_involved', title: 'Optional: Stay involved', section: null };

export const useConsultation = (questionnaire: Questionnaire = DEFAULT_QUESTIONNAIRE) => {
  const [draft, setDraft] = useState<Draft>(() => {
    const saved = readJson<Draft>(STORAGE_KEYS.draft);
    // A saved draft from an earlier round is not resumable: the questions have
    // changed underneath it, so start clean rather than mix rounds.
    if (saved !== null && saved.roundId === questionnaire.roundId) return saved;
    return emptyDraft(questionnaire);
  });
  const isResumed = useRef(readJson<Draft>(STORAGE_KEYS.draft) !== null);

  useEffect(() => {
    writeJson(STORAGE_KEYS.draft, draft);
  }, [draft]);

  const pathway = useMemo(
    () => questionnaire.roles.find((role) => role.id === draft.role)?.pathway ?? null,
    [questionnaire.roles, draft.role],
  );

  const steps = useMemo<readonly Step[]>(() => {
    const roleSection = pathway === null ? null : (questionnaire.pathways[pathway] ?? null);
    const sectionSteps = [
      ...questionnaire.core,
      ...(roleSection === null ? [] : [roleSection]),
      ...questionnaire.projectDesign,
    ].map((section) => ({ id: section.id, title: section.title, intro: section.intro, section }));
    return [ABOUT_YOU, ...sectionSteps, STAY_INVOLVED];
  }, [pathway, questionnaire]);

  const stepIndex = Math.min(draft.stepIndex, steps.length - 1);
  const step = steps[stepIndex] ?? ABOUT_YOU;

  const setAnswer = useCallback((questionId: string, answer: Answer | undefined) => {
    setDraft((current) => {
      const answers = { ...current.answers };
      if (answer === undefined) delete answers[questionId];
      else answers[questionId] = answer;
      return { ...current, answers };
    });
  }, []);

  const setRole = useCallback((role: RoleId) => setDraft((current) => ({ ...current, role })), []);
  const setRegions = useCallback((regions: readonly string[]) => setDraft((current) => ({ ...current, regions })), []);
  const setRegionOther = useCallback((regionOther: string) => setDraft((current) => ({ ...current, regionOther })), []);

  const goTo = useCallback(
    (index: number) => {
      setDraft((current) => ({ ...current, stepIndex: Math.max(0, Math.min(index, steps.length - 1)) }));
      window.scrollTo({ top: 0 });
    },
    [steps.length],
  );

  const next = useCallback(() => goTo(stepIndex + 1), [goTo, stepIndex]);
  const back = useCallback(() => goTo(stepIndex - 1), [goTo, stepIndex]);

  const reset = useCallback(() => {
    removeKey(STORAGE_KEYS.draft);
    setDraft(emptyDraft(questionnaire));
  }, [questionnaire]);

  return {
    draft,
    pathway,
    steps,
    step,
    stepIndex,
    isResumed: isResumed.current,
    setAnswer,
    setRole,
    setRegions,
    setRegionOther,
    next,
    back,
    goTo,
    reset,
  };
};
