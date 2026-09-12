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
      farm_pressure: { kind: 'multi', values: ['harvest', 'carting', 'staffing'], other: '' },
      farm_adopted: { kind: 'multi', values: ['guidance', 'section_control', 'harvester_setup'], other: '' },
      farm_outcome: { kind: 'single', value: 'refine' },
      farm_barriers: { kind: 'multi', values: ['capital', 'roi', 'service'], other: '' },
      farm_measures: { kind: 'multi', values: ['labour_hours', 'packout', 'damage', 'timeliness'], other: '' },
      farm_case_study: { kind: 'single', value: 'own_farm' },
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
      farm_pressure: { kind: 'multi', values: ['irrigation', 'maintenance', 'staffing'], other: '' },
      farm_adopted: { kind: 'multi', values: ['soil_moisture', 'irrigation_auto', 'machine_telemetry'], other: '' },
      farm_outcome: { kind: 'single', value: 'expand' },
      farm_barriers: { kind: 'multi', values: ['operators', 'fit', 'data'], other: '' },
      farm_measures: { kind: 'multi', values: ['labour_hours', 'inputs', 'maintenance'], other: '' },
      farm_case_study: { kind: 'single', value: 'own_farm' },
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
      con_peak: { kind: 'multi', values: ['harvest', 'carting', 'machine_moves'], other: '' },
      con_limits: { kind: 'multi', values: ['machine_availability', 'operators', 'parts_lead'], other: '' },
      con_service: { kind: 'multi', values: ['parts_in_season', 'technicians'], other: '' },
      con_skills: { kind: 'multi', values: ['harvester_setup', 'damage', 'new_operators'], other: '' },
      con_tech: { kind: 'multi', values: ['logistics', 'telemetry', 'training'], other: '' },
      con_demo: { kind: 'multi', values: ['commercial_rates', 'paid', 'off_peak'], other: '' },
      con_other: { kind: 'text', value: 'Parts out of Europe on a three week lead time is the killer.' },
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
      pro_constraints: { kind: 'multi', values: ['grading', 'defects', 'palletising', 'staffing'], other: '' },
      pro_losses: { kind: 'multi', values: ['bruising', 'greening', 'misgrades'], other: '' },
      pro_systems: { kind: 'multi', values: ['optical_size', 'optical_defect'], other: '' },
      pro_barriers: { kind: 'multi', values: ['capital', 'evidence', 'service'], other: '' },
      pro_measures: { kind: 'multi', values: ['throughput', 'labour', 'grading_accuracy', 'damage'], other: '' },
      pro_other: {
        kind: 'text',
        value:
          'Defect detection was not reliable enough on dirty potatoes. An independent accuracy assessment would be valuable.',
      },
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
        kind: 'multi',
        values: ['planting', 'harvest', 'optical', 'sensors', 'maintenance'],
        other: '',
      },
      mach_ready: { kind: 'multi', values: ['optical', 'sensors', 'maintenance'], other: '' },
      mach_barriers: { kind: 'multi', values: ['capital', 'roi', 'service', 'operators'], other: '' },
      mach_capacity: { kind: 'multi', values: ['field_techs', 'parts_holding', 'tech_training'], other: '' },
      mach_gaps: { kind: 'multi', values: ['row_spacing', 'soil', 'scale', 'support_distance'], other: '' },
      mach_contribute: { kind: 'single', value: 'yes' },
      mach_other: {
        kind: 'text',
        value: 'Machines are designed for northern hemisphere row spacing and soil types.',
      },
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
      tech_offer: { kind: 'multi', values: ['optical', 'sensors', 'data_standards'], other: '' },
      tech_problem: { kind: 'multi', values: ['quality', 'data', 'labour'], other: '' },
      tech_maturity: { kind: 'single', value: 'overseas' },
      tech_requirements: { kind: 'multi', values: ['connectivity', 'conditions', 'integration'], other: '' },
      tech_evidence: { kind: 'multi', values: ['overseas_commercial', 'customer_case'], other: '' },
      tech_demo: { kind: 'multi', values: ['host_site', 'independent_measure', 'full_season'], other: '' },
      tech_other: {
        kind: 'text',
        value:
          'In-line quality sensing that records defect classes against a grower and paddock. Quality data is captured by hand at receival, if at all.',
      },
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
      adv_gaps: { kind: 'multi', values: ['damage_cost', 'roi_au', 'workforce'], other: '' },
      adv_evaluate: { kind: 'multi', values: ['optical', 'harvest'], other: '' },
      adv_measurements: { kind: 'multi', values: ['damage', 'throughput', 'labour_hours', 'cost'], other: '' },
      adv_underrepresented: { kind: 'multi', values: ['operators', 'small_farms'], other: '' },
      adv_sharing: { kind: 'multi', values: ['case_numbers', 'field_days', 'existing_groups'], other: '' },
      adv_connections: {
        kind: 'text',
        value: 'The existing PotatoLink demonstration sites, and the soil health work in Tasmania.',
      },
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
      adv_gaps: { kind: 'multi', values: ['workforce', 'labour_impact', 'safety'], other: '' },
      adv_evaluate: { kind: 'multi', values: ['training', 'robotics'], other: '' },
      adv_measurements: { kind: 'multi', values: ['labour_hours', 'safety'], other: '' },
      adv_underrepresented: { kind: 'multi', values: ['seasonal', 'operators'], other: '' },
      adv_sharing: { kind: 'multi', values: ['existing_groups', 'publications'], other: '' },
      adv_connections: {
        kind: 'text',
        value: 'State farming organisations and the relevant training packages.',
      },
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
