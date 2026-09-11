-- Seeded TEST DATA for the PT25003 consultation.
--
-- Every row has is_test_data = true. The admin area hides these by default, so
-- a response count shown to the project team is never inflated by them.
-- Run this only in a development or staging project, and clear the rows with
--   delete from public.consultation_responses where is_test_data;
--   delete from public.consultation_contacts  where is_test_data;
-- before the consultation goes live.

insert into public.consultation_rounds (round_id, label, is_active)
values ('2026-round-1', 'PT25003 consultation, round 1', true)
on conflict (round_id) do nothing;

insert into public.consultation_responses
  (id, round_id, role, pathway, regions, region_other, answers, started_at, submitted_at, duration_seconds, is_test_data)
values (
  '00000000-0000-4000-8000-000000000001', '2026-round-1', 'grower', 'farm', array['tas_north']::text[], '',
  '{"q1_constraints": {"kind": "multi", "values": ["harvesting", "harvest_logistics", "skills", "storage"], "other": ""}, "q2_top_three": {"kind": "rank", "values": ["harvesting", "skills", "harvest_logistics"]}, "q3_impact": {"kind": "multi", "values": ["labour_avail", "timeliness", "damage"], "other": ""}, "q4_bad_season": {"kind": "text", "value": "A wet November and we cannot lift on time. Last season two paddocks went a fortnight late and pack-out dropped about eight per cent."}, "q5_areas": {"kind": "rating", "values": {"harvest_efficiency": 5, "harvest_logistics": 5, "training": 4, "precision_planting": 4, "irrigation_automation": 4, "predictive_maintenance": 4, "optical_sorting": 3, "autonomy": 3, "sensors": 3, "robotics": 2, "packhouse_automation": 2, "interoperability": 2}}, "q6_first_opportunities": {"kind": "text", "value": "Harvester damage reduction. Small changes to web speed and drop heights cost very little."}, "q7_evidence": {"kind": "multi", "values": ["local_demo", "roi", "peer", "service"], "other": ""}, "pd_most_useful": {"kind": "text", "value": "Independent bruise benchmarking across different harvesters, with the numbers published."}, "pd_avoid": {"kind": "text", "value": "Another survey of what growers think."}, "pd_formats": {"kind": "multi", "values": ["case_studies", "field_demos", "peer_groups"], "other": ""}, "pd_timing": {"kind": "multi", "values": ["early_am", "winter"], "other": ""}, "farm_pressure": {"kind": "text", "value": "Harvest and carting. Two operators do the bulk of it."}, "farm_outcome": {"kind": "single", "value": "refine"}, "farm_barriers": {"kind": "multi", "values": ["capital", "roi", "service"], "other": ""}, "farm_measures": {"kind": "multi", "values": ["labour_hours", "packout", "damage", "timeliness"], "other": ""}}'::jsonb,
  now() - interval '1 days' - interval '660 seconds',
  now() - interval '1 days',
  660, true
) on conflict (id) do nothing;

insert into public.consultation_responses
  (id, round_id, role, pathway, regions, region_other, answers, started_at, submitted_at, duration_seconds, is_test_data)
