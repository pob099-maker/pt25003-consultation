import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { STORAGE_KEYS, readJson, removeKey, writeJson } from '../lib/storage';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { allQuestions } from '../content/lookup';
import { currentProject } from '../content/projects';
import { useQuestionnaireState } from '../contexts/QuestionnaireContext';
import { recordProgress } from '../services/progress';
import { asksFollowUp } from '../services/roundRules';
import type { FormLength } from '../services/formLength';
import type { Answer, AnswerMap, Questionnaire, RoleId, Section } from '../types';

export interface Draft {
  /** Identifies this session to the progress table. Never shown, never linked
   *  to the answers, and random enough that nobody can guess somebody else's. */
  readonly progressId: string;
  /** One id for the life of the draft, so the same answers sent twice are stored once. */
  readonly responseId: string;
  readonly startedAt: string;
  readonly roundId: string;
  /**
   * Whether roundId is the round the server said was live. A draft begun
   * before the server answered carries a stand-in, and takes the live round's
   * id when it arrives, rather than being thrown away for not matching.
   */
  readonly roundConfirmed: boolean;
  readonly role: RoleId | null;
  readonly regions: readonly string[];
  readonly regionOther: string;
  readonly answers: AnswerMap;
  readonly stepIndex: number;
  /**
   * Which step, by id. The index alone is not enough: the short and full
   * versions number their steps differently, so a place saved in one pointed
   * at a different section, or past the end, in the other. Null in drafts
   * written before it was kept.
   */
  readonly stepId: string | null;
  /** The version last used, so the landing page continues in it. Null for interviews and older drafts. */
  readonly length: FormLength | null;
}

const FIRST_STEP_ID = 'about_you';

const emptyDraft = (questionnaire: Questionnaire, confirmed: boolean): Draft => ({
  progressId: crypto.randomUUID(),
  responseId: crypto.randomUUID(),
  startedAt: new Date().toISOString(),
  roundId: questionnaire.roundId,
  roundConfirmed: confirmed,
  role: null,
  regions: [],
  regionOther: '',
  answers: {},
  stepIndex: 0,
  stepId: FIRST_STEP_ID,
  length: null,
});

/** A saved draft, brought up to date if an earlier version of the app wrote it. */
const resumeDraft = (saved: Partial<Draft>): Draft | null => {
  if (typeof saved.roundId !== 'string') return null;
  return {
    progressId: typeof saved.progressId === 'string' ? saved.progressId : crypto.randomUUID(),
    responseId: typeof saved.responseId === 'string' ? saved.responseId : crypto.randomUUID(),
    startedAt: typeof saved.startedAt === 'string' ? saved.startedAt : new Date().toISOString(),
    roundId: saved.roundId,
    roundConfirmed: saved.roundConfirmed === true,
    role: saved.role ?? null,
    regions: Array.isArray(saved.regions) ? saved.regions : [],
    regionOther: typeof saved.regionOther === 'string' ? saved.regionOther : '',
    answers: saved.answers ?? {},
    stepIndex: typeof saved.stepIndex === 'number' ? saved.stepIndex : 0,
    stepId: typeof saved.stepId === 'string' ? saved.stepId : null,
    length: saved.length === 'short' || saved.length === 'full' ? saved.length : null,
  };
};

/**
 * A saved draft worth offering to continue: one with something in it, from a
 * round still collecting. The form saves a draft the moment it opens, so
 * without the first check a glance at the first screen read as saved answers;
 * and a draft from a round that has closed is cleared as soon as the form opens.
 */
export const resumableDraft = (saved: Partial<Draft> | null, liveRoundId: string, live: boolean): Draft | null => {
  const draft = saved === null ? null : resumeDraft(saved);
  if (draft === null) return null;
  if (live && draft.roundConfirmed && draft.roundId !== liveRoundId) return null;
  const started =
    draft.role !== null ||
    draft.regions.length > 0 ||
    draft.regionOther !== '' ||
    Object.keys(draft.answers).length > 0 ||
    draft.stepIndex > 0;
  return started ? draft : null;
};

/**
 * Answers to questions the live round does not ask are dropped when a draft
 * takes the live round's id. They were given to questions shown before the
 * round was known, and kept, they would read as that round having asked them.
 * Keys that are not questions at all, such as interview notes, are kept.
 */
