import type { Option, Questionnaire, ScalePoint, Section } from '../types';

const opts = (...pairs: readonly (readonly [string, string, string?])[]): readonly Option[] =>
  pairs.map(([id, label, help]) => (help === undefined ? { id, label } : { id, label, help }));

/**
 * Technology providers share the machinery branch: they sell into the same
 * businesses and are asked the same supply-side questions, then what they
 * offer. Advisers and researchers share a branch too, but are counted apart,
 * because an agronomist in a paddock and a researcher see different things.
 */
export const ROLES = [
  { id: 'grower', label: 'Grower: business owner', pathway: 'farm' },
  { id: 'farm_manager', label: 'Grower: farm manager, supervisor or machinery operator', pathway: 'farm' },
  { id: 'processor', label: 'Processor, packhouse or storage business', pathway: 'processor' },
  { id: 'adviser', label: 'Advisor, agronomist', pathway: 'adviser' },
  { id: 'contractor', label: 'Contractor', pathway: 'contractor' },
  { id: 'machinery', label: 'Machinery dealer, manufacturer, technology provider or service provider', pathway: 'machinery' },
  { id: 'researcher', label: 'Researcher, consultant or educator', pathway: 'adviser' },
  { id: 'industry_body', label: 'Industry body or other stakeholder', pathway: 'industry' },
] as const;

/**
 * The growing areas of docs/REGIONS.md, with the same ids, so the
 * consultation, the CRM and the scoreboard name places the same way. An area
 * is where the farm is; the region that looks after it is worked out from the
 * area (content/scoreboardSettings.ts), so regrouping areas into regions never
 * touches an answer. Each label starts with the state or states it covers, and
 * the towns under it settle the border cases: a grower at Holbrook, or on the
 * Victorian bank of the Murray at Echuca, finds their own town.
 *
 * Merging two areas later is easy; splitting one is not, so an area is only
 * as wide as the districts in it are alike.
 */
const REGIONS = opts(
  ['mallee-loxton', 'SA and Vic: Mallee and Riverland', 'Loxton, Pinnaroo, Parilla, Mildura, Swan Hill'],
  ['murray-bridge-adelaide-plains', 'SA: Murray Bridge and Adelaide Plains', 'Murray Bridge, Virginia, the Adelaide Hills'],
  ['mt-gambier-warrnambool', 'SA and Vic: South East SA and South West Victoria', 'Mt Gambier, Penola, Warrnambool'],
  ['ballarat', 'Vic: Ballarat and Central Highlands', 'Ballarat, Bungaree, Creswick'],
  ['gippsland-thorpdale', 'Vic: Gippsland', 'Thorpdale, Koo Wee Rup, West Gippsland'],
  ['nw-tas-sisters-creek', 'Tas: North West', 'Sisters Creek, Devonport, Smithton'],
  ['ne-tas-scottsdale', 'Tas: North East', 'Scottsdale'],
  ['midlands-longford', 'Tas: Midlands and the south', 'Longford, Cressy'],
  [
    'riverina',
    'NSW and Vic: Riverina and the Murray',
    'Griffith, Hay, Wagga Wagga, Holbrook, Albury, and the Victorian side of the Murray from Echuca to Wodonga',
  ],
  ['nsw-tablelands', 'NSW: Tablelands', 'Crookwell, Guyra'],
  ['nsw-coast', 'NSW: Coast', 'The coast and the ranges behind it'],
  ['atherton', 'Qld: Atherton Tablelands', 'Atherton, Tolga, Kairi'],
  ['lockyer-bundaberg', 'Qld: Lockyer Valley and Bundaberg', 'Gatton, the Lockyer Valley, Bundaberg'],
  ['south-west-wa', 'WA: South West', 'Manjimup, Pemberton, Busselton and Jindong, Myalup'],
  ['national', 'More than one region, or all of Australia'],
  ['other', 'Somewhere else'],
  ['no_say', 'Prefer not to say'],
);


/**
 * The process axis: where in the chain the trouble is. Question 1 uses it.
 *
 * Ids are canonical and shared — `harvest` here is the same harvest as
 * `harvest_efficiency` in AREAS below, and DOMAIN_TO_AREAS says so, so the
 * obvious cross-tab ("did the people who named harvesting also rate harvest
 * technology highly?") does not need a hand-built lookup at analysis time.
 */
const CONSTRAINTS = opts(
  ['land_prep', 'Ground preparation and bed forming'],
  ['planting', 'Planting'],
  ['monitoring', 'Crop monitoring and agronomy decisions'],
  ['irrigation', 'Irrigation operation, scheduling and automation'],
  ['crop_protection', 'Spraying and crop protection operations'],
  ['haulm', 'Haulm removal before harvest'],
  ['harvest', 'Harvesting'],
  ['harvest_logistics', 'In-field transport and harvest logistics'],
  ['receival', 'Receival'],
  ['grading', 'Washing, grading and sorting'],
  ['packing', 'Packing'],
  ['storage', 'Handling and storage'],
  ['maintenance', 'Machinery maintenance and reliability'],
  ['data', 'Record keeping, traceability, compliance and getting systems to talk to each other'],
  ['skills', 'Staffing, finding skilled operators and technicians'],
  ['other', 'Other'],
);

/**
 * The response axis: what could be done about it. One list, used by the
 * priority ratings, by what dealers say is available and ready, by what
 * technology providers offer, and by what advisers think needs evaluating —
 * so those four questions can be read against each other.
 */
const AREAS = opts(
  ['precision_planting', 'Precision planting and crop establishment'],
  ['crop_protection', 'Spraying and weed control'],
  ['haulm_removal', 'Haulm removal before harvest'],
  ['autonomy', 'Autonomous and self-steering field machinery', 'Machines that run with limited or no driver input.'],
  ['harvest_efficiency', 'Harvest efficiency and less damage'],
  ['harvest_logistics', 'Carting and harvest logistics'],
  ['optical_sorting', 'Optical sorting and grading', 'Cameras and sensors that grade tubers as they pass.'],
  ['packhouse_automation', 'Packhouse and receival automation'],
  ['robotics', 'Robots for repetitive hand work'],
  ['sensors', 'Sensors and machine data for day-to-day decisions'],
  ['irrigation_automation', 'Irrigation automation that uses crop and soil information'],
  ['predictive_maintenance', 'Predictive maintenance and machinery uptime', 'Using machine data to service a part before it fails.'],
  ['interoperability', 'Getting different brands and systems to work together', 'Data standards, so machinery and software from different suppliers share information.'],
  ['training', 'Training, skills and getting new people in'],
);

const AREAS_WITH_OTHER = [...AREAS, { id: 'other', label: 'Other' }] as const;

/**
 * Which responses belong to which part of the chain. Published in
 * docs/QUESTION-MAP.md so the crosswalk is a stated assumption rather than
 * something each analyst re-invents differently.
 */
export const DOMAIN_TO_AREAS: Readonly<Record<string, readonly string[]>> = {
  land_prep: ['precision_planting', 'autonomy'],
  planting: ['precision_planting', 'autonomy'],
  monitoring: ['sensors', 'interoperability'],
  irrigation: ['irrigation_automation', 'sensors'],
  crop_protection: ['crop_protection', 'autonomy', 'sensors'],
  haulm: ['haulm_removal'],
  harvest: ['harvest_efficiency', 'autonomy'],
  harvest_logistics: ['harvest_logistics'],
  receival: ['packhouse_automation', 'optical_sorting'],
  grading: ['optical_sorting', 'packhouse_automation'],
  packing: ['packhouse_automation', 'robotics'],
  storage: ['sensors', 'packhouse_automation'],
  data: ['interoperability', 'sensors'],
  maintenance: ['predictive_maintenance'],
  skills: ['training'],
};