values (
  '00000000-0000-4000-8000-000000000002', '2026-round-1', 'farm_manager', 'farm', array['sa_murraylands']::text[], '',
  '{"q1_constraints": {"kind": "multi", "values": ["irrigation", "monitoring", "maintenance", "skills"], "other": ""}, "q2_top_three": {"kind": "rank", "values": ["skills", "maintenance", "irrigation"]}, "q3_impact": {"kind": "multi", "values": ["labour_avail", "downtime", "skills"], "other": ""}, "q4_bad_season": {"kind": "text", "value": "We lose days waiting on parts. In January that is irrigation missed, and you cannot get that back."}, "q5_areas": {"kind": "rating", "values": {"predictive_maintenance": 5, "training": 5, "irrigation_automation": 5, "sensors": 4, "harvest_efficiency": 3, "precision_planting": 3, "harvest_logistics": 3, "interoperability": 3, "autonomy": 2, "optical_sorting": 2, "packhouse_automation": 2, "robotics": 2}}, "q6_first_opportunities": {"kind": "text", "value": "Irrigation automation tied to soil moisture."}, "q7_evidence": {"kind": "multi", "values": ["operating_data", "training", "service", "compatibility"], "other": ""}, "pd_most_useful": {"kind": "text", "value": "Short practical training for operators."}, "pd_avoid": {"kind": "text", "value": "Big conference presentations."}, "pd_formats": {"kind": "multi", "values": ["checklists", "videos", "briefings"], "other": ""}, "pd_timing": {"kind": "multi", "values": ["late_am", "off_peak"], "other": ""}, "farm_pressure": {"kind": "text", "value": "Irrigation shifts and breakdowns during the peak."}, "farm_outcome": {"kind": "single", "value": "expand"}, "farm_barriers": {"kind": "multi", "values": ["operators", "fit", "data"], "other": ""}, "farm_measures": {"kind": "multi", "values": ["labour_hours", "inputs", "maintenance"], "other": ""}}'::jsonb,
  now() - interval '2 days' - interval '480 seconds',
  now() - interval '2 days',
  480, true
) on conflict (id) do nothing;

insert into public.consultation_responses
  (id, round_id, role, pathway, regions, region_other, answers, started_at, submitted_at, duration_seconds, is_test_data)
values (
  '00000000-0000-4000-8000-000000000003', '2026-round-1', 'contractor', 'contractor', array['vic_ballarat','vic_gippsland']::text[], '',
  '{"q1_constraints": {"kind": "multi", "values": ["harvesting", "harvest_logistics", "maintenance"], "other": ""}, "q2_top_three": {"kind": "rank", "values": ["harvest_logistics", "maintenance", "harvesting"]}, "q3_impact": {"kind": "multi", "values": ["timeliness", "downtime", "labour_cost"], "other": ""}, "q4_bad_season": {"kind": "text", "value": "Everyone wants us in the same fortnight. A breakdown pushes three clients back a week."}, "q5_areas": {"kind": "rating", "values": {"harvest_logistics": 5, "predictive_maintenance": 5, "harvest_efficiency": 4, "training": 4, "autonomy": 3, "sensors": 3, "precision_planting": 3, "interoperability": 3, "optical_sorting": 2, "irrigation_automation": 2, "robotics": 1, "packhouse_automation": 1}}, "q6_first_opportunities": {"kind": "text", "value": "Anything that shortens changeover between jobs, and parts availability in season."}, "q7_evidence": {"kind": "multi", "values": ["local_demo", "service", "operating_data"], "other": ""}, "pd_most_useful": {"kind": "text", "value": "Help the industry lift operator skills."}, "pd_avoid": {"kind": "text", "value": "Trials that do not reflect commercial speed."}, "pd_formats": {"kind": "multi", "values": ["field_demos", "checklists", "one_to_one"], "other": ""}, "pd_timing": {"kind": "multi", "values": ["evening", "winter"], "other": ""}, "con_peak": {"kind": "text", "value": "Lifting and carting through March and April."}, "con_limits": {"kind": "text", "value": "Machine availability and finding capable operators."}, "con_service": {"kind": "text", "value": "Parts out of Europe on a three week lead time."}, "con_demo": {"kind": "text", "value": "It has to run a full day at commercial rates."}}'::jsonb,
  now() - interval '3 days' - interval '540 seconds',
  now() - interval '3 days',
  540, true
) on conflict (id) do nothing;

insert into public.consultation_responses
  (id, round_id, role, pathway, regions, region_other, answers, started_at, submitted_at, duration_seconds, is_test_data)
