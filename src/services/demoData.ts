import type {
  Answer,
  AnswerMap,
  CollectionMethod,
  ConsultationResponse,
  Question,
  Questionnaire,
  RoleId,
} from '../types';
import type { RoundInfo } from './change';
import { COVERED_ID, noteId } from './interviewNotes';

/**
 * Invented responses for the demonstration site, so somebody exploring it sees
 * what a real consultation looks like: a baseline and a review round, a few
 * dozen people in each, collected online, by interview and in workshops.
 *
 * Nobody in here is real. It is generated, not stored, and deterministic, so
 * the demo shows the same picture every time it is opened. It lives only in
 * the browser and never reaches a database.
 */

export const DEMO_BASELINE = 'demo-baseline';
export const DEMO_REVIEW = 'demo-review';

export const DEMO_ROUNDS: readonly RoundInfo[] = [
  { roundId: DEMO_BASELINE, label: 'Baseline (demo)', stage: 'baseline' },
  { roundId: DEMO_REVIEW, label: 'Mid-project review (demo)', stage: 'review' },
];

/** Small, seeded, good enough: the same numbers every time. */
const random = (seed: number) => {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hash = (text: string): number => {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value >>> 0) / 4294967296;
};

type Rng = () => number;

const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)] as T;

const weighted = <T>(rng: Rng, items: readonly (readonly [T, number])[]): T => {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * total;
  for (const [item, weight] of items) {
    roll -= weight;
    if (roll <= 0) return item;
  }
  return (items.at(-1) as readonly [T, number])[0];
};

/** How likely each constraint is to be named, and how that moved by the review. */
const CONSTRAINT_BIAS: Readonly<Record<string, readonly [number, number]>> = {
  harvest: [0.62, 0.72],
  skills: [0.58, 0.34],
  storage: [0.32, 0.3],
  grading: [0.28, 0.4],
  maintenance: [0.36, 0.32],
  data: [0.2, 0.36],
  harvest_logistics: [0.25, 0.22],
  planting: [0.22, 0.2],
};

/** Rating rows that improved or slipped between the rounds, by a little. */
const RATING_SHIFT: Readonly<Record<string, number>> = {
  harvest_efficiency: 0.4,
  sensors: 0.6,
  training: -0.5,
  optical_sorting: 0.5,
};

const TEXT_POOL: Readonly<Record<string, readonly string[]>> = {
  q4_bad_season: [
    'Harvest runs late into winter and we lose quality in the ground.',
    'Wet harvest, the machines bog and the bruising goes through the roof.',
    'We can’t get operators, so the harvester sits idle while the crop waits.',
    'Breakdowns at peak — a part takes a week and we fall behind everyone.',
    'Everything lands at once: planting, spraying and the last of the harvest.',
    'Storage fills up and we end up selling at the wrong time.',
  ],
  q6_first_opportunities: [
    'Damage at harvest — it costs us more than anything else.',
    'Training operators. The machines are there, the people aren’t.',
    'Grading on the go so we know what we’ve got before it hits the shed.',
    'Better data from the machines we already own.',
    'Anything that cuts labour in the packhouse.',
  ],
  pd_most_useful: [
    'See it working on a farm like mine, not a research station.',
    'Honest numbers on what it costs and what it saves.',
    'Short videos I can watch in the ute.',
    'A field day at harvest, not in the off season.',
  ],
  pd_avoid: [
    'Long reports nobody reads.',
    'Meetings in the middle of harvest.',
    'Trials that only work on the best paddock.',
  ],
  fu_what: [
    'Changed the harvester settings after the field day.',
    'Started logging damage at the grader.',
    'Talked to our contractor about the sorting trial results.',
  ],
};

const GENERIC_TEXT = [
  'Hard to say — depends on the season.',
  'Cost is the big one for us.',
  'We’d need to see it first.',
  'Time. There’s never enough of it at the right time of year.',
];

const NOTES = [
  '"If I can see it working on a neighbour’s place, I’ll try it."',
  'Runs a mixed operation; potatoes are about a third of the business.',
  '"The machines are fine. It’s finding someone to drive them."',
  'Keen to host a demonstration next season.',
];

const ROLE_MIX: readonly (readonly [RoleId, number])[] = [
  ['grower', 38],
  ['farm_manager', 14],
  ['contractor', 10],
  ['processor', 12],
  ['machinery', 8],
  ['technology', 5],
  ['adviser', 8],
  ['industry_body', 5],
];

const METHOD_MIX: readonly (readonly [CollectionMethod, number])[] = [
  ['online', 55],
  ['interview_phone', 18],
  ['interview_in_person', 10],
  ['workshop', 17],
];

const DEMO_STAFF = '00000000-0000-4000-a000-000000000001';
const DEMO_WORKSHOP = '00000000-0000-4000-b000-000000000001';

const optionsOf = (question: Question): readonly string[] => {
  if (question.kind === 'multi' || question.kind === 'single') return question.options.map((option) => option.id);
  if (question.kind === 'rank') return question.fallbackOptions.map((option) => option.id);
  if (question.kind === 'rating') return question.rows.map((row) => row.id);
  return [];
};

