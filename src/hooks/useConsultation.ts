import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { STORAGE_KEYS, readJson, removeKey, writeJson } from '../lib/storage';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { recordProgress } from '../services/progress';
import type { Answer, AnswerMap, Questionnaire, RoleId, Section } from '../types';

export interface Draft {
  /** Identifies this session to the progress table. Never shown, never linked
   *  to the answers, and random enough that nobody can guess somebody else's. */
  readonly progressId: string;
  readonly startedAt: string;
  readonly roundId: string;
  readonly role: RoleId | null;
  readonly regions: readonly string[];
  readonly regionOther: string;
  readonly answers: AnswerMap;
  readonly stepIndex: number;
}

const emptyDraft = (questionnaire: Questionnaire): Draft => ({
  progressId: crypto.randomUUID(),
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

export interface ConsultationOptions {
  /** Where the draft is kept. Interviews use their own key. */
  readonly storageKey?: string;
  /** Whether to record how far the session got. Off for interviews. */
  readonly trackProgress?: boolean;
}

export const useConsultation = (
  questionnaire: Questionnaire = DEFAULT_QUESTIONNAIRE,
  { storageKey = STORAGE_KEYS.draft, trackProgress = true }: ConsultationOptions = {},
) => {
  const [draft, setDraft] = useState<Draft>(() => {
    const saved = readJson<Draft>(storageKey);
    // A saved draft from an earlier round is not resumable: the questions have
    // changed underneath it, so start clean rather than mix rounds.
    if (saved !== null && saved.roundId === questionnaire.roundId) {
      return saved.progressId === undefined ? { ...saved, progressId: crypto.randomUUID() } : saved;
    }
    return emptyDraft(questionnaire);
  });
  const isResumed = useRef(readJson<Draft>(storageKey) !== null);

  useEffect(() => {
    writeJson(storageKey, draft);
  }, [draft, storageKey]);

  /** Kept in a ref so the progress ping reads the current draft without
   *  every callback that touches it being rebuilt on each keystroke. */
  const latest = useRef(draft);
  latest.current = draft;

  const pathwayOf = useCallback(
    (role: RoleId | null) => questionnaire.roles.find((entry) => entry.id === role)?.pathway ?? null,
    [questionnaire.roles],
  );

  const pathway = useMemo(() => pathwayOf(draft.role), [pathwayOf, draft.role]);

  const steps = useMemo<readonly Step[]>(() => {
    const roleSection = pathway === null ? null : (questionnaire.pathways[pathway] ?? null);
    const sectionSteps = [
      ...questionnaire.core,
      ...(roleSection === null ? [] : [roleSection]),
      ...(questionnaire.stage === 'review' ? questionnaire.followUp : []),
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

  /** Instrumentation only: how far this session got, on which branch. Nothing
   *  that was typed goes with it. See services/progress.ts. */
  const ping = useCallback(
    (stepIndex: number, completed: boolean) => {
      if (!trackProgress) return;
      const current = latest.current;
      recordProgress({
        id: current.progressId,
        roundId: current.roundId,
        role: current.role,
        pathway: pathwayOf(current.role),
        stepIndex,
        stepId: steps[stepIndex]?.id ?? '',
        stepCount: steps.length,
        startedAt: current.startedAt,
        completed,
      });
    },
    [steps, pathwayOf, trackProgress],
  );

  const goTo = useCallback(
    (index: number) => {
      const stepIndex = Math.max(0, Math.min(index, steps.length - 1));
      setDraft((current) => ({ ...current, stepIndex }));
      ping(stepIndex, false);
      window.scrollTo({ top: 0 });
    },
    [steps.length, ping],
  );

  const next = useCallback(() => goTo(stepIndex + 1), [goTo, stepIndex]);
  const back = useCallback(() => goTo(stepIndex - 1), [goTo, stepIndex]);

  const reset = useCallback(() => {
    removeKey(storageKey);
    setDraft(emptyDraft(questionnaire));
  }, [questionnaire, storageKey]);

  return {
    draft,
    pathway,
    ping,
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
