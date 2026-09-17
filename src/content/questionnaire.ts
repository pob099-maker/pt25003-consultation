import type { Option, Questionnaire, ScalePoint, Section } from '../types';

const opts = (...pairs: readonly (readonly [string, string, string?])[]): readonly Option[] =>
  pairs.map(([id, label, help]) => (help === undefined ? { id, label } : { id, label, help }));

export const ROLES = [
  { id: 'grower', label: 'Potato grower or business owner', pathway: 'farm' },
  { id: 'farm_manager', label: 'Farm manager, supervisor or machinery operator', pathway: 'farm' },
  { id: 'contractor', label: 'Contractor', pathway: 'contractor' },
  { id: 'processor', label: 'Processor, packhouse or storage business', pathway: 'processor' },
  { id: 'machinery', label: 'Machinery dealer, manufacturer or service provider', pathway: 'machinery' },
  { id: 'technology', label: 'Technology provider', pathway: 'technology' },
  { id: 'adviser', label: 'Adviser, consultant, researcher or educator', pathway: 'adviser' },
  { id: 'industry_body', label: 'Industry body or other stakeholder', pathway: 'industry' },
] as const;

const REGIONS = opts(
  ['sa_murraylands', 'South Australia — Murraylands and Riverland'],
  ['sa_southeast', 'South Australia — South East and Adelaide Hills'],
  ['vic_ballarat', 'Victoria — Ballarat and Central Highlands'],
  ['vic_gippsland', 'Victoria — Gippsland'],
  ['vic_other', 'Victoria — other districts'],
  ['tas_north', 'Tasmania — North and North West'],
  ['tas_other', 'Tasmania — other districts'],
  ['nsw', 'New South Wales'],
  ['qld', 'Queensland — Lockyer Valley, Atherton and other districts'],
  ['wa', 'Western Australia'],
  ['national', 'National / multiple regions'],
  ['other', 'Other region'],
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
  ['planting', 'Ground preparation and planting'],
  ['monitoring', 'Crop monitoring and decision support'],
  ['irrigation', 'Irrigation operation and automation'],
  ['crop_protection', 'Crop protection operations'],
  ['harvest', 'Harvesting'],
  ['harvest_logistics', 'In-field transport and harvest logistics'],
  ['receival', 'Receival'],
  ['grading', 'Washing, grading and sorting'],
  ['packing', 'Packing'],
  ['storage', 'Storage and handling'],
  ['data', 'Data capture, traceability and system integration'],
  ['maintenance', 'Machinery maintenance and reliability'],
  ['skills', 'Access to skilled operators and technicians'],
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
  ['autonomy', 'Autonomous or semi-autonomous field operations', 'Machines that run with limited or no driver input.'],
  ['harvest_efficiency', 'Harvest efficiency and damage reduction'],
  ['harvest_logistics', 'Harvest logistics and transport coordination'],
  ['optical_sorting', 'Optical sorting, grading and quality measurement', 'Cameras and sensors that grade tubers as they pass.'],
  ['packhouse_automation', 'Packhouse and receival automation'],
  ['robotics', 'Robotics for repetitive manual tasks'],
  ['sensors', 'Sensors and machine data for operational decisions'],
  ['irrigation_automation', 'Irrigation automation linked to crop and soil information'],
  ['predictive_maintenance', 'Predictive maintenance and machinery uptime', 'Using machine data to service a part before it fails.'],
  ['interoperability', 'Data standards and system interoperability', 'Making equipment and software from different suppliers share data.'],
  ['training', 'Training, skills and workforce pathways'],
);

const AREAS_WITH_OTHER = [...AREAS, { id: 'other', label: 'Other' }] as const;

/**
 * Which responses belong to which part of the chain. Published in
 * docs/QUESTION-MAP.md so the crosswalk is a stated assumption rather than
 * something each analyst re-invents differently.
 */