values (
  '00000000-0000-4000-8000-000000000004', '2026-round-1', 'processor', 'processor', array['tas_north','vic_ballarat']::text[], '',
  '{"q1_constraints": {"kind": "multi", "values": ["grading", "receival", "packing", "data"], "other": ""}, "q2_top_three": {"kind": "rank", "values": ["grading", "packing", "data"]}, "q3_impact": {"kind": "multi", "values": ["labour_avail", "quality", "labour_cost"], "other": ""}, "q4_bad_season": {"kind": "text", "value": "We run short shifts because we cannot staff the grading table, and quality complaints follow."}, "q5_areas": {"kind": "rating", "values": {"optical_sorting": 5, "packhouse_automation": 5, "robotics": 4, "sensors": 4, "interoperability": 4, "predictive_maintenance": 4, "training": 3, "harvest_efficiency": 3, "harvest_logistics": 3, "precision_planting": 2, "autonomy": 2, "irrigation_automation": 1}}, "q6_first_opportunities": {"kind": "text", "value": "Optical grading with defect classification that holds up on dirty potatoes."}, "q7_evidence": {"kind": "multi", "values": ["operating_data", "case_study", "roi", "compatibility"], "other": ""}, "pd_most_useful": {"kind": "text", "value": "Independent testing of sorting accuracy under real conditions."}, "pd_avoid": {"kind": "text", "value": "Duplicating what suppliers already publish."}, "pd_formats": {"kind": "multi", "values": ["case_studies", "roi_tools", "factsheets"], "other": ""}, "pd_timing": {"kind": "multi", "values": ["afternoon", "off_peak"], "other": ""}, "pro_constraints": {"kind": "text", "value": "Manual grading at receival, and palletising. Both are people-limited."}, "pro_losses": {"kind": "text", "value": "Bruising from drops between conveyors, and greening in store."}, "pro_barriers": {"kind": "multi", "values": ["capital", "evidence", "service"], "other": ""}, "pro_measures": {"kind": "multi", "values": ["throughput", "labour", "grading_accuracy", "damage"], "other": ""}}'::jsonb,
  now() - interval '4 days' - interval '600 seconds',
  now() - interval '4 days',
  600, true
) on conflict (id) do nothing;

insert into public.consultation_responses
  (id, round_id, role, pathway, regions, region_other, answers, started_at, submitted_at, duration_seconds, is_test_data)
values (
  '00000000-0000-4000-8000-000000000005', '2026-round-1', 'machinery', 'machinery', array['national']::text[], '',
  '{"q1_constraints": {"kind": "multi", "values": ["maintenance", "skills", "harvesting"], "other": ""}, "q2_top_three": {"kind": "rank", "values": ["skills", "maintenance", "harvesting"]}, "q3_impact": {"kind": "multi", "values": ["skills", "downtime", "labour_cost"], "other": ""}, "q4_bad_season": {"kind": "text", "value": "Customers cannot get technicians, so small faults become whole-season problems."}, "q5_areas": {"kind": "rating", "values": {"training": 5, "predictive_maintenance": 5, "harvest_efficiency": 4, "sensors": 4, "interoperability": 4, "autonomy": 3, "optical_sorting": 3, "packhouse_automation": 3, "precision_planting": 3, "harvest_logistics": 3, "irrigation_automation": 3, "robotics": 2}}, "q6_first_opportunities": {"kind": "text", "value": "Technician training pathways, and getting machine data off equipment usefully."}, "q7_evidence": {"kind": "multi", "values": ["local_demo", "training", "compatibility"], "other": ""}, "pd_most_useful": {"kind": "text", "value": "A clear-eyed assessment of what is commercially ready here."}, "pd_avoid": {"kind": "text", "value": "Promoting prototypes as though they were products."}, "pd_formats": {"kind": "multi", "values": ["field_demos", "factsheets", "one_to_one"], "other": ""}, "pd_timing": {"kind": "multi", "values": ["afternoon"], "other": ""}, "mach_available": {"kind": "text", "value": "Planter section control, harvester sensing, in-shed optical grading."}, "mach_ready": {"kind": "text", "value": "Optical grading and telemetry are ready. Field autonomy is not."}, "mach_barriers": {"kind": "multi", "values": ["capital", "roi", "service", "operators"], "other": ""}, "mach_contribute": {"kind": "single", "value": "yes"}}'::jsonb,
  now() - interval '5 days' - interval '480 seconds',
  now() - interval '5 days',
  480, true
) on conflict (id) do nothing;

