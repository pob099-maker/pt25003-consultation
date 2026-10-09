/** Identifier for one of the value-chain perspectives a respondent can pick. */
export type RoleId =
  | 'grower'
  | 'farm_manager'
  | 'contractor'
  | 'processor'
  | 'machinery'
  | 'adviser'
  | 'researcher'
  | 'industry_body';

export interface Option {
  readonly id: string;
  readonly label: string;
  /** Short plain-English gloss shown under the label for anything technical. */
  readonly help?: string;
}

export interface ScalePoint {
  readonly value: number;
  readonly label: string;
  /**
   * An answer that sits beside the scale rather than on it, such as "tried it
   * and stopped" next to the steps of taking something up. It is counted and
   * shown, but never averaged or charted with the steps: as a 6 it would read
   * as further along than doing it across the whole operation.
   */
  readonly offScale?: boolean;
}

/**
 * A box under a tick list or a single choice, for a few words of the
 * respondent's own: an example, or the name of the thing they picked. It is
 * part of the same question, so it is numbered, exported and read with it.
 */
export interface QuestionNote {
  readonly label: string;
  readonly rows?: number;
}

interface QuestionBase {
  readonly id: string;
  readonly prompt: string;
  readonly help?: string;
  /** Every question is optional unless this is true. Only role is required. */
  readonly required?: boolean;
  /**
   * Asked word-for-word in every round, and locked against editing, so the
   * baseline can be compared with every review that follows. Changing the
   * wording or the options of a tracked question — even adding an option,
   * which draws ticks away from the others — breaks that comparison.
   */
  readonly tracking?: boolean;
  /**
   * How a person would raise this in conversation. The interviewer screen shows
   * this instead of reading the question out; anything missing falls back to
   * the question itself and a sensible probe for its kind.
   */
  readonly guide?: {
    /** A natural way in. */
    readonly open?: string;
    /** One follow-up, to get past the first answer. */
    readonly probe?: string;
  };
}

/**
 * Where a round sits in the evaluation.
 * - pilot: internal testing; never compared with anything
 * - baseline: the starting point every later round is measured against
 * - interim: a short check between the full rounds, after the project's focus
 *   shifts. It asks only what the team picks, usually rows the project has just
 *   taken on, and is the starting point for anything first asked in it. It
 *   never resets a starting point something already has.
 * - review: a later round, which also asks what people saw and changed
 */
export type RoundStage = 'pilot' | 'baseline' | 'interim' | 'review';

export type Question =
  | (QuestionBase & {
      readonly kind: 'multi';
      readonly options: readonly Option[];
      readonly allowOther?: boolean;
      readonly note?: QuestionNote;
    })
  | (QuestionBase & {
      readonly kind: 'single';
      readonly options: readonly Option[];
      /** Offered once a choice is made, so the words always go with an answer. */
      readonly note?: QuestionNote;
    })
  | (QuestionBase & {
      readonly kind: 'text';
      readonly placeholder?: string;
      readonly rows?: number;
      /**
       * A text answer entered some other way than typing freely. 'linkCode' is
       * the anonymous follow-up code, built from three fixed pieces so it comes
       * out the same every time; it is stored as text, never analysed as a
       * comment.
       */
      readonly entry?: 'linkCode';
    })
  | (QuestionBase & {
      readonly kind: 'rating';
      readonly rows: readonly Option[];
      readonly scale: readonly ScalePoint[];
      /**
       * Show the words for every point, not just the two ends. Right for a
       * scale of distinct stages, such as where somebody is with a practice,
       * where nobody can pick 3 without knowing what 3 means.
       */
      readonly labelEveryStep?: boolean;
      /**
       * A watch list. A later round may add a row, or stop asking one, and
       * nothing else: the prompt, the scale and every row already asked stay
       * word for word. That is safe here and nowhere else, because each row is
       * rated on its own, so a new row does not move the answers to the
       * others. In a tick list it would, which is why those stay locked. A row
       * is compared from the round it was first asked in.
       */
      readonly openRows?: boolean;
      /**
       * A last row the respondent names for themselves, for whatever the list
       * missed. Never compared across rounds, since each person's is a
       * different thing, but it is where new technology shows up first.
       */
      readonly allowOther?: boolean;
    })
  | (QuestionBase & {
      readonly kind: 'rank';
      readonly count: number;
      /** Choices come from what the respondent ticked in this question. */
      readonly sourceQuestionId: string;
      readonly fallbackOptions: readonly Option[];
    });