/**
 * Scale, in tonnes rather than hectares, because tonnage is the one currency a
 * grower, a packer and a processor all use — one comparable question instead of
 * three that cannot be pooled. Without it there is no way to tell whether
 * "capital cost" is a small-grower finding or an industry-wide one.
 */
const TONNAGE = opts(
  ['under_1k', 'Under 1,000 tonnes'],
  ['1k_5k', '1,000 to 5,000 tonnes'],
  ['5k_20k', '5,000 to 20,000 tonnes'],
  ['20k_50k', '20,000 to 50,000 tonnes'],
  ['over_50k', 'More than 50,000 tonnes'],
  ['no_say', 'Prefer not to say'],
);

/**
 * Labour use, which the Year 1 baseline is meant to record. Counted in people
 * at the busiest time rather than in hours, because a headcount at peak is a
 * number people actually know, and in bands because nobody knows it exactly.
 * Read it against the tonnage band: a bigger business needs more people.
 */
const PEAK_LABOUR = opts(
  ['none', 'None'],
  ['1_5', '1 to 5'],
  ['6_20', '6 to 20'],
  ['21_50', '21 to 50'],
  ['over_50', 'More than 50'],
  ['no_say', 'Prefer not to say'],
);

const IMPORTANCE_SCALE: readonly ScalePoint[] = [
  { value: 1, label: 'Not important' },
  { value: 2, label: 'Slightly important' },
  { value: 3, label: 'Moderately important' },
  { value: 4, label: 'Very important' },
  { value: 5, label: 'Essential' },
];

/**
 * Where somebody stands on a practice, as a stage rather than a yes or no.
 *
 * The behaviour measure the rest of the questionnaire lacks: priorities and
 * trust are opinions, which can sit still while practice moves. Asked the same
 * way at the baseline and every review, it gives the adoption curve a real
 * starting point, and it is what a final report is judged on.
 *
 * Every step is shown on screen, because they are five distinct stages rather
 * than a quantity, and nobody can pick "3" without knowing what 3 means.
 *
 * "Tried it and stopped" is the sixth answer, so the five steps keep their
 * order and their numbers. It is the one place giving something up shows, and
 * it is kept beside the steps rather than averaged with them.
 */
const ADOPTION_SCALE: readonly ScalePoint[] = [
  { value: 1, label: 'Not for us' },
  { value: 2, label: 'Thinking about it' },
  { value: 3, label: 'Trying it' },
  { value: 4, label: 'Doing it on part of the operation' },
  { value: 5, label: 'Doing it across the operation' },
  { value: 6, label: 'Tried it and stopped', offScale: true },
];

/**
 * How far along a technology is in Australia, from the supply side. The top
 * step matches "established in Australian potato operations", the last answer
 * a technology provider can give about their own product.
 */
const AVAILABILITY_SCALE: readonly ScalePoint[] = [
  { value: 1, label: 'Not available yet' },
  { value: 2, label: 'Available overseas, not yet in Australia' },
  { value: 3, label: 'Available in Australia to trial' },
  { value: 4, label: 'Commercially ready in Australia' },
  { value: 5, label: 'Established in Australian potato operations' },
];

/**
 * Which part of the industry somebody works in. Asked of everybody, so any
 * answer can be read by sector: a crisping grower and a fresh grower can name
 * the same trouble for different reasons.
 */
const SECTORS = opts(
  ['fresh', 'Fresh (washed or brushed)'],
  ['processing_fry', 'Processing: French fry'],
  ['processing_crisp', 'Processing: crisping'],
  ['seed', 'Seed'],
  ['other', 'Something else'],
);

/**
 * Practices in the order of the potato year. Shared by the grower and the
 * contractor lists so a technology reads the same in both, and the two can be
 * set side by side.
 */
const PRACTICE = {
  guidance: ['guidance', 'GPS guidance or autosteer'],
  planting: ['precision_planting', 'Precision planting equipment'],
  cropSensing: ['crop_sensing', 'Drones, satellite images or sensors to check the crop'],
  irrigation: [
    'irrigation_tech',
    'Soil moisture sensors or automated irrigation',
    'Including variable rate irrigation, which puts on more water where the paddock needs it.',
  ],
  spraying: ['ai_spraying', 'Camera-guided or AI spraying'],
  haulm: ['haulm_alternative', 'Electric or mechanical haulm removal'],
  harvest: ['harvest_tech', 'Harvester upgrades to cut damage or separate stones and clods'],
  grading: ['optical_grading', 'Optical grading on farm'],
  driverless: ['autonomy', 'Driverless or autonomous machines'],
} as const;

/**
 * Confidence, the middle of the chain between hearing about something and
 * changing practice. It moves first, often within the year, so it shows
 * progress long before adoption does.
 */
const CONFIDENCE_SCALE: readonly ScalePoint[] = [
  { value: 1, label: 'Not at all confident' },
  { value: 2, label: 'A little confident' },
  { value: 3, label: 'Somewhat confident' },
  { value: 4, label: 'Fairly confident' },
  { value: 5, label: 'Very confident' },
];