export const DOMAIN_TO_AREAS: Readonly<Record<string, readonly string[]>> = {
  planting: ['precision_planting', 'autonomy'],
  monitoring: ['sensors', 'interoperability'],
  irrigation: ['irrigation_automation', 'sensors'],
  crop_protection: ['autonomy', 'sensors'],
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

const PRIORITY_SCALE: readonly ScalePoint[] = [
  { value: 1, label: 'Not a priority' },
  { value: 2, label: 'Low priority' },
  { value: 3, label: 'Moderate priority' },
  { value: 4, label: 'High priority' },
  { value: 5, label: 'Very high priority' },
];

const CORE: readonly Section[] = [
  {
    id: 'core_constraints',
    title: 'Where the pressure is',
    intro: 'First, how you see the industry as a whole — not just your own place.',
    questions: [
      {
        id: 'q1_constraints',
        guide: { open: 'What\'s the part of the job that gives the most grief right now — yours, or the industry\'s?', probe: 'Where does that actually bite — which part of the season?' },
        tracking: true,
        kind: 'multi',
        prompt: 'Where do you see the biggest hold-ups in the potato industry — the places where mechanisation, automation or a better workflow would make the most difference?',
        help: 'Choose as many as apply.',
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
        guide: { open: 'When that goes wrong, what does it actually cost?', probe: 'Is that mostly money, time, or people?' },
        kind: 'multi',
        prompt: 'For the one at the top of your list, what does it actually cost a business?',
        help: 'Choose as many as apply.',
        options: opts(
          ['labour_avail', 'Labour availability'],
          ['labour_cost', 'Labour cost'],
          ['timeliness', 'Timeliness of operations'],
          ['yield', 'Yield loss'],
          ['quality', 'Quality loss or reduced pack-out'],
          ['damage', 'Bruising, damage or handling loss'],
          ['whs', 'Workplace health and safety'],
          ['downtime', 'Machine downtime or reliability'],
          ['inputs', 'Energy, fuel or water use'],
          ['skills', 'Difficulty accessing skilled operators or technicians'],
          ['data', 'Lack of useful operational data'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'q4_bad_season',
        guide: { open: 'Think of a bad year. What happened?', probe: 'What would have made the difference?' },
        kind: 'text',
        prompt: 'In a tough season, or when everything lands at once, what happens if nothing changes?',
        help: 'Optional. For example: harvest runs late, quality drops, throughput falls away, extra labour cost, crop left in the ground, a safety risk, or a market missed.',
        rows: 4,
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
        prompt: 'Where should we put our effort first?',
        help: 'Rate each one from 1 (not a priority) to 5 (very high priority). Skip any you have no view on.',
        scale: PRIORITY_SCALE,
        rows: AREAS,
      },
    ],
  },
  {
    id: 'core_evidence',
    title: 'What would convince you',
    questions: [
      {
        id: 'q6_first_opportunities',
        guide: { open: 'If you were running the project, what would you do first?', probe: 'Why that one?' },
        kind: 'text',
        prompt: 'If we could only take on one or two of those, which would you pick — and why?',
        rows: 4,
      },
      {
        id: 'q7_evidence',
        guide: { open: 'What would it take for you to actually try something new?', probe: 'Whose word would you take on it?' },
        tracking: true,
        kind: 'multi',
        prompt: 'What would it take to convince you to try something new?',
        help: 'Choose as many as apply.',
        options: opts(
          ['local_demo', 'Local demonstration under Australian potato conditions'],
          ['roi', 'Independent economic analysis or ROI assessment', 'An independent look at whether the money spent comes back.'],
          ['operating_data', 'Practical operating data'],
          ['case_study', 'Case study from a similar business'],
          ['peer', 'Peer grower or industry experience'],
          ['service', 'Good local service, parts and technical support'],
          ['training', 'Training for operators and managers'],
          ['finance', 'Finance, leasing or ownership-model options'],
          ['safety', 'Clear safety or regulatory guidance'],
          ['compatibility', 'Better compatibility with existing equipment or data systems'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'q_trial',
        guide: { open: 'Would you need to try it on part of the place before you committed?', probe: 'How big a trial would you need to see?' },
        tracking: true,
        kind: 'single',
        // Trialability — whether something can be tried on a small scale before
        // committing — is one of the strongest predictors of adoption in ADOPT,
        // the CSIRO tool Australian extension leans on. It was implied by the
        // evidence question above but never asked, and "a demonstration
        // somewhere" is not the same thing as "on my own place, on a few rows".
        prompt: 'Before you committed to something new, how much would it matter to try it on part of the operation first?',
        options: opts(
          ['essential', 'Essential — I would not go ahead without it'],
          ['helpful', 'Helpful, but not a deal-breaker'],
          ['not_needed', 'Not needed — the evidence would be enough'],
          ['not_my_call', 'Not my call to make in my role'],
        ),
      },
      {
        id: 'q_trust',
        guide: { open: 'When you\'re weighing up a new bit of gear, who do you actually listen to?', probe: 'Who\'s the one person whose view would settle it?' },
        tracking: true,
        kind: 'multi',
        // Who actually shifts somebody's thinking is arguably the single most
        // useful answer for designing extension, and it was missing. A finding
        // nobody hears from a source they trust is a finding that changes
        // nothing on a farm.
        prompt: 'When you are weighing up new gear or a new way of doing things, whose opinion actually counts?',
        help: 'Tick any that genuinely sway you — not everyone you hear from.',
        options: opts(
          ['neighbours', 'Other growers and neighbours'],
          ['grower_groups', 'Grower groups and study groups'],
          ['agronomist', 'An independent agronomist or consultant'],
          ['dealer', 'Machinery dealers'],
          ['manufacturer', 'Manufacturer representatives'],
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
    ],
  },
];

const ADOPTION_BARRIERS = opts(
  ['capital', 'Upfront capital cost'],
  ['roi', 'Uncertain return on investment'],
  ['reliability', 'Reliability or downtime concerns'],
  ['service', 'Lack of local service or support'],
  ['operators', 'Lack of suitable operators or training'],
  ['fit', 'Poor fit with existing systems'],
  ['evidence', 'Lack of evidence under Australian conditions'],
  ['data', 'Data or integration issues'],
  ['safety', 'Safety or regulatory concerns'],
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
    intro: 'Now a few questions about your own place, so we know where the pressure actually falls.',
    questions: [
      {
        id: 'farm_scale',
        guide: { open: 'Roughly how many tonnes do you grow in a year? A ballpark is fine.' },
        tracking: true,
        kind: 'single',
        prompt: 'Roughly how many tonnes of potatoes do you grow in a year?',
        help: 'A broad band is plenty. It lets us tell whether a finding belongs to smaller operations or to everybody.',
        options: TONNAGE,
      },
      {
        id: 'farm_pressure',
        guide: { open: 'Where does the pressure land on your place?', probe: 'Which of those costs you most?' },
        kind: 'multi',
        prompt: 'Which parts of your operation give you the most trouble — labour, timeliness, safety, quality or reliability?',
        help: 'Tick any that apply.',
        options: opts(
          ['land_prep', 'Ground preparation and bed forming'],
          ['planting', 'Planting'],
          ['irrigation', 'Irrigation, shifting and scheduling'],
          ['crop_protection', 'Spraying and crop protection'],
          ['monitoring', 'Crop monitoring and agronomy decisions'],
          ['harvest', 'Harvest'],
          ['carting', 'Carting and in-field logistics'],
          ['on_farm_grading', 'Grading, handling and storage on farm'],
          ['maintenance', 'Machinery maintenance and breakdowns'],
          ['staffing', 'Staffing, rosters and finding operators'],
          ['records', 'Record keeping and compliance'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'farm_adopted',
        guide: { open: 'What have you put on, or had a good look at, in the last few years?', probe: 'What made you look at it in the first place?' },
        tracking: true,
        kind: 'multi',
        prompt: 'What have you put on, trialled, or had a serious look at?',
        help: 'Tick any that apply. It does not matter whether you kept it.',
        options: opts(
          ['guidance', 'GPS guidance or autosteer'],
          ['section_control', 'Section control on the boom or planter'],
          ['variable_rate', 'Variable rate application'],
          ['precision_planter', 'Precision planting equipment'],
          ['soil_moisture', 'Soil moisture probes'],
          ['irrigation_auto', 'Irrigation automation or pump telemetry'],
          ['harvester_setup', 'Harvester changes to reduce damage', 'Web speed, drop heights, padding and the like.'],
          ['yield_sensing', 'Yield or quality sensing on the harvester'],
          ['optical_grading', 'Optical grading on farm'],
          ['machine_telemetry', 'Machine telemetry or maintenance alerts'],
          ['imagery', 'Drones, satellite or aerial imagery'],
          ['farm_software', 'Farm management or record-keeping software'],
          ['robotics', 'Robotics or autonomous machines'],
          ['none', 'Nothing much yet'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'farm_outcome',
        kind: 'single',
        // Asked about one thing on purpose. It used to ask "how did that go,
        // overall?" after somebody ticked five technologies, which forces an
        // average across five different experiences and records a blur.
        prompt: 'Think of the one that mattered most. How did that go?',
        options: opts(
          ['expand', 'Working well, and we would do more of it'],
          ['refine', 'Working, but it needs sorting out'],
          ['stopped', 'We tried it and stopped'],
          ['not_adopted', 'We looked into it and did not go ahead'],
          ['varies', 'Mixed — some of it worked, some did not'],
          ['not_relevant', 'Nothing has really applied to us yet'],
        ),
      },
      {
        id: 'farm_barriers',
        guide: { open: 'What\'s stopped you going further with it?', probe: 'If that was sorted tomorrow, would you go ahead?' },
        tracking: true,
        kind: 'multi',
        prompt: 'What has held you back most?',
        help: 'Tick any that apply.',
        options: ADOPTION_BARRIERS,
        allowOther: true,
      },
      {
        id: 'farm_measures',
        kind: 'multi',
        prompt: 'When you are weighing up a machinery purchase, which numbers do you actually look at?',
        help: 'Tick any that apply.',
        options: opts(
          ['labour_hours', 'Labour hours saved'],
          ['cost_ha', 'Cost per hectare'],
          ['cost_t', 'Cost per tonne'],
          ['yield', 'Yield'],
          ['packout', 'Pack-out', 'The share of the crop that makes saleable grade.'],
          ['quality', 'Quality'],
          ['damage', 'Bruising or damage'],
          ['throughput', 'Throughput'],
          ['timeliness', 'Getting the job done in the window'],
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
        prompt: 'Is there anything running now that would make a good local case study or demonstration?',
        help: 'We are looking for gear that is working in the paddock, not a sales pitch.',
        options: opts(
          ['own_farm', 'Yes — something on our own place'],
          ['known_farm', 'Yes — somewhere else I know of'],
          ['no', 'Not that comes to mind'],
        ),
      },
      {
        id: 'farm_scepticism',
        guide: { open: 'Is there anything being pushed at the moment that you reckon won\'t work here?', probe: 'What makes you say that?' },
        kind: 'text',
        prompt: 'Is anything being pushed at the moment that you reckon will not work in Australian potatoes? What is the concern?',
        help: 'Optional, and genuinely useful. Nobody ticks a box to disagree with the industry, so this is the place to say it.',
        rows: 4,
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
        id: 'con_peak',
        guide: { open: 'When you\'re flat out, which jobs are the ones that bite?', probe: 'What happens to the next client when one of those runs over?' },
        kind: 'multi',
        prompt: 'Which jobs put you under the most pressure in the peak?',
        help: 'Tick any that apply.',
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
        prompt: 'What stops you getting through more work, or doing it better?',
        help: 'Tick any that apply.',
        options: opts(
          ['machine_availability', 'Not enough machines'],
          ['operators', 'Not enough skilled operators'],
          ['parts_lead', 'Parts lead times'],
          ['breakdowns', 'Breakdowns and reliability'],
          ['weather', 'Weather windows'],
          ['client_clash', 'Clients all wanting the same fortnight'],
          ['conditions', 'Paddock conditions and soil type'],
          ['travel', 'Travel time between jobs'],
          ['capital', 'Cost of upgrading gear'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'con_service',
        kind: 'multi',
        prompt: 'On the machinery side, what causes you the most grief?',
        help: 'Tick any that apply.',
        options: opts(
          ['parts_in_season', 'Getting parts during the season'],
          ['dealer_support', 'Local dealer support'],
          ['parts_cost', 'Cost of parts'],
          ['technicians', 'Getting a technician out'],
          ['warranty', 'Warranty and repair turnaround'],
          ['diagnostics', 'Access to diagnostics or software'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'con_skills',
        kind: 'multi',
        prompt: 'Where are the biggest gaps in operator skills?',
        help: 'Tick any that apply.',
        options: opts(
          ['harvester_setup', 'Setting a harvester up for the conditions'],
          ['damage', 'Running gear in a way that limits damage'],
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
        prompt: 'What would make the biggest difference to the service you can offer?',
        help: 'Tick any that apply.',
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
        prompt: 'If we ran a demonstration, what would it take for it to be worth your while?',
        help: 'Tick any that apply.',
        options: opts(
          ['commercial_rates', 'A full day at commercial rates, not a half-hour show'],
          ['paid', 'Payment for your time and machine'],
          ['no_crop_risk', 'No risk to the client crop'],
          ['off_peak', 'Held outside the peak'],
          ['machine_supplied', 'The machine supplied by somebody else'],
          ['independent', 'Independent measurement of the results'],
          ['insurance', 'Insurance and safety sorted beforehand'],
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
        id: 'pro_constraints',
        guide: { open: 'Walk me through the shed — where does it slow down or go wrong?', probe: 'Where do you lose the most people-hours?' },
        kind: 'multi',
        prompt: 'Where are the pinch points — labour, throughput, quality, handling or safety?',
        help: 'Tick any that apply.',
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
        help: 'Tick any that apply.',
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
        id: 'pro_systems',
        tracking: true,
        kind: 'multi',
        prompt: 'What have you put in, trialled, or had a serious look at?',
        help: 'Tick any that apply.',
        options: opts(
          ['optical_size', 'Optical sizing and shape grading'],
          ['optical_defect', 'Optical defect detection'],
          ['internal_quality', 'Internal quality sensing', 'X-ray, near infrared, or similar.'],
          ['auto_packing', 'Automated packing'],
          ['palletising', 'Robotic palletising'],
          ['storage_control', 'Storage climate control'],
          ['traceability', 'Traceability and lot tracking'],
          ['line_data', 'Line performance monitoring'],
          ['none', 'Nothing much yet'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'pro_barriers',
        tracking: true,
        kind: 'multi',
        prompt: 'What has held that back?',
        help: 'Tick any that apply.',
        options: ADOPTION_BARRIERS,
        allowOther: true,
      },
      {
        id: 'pro_measures',
        kind: 'multi',
        prompt: 'Which numbers matter most when you judge whether something is working?',
        help: 'Tick any that apply.',
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
    title: 'Machinery supply and service',
    intro: 'A few questions from the supply side, where you see the whole industry rather than one farm.',
    questions: [
      {
        id: 'mach_available',
        guide: { open: 'What can growers actually buy or trial right now?', probe: 'What\'s coming in the next couple of years?' },
        kind: 'multi',
        prompt: 'What can Australian potato businesses actually buy or trial today?',
        help: 'Tick any that apply.',
        options: AREAS_WITH_OTHER,
        allowOther: true,
      },
      {
        id: 'mach_ready',
        kind: 'multi',
        prompt: 'And of those, which would you say are genuinely ready — not just promising?',
        help: 'Tick any that apply.',
        options: AREAS_WITH_OTHER,
        allowOther: true,
      },
      {
        id: 'mach_barriers',
        tracking: true,
        kind: 'multi',
        prompt: 'What stops your potato customers going ahead?',
        help: 'Tick any that apply.',
        options: ADOPTION_BARRIERS,
        allowOther: true,
      },
      {
        id: 'mach_capacity',
        kind: 'multi',
        prompt: 'What would the industry need on the service side to support more of this gear?',
        help: 'Tick any that apply.',
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
        prompt: 'Where does imported equipment not quite fit Australian conditions?',
        help: 'Tick any that apply.',
        options: opts(
          ['row_spacing', 'Row spacing and bed configuration'],
          ['soil', 'Soil types and conditions'],
          ['scale', 'Scale of our operations'],
          ['terrain', 'Paddock size and terrain'],
          ['season', 'Our seasonal windows'],
          ['integration', 'Fitting in with gear people already run'],
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
        help: 'There is a place to leave your details at the end if so.',
        options: opts(['yes', 'Yes'], ['maybe', 'Possibly, depending on the detail'], ['no', 'No']),
      },
      {
        id: 'mach_other',
        kind: 'text',
        prompt: 'Anything else we should know from where you sit?',
        rows: 3,
      },
    ],
  },
  technology: {
    id: 'technology',
    title: 'Your technology',
    intro: 'A few questions about what you offer. Keep it to a level of detail you are comfortable sharing.',
    questions: [
      {
        id: 'tech_offer',
        guide: { open: 'Tell me about what you do, in plain terms.', probe: 'Where would it sit on a potato operation?' },
        kind: 'multi',
        prompt: 'What sort of technology do you offer?',
        help: 'Tick any that apply. There is room to describe it properly at the end.',
        options: AREAS_WITH_OTHER,
        allowOther: true,
      },
      {
        id: 'tech_problem',
        kind: 'multi',
        prompt: 'What problem does it solve for a potato business?',
        help: 'Tick any that apply.',
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
        prompt: 'What does a business need to have in place for it to work properly?',
        help: 'Tick any that apply.',
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
        help: 'Tick any that apply.',
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
        help: 'Tick any that apply.',
        options: opts(
          ['host_site', 'A host site'],
          ['independent_measure', 'Independent measurement'],
          ['full_season', 'A full season rather than a snapshot'],
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
        help: 'Tick any that apply.',
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
        help: 'Tick any that apply.',
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
        help: 'Tick any that apply.',
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
        prompt: 'Are there groups, programs or people we should be working with rather than around?',
        help: 'Optional. Names are more use to us than categories here.',
        rows: 4,
      },
    ],
  },
  adviser: {
    id: 'adviser',
    title: 'Evidence, evaluation and extension',
    intro: 'A few questions about the evidence base and how findings get used.',
    questions: [
      {
        id: 'adv_gaps',
        guide: { open: 'Where do you reckon the industry is flying blind?', probe: 'What would it take to fill that gap?' },
        kind: 'multi',
        prompt: 'Where are the biggest holes in what we actually know?',
        help: 'Tick any that apply.',
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
        prompt: 'What deserves a proper independent look?',
        help: 'Tick any that apply.',
        options: AREAS_WITH_OTHER,
        allowOther: true,
      },
      {
        id: 'adv_measurements',
        kind: 'multi',
        prompt: 'If we run a demonstration, what should we be measuring?',
        help: 'Tick any that apply.',
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
        help: 'Tick any that apply.',
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
        id: 'adv_sharing',
        kind: 'multi',
        prompt: 'How do findings actually reach potato businesses?',
        help: 'Tick any that apply.',
        options: opts(
          ['case_numbers', 'Short written case studies with the numbers in them'],
          ['field_days', 'Field days where people can see it running'],
          ['existing_groups', 'Through grower groups that already meet'],
          ['webinars', 'Webinars'],
          ['factsheets', 'Factsheets'],
          ['video', 'Short videos'],
          ['one_to_one', 'One-to-one conversations'],
          ['publications', 'Industry publications'],
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
    intro: 'Two quick questions about what has happened since the project started.',
    questions: [
      {
        id: 'fu_seen',
        guide: { open: 'Since we last spoke, have you come across anything from the project?', probe: 'Where did you come across it?' },
        kind: 'multi',
        tracking: true,
        prompt: 'Have you seen or used anything from the Potato Mechanisation Project?',
        help: 'Tick any that apply.',
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
          ['changed', 'Yes — we have changed how we do something'],
          ['planning', 'We are planning a change'],
          ['considering', 'We are looking into it'],
          ['no_change', 'No change'],
          ['not_applicable', 'Have not seen enough to say'],
        ),
      },
      {
        id: 'fu_what',
        kind: 'text',
        prompt: 'If something changed, what was it — and what made the difference?',
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
        prompt: 'What could we do that would be genuinely useful — to your business, or to the industry?',
        rows: 4,
      },
      {
        id: 'pd_avoid',
        guide: { open: 'And what should we not bother with?' },
        kind: 'text',
        prompt: 'And what should we not waste time or money on?',
        rows: 3,
      },
      {
        id: 'pd_formats',
        kind: 'multi',
        prompt: 'How do you like to get this sort of information?',
        help: 'Choose as many as apply.',
        options: opts(
          ['case_studies', 'Short practical case studies'],
          ['videos', 'Videos from commercial operations'],
          ['field_demos', 'Field demonstrations'],
          ['peer_groups', 'Small peer groups'],
          ['webinars', 'Webinars'],
          ['briefings', 'Short online briefings'],
          ['checklists', 'Machinery or operator checklists'],
          ['roi_tools', 'ROI calculators and decision tools'],
          ['factsheets', 'Technical factsheets'],
          ['one_to_one', 'One-to-one discussions'],
          ['articles', 'PotatoLink articles or updates'],
          ['other', 'Other'],
        ),
        allowOther: true,
      },
      {
        id: 'pd_timing',
        kind: 'multi',
        prompt: 'If we wanted a yarn later on, when suits you best?',
        help: 'Choose as many as apply.',
        options: opts(
          ['early_am', 'Early morning'],
          ['late_am', 'Late morning'],
          ['afternoon', 'Afternoon'],
          ['evening', 'Evening'],
          ['off_peak', 'Outside peak production periods'],
          ['winter', 'During winter or the off-season'],
          ['other', 'Other'],
          ['no_say', 'Prefer not to say'],
        ),
        allowOther: true,
      },
    ],
  },
];

export const NO_INTEREST_ID = 'none';

/**
 * Ways to stay involved that anybody can offer, whatever their part of the
 * chain. The project reference group sits here rather than in a pathway,
 * because it is the same commitment for everyone and the project needs to see
 * every volunteer for it in one list.
 */
export const INTEREST_OPTIONS = opts(
  ['reference_group', 'Joining the project reference group', 'A small group that meets a few times a year to steer the project.'],
  ['follow_up', 'Confidential follow-up discussion'],
  ['summary', 'Receiving a summary of findings'],
  ['online_discussion', 'Joining a future online discussion'],
  ['peer_group', 'Participating in a small peer group'],
  ['case_study', 'Contributing to a case study'],
  ['data', 'Contributing de-identified operational data'],
  ['review_tool', 'Reviewing a draft ROI or decision-support tool'],
  ['updates', 'Receiving PotatoLink updates about mechanisation'],
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
    ['pro_benchmark', 'Taking part in an independent grading accuracy assessment'],
  ),
  machinery: opts(
    ['mach_supply_demo', 'Supplying machinery for a demonstration'],
    ['mach_technical_support', 'Providing a technician or operator for a trial'],
    ['mach_briefing', 'Briefing the project on equipment that is coming to market'],
    ['mach_training', 'Helping deliver operator or technician training'],
  ),
  technology: opts(
    ['tech_evaluation', 'Providing your technology for an independent evaluation'],
    ['tech_protocol', 'Helping design what a credible trial would measure'],
    ['tech_integration', 'Working on data compatibility with other systems'],
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