export interface Section {
  readonly id: string;
  readonly title: string;
  readonly intro?: string;
  readonly questions: readonly Question[];
}

export interface RoleOption extends Option {
  readonly id: RoleId;
  /** Which role-specific section this perspective leads to. */
  readonly pathway: string;
}

export interface Questionnaire {
  /** Consultation round. Historic responses keep the round they were taken in. */
  readonly roundId: string;
  readonly roundLabel: string;
  readonly stage: RoundStage;
  readonly roles: readonly RoleOption[];
  readonly regions: readonly Option[];
  /** Sections shown to everybody, before the role-specific pathway. */
  readonly core: readonly Section[];
  /** Role-specific sections, keyed by pathway id. */
  readonly pathways: Readonly<Record<string, Section>>;
  /**
   * Shown only in review rounds: whether people saw anything from the project
   * and whether it changed what they do. There is nothing to react to at
   * baseline, so asking there would only collect noise.
   */
  readonly followUp: readonly Section[];
  /** Sections shown to everybody, after the role-specific pathway. */
  readonly projectDesign: readonly Section[];
  /** Ways to stay involved that are offered to everybody. */
  readonly interestOptions: readonly Option[];
  /** Ways to help that only make sense for one part of the chain, by pathway. */
  readonly pathwayInterests: Readonly<Record<string, readonly Option[]>>;
  readonly contactMethods: readonly Option[];
}

export type Answer =
  | {
      readonly kind: 'multi';
      readonly values: readonly string[];
      readonly other?: string;
      /**
       * In an interview, the subset of `values` that only came up after the
       * interviewer read the list. Everything in `values` was mentioned;
       * anything not in here was raised unprompted — which is the stronger
       * finding, and the one a form cannot measure.
       */
      readonly prompted?: readonly string[];
      /** What was written in the question's own box, if it has one. */
      readonly note?: string;
    }
  | { readonly kind: 'single'; readonly value: string; readonly note?: string }
  | { readonly kind: 'text'; readonly value: string }
  | {
      readonly kind: 'rating';
      readonly values: Readonly<Record<string, number>>;
      /** What somebody wrote for the row they named themselves. Its step is `values.other`. */
      readonly other?: string;
    }
  | { readonly kind: 'rank'; readonly values: readonly string[] };

export type AnswerMap = Readonly<Record<string, Answer>>;

export type CollectionMethod =
  | 'online'
  | 'interview_in_person'
  | 'interview_video'
  | 'interview_phone'
  | 'workshop';

/** Anonymous consultation data. Carries nothing that identifies a person. */
export interface ConsultationResponse {
  readonly id: string;
  readonly roundId: string;
  readonly role: RoleId | null;
  readonly pathway: string | null;
  readonly regions: readonly string[];
  readonly regionOther: string;
  readonly answers: AnswerMap;
  readonly startedAt: string;
  readonly submittedAt: string;
  /** Whole-consultation duration in seconds, for the completion-time figure. */
  readonly durationSeconds: number;
  readonly isTestData: boolean;
  /** How it was collected. People tell a person different things than a form. */
  readonly method: CollectionMethod;
  /** The staff member, for an interview. Staff identity, never the respondent's. */
  readonly collectedBy: string | null;
  /** A spoken consent was read and agreed to, for an interview. */
  readonly consentVerbal: boolean | null;
  /** The live session a workshop answer came from. */
  readonly sessionId: string | null;
  /**
   * The labelled link it came in by, such as the magazine or a newsletter, from
   * the fixed list in services/sources.ts. A channel, never a person, and null
   * for anything that did not arrive by a labelled link.
   */
  readonly source: string | null;
}

/**
 * Optional contact and expression-of-interest data. Deliberately carries no
 * key back to the anonymous response: the two are separate records so that
 * nothing in the interface, or in an export, can re-identify an answer set.
 */
export interface ContactRecord {
  readonly id: string;
  readonly roundId: string;
  readonly interests: readonly string[];
  readonly name: string;
  readonly organisation: string;
  readonly broadRole: string;
  readonly region: string;
  readonly email: string;
  readonly phone: string;
  readonly preferredContactMethod: string;
  readonly preferredContactTime: string;
  readonly comments: string;
  readonly submittedAt: string;
  readonly isTestData: boolean;
  /** The labelled link it came in by, as for a response. */
  readonly source: string | null;
}

export type Result<T> = { readonly success: true; readonly data: T } | { readonly success: false; readonly error: string };
