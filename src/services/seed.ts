import { DEFAULT_QUESTIONNAIRE, ROLES } from '../content/questionnaire';
import type { Answer, AnswerMap, ConsultationResponse, ContactRecord, RoleId } from '../types';

/**
 * Realistic test data, one response per role. Every record carries
 * isTestData: true and the admin area filters it out by default, so a count
 * shown to the project team is never inflated by demonstration rows.
 */

const pathwayFor = (role: RoleId): string =>
  ROLES.find((entry) => entry.id === role)?.pathway ?? 'adviser';

const rating = (values: Record<string, number>): Answer => ({ kind: 'rating', values });

interface SeedSpec {
  readonly role: RoleId;
  readonly regions: readonly string[];
  readonly constraints: readonly string[];
  readonly topThree: readonly string[];
  readonly impacts: readonly string[];
  readonly badSeason: string;
  readonly areas: Record<string, number>;
  readonly opportunities: string;
  readonly evidence: readonly string[];
  readonly pathwayAnswers: AnswerMap;
  readonly mostUseful: string;
  readonly avoid: string;
  readonly formats: readonly string[];
  readonly timing: readonly string[];
  readonly minutes: number;
}

const SPECS: readonly SeedSpec[] = [
  {
    role: 'grower',
    regions: ['tas_north'],
    constraints: ['harvesting', 'harvest_logistics', 'skills', 'storage'],
    topThree: ['harvesting', 'skills', 'harvest_logistics'],
    impacts: ['labour_avail', 'timeliness', 'damage'],
    badSeason:
      'A wet November and we simply cannot lift on time. Last season we left two paddocks a fortnight late, the skin set went off and the pack-out dropped about eight per cent. Chasing extra crew at that point costs more than the crop is worth.',
    areas: {
      harvest_efficiency: 5,
      harvest_logistics: 5,
      training: 4,
      optical_sorting: 3,
      autonomy: 3,
      sensors: 3,
      precision_planting: 4,
      robotics: 2,
      irrigation_automation: 4,
      predictive_maintenance: 4,
      packhouse_automation: 2,
      interoperability: 2,
    },
    opportunities:
      'Harvester damage reduction first. Small changes to web speed and drop heights make a real difference and cost very little compared with a new machine.',
    evidence: ['local_demo', 'roi', 'peer', 'service'],
    pathwayAnswers: {
      farm_pressure: {
        kind: 'text',
        value: 'Harvest and carting. Two operators do the bulk of it and if one is away we are stopped.',
      },
      farm_adopted: {
        kind: 'text',
        value: 'GPS guidance and section control on the boom. Looked hard at an optical sorter on the grader line.',
      },
      farm_outcome: { kind: 'single', value: 'refine' },
      farm_barriers: { kind: 'multi', values: ['capital', 'roi', 'service'], other: '' },
      farm_measures: { kind: 'multi', values: ['labour_hours', 'packout', 'damage', 'timeliness'], other: '' },
      farm_case_study: {
        kind: 'text',
        value: 'Happy to show the guidance setup and our bruise sampling at the shed if that is useful.',
      },
      farm_scepticism: {
        kind: 'text',
        value:
          'Fully autonomous tractors in our country. Paddocks are small and hilly and the service support is not there yet.',
      },
    },
    mostUseful:
      'Independent bruise and damage benchmarking across a few different harvesters, in our conditions, with the numbers published.',
    avoid: 'Another survey of what growers think. Go and measure something on a working farm.',
    formats: ['case_studies', 'field_demos', 'peer_groups', 'articles'],
    timing: ['early_am', 'winter'],
    minutes: 11,
  },
  {
    role: 'farm_manager',
    regions: ['sa_murraylands'],
    constraints: ['irrigation', 'monitoring', 'maintenance', 'skills'],
    topThree: ['skills', 'maintenance', 'irrigation'],
    impacts: ['labour_avail', 'downtime', 'skills'],
    badSeason:
      'We lose days waiting on parts. In January that is irrigation missed, and you cannot get that back in a crop.',
    areas: {
      predictive_maintenance: 5,
      training: 5,
      irrigation_automation: 5,
      sensors: 4,
      harvest_efficiency: 3,
      autonomy: 2,
      optical_sorting: 2,
      packhouse_automation: 2,
      robotics: 2,
      precision_planting: 3,
      harvest_logistics: 3,
      interoperability: 3,
    },
    opportunities: 'Irrigation automation tied to soil moisture. It is the one that saves both water and labour hours.',
    evidence: ['operating_data', 'training', 'service', 'compatibility'],
    pathwayAnswers: {
      farm_pressure: { kind: 'text', value: 'Irrigation shifts and machinery breakdowns during the peak.' },
      farm_adopted: { kind: 'text', value: 'Soil moisture probes, variable rate on the pivot, a telemetry package on pumps.' },
      farm_outcome: { kind: 'single', value: 'expand' },
      farm_barriers: { kind: 'multi', values: ['operators', 'fit', 'data'], other: '' },
      farm_measures: { kind: 'multi', values: ['labour_hours', 'inputs', 'maintenance', 'timeliness'], other: '' },
      farm_case_study: { kind: 'text', value: 'The pump telemetry has paid for itself. Worth writing up.' },
      farm_scepticism: { kind: 'text', value: '' },
    },
    mostUseful: 'Short, practical training for operators. Most of the gear we already have is not used properly.',
    avoid: 'Big conference presentations.',
    formats: ['checklists', 'videos', 'briefings'],
    timing: ['late_am', 'off_peak'],
    minutes: 8,
  },
  {
    role: 'contractor',
    regions: ['vic_ballarat', 'vic_gippsland'],
    constraints: ['harvesting', 'harvest_logistics', 'maintenance'],
    topThree: ['harvest_logistics', 'maintenance', 'harvesting'],
    impacts: ['timeliness', 'downtime', 'labour_cost'],
    badSeason: 'Everyone wants us in the same fortnight. If a machine goes down we push three clients back a week.',
    areas: {
      harvest_logistics: 5,
      predictive_maintenance: 5,
      harvest_efficiency: 4,
      training: 4,
      autonomy: 3,
      sensors: 3,
      precision_planting: 3,
      optical_sorting: 2,
      robotics: 1,
      packhouse_automation: 1,
      irrigation_automation: 2,
      interoperability: 3,
    },
    opportunities: 'Anything that shortens the changeover between jobs, and better parts availability in season.',
    evidence: ['local_demo', 'service', 'operating_data'],
    pathwayAnswers: {
      con_peak: { kind: 'text', value: 'Lifting and carting through March and April. Everything else can wait.' },
      con_limits: { kind: 'text', value: 'Machine availability and finding operators who can run a harvester properly.' },
      con_service: { kind: 'text', value: 'Parts out of Europe on a three week lead time is the killer.' },
      con_skills: { kind: 'text', value: 'Setting a harvester up for conditions. Most damage happens at the settings.' },
      con_tech: { kind: 'text', value: 'Load tracking between paddock and shed so nobody is waiting on a truck.' },
      con_demo: { kind: 'text', value: 'It has to run a full day at commercial rates, not a half hour demonstration.' },
    },
    mostUseful: 'Help the industry lift operator skills. That is worth more than new machinery.',
    avoid: 'Trials on plots that do not reflect commercial speed.',
    formats: ['field_demos', 'checklists', 'one_to_one'],
    timing: ['evening', 'winter'],
    minutes: 9,
  },
  {
    role: 'processor',
    regions: ['tas_north', 'vic_ballarat'],
    constraints: ['grading', 'receival', 'packing', 'data'],
    topThree: ['grading', 'packing', 'data'],
    impacts: ['labour_avail', 'quality', 'labour_cost'],
    badSeason: 'We run short shifts because we cannot staff the grading table, and quality complaints follow.',
    areas: {
      optical_sorting: 5,
      packhouse_automation: 5,
      robotics: 4,
      sensors: 4,
      interoperability: 4,
      training: 3,
      harvest_efficiency: 3,
      harvest_logistics: 3,
      predictive_maintenance: 4,
      precision_planting: 2,
      autonomy: 2,
      irrigation_automation: 1,
    },
    opportunities: 'Optical grading with defect classification that actually holds up on dirty potatoes.',
    evidence: ['operating_data', 'case_study', 'roi', 'compatibility'],
    pathwayAnswers: {
      pro_constraints: {
        kind: 'text',
        value: 'Manual grading at receival, and palletising at the end of the line. Both are people-limited.',
      },
      pro_losses: { kind: 'text', value: 'Bruising from drops between conveyors, and greening in store.' },
      pro_systems: { kind: 'text', value: 'Trialled an optical sorter for size and shape. Defect detection was not reliable enough.' },
      pro_barriers: { kind: 'multi', values: ['capital', 'evidence', 'service'], other: '' },
      pro_measures: { kind: 'multi', values: ['throughput', 'labour', 'grading_accuracy', 'damage'], other: '' },
      pro_case_study: { kind: 'text', value: 'An independent accuracy assessment against a manual grade would be valuable.' },
    },
    mostUseful: 'Independent testing of sorting accuracy under real conditions, not vendor figures.',
    avoid: 'Duplicating what equipment suppliers already publish.',
    formats: ['case_studies', 'roi_tools', 'factsheets'],
    timing: ['afternoon', 'off_peak'],
    minutes: 10,
  },
  {
    role: 'machinery',
    regions: ['national'],
    constraints: ['maintenance', 'skills', 'harvesting'],
    topThree: ['skills', 'maintenance', 'harvesting'],
    impacts: ['skills', 'downtime', 'labour_cost'],
    badSeason: 'Customers cannot get technicians, so small faults become whole-season problems.',
    areas: {
      training: 5,
      predictive_maintenance: 5,
      harvest_efficiency: 4,
      sensors: 4,
      interoperability: 4,
      autonomy: 3,
      optical_sorting: 3,
      packhouse_automation: 3,
      precision_planting: 3,
      harvest_logistics: 3,
      robotics: 2,
      irrigation_automation: 3,
    },
    opportunities: 'Technician training pathways, and getting machine data off equipment in a usable form.',
    evidence: ['local_demo', 'training', 'compatibility'],
    pathwayAnswers: {
      mach_available: {
        kind: 'text',
        value: 'Planter section control, harvester sensing and web speed automation, in-shed optical grading.',
      },
      mach_ready: { kind: 'text', value: 'Optical grading and machine telemetry are ready now. Field autonomy is not.' },
      mach_barriers: { kind: 'multi', values: ['capital', 'roi', 'service', 'operators'], other: '' },
      mach_capacity: { kind: 'text', value: 'More field technicians, and a parts pool held in country through the season.' },
      mach_gaps: { kind: 'text', value: 'Machines designed for northern hemisphere row spacing and soil types.' },
      mach_contribute: { kind: 'single', value: 'yes' },
    },
    mostUseful: 'A clear-eyed assessment of what is genuinely commercially ready for Australian conditions.',
    avoid: 'Promoting prototypes as though they were products.',
    formats: ['field_demos', 'factsheets', 'one_to_one'],
    timing: ['afternoon'],
    minutes: 8,
  },
  {
    role: 'technology',
    regions: ['national'],
    constraints: ['data', 'monitoring', 'grading'],
    topThree: ['data', 'grading', 'monitoring'],
    impacts: ['data', 'quality', 'labour_cost'],
    badSeason: 'Decisions get made on memory rather than measurement, and the same mistakes repeat.',
    areas: {
      sensors: 5,
      interoperability: 5,
      optical_sorting: 4,
      robotics: 4,
      predictive_maintenance: 4,
      autonomy: 3,
      packhouse_automation: 3,
      harvest_efficiency: 3,
      precision_planting: 3,
      harvest_logistics: 3,
      irrigation_automation: 3,
      training: 3,
    },
    opportunities: 'Common data formats. Without them every integration is a custom job and nothing scales.',
    evidence: ['local_demo', 'operating_data', 'compatibility'],
    pathwayAnswers: {
      tech_offer: { kind: 'text', value: 'In-line quality sensing that records defect classes against a grower and paddock.' },
      tech_problem: { kind: 'text', value: 'Quality data is captured by hand at receival, if at all, and is not comparable between sites.' },
      tech_maturity: { kind: 'single', value: 'overseas' },
      tech_requirements: { kind: 'text', value: 'Consistent lighting, a conveyor of known speed, and network access at the shed.' },
      tech_evidence: { kind: 'text', value: 'European packhouse data showing grading labour down about 30 per cent.' },
      tech_demo: { kind: 'text', value: 'A full season at one Australian packhouse, with an independent party holding the numbers.' },
    },
    mostUseful: 'Set data standards the industry can actually agree on.',
    avoid: 'Funding one-off software that nobody maintains after the project ends.',
    formats: ['briefings', 'factsheets', 'one_to_one'],
    timing: ['late_am'],
    minutes: 9,
  },
  {
    role: 'adviser',
    regions: ['sa_southeast', 'vic_ballarat'],
    constraints: ['monitoring', 'skills', 'data', 'harvesting'],
    topThree: ['skills', 'monitoring', 'data'],
    impacts: ['skills', 'data', 'timeliness'],
    badSeason: 'Growers fall back on what they did last year, because there is no local evidence to do otherwise.',
    areas: {
      training: 5,
      sensors: 4,
      harvest_efficiency: 4,
      interoperability: 4,
      optical_sorting: 3,
      precision_planting: 4,
      irrigation_automation: 4,
      predictive_maintenance: 3,
      packhouse_automation: 3,
      harvest_logistics: 3,
      autonomy: 2,
      robotics: 2,
    },
    opportunities: 'Harvest damage, because it is measurable, and the results transfer between businesses.',
    evidence: ['local_demo', 'roi', 'operating_data', 'case_study'],
    pathwayAnswers: {
      adv_gaps: { kind: 'text', value: 'There is almost no Australian data on the cost of handling damage through the chain.' },
      adv_evaluate: { kind: 'text', value: 'Optical grading accuracy, and harvester setting effects on bruising.' },
      adv_measurements: {
        kind: 'text',
        value: 'Bruise incidence by sampling point, throughput, labour hours, fuel, and a consistent defect scoring method.',
      },
      adv_underrepresented: { kind: 'text', value: 'Machinery operators, and smaller family operations under about 50 hectares.' },
      adv_sharing: { kind: 'text', value: 'Short written case studies with the numbers, plus a field day where people can see it.' },
      adv_connections: { kind: 'text', value: 'The existing PotatoLink demonstration sites, and the soil health work in Tasmania.' },
    },
    mostUseful: 'Generate Australian numbers. Everything else follows from that.',
    avoid: 'Repeating overseas literature reviews.',
    formats: ['case_studies', 'field_demos', 'webinars', 'factsheets'],
    timing: ['late_am', 'off_peak'],
    minutes: 12,
  },
  {
    role: 'industry_body',
    regions: ['national'],
    constraints: ['skills', 'data', 'maintenance'],
    topThree: ['skills', 'data', 'maintenance'],
    impacts: ['skills', 'labour_avail', 'whs'],
    badSeason: 'Workforce shortages hit every region at once and there is no shared response.',
    areas: {
      training: 5,
      interoperability: 4,
      sensors: 3,
      harvest_efficiency: 3,
      predictive_maintenance: 3,
      optical_sorting: 3,
      packhouse_automation: 3,
      robotics: 3,
      precision_planting: 2,
      harvest_logistics: 3,
      autonomy: 2,
      irrigation_automation: 3,
    },
    opportunities: 'Workforce and skills pathways, linked to the machinery that is actually being bought.',
    evidence: ['case_study', 'peer', 'safety'],
    pathwayAnswers: {
      adv_gaps: { kind: 'text', value: 'What automation actually does to workforce numbers and skill mix on Australian farms.' },
      adv_evaluate: { kind: 'text', value: 'Safety outcomes where semi-automated handling has been introduced.' },
      adv_measurements: { kind: 'text', value: 'Labour hours by task, injury and near miss reporting, training time required.' },
      adv_underrepresented: { kind: 'text', value: 'Seasonal workers and the labour hire sector.' },
      adv_sharing: { kind: 'text', value: 'Through existing grower groups rather than new channels.' },
      adv_connections: { kind: 'text', value: 'State farming organisations and the relevant training packages.' },
    },
    mostUseful: 'Connect the mechanisation work to workforce planning rather than treating them separately.',
    avoid: 'Creating a new grower network. Use the ones that exist.',
    formats: ['briefings', 'articles', 'peer_groups'],
    timing: ['afternoon', 'no_say'],
    minutes: 7,
  },
];

const isoDaysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(9, 30, 0, 0);
  return date.toISOString();
};

export const seedResponses = (): readonly ConsultationResponse[] =>
  SPECS.map((spec, index) => {
    const submittedAt = isoDaysAgo(SPECS.length - index);
    const durationSeconds = spec.minutes * 60;
    const answers: AnswerMap = {
      q1_constraints: { kind: 'multi', values: spec.constraints, other: '' },
      q2_top_three: { kind: 'rank', values: spec.topThree },
      q3_impact: { kind: 'multi', values: spec.impacts, other: '' },
      q4_bad_season: { kind: 'text', value: spec.badSeason },
      q5_areas: rating(spec.areas),
      q6_first_opportunities: { kind: 'text', value: spec.opportunities },
      q7_evidence: { kind: 'multi', values: spec.evidence, other: '' },
      ...spec.pathwayAnswers,
      pd_most_useful: { kind: 'text', value: spec.mostUseful },
      pd_avoid: { kind: 'text', value: spec.avoid },
      pd_formats: { kind: 'multi', values: spec.formats, other: '' },
      pd_timing: { kind: 'multi', values: spec.timing, other: '' },
    };
    return {
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      roundId: DEFAULT_QUESTIONNAIRE.roundId,
      role: spec.role,
      pathway: pathwayFor(spec.role),
      regions: spec.regions,
      regionOther: '',
      answers,
      startedAt: new Date(new Date(submittedAt).getTime() - durationSeconds * 1000).toISOString(),
      submittedAt,
      durationSeconds,
      isTestData: true,
    };
  });

