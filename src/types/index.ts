/** Identifier for one of the value-chain perspectives a respondent can pick. */
export type RoleId =
  | 'grower'
  | 'farm_manager'
  | 'contractor'
  | 'processor'
  | 'machinery'
  | 'technology'
  | 'adviser'
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
}

interface QuestionBase {
  readonly id: string;
  readonly prompt: string;
  readonly help?: string;
  /** Every question is optional unless this is true. Only role is required. */
  readonly required?: boolean;
}

export type Question =
  | (QuestionBase & { readonly kind: 'multi'; readonly options: readonly Option[]; readonly allowOther?: boolean })
  | (QuestionBase & { readonly kind: 'single'; readonly options: readonly Option[] })
  | (QuestionBase & { readonly kind: 'text'; readonly placeholder?: string; readonly rows?: number })
  | (QuestionBase & { readonly kind: 'rating'; readonly rows: readonly Option[]; readonly scale: readonly ScalePoint[] })
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
  readonly roles: readonly RoleOption[];
  readonly regions: readonly Option[];
  /** Sections shown to everybody, before the role-specific pathway. */
  readonly core: readonly Section[];
  /** Role-specific sections, keyed by pathway id. */
  readonly pathways: Readonly<Record<string, Section>>;
  /** Sections shown to everybody, after the role-specific pathway. */
  readonly projectDesign: readonly Section[];
  /** Ways to stay involved that are offered to everybody. */
  readonly interestOptions: readonly Option[];
  /** Ways to help that only make sense for one part of the chain, by pathway. */
  readonly pathwayInterests: Readonly<Record<string, readonly Option[]>>;
  readonly contactMethods: readonly Option[];
}

export type Answer =
  | { readonly kind: 'multi'; readonly values: readonly string[]; readonly other?: string }
  | { readonly kind: 'single'; readonly value: string }
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'rating'; readonly values: Readonly<Record<string, number>> }
  | { readonly kind: 'rank'; readonly values: readonly string[] };

export type AnswerMap = Readonly<Record<string, Answer>>;

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
}

export type Result<T> = { readonly success: true; readonly data: T } | { readonly success: false; readonly error: string };