const answerFor = (question: Question, rng: Rng, review: boolean, answers: AnswerMap): Answer | undefined => {
  const choices = optionsOf(question).filter((id) => id !== 'other' && id !== 'none' && id !== 'no_say');
  switch (question.kind) {
    case 'multi': {
      if (rng() < 0.08) return undefined;
      const values = choices.filter((id) => {
        const bias = CONSTRAINT_BIAS[id];
        const chance =
          question.id === 'q1_constraints' && bias !== undefined
            ? bias[review ? 1 : 0]
            : 0.18 + hash(question.id + id) * 0.3;
        return rng() < chance;
      });
      const chosen = values.length > 0 ? values : [pick(rng, choices)];
      return { kind: 'multi', values: chosen.slice(0, 6), other: '' };
    }
    case 'single':
      if (rng() < 0.06 || choices.length === 0) return undefined;
      return {
        kind: 'single',
        value: weighted(
          rng,
          choices.map((id, index) => [id, choices.length - index * 0.6] as const),
        ),
      };
    case 'rank': {
      const named = answers[question.sourceQuestionId];
      const pool = named?.kind === 'multi' && named.values.length > 0 ? [...named.values] : [...choices];
      const ranked = pool.sort(
        (a, b) =>
          (CONSTRAINT_BIAS[b]?.[review ? 1 : 0] ?? 0.1) +
          rng() * 0.3 -
          ((CONSTRAINT_BIAS[a]?.[review ? 1 : 0] ?? 0.1) + rng() * 0.3),
      );
      return ranked.length === 0 ? undefined : { kind: 'rank', values: ranked.slice(0, question.count) };
    }
    case 'rating': {
      const values: Record<string, number> = {};
      for (const row of choices) {
        if (rng() < 0.1) continue;
        const mean = 2.4 + hash(row) * 1.9 + (review ? (RATING_SHIFT[row] ?? 0) : 0);
        const score = Math.round(mean + (rng() + rng() + rng() - 1.5) * 1.3);
        values[row] = Math.max(1, Math.min(5, score));
      }
      return Object.keys(values).length === 0 ? undefined : { kind: 'rating', values };
    }
    case 'text': {
      if (rng() < 0.45) return undefined;
      return { kind: 'text', value: pick(rng, TEXT_POOL[question.id] ?? GENERIC_TEXT) };
    }
  }
};

const build = (questionnaire: Questionnaire, roundId: string, count: number, seed: number): ConsultationResponse[] => {
  const rng = random(seed);
  const review = roundId === DEMO_REVIEW;
  const daysBack = review ? 20 : 200;
  const regionIds = questionnaire.regions.map((region) => region.id).filter((id) => id !== 'no_say' && id !== 'other');
  return Array.from({ length: count }, (_, index) => {
    const role = weighted(rng, ROLE_MIX);
    const pathway = questionnaire.roles.find((entry) => entry.id === role)?.pathway ?? null;
    const method = weighted(rng, METHOD_MIX);
    const sections = [
      ...questionnaire.core,
      ...(pathway === null || questionnaire.pathways[pathway] === undefined ? [] : [questionnaire.pathways[pathway]]),
      ...(review ? questionnaire.followUp : []),
      ...(method === 'workshop' ? [] : questionnaire.projectDesign),
    ];
    const answers: Record<string, Answer> = {};
    for (const question of sections.flatMap((section) => section?.questions ?? [])) {
      // A workshop only puts the shared questions to the room.
      if (method === 'workshop' && !questionnaire.core.some((section) => section.questions.includes(question)))
        continue;
      const answer = answerFor(question, rng, review, answers);
      if (answer !== undefined) answers[question.id] = answer;
    }
    if (method.startsWith('interview_')) {
      const q1 = answers.q1_constraints;
      if (q1?.kind === 'multi' && q1.values.length > 1)
        answers.q1_constraints = { ...q1, prompted: q1.values.slice(-1) };
      if (rng() < 0.5)
        answers[noteId(questionnaire.core[0]?.id ?? 'general')] = { kind: 'text', value: pick(rng, NOTES) };
      if (rng() < 0.3) answers[COVERED_ID] = { kind: 'multi', values: ['q4_bad_season'] };
    }
    const minutes =
      method === 'workshop' ? 25 : method === 'online' ? 6 + Math.floor(rng() * 9) : 8 + Math.floor(rng() * 10);
    const submitted = new Date();
    submitted.setDate(submitted.getDate() - daysBack + Math.floor((index / count) * 18));
    submitted.setHours(8 + Math.floor(rng() * 10), Math.floor(rng() * 60), 0, 0);
    return {
      id: `00000000-0000-4${review ? '1' : '0'}00-8000-${String(index + 1).padStart(12, '0')}`,
      roundId,
      role,
      pathway,
      regions: [pick(rng, regionIds)],
      regionOther: '',
      answers,
      startedAt: new Date(submitted.getTime() - minutes * 60_000).toISOString(),
      submittedAt: submitted.toISOString(),
      durationSeconds: minutes * 60,
      // Not flagged as test data: the demo is meant to be read as a real
      // consultation, and the change view leaves test data out.
      isTestData: false,
      method,
      collectedBy: method.startsWith('interview_') ? DEMO_STAFF : null,
      consentVerbal: method.startsWith('interview_') ? true : null,
      sessionId: method === 'workshop' ? DEMO_WORKSHOP : null,
    };
  });
};

/** A baseline of 45 and a review of 38, newest first. */
export const demoResponses = (questionnaire: Questionnaire): readonly ConsultationResponse[] =>
  [...build(questionnaire, DEMO_BASELINE, 45, 2026), ...build(questionnaire, DEMO_REVIEW, 38, 2027)].sort((a, b) =>
    b.submittedAt.localeCompare(a.submittedAt),
  );