const CORE: readonly Section[] = [
  {
    // Straight after the role and the growing areas, on its own short page,
    // so the question is answered by everybody and travels with the answers
    // like any other.
    id: 'core_sector',
    title: 'Your part of the industry',
    questions: [
      {
        id: 'sector',
        guide: { open: 'Which parts of the potato industry do you work in? Fresh, processing, seed?' },
        tracking: true,
        kind: 'multi',
        prompt: 'Which parts of the potato industry do you work in?',
        help: 'Tick as many as apply.',
        options: SECTORS,
        allowOther: true,
      },
    ],
  },
  {
    id: 'core_constraints',
    title: 'Current challenges',
    intro: 'First, how you see the industry as a whole. Your own place comes later.',
    questions: [
      {
        id: 'q1_constraints',
        guide: { open: 'What are the biggest challenges for the industry right now, in growing and handling potatoes?', probe: 'Where does that actually bite, which part of the season?' },
        tracking: true,
        kind: 'multi',
        prompt: 'Which parts of potato production and handling are the biggest challenges for the industry right now?',
        help: 'Tick as many as you like.',
        options: CONSTRAINTS,
        allowOther: true,
      },
      {
        id: 'q2_top_three',
        guide: { open: 'If the project could only work on three of those, which three would you pick?', probe: 'Why that one first?' },
        tracking: true,
        kind: 'rank',
        prompt: 'Of those, which three should we be putting the most effort into?',
        help: 'Tap them in order, most important first.',
        count: 3,
        sourceQuestionId: 'q1_constraints',
        fallbackOptions: CONSTRAINTS,
      },
      {
        id: 'q3_impact',
        guide: { open: 'For that one, how does it affect businesses?', probe: 'Can you think of an example from a tough season?' },
        kind: 'multi',
        prompt: 'For the challenge at the top of your list, how does it affect businesses?',
        help: 'Tick as many as you like.',
        // What it costs, never the problem again. The question is asked about
        // whichever problem is top, so an answer that names one of them reads
        // back as circular: "trouble finding skilled operators" was offered as
        // the cost of finding skilled operators. See content/dynamic.ts for the
        // one answer left out for one problem.
        options: opts(
          ['labour_avail', 'Labour availability'],
          ['labour_cost', 'Labour cost'],
          ['timeliness', 'Getting jobs done on time'],
          ['yield', 'Yield loss'],
          ['quality', 'Quality loss or a smaller pack-out'],
          ['damage', 'Bruising, damage or handling loss'],
          ['whs', 'Workplace health and safety'],
          ['downtime', 'Machines or crews standing idle'],
          ['inputs', 'Energy, fuel or water use'],
          ['training', 'Time and money spent training people'],
          ['data', 'Not knowing what is actually happening'],
          ['other', 'Other'],
        ),
        allowOther: true,
        // What a tough season looks like used to be a question of its own, and
        // read as this one again in different words. One question, one box.
        note: { label: 'Optional: give an example from a tough season', rows: 3 },
      },
    ],
  },
  {
    id: 'core_priorities',
    title: 'Where we should put our effort',
    questions: [
      {
        id: 'q5_areas',
        guide: { open: 'I\'ll read out some areas the project could work on. Tell me how much each one matters to you, one to five.', probe: 'Of all of those, which would you put at the very top?' },
        tracking: true,
        kind: 'rating',
        // A watch list: when the project takes on something new, a later round
        // can add it as a row without moving the ratings of the others.
        openRows: true,
        prompt: 'How important is it for the project to work on each of these?',
        help: '1 is not important, 5 is essential. Skip any you have no view on.',
        scale: IMPORTANCE_SCALE,
        rows: AREAS,
      },
      {
        // Straight after the list it refers to. It used to open the next page,
        // under another heading, where "those" pointed at nothing on screen.
        id: 'q6_first_opportunities',
        guide: { open: 'Of the ones you rated highest, why do they matter most?', probe: 'What would improving them change for you?' },
        kind: 'text',
        prompt: 'Thinking about the areas you rated highest, why do they matter most?',
        help: 'For example, what would improving them change for your business or the industry?',
        rows: 4,
      },
    ],
  },
  {
    id: 'core_evidence',
    title: 'What would convince you',
    questions: [
      {
        id: 'q7_evidence',
        guide: { open: 'What would you need before you put money into a new machine or technology?', probe: 'Whose word would you take on it?' },
        // Full version only. It shapes the project at the starting point, and
        // nobody expects the answer to move over three years, so it is not
        // worth what it costs the short version.
        kind: 'multi',
        prompt: 'What would you need before investing in a new machine or technology?',
        help: 'Tick as many as you like.',
        options: opts(
          ['local_demo', 'A demonstration in an Australian potato crop'],
          // Trialability, one of the strongest predictors of adoption in ADOPT,
          // the CSIRO tool Australian extension leans on. It was a question of
          // its own; as a choice here it is asked once, beside the rest.
          ['own_trial', 'Trying it on part of my own operation first'],
          ['case_study', "Results from a similar business, such as a case study or another grower's experience"],
          ['roi', 'Independent analysis of whether it pays'],
          ['operating_data', 'Figures from it working in the paddock'],
          ['service', 'Good local service, parts and technical support'],
          ['training', 'Training for operators and managers'],
          ['finance', 'Finance, leasing or sharing the cost'],
          ['safety', 'Clear guidance on safety and the rules'],
          ['compatibility', 'It works with the machinery and software we already run'],
          ['not_my_call', 'Not my call to make'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'q_trust',
        guide: { open: 'When you\'re weighing up new machinery, who do you actually listen to?', probe: 'Who\'s the one person whose view would settle it?' },
        tracking: true,
        kind: 'multi',
        // Who actually shifts somebody's thinking is arguably the single most
        // useful answer for designing extension, and it was missing. A finding
        // nobody hears from a source they trust is a finding that changes
        // nothing on a farm.
        prompt: 'When you are weighing up new machinery or a new way of doing things, whose opinion counts most?',
        help: 'Tick the ones that would change your mind.',
        options: opts(
          ['neighbours', 'Other growers and neighbours'],
          ['grower_groups', 'Grower groups and study groups'],
          ['agronomist', 'An independent agronomist or consultant'],
          ['dealer', 'Machinery dealers'],
          ['manufacturer', 'Manufacturer reps'],
          ['processor_field', 'Processor or packer field officers'],
          ['industry_body', 'Industry bodies'],
          ['researchers', 'Researchers and universities'],
          ['state_ag', 'State agriculture departments'],
          ['extension', 'Extension officers, including PotatoLink'],
          ['field_days', 'Field days and trade shows'],
          ['press', 'Rural press and industry magazines'],
          ['online', 'Online forums, video and social media'],
          ['family', 'Family and business partners'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'q_confidence',
        guide: {
          open: 'How confident would you feel working out whether new machinery would be worth the investment?',
          probe: 'What would it take to feel more sure of that?',
        },
        tracking: true,
        kind: 'rating',
        // Each row is something the project's demonstrations, case studies and
        // calculators should move. The last three are the capability the RFP
        // asks the project to build: operating, maintaining and integrating
        // new technology.
        prompt: 'When it comes to new machinery or technology, how confident are you in each of these?',
        help: 'Skip any that do not apply to you.',
        scale: CONFIDENCE_SCALE,
        rows: opts(
          ['pays', 'Working out whether it would be worth the investment'],
          ['claims', 'Judging whether trial results or supplier claims would apply in your conditions'],
          ['advice', 'Finding independent advice you trust'],
          ['setup', 'Getting it set up and working well in the first season'],
          ['maintain', 'Keeping it serviced and fixing problems when they come up'],
          ['integrate', 'Getting it to work with the machines and software you already use'],
        ),
      },
    ],
  },
];

const ADOPTION_BARRIERS = opts(
  ['capital', 'The up-front cost'],
  ['roi', 'Not sure it would pay for itself'],
  ['reliability', 'Breakdowns and downtime'],
  ['service', 'No service or support close by'],
  ['operators', 'Not enough trained operators'],
  ['fit', 'Does not fit the machinery we already run'],
  ['evidence', 'No proof it works in Australian conditions'],
  ['data', 'Data, or getting systems to talk to each other'],
  ['safety', 'Safety or regulation'],
  ['other', 'Other'],
);


/**
 * The role-specific sections.
 *
 * These were six open questions each, which on a phone is a wall of typing and
 * returns six paragraphs that each say the same thing differently. Where the
 * answer space is already well understood — which operations bite, what stops
 * people adopting, what a demonstration would need — they are choices now, so
 * an answer takes a tap and the results can actually be counted.
 *
 * What stays open is deliberate: the questions whose value is the thing we did
 * not think to ask. A tick-box can only ever return a ranking of our own
 * hypotheses, and a consultation that cannot surprise us is not worth running.
 *
 * Every question is phrased the way somebody from the project would ask it out
 * loud, because the same wording is used on the phone when a person would
 * rather talk — see docs/PHONE-SCRIPT.md.
 */
const PATHWAYS: Readonly<Record<string, Section>> = {
  farm: {
    id: 'farm',
    title: 'Your farming operation',
    intro: 'Now a few questions about your own place, so we know where the pressure falls.',
    questions: [
      {
        id: 'farm_scale',
        guide: { open: 'Roughly how many tonnes do you grow in a year? A ballpark is fine.' },
        tracking: true,
        kind: 'single',
        prompt: 'Roughly how many tonnes of potatoes do you grow in a year?',
        help: 'A rough band is plenty. It helps us see whether challenges differ by business size.',
        options: TONNAGE,
      },
      {
        id: 'farm_labour',
        guide: { open: 'At your busiest time, how many extra people do you put on for the potatoes?' },
        tracking: true,
        kind: 'single',
        // Labour use, which the Year 1 baseline is meant to record. The project
        // is meant to cut labour or move it to more skilled work, and this is
        // the number that shows whether reliance on seasonal staff falls.
        prompt: 'At your busiest time of year, how many seasonal or casual people work on your potatoes?',
        help: 'Not counting you or your permanent staff. A rough number is fine.',
        options: PEAK_LABOUR,
      },
      {
        id: 'farm_pressure',
        guide: { open: 'Where does the pressure land on your place?', probe: 'Which of those costs you most?' },
        kind: 'multi',
        prompt: 'Which parts of your own operation are the biggest challenges right now?',
        help: 'Labour, timeliness, safety, quality, reliability, whatever it is for you. Tick as many as you like.',
        // In the same words and order as the industry-wide list in the
        // first section, so the two can be read against each other.
        options: opts(
          ['land_prep', 'Ground preparation and bed forming'],
          ['planting', 'Planting'],
          ['monitoring', 'Crop monitoring and agronomy decisions'],
          ['irrigation', 'Irrigation operation and scheduling'],
          ['crop_protection', 'Spraying and crop protection operations'],
          ['haulm', 'Haulm removal before harvest'],
          ['harvest', 'Harvesting'],
          ['carting', 'Carting and in-field logistics'],
          ['on_farm_grading', 'Washing, grading and/or sorting on farm'],
          ['on_farm_storage', 'Handling and storage on farm'],
          ['maintenance', 'Machinery maintenance and breakdowns'],
          ['records', 'Record keeping, traceability, compliance and getting systems to talk to each other'],
          ['staffing', 'Staffing, rosters and finding skilled operators and technicians'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'farm_practices',
        guide: {
          open: 'I will read out some technologies. For each one, tell me where you are at with it.',
          probe: 'Which of those has made the biggest difference so far?',
        },
        tracking: true,
        kind: 'rating',
        labelEveryStep: true,
        openRows: true,
        allowOther: true,
        // The practice-change measure, in the order of the potato year. The
        // rows cover the gaps the RFP names (crop monitoring, irrigation,
        // disease control, harvest and post-harvest handling), the
        // technologies the project set out to trial, and the kickoff
        // workstreams: haulm removal, optical grading, the driverless tractor
        // and variable rate irrigation. Harvest damage and separation are one
        // row, as the project itself describes them. Autosteer stays as the
        // familiar one, which also shows whether a later round reached the
        // same kind of grower.
        //
        // A watch list, so the project can follow new technology as it turns
        // up: a round can add a row or stop asking one without moving the
        // other answers. What people write in "Something else" is where the
        // next row usually comes from.
        prompt: 'Where are you at with each of these in your own operation?',
        help: 'Pick the step that fits each one. Leave any you have not come across.',
        scale: ADOPTION_SCALE,
        rows: opts(
          PRACTICE.guidance,
          PRACTICE.planting,
          PRACTICE.cropSensing,
          PRACTICE.irrigation,
          PRACTICE.spraying,
          PRACTICE.haulm,
          PRACTICE.harvest,
          PRACTICE.grading,
          PRACTICE.driverless,
        ),
      },
      {
        id: 'farm_outcome',
        kind: 'single',
        // Asked about one thing on purpose. It used to ask "how did that go,
        // overall?" after somebody ticked five technologies, which forces an
        // average across five different experiences and records a blur.
        prompt: "Of the technologies above that you've tried or use, think of the one that mattered most. How has it gone?",
        options: opts(
          ['expand', 'Working well, and we would do more of it'],
          ['refine', 'Working, but it needs sorting out'],
          ['stopped', 'We tried it and stopped'],
          ['not_adopted', 'We looked into it and did not go ahead'],
          ['varies', 'Some of it worked, some did not'],
          ['not_relevant', 'Nothing has really applied to us yet'],
        ),
        note: { label: 'What is it?', rows: 1 },
      },
      {
        id: 'farm_barriers',
        guide: { open: 'What\'s stopped you going further with it?', probe: 'If that was sorted tomorrow, would you go ahead?' },
        tracking: true,
        kind: 'multi',
        prompt: 'What has held you back from taking up new machinery or technology?',
        help: 'Tick your top 3-5 barriers.',
        options: ADOPTION_BARRIERS,
        allowOther: true,
      },
      {
        id: 'farm_measures',
        kind: 'multi',
        prompt: 'When you are weighing up a machinery purchase, which numbers do you consider?',
        help: 'Tick as many as you like.',
        options: opts(
          ['labour_hours', 'Labour hours saved'],
          ['cost_ha', 'Cost per hectare'],
          ['cost_t', 'Cost per tonne'],
          ['yield', 'Yield'],
          ['packout', 'Pack-out', 'The share of the crop that makes saleable grade.'],
          ['quality', 'Quality'],
          ['damage', 'Bruising or damage'],
          ['throughput', 'How much you get done in a day'],
          ['timeliness', 'Getting the job done on time'],
          ['safety', 'Safety'],
          ['inputs', 'Water, fuel or energy use'],
          ['maintenance', 'Maintenance and downtime'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'farm_case_study',
        kind: 'single',
        prompt: 'Is there anything running now that would make a good local case study or a demonstration?',
        help: 'Something working on a real job. It does not have to be new or high-tech.',
        options: opts(
          ['own_farm', 'Yes, something on our own place'],
          ['known_farm', 'Yes, somewhere else I know of'],
          ['no', 'Nothing comes to mind'],
        ),
      },
    ],
  },
  contractor: {
    id: 'contractor',
    title: 'Your contracting work',
    intro: 'A few questions about the work you do for potato growers.',
    questions: [
      {
        id: 'con_scale',
        guide: { open: 'Roughly how many tonnes go through your hands in a year, across all your clients?' },
        tracking: true,
        kind: 'single',
        prompt: 'Roughly how many tonnes of potatoes do you handle in a year, across all your clients?',
        help: 'A broad band is plenty.',
        options: TONNAGE,
      },
      {
        id: 'con_labour',
        guide: { open: 'At your busiest time, how many extra people do you put on?' },
        tracking: true,
        kind: 'single',
        prompt: 'At your busiest time of year, how many seasonal or casual people do you put on for potato work?',
        help: 'Not counting you or your permanent staff. A rough number is fine.',
        options: PEAK_LABOUR,
      },
      {
        id: 'con_practices',
        guide: { open: 'For each of these, where are you at in your own fleet?' },
        tracking: true,
        kind: 'rating',
        labelEveryStep: true,
        openRows: true,
        allowOther: true,
        // Contractors run a good share of the machinery the project cares
        // about: planting, spraying, haulm removal and harvest are often
        // theirs, and new machinery is often on a contractor's rig before it is on
        // anybody's farm. A watch list, like the grower one.
        prompt: 'Where are you at with each of these across your own equipment?',
        help: 'Pick the step that fits each one. Leave any you have not come across.',
        scale: ADOPTION_SCALE,
        rows: opts(
          PRACTICE.guidance,
          PRACTICE.planting,
          PRACTICE.spraying,
          PRACTICE.haulm,
          PRACTICE.harvest,
          ['telemetry', 'Machine telemetry or remote diagnostics'],
          ['logistics', 'Load tracking and logistics coordination'],
          PRACTICE.driverless,
        ),
      },
      {
        id: 'con_peak',
        guide: { open: 'When you\'re flat out, which jobs are the ones that bite?', probe: 'What happens to the next client when one of those runs over?' },
        kind: 'multi',
        prompt: 'Which jobs put you under the most pressure in the peak?',
        help: 'Tick as many as you like.',
        options: opts(
          ['planting', 'Planting'],
          ['hilling', 'Hilling and bed forming'],
          ['spraying', 'Spraying'],
          ['irrigation', 'Irrigation work'],
          ['harvest', 'Lifting'],
          ['carting', 'Carting'],
          ['machine_moves', 'Moving machinery between jobs'],
          ['servicing', 'Servicing and repairs'],
          ['crewing', 'Finding and keeping crew'],
          ['scheduling', 'Juggling client schedules'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'con_limits',
        kind: 'multi',
        prompt: 'What limits how much work you can get through, or how well you can do it?',
        help: 'Tick as many as you like.',
        // Takes in what used to be a separate question on the machinery side
        // (parts, dealer support, repairs, diagnostics), which asked much the
        // same thing again.
        options: opts(
          ['machine_availability', 'Not enough machines'],
          ['capital', 'Cost of upgrading equipment'],
          ['breakdowns', 'Breakdowns and reliability'],
          ['parts_lead', 'Getting parts during the season and parts lead times'],
          ['parts_cost', 'Cost of parts'],
          ['dealer_support', 'Getting dealer or technician support'],
          ['warranty', 'Slow repair or warranty turnaround'],
          ['diagnostics', 'Access to diagnostics or software'],
          ['operators', 'Not enough skilled operators'],
          ['client_clash', 'Clients all wanting the same fortnight'],
          ['travel', 'Travel time between jobs'],
          ['weather', 'Weather windows'],
          ['conditions', 'Paddock conditions and soil type'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'con_skills',
        kind: 'multi',
        prompt: 'Where are the biggest gaps in operator skills?',
        help: 'Tick as many as you like.',
        options: opts(
          ['harvester_setup', 'Setting a harvester up for the conditions'],
          ['damage', 'Running machinery in a way that limits damage'],
          ['guidance', 'Guidance and GPS systems'],
          ['diagnostics', 'Reading machine diagnostics'],
          ['maintenance', 'Day-to-day maintenance'],
          ['safety', 'Safety and inductions'],
          ['records', 'Record keeping and data'],
          ['new_operators', 'Getting new operators up to speed quickly'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'con_tech',
        kind: 'multi',
        prompt: 'What would make the biggest difference to the job you can do for your clients?',
        help: 'Tick as many as you like.',
        options: opts(
          ['logistics', 'Load tracking and logistics coordination'],
          ['harvester_sensing', 'Harvesters that sense and adjust themselves'],
          ['guidance', 'Guidance and autosteer'],
          ['telemetry', 'Machine telemetry and predictive maintenance'],
          ['scheduling', 'Better scheduling software'],
          ['quality_sensing', 'Quality or damage sensing as you go'],
          ['autonomy', 'Autonomous or semi-autonomous machines'],
          ['training', 'Training for your operators'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'con_demo',
        kind: 'multi',
        prompt: 'What would you need to take part in a project demonstration?',
        help: 'Tick as many as you like.',
        options: opts(
          ['paid', 'Payment for your time, crew and machine at commercial rates'],
          ['off_peak', 'Held outside the peak season'],
          ['client_ok', "Your client's agreement"],
          ['no_crop_risk', "No risk to your client's crop"],
          ['machine_supplied', 'Machinery supplied by the project or manufacturer'],
          ['insurance', 'Insurance and safety sorted beforehand'],
          ['independent', 'Independent measurement of the results'],
          ['results_access', 'Access to the results afterwards'],
          ['not_interested', "I wouldn't be interested in taking part"],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'con_other',
        kind: 'text',
        prompt: 'Anything else about contracting we should know?',
        rows: 3,
      },
    ],
  },
  processor: {
    id: 'processor',
    title: 'Receival, storage, grading and packing',
    intro: 'A few questions about your shed, from the weighbridge through to dispatch.',
    questions: [
      {
        id: 'pro_scale',
        guide: { open: 'Roughly how many tonnes do you handle in a year?' },
        tracking: true,
        kind: 'single',
        prompt: 'Roughly how many tonnes do you handle in a year?',
        help: 'A broad band is plenty.',
        options: TONNAGE,
      },
      {
        id: 'pro_labour',
        guide: { open: 'At your busiest time, how many extra people do you put on in the shed?' },
        tracking: true,
        kind: 'single',
        prompt: 'At your busiest time of year, how many seasonal or casual people work in your shed?',
        help: 'Not counting permanent staff. A rough number is fine.',
        options: PEAK_LABOUR,
      },
      {
        id: 'pro_constraints',
        guide: { open: 'Walk me through the shed. Where does it slow down or go wrong?', probe: 'Where do you lose the most time?' },
        kind: 'multi',
        prompt: 'Where are the pinch points in your operation?',
        help: 'Labour, throughput, quality, handling, safety, wherever the problems are. Tick as many as you like.',
        options: opts(
          ['receival', 'Receival and tipping'],
          ['sampling', 'Sampling and testing on arrival'],
          ['storage', 'Getting stock in and out of store'],
          ['washing', 'Washing'],
          ['grading', 'Grading and sizing'],
          ['defects', 'Taking out defects'],
          ['packing', 'Packing'],
          ['palletising', 'Palletising'],
          ['dispatch', 'Dispatch'],
          ['changeovers', 'Cleaning and changeovers'],
          ['staffing', 'Staffing the shifts'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'pro_losses',
        kind: 'multi',
        prompt: 'Which losses or quality problems cost you the most?',
        help: 'Tick as many as you like.',
        options: opts(
          ['bruising', 'Bruising from drops and transfers'],
          ['greening', 'Greening'],
          ['rots', 'Rots in store'],
          ['sprouting', 'Sprouting'],
          ['shrink', 'Weight loss and shrink'],
          ['misgrades', 'Misgrades, over and under size'],
          ['foreign_matter', 'Foreign matter'],
          ['skin', 'Skin damage'],
          ['complaints', 'Customer complaints or rejections'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'pro_practices',
        tracking: true,
        kind: 'rating',
        labelEveryStep: true,
        openRows: true,
        allowOther: true,
        // The packhouse end of post-harvest handling, which the RFP names as a
        // gap, from the weighbridge to the pallet. A watch list, like the
        // grower one.
        prompt: 'Where are you at with each of these in your operation?',
        help: 'Pick the step that fits each one. Leave any you have not come across.',
        scale: ADOPTION_SCALE,
        rows: opts(
          ['receival_automation', 'Automated receival, tipping or box handling'],
          ['optical_size', 'Optical sizing and shape grading'],
          ['optical_defect', 'Optical defect detection'],
          ['internal_quality', 'Internal quality sensing', 'X-ray, near infrared, or similar.'],
          ['auto_packing', 'Automated packing'],
          ['palletising', 'Robotic palletising'],
          ['line_data', 'Line performance monitoring'],
        ),
      },
      {
        id: 'pro_barriers',
        tracking: true,
        kind: 'multi',
        prompt: 'What has held that back most?',
        help: 'Tick your top 3-5 barriers.',
        options: ADOPTION_BARRIERS,
        allowOther: true,
      },
      {
        id: 'pro_measures',
        kind: 'multi',
        prompt: 'Which numbers matter most when you judge whether something is working?',
        help: 'Tick as many as you like.',
        options: opts(
          ['throughput', 'Throughput'],
          ['labour', 'Labour needed'],
          ['grading_accuracy', 'Grading accuracy'],
          ['consistency', 'Consistency of quality'],
          ['damage', 'Bruising and handling damage'],
          ['traceability', 'Traceability'],
          ['downtime', 'Downtime'],
          ['energy', 'Energy use'],
          ['food_safety', 'Food safety and compliance'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'pro_other',
        kind: 'text',
        prompt: 'Anything else about your operation we should know?',
        rows: 3,
      },
    ],
  },
  machinery: {
    id: 'machinery',
    title: 'Machinery and technology supply',
    intro: 'A few questions from the supply side, where you see across the whole industry, then a few about what you offer. Tell us as much as you are comfortable sharing.',
    questions: [
      {
        id: 'mach_available',
        guide: { open: 'For each of these, how available is it to Australian growers today?', probe: 'What\'s coming in the next couple of years?' },
        // One rating per area, from not available to established. It used to be
        // two tick lists, available and then ready, which a rating says at once.
        kind: 'rating',
        labelEveryStep: true,
        allowOther: true,
        prompt: 'How available is each of these to Australian potato businesses today?',
        help: "Pick the one that fits best for each. Skip any you don't know about.",
        scale: AVAILABILITY_SCALE,
        rows: AREAS,
      },
      {
        id: 'mach_barriers',
        tracking: true,
        kind: 'multi',
        prompt: 'What stops your potato customers going ahead?',
        help: 'Tick your top 3-5 barriers.',
        options: ADOPTION_BARRIERS,
        allowOther: true,
      },
      {
        id: 'mach_capacity',
        kind: 'multi',
        prompt: 'What would the industry need on the service side to keep more of this machinery running?',
        help: 'Tick as many as you like.',
        options: opts(
          ['field_techs', 'More field technicians'],
          ['parts_holding', 'Parts held in country through the season'],
          ['operator_training', 'Operator training'],
          ['tech_training', 'Technician training pathways'],
          ['remote_diagnostics', 'Remote diagnostics and support'],
          ['after_hours', 'After-hours support in the peak'],
          ['documentation', 'Better manuals and documentation'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'mach_gaps',
        kind: 'multi',
        prompt: 'Where does imported machinery not suit Australian conditions?',
        help: 'Tick as many as you like.',
        options: opts(
          ['row_spacing', 'Row spacing and bed configuration'],
          ['soil', 'Soil types and conditions'],
          ['scale', 'Scale of our operations'],
          ['terrain', 'Paddock size and terrain'],
          ['season', 'Our seasonal windows'],
          ['integration', 'Fitting in with machinery people already run'],
          ['price', 'Price point for our market'],
          ['support_distance', 'Distance from service and support'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'mach_contribute',
        kind: 'single',
        prompt: 'Would you be interested in being part of a demonstration, case study or technical briefing?',
        help: 'There is a spot at the end to leave your details.',
        options: opts(['yes', 'Yes'], ['maybe', 'Possibly, depending on the detail'], ['no', 'No']),
      },
      {
        id: 'tech_offer',
        guide: { open: 'Tell me about what you do, in plain terms.', probe: 'Where would it sit on a potato operation?' },
        kind: 'multi',
        prompt: 'What sort of technology do you offer?',
        help: 'Tick as many as you like. There is room to describe it properly at the end.',
        options: AREAS_WITH_OTHER,
        allowOther: true,
      },
      {
        id: 'tech_problem',
        kind: 'multi',
        prompt: 'What problem does it solve for a potato business?',
        help: 'Tick as many as you like.',
        options: opts(
          ['labour', 'Labour needed for a job'],
          ['timeliness', 'Getting work done in the window'],
          ['quality', 'Quality and pack-out'],
          ['damage', 'Bruising and handling damage'],
          ['yield', 'Yield'],
          ['data', 'Knowing what is actually happening'],
          ['maintenance', 'Machinery uptime'],
          ['traceability', 'Traceability'],
          ['safety', 'Safety'],
          ['inputs', 'Water, fuel or energy'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'tech_maturity',
        kind: 'single',
        prompt: 'How far along is it?',
        options: opts(
          ['concept', 'Concept or prototype'],
          ['early', 'Early commercial trials'],
          ['overseas', 'Sold commercially overseas'],
          ['au', 'Sold commercially in Australia'],
          ['established', 'Established in Australian potato operations'],
        ),
      },
      {
        id: 'tech_requirements',
        kind: 'multi',
        prompt: 'What does a business need to have in place before it will work properly?',
        help: 'Tick as many as you like.',
        options: opts(
          ['connectivity', 'Reliable connectivity'],
          ['power', 'Power at the site'],
          ['conditions', 'Consistent operating conditions', 'Lighting, line speed, and the like.'],
          ['line_access', 'Access to the line or machine to fit it'],
          ['integration', 'Integration with systems they already run'],
          ['training', 'Staff training'],
          ['data_sharing', 'A data sharing arrangement'],
          ['calibration', 'Ongoing calibration and support'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'tech_evidence',
        kind: 'multi',
        prompt: 'What evidence can you point to on how well it performs?',
        help: 'Tick as many as you like.',
        options: opts(
          ['overseas_commercial', 'Commercial results from overseas'],
          ['au_trial', 'Australian trial data'],
          ['independent', 'An independent evaluation'],
          ['customer_case', 'Customer case studies'],
          ['internal', 'Internal testing only'],
          ['none', 'Nothing published yet'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'tech_demo',
        kind: 'multi',
        prompt: 'What would you need from us for a credible Australian evaluation?',
        help: 'Tick as many as you like.',
        options: opts(
          ['host_site', 'A host site'],
          ['independent_measure', 'Independent measurement'],
          ['full_season', 'A full season of results'],
          ['funding', 'Some funding support'],
          ['integration_help', 'Help integrating with what the host already runs'],
          ['success_criteria', 'Agreed success criteria up front'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'tech_other',
        kind: 'text',
        prompt: 'Tell us about the technology in your own words.',
        help: 'What it does, and where it would fit in a potato operation.',
        rows: 4,
      },
      {
        id: 'mach_other',
        kind: 'text',
        prompt: 'Anything else we should know from where you sit?',
        rows: 3,
      },
    ],
  },
  /*
   * Industry bodies used to be sent down the adviser branch, where they were
   * asked what a field demonstration should measure — a question a peak body
   * has no reason to hold a view on. Four questions that suit the seat they
   * actually sit in beat six that do not.
   */
  industry: {
    id: 'industry',
    title: 'Your members and the wider industry',
    questions: [
      {
        id: 'ind_priorities',
        guide: { open: 'What do your members bring up with you most?', probe: 'Is that getting better or worse?' },
        kind: 'multi',
        prompt: 'What do the businesses you represent raise with you most often?',
        help: 'Tick as many as you like.',
        options: opts(
          ['labour', 'Labour availability and cost'],
          ['skills', 'Skills and training'],
          ['capital', 'Cost of machinery'],
          ['energy', 'Energy and input costs'],
          ['workforce_safety', 'Workplace safety'],
          ['market', 'Market access and returns'],
          ['regulation', 'Regulation and compliance'],
          ['succession', 'Succession and new entrants'],
          ['data', 'Data and reporting burden'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'ind_role',
        kind: 'multi',
        prompt: 'Where could a project like this be most useful to your members?',
        help: 'Tick as many as you like.',
        options: opts(
          ['independent_evidence', 'Independent evidence they can trust'],
          ['demos', 'Demonstrations they can visit'],
          ['training', 'Training and skills pathways'],
          ['roi_tools', 'Tools for working out whether it pays'],
          ['safety_guidance', 'Safety and regulatory guidance'],
          ['coordination', 'Coordinating across regions and sectors'],
          ['advocacy', 'Evidence to support advocacy'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'ind_underrepresented',
        kind: 'multi',
        prompt: 'Whose voice usually gets missed in these conversations?',
        help: 'Tick as many as you like.',
        options: opts(
          ['operators', 'Machinery operators'],
          ['small_farms', 'Smaller family operations'],
          ['seasonal', 'Seasonal and labour hire workforce'],
          ['contractors', 'Contractors'],
          ['packhouse_floor', 'Packhouse floor staff'],
          ['new_entrants', 'New entrants'],
          ['women', 'Women in the industry'],
          ['regions', 'Particular regions'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'ind_connections',
        kind: 'text',
        prompt: 'Are there groups, programs or people we should be working with?',
        help: 'Optional. Names are more use to us than categories here.',
        rows: 4,
      },
    ],
  },
  adviser: {
    id: 'adviser',
    title: 'Evidence, evaluation and extension',
    intro: 'A few questions about what we know, and what we should be measuring.',
    questions: [
      {
        id: 'adv_gaps',
        guide: { open: 'Where do you reckon the industry is flying blind?', probe: 'What would it take to fill that gap?' },
        kind: 'multi',
        prompt: 'Where are the biggest knowledge gaps?',
        help: 'Tick as many as you like.',
        options: opts(
          ['damage_cost', 'What handling damage really costs through the chain'],
          ['roi_au', 'Return on investment under Australian conditions'],
          ['labour_impact', 'What automation does to labour needs'],
          ['grading_accuracy', 'How accurate optical grading really is'],
          ['soil_machinery', 'Machinery effects on soil and the following crop'],
          ['agronomy_link', 'Where machinery and agronomy interact'],
          ['workforce', 'Workforce and skills data'],
          ['data_standards', 'Data standards and interoperability'],
          ['safety', 'Safety outcomes'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'adv_evaluate',
        kind: 'multi',
        prompt: 'Which technologies most need independent evaluation?',
        help: 'Tick as many as you like.',
        options: AREAS_WITH_OTHER,
        allowOther: true,
      },
      {
        id: 'adv_measurements',
        kind: 'multi',
        prompt: 'If we run a demonstration, what should we be measuring?',
        help: 'Tick as many as you like.',
        options: opts(
          ['damage', 'Bruise and damage incidence, by sampling point'],
          ['yield', 'Yield'],
          ['packout', 'Pack-out'],
          ['throughput', 'Throughput'],
          ['labour_hours', 'Labour hours by task'],
          ['fuel', 'Fuel and energy'],
          ['water', 'Water'],
          ['timeliness', 'Timeliness against the window'],
          ['downtime', 'Machine downtime'],
          ['compaction', 'Soil compaction'],
          ['cost', 'Cost per tonne or per hectare'],
          ['safety', 'Safety incidents and near misses'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'adv_underrepresented',
        kind: 'multi',
        prompt: 'Whose voice usually gets missed in these conversations?',
        help: 'Tick as many as you like.',
        options: opts(
          ['operators', 'Machinery operators'],
          ['small_farms', 'Smaller family operations'],
          ['seasonal', 'Seasonal and labour hire workforce'],
          ['contractors', 'Contractors'],
          ['packhouse_floor', 'Packhouse floor staff'],
          ['new_entrants', 'New entrants'],
          ['women', 'Women in the industry'],
          ['regions', 'Particular regions'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'adv_connections',
        kind: 'text',
        prompt: 'Are there projects, data sources, researchers or demonstration sites we should be talking to?',
        help: 'Optional. Names and places are more use to us than categories here.',
        rows: 4,
      },
    ],
  },
};

/**
 * Review rounds only. Bennett's hierarchy asks whether people saw what a
 * project produced and whether it changed anything they do — the two levels a
 * baseline cannot measure, because nothing has been produced yet.
 */
const FOLLOW_UP: readonly Section[] = [
  {
    id: 'follow_up',
    title: 'Since we last asked',
    intro: 'A few quick questions about what has happened since the project started.',
    questions: [
      {
        id: 'fu_seen',
        guide: { open: 'Since we last spoke, have you come across anything from the project?', probe: 'Where did you come across it?' },
        kind: 'multi',
        tracking: true,
        prompt: 'Have you seen or used anything from the Potato Mechanisation Project?',
        help: 'Tick as many as you like.',
        options: opts(
          ['field_day', 'A field day or demonstration'],
          ['case_study', 'A case study'],
          ['video', 'A video'],
          ['factsheet', 'A factsheet or checklist'],
          ['roi_tool', 'An ROI calculator or decision tool'],
          ['webinar', 'A webinar or online briefing'],
          ['one_to_one', 'A one-to-one conversation'],
          ['article', 'A PotatoLink article or update'],
          ['none', 'Nothing yet'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'fu_changed',
        guide: { open: 'Has any of it changed what you\'re doing, or planning to do?', probe: 'What was it that made the difference?' },
        kind: 'single',
        tracking: true,
        prompt: 'Has any of it changed what you do, or plan to do?',
        options: opts(
          ['changed', 'Yes, we have changed how we do something'],
          ['planning', 'We are planning a change'],
          ['considering', 'We are looking into it'],
          ['no_change', 'No change'],
          ['not_applicable', 'Have not seen enough to say'],
        ),
      },
      {
        id: 'fu_contribution',
        guide: { open: 'If you have changed something, do you reckon you would have done it anyway, without the project?' },
        tracking: true,
        kind: 'single',
        // The standard contribution question. Funders expect it, and it is the
        // difference between "people changed" and "the project changed them".
        // Nothing hides a question here, so "nothing has changed" is an answer.
        prompt: 'If you have changed something, would you have made that change without the project?',
        options: opts(
          ['same', 'Yes, the same change at about the same time'],
          ['later', 'Yes, but later or on a smaller scale'],
          ['probably_not', 'Probably not'],
          ['no', 'No, not without the project'],
          ['not_sure', 'Not sure'],
          ['nothing_changed', 'Nothing has changed yet'],
        ),
      },
      {
        id: 'fu_labour',
        guide: {
          open: 'Has any new machinery changed the labour side of things for you?',
          probe: 'Which job did that happen in?',
        },
        tracking: true,
        kind: 'single',
        // The labour outcome the RFP asks for, in its two forms: fewer people
        // needed, or the same people moved to more skilled work. Reviews only,
        // since at the starting point nothing has happened yet.
        prompt: 'Since the project started, has new machinery or technology changed the labour in your business?',
        options: opts(
          ['fewer', 'We need fewer people for some jobs'],
          ['redeployed', 'The same people are doing different, more skilled work'],
          ['both', 'Both of those'],
          ['more', 'We need more people'],
          ['no_change', 'No change yet'],
          ['not_applicable', 'Does not apply to my work'],
        ),
      },
      {
        id: 'fu_what',
        kind: 'text',
        prompt: 'If something changed, what was it, and what made the difference?',
        help: 'Optional. A sentence is plenty.',
        rows: 3,
      },
    ],
  },
];

const PROJECT_DESIGN: readonly Section[] = [
  {
    id: 'project_design',
    title: 'How we should go about it',
    questions: [
      {
        id: 'pd_most_useful',
        guide: { open: 'What could we do that you\'d actually use?', probe: 'What would make it worth your time?' },
        kind: 'text',
        prompt: 'What could we do that would be most useful for your business or for the industry?',
        rows: 4,
      },
      {
        id: 'pd_avoid',
        guide: { open: 'What won\'t work, and what should we not bother with?', probe: 'What makes you say that?' },
        kind: 'text',
        // Takes in the grower question about what is being pushed that will
        // not work here, and asks it of everybody.
        prompt: "What won't work and what should we not waste time or money on?",
        rows: 3,
      },
      {
        id: 'pd_formats',
        kind: 'multi',
        prompt: 'How do you like to get this sort of information?',
        help: 'Tick as many as you like.',
        options: opts(
          ['case_studies', 'Short practical case studies'],
          ['videos', 'Videos from commercial operations'],
          ['field_demos', 'Field demonstrations'],
          ['peer_groups', 'Small peer groups'],
          ['webinars', 'Webinars'],
          ['briefings', 'Short online briefings'],
          ['checklists', 'Machinery or operator checklists'],
          ['roi_tools', 'Tools for working out whether it pays'],
          ['factsheets', 'Technical factsheets'],
          ['one_to_one', 'One-to-one discussions'],
          ['articles', 'PotatoLink articles or updates'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
    ],
  },
  {
    id: 'next_time',
    title: 'Next time we ask',
    intro: 'Optional. It helps us make the most of your answers.',
    questions: [
      {
        id: 'link_code',
        guide: {
          open: 'Would you be happy to give us three quick answers, so we can compare your answers with next time without your name?',
          probe: 'If you would rather not, that is fine, and we will move on.',
        },
        tracking: true,
        kind: 'text',
        entry: 'linkCode',
        // Three fixed answers the form turns into a code, the way public health
        // surveys follow people without knowing who they are. Built from facts
        // that never change, so the same person gets the same code next time
        // without remembering or writing anything down. On the short version
        // too, since that is what most people will answer at the mid-term.
        prompt: 'Would you like us to be able to compare your answers with next time?',
        help: 'Optional. Three quick answers create a code so we can ask these questions again later in the project and compare your answers over time. The code will be used next time and allows you to stay anonymous.',
      },
    ],
  },
];

/**
 * The two questions asked on their own screen before the questionnaire proper:
 * who you are, and where you work. They sit here rather than in a section
 * because the role decides which branch follows, so the form cannot treat them
 * as ordinary questions.
 *
 * The wording lives in one place all the same. The screen renders it, the
 * printable paper prints it, and the phone script reads it, so none of the
 * three can quietly describe a question the other two are not asking.
 */
export const ABOUT_YOU = {
  role: {
    prompt: 'Which perspective best reflects your experience?',
    help: 'Required. Choose the one that fits best.',
  },
  regions: {
    prompt: 'Which potato growing areas are most relevant to your experience?',
    help: 'Optional. Tick as many as you like. Some areas cross a state border, so go by the towns listed.',
  },
} as const;

export const NO_INTEREST_ID = 'none';

/**
 * The section the contact step comes before. Leaving details and making the
 * code for next time are both optional, and the details are asked first, so
 * the questionnaire ends on the one thing that keeps the answers anonymous.
 */
export const NEXT_TIME_ID = 'next_time';

/**
 * Stored with contact details left without ticking anything above them. The
 * details are offered whether or not something is ticked, because plenty of
 * people want to hear back without signing up for anything in particular.
 */
export const KEEP_IN_TOUCH_ID = 'keep_in_touch';
export const KEEP_IN_TOUCH_LABEL = 'Happy to be contacted';

/**
 * Ways to stay involved that anybody can offer, whatever their part of the
 * chain. The project reference group sits here rather than in a pathway,
 * because it is the same commitment for everyone and the project needs to see
 * every volunteer for it in one list.
 */
export const INTEREST_OPTIONS = opts(
  ['reference_group', 'Joining the project reference group', 'A small group that meets a few times a year to steer the project.'],
  ['follow_up', 'A confidential chat with somebody from the project'],
  ['summary', 'A summary of what we heard'],
  ['online_discussion', 'A future online discussion'],
  ['peer_group', 'A small peer group'],
  ['case_study', 'Helping with a case study'],
  ['data', 'Sharing operating data with your name taken off it'],
  ['review_tool', 'Looking over a draft tool for working out whether something pays'],
  ['updates', 'PotatoLink updates about mechanisation'],
);

/**
 * What helping with a trial actually means depends on where somebody sits.
 * A grower offers a paddock, a dealer offers a machine and a technician, a
 * packhouse offers a line and permission to measure it. Asking everybody the
 * same vague question about "participating in a demonstration" gets a tick
 * that nobody can act on, so each pathway is asked in its own terms.
 */
export const PATHWAY_INTERESTS: Readonly<Record<string, readonly Option[]>> = {
  farm: opts(
    ['farm_host_trial', 'Hosting a trial or demonstration on your farm'],
    ['farm_measurements', 'Allowing measurements during harvest or planting', 'For example bruise sampling, timing, or labour hours.'],
    ['farm_machine_data', 'Sharing machine or operational data during a trial'],
    ['farm_field_day', 'Speaking at a field day or grower walk about your experience'],
  ),
  contractor: opts(
    ['con_demo_machine', 'Running a machine at a field demonstration'],
    ['con_trial_time', 'Providing operator time or machinery for a trial'],
    ['con_measurements', 'Allowing measurements while you are working in a crop'],
  ),
  processor: opts(
    ['pro_host_trial', 'Hosting a trial in your packhouse, receival or store'],
    ['pro_line_measurement', 'Allowing throughput, grading or damage measurements on your line'],
    ['pro_benchmark', 'Taking part in an independent check of grading accuracy'],
  ),
  machinery: opts(
    ['mach_supply_demo', 'Supplying machinery for a demonstration'],
    ['tech_evaluation', 'Providing your technology for an independent evaluation'],
    ['mach_technical_support', 'Providing a technician or operator for a trial'],
    ['tech_protocol', 'Helping design what a credible trial would measure'],
    ['mach_briefing', 'Briefing the project on equipment that is coming to market'],
    ['mach_training', 'Helping deliver operator or technician training'],
    ['tech_integration', 'Working on getting systems to talk to each other'],
  ),
  industry: opts(
    ['ind_promote', 'Helping get the consultation in front of your members'],
    ['ind_event', 'Hosting a session at one of your events'],
    ['ind_circulate', 'Circulating the findings to your members'],
    ['ind_policy', 'Working with us on workforce or skills policy'],
  ),
  adviser: opts(
    ['adv_design', 'Helping design or measure a trial'],
    ['adv_review', 'Reviewing findings before they are published'],
    ['adv_event', 'Helping run a field day, workshop or webinar'],
    ['adv_connect', 'Connecting the project with growers or businesses you work with'],
  ),
};

const NONE_OPTION: Option = { id: NO_INTEREST_ID, label: 'None of these' };

/**
 * The list shown at the end: what this person specifically could offer first,
 * then the ways anybody can stay involved, then the opt-out.
 */
export const interestsForPathway = (
  questionnaire: Questionnaire,
  pathway: string | null,
): readonly Option[] => [
  ...(pathway === null ? [] : (questionnaire.pathwayInterests[pathway] ?? [])),
  ...questionnaire.interestOptions,
  NONE_OPTION,
];

export const DEFAULT_QUESTIONNAIRE: Questionnaire = {
  roundId: '2026-round-1',
  roundLabel: 'PT25003 consultation, round 1',
  stage: 'baseline',
  roles: ROLES,
  regions: REGIONS,
  core: CORE,
  pathways: PATHWAYS,
  followUp: FOLLOW_UP,
  projectDesign: PROJECT_DESIGN,
  interestOptions: INTEREST_OPTIONS,
  pathwayInterests: PATHWAY_INTERESTS,
  contactMethods: opts(['email', 'Email'], ['phone', 'Phone'], ['either', 'Either']),
};