insert into public.consultation_responses
  (id, round_id, role, pathway, regions, region_other, answers, started_at, submitted_at, duration_seconds, is_test_data)
values (
  '00000000-0000-4000-8000-000000000006', '2026-round-1', 'technology', 'technology', array['national']::text[], '',
  '{"q1_constraints": {"kind": "multi", "values": ["data", "monitoring", "grading"], "other": ""}, "q2_top_three": {"kind": "rank", "values": ["data", "grading", "monitoring"]}, "q3_impact": {"kind": "multi", "values": ["data", "quality", "labour_cost"], "other": ""}, "q4_bad_season": {"kind": "text", "value": "Decisions get made on memory rather than measurement, and the same mistakes repeat."}, "q5_areas": {"kind": "rating", "values": {"sensors": 5, "interoperability": 5, "optical_sorting": 4, "robotics": 4, "predictive_maintenance": 4, "autonomy": 3, "packhouse_automation": 3, "harvest_efficiency": 3, "precision_planting": 3, "harvest_logistics": 3, "irrigation_automation": 3, "training": 3}}, "q6_first_opportunities": {"kind": "text", "value": "Common data formats. Without them every integration is a custom job."}, "q7_evidence": {"kind": "multi", "values": ["local_demo", "operating_data", "compatibility"], "other": ""}, "pd_most_useful": {"kind": "text", "value": "Set data standards the industry can agree on."}, "pd_avoid": {"kind": "text", "value": "Funding one-off software nobody maintains."}, "pd_formats": {"kind": "multi", "values": ["briefings", "factsheets", "one_to_one"], "other": ""}, "pd_timing": {"kind": "multi", "values": ["late_am"], "other": ""}, "tech_offer": {"kind": "text", "value": "In-line quality sensing recording defect classes against grower and paddock."}, "tech_problem": {"kind": "text", "value": "Quality data is captured by hand at receival, if at all."}, "tech_maturity": {"kind": "single", "value": "overseas"}, "tech_demo": {"kind": "text", "value": "A full season at one Australian packhouse with an independent party holding the numbers."}}'::jsonb,
  now() - interval '6 days' - interval '540 seconds',
  now() - interval '6 days',
  540, true
) on conflict (id) do nothing;

insert into public.consultation_responses
  (id, round_id, role, pathway, regions, region_other, answers, started_at, submitted_at, duration_seconds, is_test_data)
values (
  '00000000-0000-4000-8000-000000000007', '2026-round-1', 'adviser', 'adviser', array['sa_southeast','vic_ballarat']::text[], '',
  '{"q1_constraints": {"kind": "multi", "values": ["monitoring", "skills", "data", "harvesting"], "other": ""}, "q2_top_three": {"kind": "rank", "values": ["skills", "monitoring", "data"]}, "q3_impact": {"kind": "multi", "values": ["skills", "data", "timeliness"], "other": ""}, "q4_bad_season": {"kind": "text", "value": "Growers fall back on what they did last year, because there is no local evidence to do otherwise."}, "q5_areas": {"kind": "rating", "values": {"training": 5, "sensors": 4, "harvest_efficiency": 4, "interoperability": 4, "precision_planting": 4, "irrigation_automation": 4, "optical_sorting": 3, "predictive_maintenance": 3, "packhouse_automation": 3, "harvest_logistics": 3, "autonomy": 2, "robotics": 2}}, "q6_first_opportunities": {"kind": "text", "value": "Harvest damage, because it is measurable and transfers between businesses."}, "q7_evidence": {"kind": "multi", "values": ["local_demo", "roi", "operating_data", "case_study"], "other": ""}, "pd_most_useful": {"kind": "text", "value": "Generate Australian numbers."}, "pd_avoid": {"kind": "text", "value": "Repeating overseas literature reviews."}, "pd_formats": {"kind": "multi", "values": ["case_studies", "field_demos", "webinars", "factsheets"], "other": ""}, "pd_timing": {"kind": "multi", "values": ["late_am", "off_peak"], "other": ""}, "adv_gaps": {"kind": "text", "value": "Almost no Australian data on the cost of handling damage through the chain."}, "adv_evaluate": {"kind": "text", "value": "Optical grading accuracy, and harvester settings effects on bruising."}, "adv_measurements": {"kind": "text", "value": "Bruise incidence by sampling point, throughput, labour hours, fuel."}, "adv_underrepresented": {"kind": "text", "value": "Machinery operators, and smaller family operations."}}'::jsonb,
  now() - interval '7 days' - interval '720 seconds',
  now() - interval '7 days',
  720, true
) on conflict (id) do nothing;