export const seedContacts = (): readonly ContactRecord[] => [
  {
    id: '00000000-0000-4000-9000-000000000001',
    roundId: DEFAULT_QUESTIONNAIRE.roundId,
    interests: ['farm_host_trial', 'reference_group', 'case_study', 'summary'],
    name: 'TEST DATA — Alex Fielding',
    organisation: 'TEST DATA — Fielding Farms',
    broadRole: 'Grower',
    region: 'Tasmania, North West',
    email: 'test.alex@example.invalid',
    phone: '',
    preferredContactMethod: 'email',
    preferredContactTime: 'Weekday mornings, outside harvest',
    comments: 'Happy to host a harvester damage demonstration.',
    submittedAt: isoDaysAgo(6),
    isTestData: true,
  },
  {
    id: '00000000-0000-4000-9000-000000000002',
    roundId: DEFAULT_QUESTIONNAIRE.roundId,
    interests: ['pro_line_measurement', 'follow_up', 'review_tool', 'updates'],
    name: 'TEST DATA — Jordan Pike',
    organisation: 'TEST DATA — Riverbend Packing',
    broadRole: 'Packhouse manager',
    region: 'Victoria, Ballarat',
    email: '',
    phone: '0400 000 000',
    preferredContactMethod: 'phone',
    preferredContactTime: 'Afternoons',
    comments: '',
    submittedAt: isoDaysAgo(4),
    isTestData: true,
  },
];