export const keepAsked = (live: Questionnaire, answers: AnswerMap): AnswerMap => {
  const asked = new Set(allQuestions(live).map((question) => question.id));
  const questions = new Set(allQuestions(currentProject().questionnaire).map((question) => question.id));
  return Object.fromEntries(Object.entries(answers).filter(([id]) => asked.has(id) || !questions.has(id)));
};

/**
 * Where a draft stands once the server has said which round is live. The same
 * round: carry on. A stand-in id: take the live one. A round that has since
 * closed: the questions changed underneath it, so start clean rather than mix
 * rounds. Kept apart from the hook so the rule can be tested on its own.
 */
export const settleDraft = (draft: Draft, live: Questionnaire): Draft => {
  if (draft.roundId === live.roundId) return draft.roundConfirmed ? draft : { ...draft, roundConfirmed: true };
  if (draft.roundConfirmed) return emptyDraft(live, true);
  return { ...draft, roundId: live.roundId, roundConfirmed: true, answers: keepAsked(live, draft.answers) };
};

export interface Step {
  readonly id: string;
  readonly title: string;
  readonly intro?: string;
  readonly section: Section | null;
}

/**
 * Where a draft picks up: at the step it was on, found by id. A step this
 * version does not have, which is a full-only section opened in the short
 * version, falls back to the number, and so to the step that follows it; so
 * does a draft from before ids were kept. Never the first unanswered question:
 * anybody may skip, and that sent them back over everything they had passed.
 */
export const resumeStep = (steps: readonly Step[], draft: Pick<Draft, 'stepId' | 'stepIndex'>): number => {
  const found = draft.stepId === null ? -1 : steps.findIndex((step) => step.id === draft.stepId);
  return found !== -1 ? found : Math.max(0, Math.min(draft.stepIndex, steps.length - 1));
};

const ABOUT_YOU: Step = {
  id: FIRST_STEP_ID,
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
  /** Which version is on screen, kept with the draft. Interviews keep theirs in the setup. */
  readonly length?: FormLength;
}

export const useConsultation = (
  questionnaire: Questionnaire = DEFAULT_QUESTIONNAIRE,
  { storageKey = STORAGE_KEYS.draft, trackProgress = true, length }: ConsultationOptions = {},
) => {
  const { questionnaire: live, status } = useQuestionnaireState();
  const [draft, setDraft] = useState<Draft>(() => {
    const saved = readJson<Partial<Draft>>(storageKey);
    // Always resumed at first. Which round is live may not be known yet: the
    // questions on screen can still be a stand-in, and comparing against them
    // here used to throw away the answers of anybody who reloaded the page.
    // settleDraft decides once the server has answered.
    const restored = saved === null ? null : resumeDraft(saved);
    return restored ?? emptyDraft(questionnaire, status === 'live');
  });
  const isResumed = useRef(readJson<Draft>(storageKey) !== null);

  useEffect(() => {
    writeJson(storageKey, draft);
  }, [draft, storageKey]);

  // Once the server has said which round is live, the draft takes it.
  useEffect(() => {
    if (status === 'live') setDraft((current) => settleDraft(current, live));
  }, [status, live]);

  useEffect(() => {
    if (length !== undefined) setDraft((current) => (current.length === length ? current : { ...current, length }));
  }, [length]);

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
      ...(asksFollowUp(questionnaire.stage) ? questionnaire.followUp : []),
      ...questionnaire.projectDesign,
    ].map((section) => ({ id: section.id, title: section.title, intro: section.intro, section }));
    return [ABOUT_YOU, ...sectionSteps, STAY_INVOLVED];
  }, [pathway, questionnaire]);

  const stepIndex = resumeStep(steps, draft);
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
      setDraft((current) => ({ ...current, stepIndex, stepId: steps[stepIndex]?.id ?? null }));
      ping(stepIndex, false);
      window.scrollTo({ top: 0 });
    },
    [steps, ping],
  );

  const next = useCallback(() => goTo(stepIndex + 1), [goTo, stepIndex]);
  const back = useCallback(() => goTo(stepIndex - 1), [goTo, stepIndex]);

  const reset = useCallback(() => {
    removeKey(storageKey);
    setDraft(emptyDraft(questionnaire, status === 'live'));
  }, [questionnaire, status, storageKey]);

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