insert into public.consultation_responses
  (id, round_id, role, pathway, regions, region_other, answers, started_at, submitted_at, duration_seconds, is_test_data)
values (
  '00000000-0000-4000-8000-000000000008', '2026-round-1', 'industry_body', 'adviser', array['national']::text[], '',
  '{"q1_constraints": {"kind": "multi", "values": ["skills", "data", "maintenance"], "other": ""}, "q2_top_three": {"kind": "rank", "values": ["skills", "data", "maintenance"]}, "q3_impact": {"kind": "multi", "values": ["skills", "labour_avail", "whs"], "other": ""}, "q4_bad_season": {"kind": "text", "value": "Workforce shortages hit every region at once and there is no shared response."}, "q5_areas": {"kind": "rating", "values": {"training": 5, "interoperability": 4, "sensors": 3, "harvest_efficiency": 3, "predictive_maintenance": 3, "optical_sorting": 3, "packhouse_automation": 3, "robotics": 3, "harvest_logistics": 3, "irrigation_automation": 3, "precision_planting": 2, "autonomy": 2}}, "q6_first_opportunities": {"kind": "text", "value": "Workforce and skills pathways linked to the machinery actually being bought."}, "q7_evidence": {"kind": "multi", "values": ["case_study", "peer", "safety"], "other": ""}, "pd_most_useful": {"kind": "text", "value": "Connect mechanisation work to workforce planning."}, "pd_avoid": {"kind": "text", "value": "Creating a new grower network. Use the ones that exist."}, "pd_formats": {"kind": "multi", "values": ["briefings", "articles", "peer_groups"], "other": ""}, "pd_timing": {"kind": "multi", "values": ["afternoon", "no_say"], "other": ""}, "adv_gaps": {"kind": "text", "value": "What automation does to workforce numbers and skill mix here."}, "adv_evaluate": {"kind": "text", "value": "Safety outcomes where semi-automated handling was introduced."}, "adv_sharing": {"kind": "text", "value": "Through existing grower groups rather than new channels."}}'::jsonb,
  now() - interval '8 days' - interval '420 seconds',
  now() - interval '8 days',
  420, true
) on conflict (id) do nothing;

insert into public.consultation_contacts
  (id, round_id, interests, name, organisation, broad_role, region, email, phone,
   preferred_contact_method, preferred_contact_time, comments, submitted_at, is_test_data)
values
  ('00000000-0000-4000-9000-000000000001', '2026-round-1',
   array['demo','case_study','summary']::text[],
   'TEST DATA - Alex Fielding', 'TEST DATA - Fielding Farms', 'Grower', 'Tasmania, North West',
   'test.alex@example.invalid', '', 'email', 'Weekday mornings, outside harvest',
   'Happy to host a harvester damage demonstration.', now() - interval '6 days', true),
  ('00000000-0000-4000-9000-000000000002', '2026-round-1',
   array['follow_up','review_tool','updates']::text[],
   'TEST DATA - Jordan Pike', 'TEST DATA - Riverbend Packing', 'Packhouse manager', 'Victoria, Ballarat',
   '', '0400 000 000', 'phone', 'Afternoons', '', now() - interval '4 days', true)
on conflict (id) do nothing;
