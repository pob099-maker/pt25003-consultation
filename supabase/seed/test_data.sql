-- Seeded TEST DATA for the PT25003 consultation.
--
-- GENERATED from src/services/seed.ts — do not edit by hand; run `npm test` instead.
--
-- Every row has is_test_data = true. The admin area hides these by default, so a
-- response count shown to the project team is never inflated by them. Clear them
-- before the consultation goes live:
--   delete from public.consultation_responses where is_test_data;
--   delete from public.consultation_contacts  where is_test_data;

insert into public.consultation_rounds (round_id, label, is_active)
values ('2026-round-1', 'PT25003 consultation, round 1', true)
on conflict (round_id) do nothing;

insert into public.consultation_responses
  (id, round_id, role, pathway, regions, region_other, answers, started_at, submitted_at, duration_seconds, is_test_data)
values (
  '00000000-0000-4000-8000-000000000001', '2026-round-1', 'grower', 'farm', array['tas_north']::text[], '',
  '{"q1_constraints":{"kind":"multi","values":["harvesting","harvest_logistics","skills","storage"],"other":""},"q2_top_three":{"kind":"rank","values":["harvesting","skills","harvest_logistics"]},"q3_impact":{"kind":"multi","values":["labour_avail","timeliness","damage"],"other":""},"q4_bad_season":{"kind":"text","value":"A wet November and we simply cannot lift on time. Last season we left two paddocks a fortnight late, the skin set went off and the pack-out dropped about eight per cent. Chasing extra crew at that point costs more than the crop is worth."},"q5_areas":{"kind":"rating","values":{"harvest_efficiency":5,"harvest_logistics":5,"training":4,"optical_sorting":3,"autonomy":3,"sensors":3,"precision_planting":4,"robotics":2,"irrigation_automation":4,"predictive_maintenance":4,"packhouse_automation":2,"interoperability":2}},"q6_first_opportunities":{"kind":"text","value":"Harvester damage reduction first. Small changes to web speed and drop heights make a real difference and cost very little compared with a new machine."},"q7_evidence":{"kind":"multi","values":["local_demo","roi","peer","service"],"other":""},"farm_pressure":{"kind":"multi","values":["harvest","carting","staffing"],"other":""},"farm_adopted":{"kind":"multi","values":["guidance","section_control","harvester_setup"],"other":""},"farm_outcome":{"kind":"single","value":"refine"},"farm_barriers":{"kind":"multi","values":["capital","roi","service"],"other":""},"farm_measures":{"kind":"multi","values":["labour_hours","packout","damage","timeliness"],"other":""},"farm_case_study":{"kind":"single","value":"own_farm"},"farm_scepticism":{"kind":"text","value":"Fully autonomous tractors in our country. Paddocks are small and hilly and the service support is not there yet."},"pd_most_useful":{"kind":"text","value":"Independent bruise and damage benchmarking across a few different harvesters, in our conditions, with the numbers published."},"pd_avoid":{"kind":"text","value":"Another survey of what growers think. Go and measure something on a working farm."},"pd_formats":{"kind":"multi","values":["case_studies","field_demos","peer_groups","articles"],"other":""},"pd_timing":{"kind":"multi","values":["early_am","winter"],"other":""}}'::jsonb,
  now() - interval '8 days' - interval '660 seconds',
  now() - interval '8 days',
  660, true
) on conflict (id) do nothing;
insert into public.consultation_responses
  (id, round_id, role, pathway, regions, region_other, answers, started_at, submitted_at, duration_seconds, is_test_data)
values (
  '00000000-0000-4000-8000-000000000002', '2026-round-1', 'farm_manager', 'farm', array['sa_murraylands']::text[], '',
  '{"q1_constraints":{"kind":"multi","values":["irrigation","monitoring","maintenance","skills"],"other":""},"q2_top_three":{"kind":"rank","values":["skills","maintenance","irrigation"]},"q3_impact":{"kind":"multi","values":["labour_avail","downtime","skills"],"other":""},"q4_bad_season":{"kind":"text","value":"We lose days waiting on parts. In January that is irrigation missed, and you cannot get that back in a crop."},"q5_areas":{"kind":"rating","values":{"predictive_maintenance":5,"training":5,"irrigation_automation":5,"sensors":4,"harvest_efficiency":3,"autonomy":2,"optical_sorting":2,"packhouse_automation":2,"robotics":2,"precision_planting":3,"harvest_logistics":3,"interoperability":3}},"q6_first_opportunities":{"kind":"text","value":"Irrigation automation tied to soil moisture. It is the one that saves both water and labour hours."},"q7_evidence":{"kind":"multi","values":["operating_data","training","service","compatibility"],"other":""},"farm_pressure":{"kind":"multi","values":["irrigation","maintenance","staffing"],"other":""},"farm_adopted":{"kind":"multi","values":["soil_moisture","irrigation_auto","machine_telemetry"],"other":""},"farm_outcome":{"kind":"single","value":"expand"},"farm_barriers":{"kind":"multi","values":["operators","fit","data"],"other":""},"farm_measures":{"kind":"multi","values":["labour_hours","inputs","maintenance"],"other":""},"farm_case_study":{"kind":"single","value":"own_farm"},"farm_scepticism":{"kind":"text","value":""},"pd_most_useful":{"kind":"text","value":"Short, practical training for operators. Most of the gear we already have is not used properly."},"pd_avoid":{"kind":"text","value":"Big conference presentations."},"pd_formats":{"kind":"multi","values":["checklists","videos","briefings"],"other":""},"pd_timing":{"kind":"multi","values":["late_am","off_peak"],"other":""}}'::jsonb,
  now() - interval '7 days' - interval '480 seconds',
  now() - interval '7 days',
  480, true
) on conflict (id) do nothing;
insert into public.consultation_responses
  (id, round_id, role, pathway, regions, region_other, answers, started_at, submitted_at, duration_seconds, is_test_data)
values (
  '00000000-0000-4000-8000-000000000003', '2026-round-1', 'contractor', 'contractor', array['vic_ballarat','vic_gippsland']::text[], '',
  '{"q1_constraints":{"kind":"multi","values":["harvesting","harvest_logistics","maintenance"],"other":""},"q2_top_three":{"kind":"rank","values":["harvest_logistics","maintenance","harvesting"]},"q3_impact":{"kind":"multi","values":["timeliness","downtime","labour_cost"],"other":""},"q4_bad_season":{"kind":"text","value":"Everyone wants us in the same fortnight. If a machine goes down we push three clients back a week."},"q5_areas":{"kind":"rating","values":{"harvest_logistics":5,"predictive_maintenance":5,"harvest_efficiency":4,"training":4,"autonomy":3,"sensors":3,"precision_planting":3,"optical_sorting":2,"robotics":1,"packhouse_automation":1,"irrigation_automation":2,"interoperability":3}},"q6_first_opportunities":{"kind":"text","value":"Anything that shortens the changeover between jobs, and better parts availability in season."},"q7_evidence":{"kind":"multi","values":["local_demo","service","operating_data"],"other":""},"con_peak":{"kind":"multi","values":["harvest","carting","machine_moves"],"other":""},"con_limits":{"kind":"multi","values":["machine_availability","operators","parts_lead"],"other":""},"con_service":{"kind":"multi","values":["parts_in_season","technicians"],"other":""},"con_skills":{"kind":"multi","values":["harvester_setup","damage","new_operators"],"other":""},"con_tech":{"kind":"multi","values":["logistics","telemetry","training"],"other":""},"con_demo":{"kind":"multi","values":["commercial_rates","paid","off_peak"],"other":""},"con_other":{"kind":"text","value":"Parts out of Europe on a three week lead time is the killer."},"pd_most_useful":{"kind":"text","value":"Help the industry lift operator skills. That is worth more than new machinery."},"pd_avoid":{"kind":"text","value":"Trials on plots that do not reflect commercial speed."},"pd_formats":{"kind":"multi","values":["field_demos","checklists","one_to_one"],"other":""},"pd_timing":{"kind":"multi","values":["evening","winter"],"other":""}}'::jsonb,
  now() - interval '6 days' - interval '540 seconds',
  now() - interval '6 days',
  540, true
) on conflict (id) do nothing;
insert into public.consultation_responses
  (id, round_id, role, pathway, regions, region_other, answers, started_at, submitted_at, duration_seconds, is_test_data)
values (
  '00000000-0000-4000-8000-000000000004', '2026-round-1', 'processor', 'processor', array['tas_north','vic_ballarat']::text[], '',
  '{"q1_constraints":{"kind":"multi","values":["grading","receival","packing","data"],"other":""},"q2_top_three":{"kind":"rank","values":["grading","packing","data"]},"q3_impact":{"kind":"multi","values":["labour_avail","quality","labour_cost"],"other":""},"q4_bad_season":{"kind":"text","value":"We run short shifts because we cannot staff the grading table, and quality complaints follow."},"q5_areas":{"kind":"rating","values":{"optical_sorting":5,"packhouse_automation":5,"robotics":4,"sensors":4,"interoperability":4,"training":3,"harvest_efficiency":3,"harvest_logistics":3,"predictive_maintenance":4,"precision_planting":2,"autonomy":2,"irrigation_automation":1}},"q6_first_opportunities":{"kind":"text","value":"Optical grading with defect classification that actually holds up on dirty potatoes."},"q7_evidence":{"kind":"multi","values":["operating_data","case_study","roi","compatibility"],"other":""},"pro_constraints":{"kind":"multi","values":["grading","defects","palletising","staffing"],"other":""},"pro_losses":{"kind":"multi","values":["bruising","greening","misgrades"],"other":""},"pro_systems":{"kind":"multi","values":["optical_size","optical_defect"],"other":""},"pro_barriers":{"kind":"multi","values":["capital","evidence","service"],"other":""},"pro_measures":{"kind":"multi","values":["throughput","labour","grading_accuracy","damage"],"other":""},"pro_other":{"kind":"text","value":"Defect detection was not reliable enough on dirty potatoes. An independent accuracy assessment would be valuable."},"pd_most_useful":{"kind":"text","value":"Independent testing of sorting accuracy under real conditions, not vendor figures."},"pd_avoid":{"kind":"text","value":"Duplicating what equipment suppliers already publish."},"pd_formats":{"kind":"multi","values":["case_studies","roi_tools","factsheets"],"other":""},"pd_timing":{"kind":"multi","values":["afternoon","off_peak"],"other":""}}'::jsonb,
  now() - interval '5 days' - interval '600 seconds',
  now() - interval '5 days',
  600, true
) on conflict (id) do nothing;
insert into public.consultation_responses
  (id, round_id, role, pathway, regions, region_other, answers, started_at, submitted_at, duration_seconds, is_test_data)
values (
  '00000000-0000-4000-8000-000000000005', '2026-round-1', 'machinery', 'machinery', array['national']::text[], '',
  '{"q1_constraints":{"kind":"multi","values":["maintenance","skills","harvesting"],"other":""},"q2_top_three":{"kind":"rank","values":["skills","maintenance","harvesting"]},"q3_impact":{"kind":"multi","values":["skills","downtime","labour_cost"],"other":""},"q4_bad_season":{"kind":"text","value":"Customers cannot get technicians, so small faults become whole-season problems."},"q5_areas":{"kind":"rating","values":{"training":5,"predictive_maintenance":5,"harvest_efficiency":4,"sensors":4,"interoperability":4,"autonomy":3,"optical_sorting":3,"packhouse_automation":3,"precision_planting":3,"harvest_logistics":3,"robotics":2,"irrigation_automation":3}},"q6_first_opportunities":{"kind":"text","value":"Technician training pathways, and getting machine data off equipment in a usable form."},"q7_evidence":{"kind":"multi","values":["local_demo","training","compatibility"],"other":""},"mach_available":{"kind":"multi","values":["planting","harvest","optical","sensors","maintenance"],"other":""},"mach_ready":{"kind":"multi","values":["optical","sensors","maintenance"],"other":""},"mach_barriers":{"kind":"multi","values":["capital","roi","service","operators"],"other":""},"mach_capacity":{"kind":"multi","values":["field_techs","parts_holding","tech_training"],"other":""},"mach_gaps":{"kind":"multi","values":["row_spacing","soil","scale","support_distance"],"other":""},"mach_contribute":{"kind":"single","value":"yes"},"mach_other":{"kind":"text","value":"Machines are designed for northern hemisphere row spacing and soil types."},"pd_most_useful":{"kind":"text","value":"A clear-eyed assessment of what is genuinely commercially ready for Australian conditions."},"pd_avoid":{"kind":"text","value":"Promoting prototypes as though they were products."},"pd_formats":{"kind":"multi","values":["field_demos","factsheets","one_to_one"],"other":""},"pd_timing":{"kind":"multi","values":["afternoon"],"other":""}}'::jsonb,
  now() - interval '4 days' - interval '480 seconds',
  now() - interval '4 days',
  480, true
) on conflict (id) do nothing;
insert into public.consultation_responses
  (id, round_id, role, pathway, regions, region_other, answers, started_at, submitted_at, duration_seconds, is_test_data)
values (
  '00000000-0000-4000-8000-000000000006', '2026-round-1', 'technology', 'technology', array['national']::text[], '',
  '{"q1_constraints":{"kind":"multi","values":["data","monitoring","grading"],"other":""},"q2_top_three":{"kind":"rank","values":["data","grading","monitoring"]},"q3_impact":{"kind":"multi","values":["data","quality","labour_cost"],"other":""},"q4_bad_season":{"kind":"text","value":"Decisions get made on memory rather than measurement, and the same mistakes repeat."},"q5_areas":{"kind":"rating","values":{"sensors":5,"interoperability":5,"optical_sorting":4,"robotics":4,"predictive_maintenance":4,"autonomy":3,"packhouse_automation":3,"harvest_efficiency":3,"precision_planting":3,"harvest_logistics":3,"irrigation_automation":3,"training":3}},"q6_first_opportunities":{"kind":"text","value":"Common data formats. Without them every integration is a custom job and nothing scales."},"q7_evidence":{"kind":"multi","values":["local_demo","operating_data","compatibility"],"other":""},"tech_offer":{"kind":"multi","values":["optical","sensors","data_standards"],"other":""},"tech_problem":{"kind":"multi","values":["quality","data","labour"],"other":""},"tech_maturity":{"kind":"single","value":"overseas"},"tech_requirements":{"kind":"multi","values":["connectivity","conditions","integration"],"other":""},"tech_evidence":{"kind":"multi","values":["overseas_commercial","customer_case"],"other":""},"tech_demo":{"kind":"multi","values":["host_site","independent_measure","full_season"],"other":""},"tech_other":{"kind":"text","value":"In-line quality sensing that records defect classes against a grower and paddock. Quality data is captured by hand at receival, if at all."},"pd_most_useful":{"kind":"text","value":"Set data standards the industry can actually agree on."},"pd_avoid":{"kind":"text","value":"Funding one-off software that nobody maintains after the project ends."},"pd_formats":{"kind":"multi","values":["briefings","factsheets","one_to_one"],"other":""},"pd_timing":{"kind":"multi","values":["late_am"],"other":""}}'::jsonb,
  now() - interval '3 days' - interval '540 seconds',
  now() - interval '3 days',
  540, true
) on conflict (id) do nothing;
insert into public.consultation_responses
  (id, round_id, role, pathway, regions, region_other, answers, started_at, submitted_at, duration_seconds, is_test_data)
values (
  '00000000-0000-4000-8000-000000000007', '2026-round-1', 'adviser', 'adviser', array['sa_southeast','vic_ballarat']::text[], '',
  '{"q1_constraints":{"kind":"multi","values":["monitoring","skills","data","harvesting"],"other":""},"q2_top_three":{"kind":"rank","values":["skills","monitoring","data"]},"q3_impact":{"kind":"multi","values":["skills","data","timeliness"],"other":""},"q4_bad_season":{"kind":"text","value":"Growers fall back on what they did last year, because there is no local evidence to do otherwise."},"q5_areas":{"kind":"rating","values":{"training":5,"sensors":4,"harvest_efficiency":4,"interoperability":4,"optical_sorting":3,"precision_planting":4,"irrigation_automation":4,"predictive_maintenance":3,"packhouse_automation":3,"harvest_logistics":3,"autonomy":2,"robotics":2}},"q6_first_opportunities":{"kind":"text","value":"Harvest damage, because it is measurable, and the results transfer between businesses."},"q7_evidence":{"kind":"multi","values":["local_demo","roi","operating_data","case_study"],"other":""},"adv_gaps":{"kind":"multi","values":["damage_cost","roi_au","workforce"],"other":""},"adv_evaluate":{"kind":"multi","values":["optical","harvest"],"other":""},"adv_measurements":{"kind":"multi","values":["damage","throughput","labour_hours","cost"],"other":""},"adv_underrepresented":{"kind":"multi","values":["operators","small_farms"],"other":""},"adv_sharing":{"kind":"multi","values":["case_numbers","field_days","existing_groups"],"other":""},"adv_connections":{"kind":"text","value":"The existing PotatoLink demonstration sites, and the soil health work in Tasmania."},"pd_most_useful":{"kind":"text","value":"Generate Australian numbers. Everything else follows from that."},"pd_avoid":{"kind":"text","value":"Repeating overseas literature reviews."},"pd_formats":{"kind":"multi","values":["case_studies","field_demos","webinars","factsheets"],"other":""},"pd_timing":{"kind":"multi","values":["late_am","off_peak"],"other":""}}'::jsonb,
  now() - interval '2 days' - interval '720 seconds',
  now() - interval '2 days',
  720, true
) on conflict (id) do nothing;
insert into public.consultation_responses
  (id, round_id, role, pathway, regions, region_other, answers, started_at, submitted_at, duration_seconds, is_test_data)
values (
  '00000000-0000-4000-8000-000000000008', '2026-round-1', 'industry_body', 'adviser', array['national']::text[], '',
  '{"q1_constraints":{"kind":"multi","values":["skills","data","maintenance"],"other":""},"q2_top_three":{"kind":"rank","values":["skills","data","maintenance"]},"q3_impact":{"kind":"multi","values":["skills","labour_avail","whs"],"other":""},"q4_bad_season":{"kind":"text","value":"Workforce shortages hit every region at once and there is no shared response."},"q5_areas":{"kind":"rating","values":{"training":5,"interoperability":4,"sensors":3,"harvest_efficiency":3,"predictive_maintenance":3,"optical_sorting":3,"packhouse_automation":3,"robotics":3,"precision_planting":2,"harvest_logistics":3,"autonomy":2,"irrigation_automation":3}},"q6_first_opportunities":{"kind":"text","value":"Workforce and skills pathways, linked to the machinery that is actually being bought."},"q7_evidence":{"kind":"multi","values":["case_study","peer","safety"],"other":""},"adv_gaps":{"kind":"multi","values":["workforce","labour_impact","safety"],"other":""},"adv_evaluate":{"kind":"multi","values":["training","robotics"],"other":""},"adv_measurements":{"kind":"multi","values":["labour_hours","safety"],"other":""},"adv_underrepresented":{"kind":"multi","values":["seasonal","operators"],"other":""},"adv_sharing":{"kind":"multi","values":["existing_groups","publications"],"other":""},"adv_connections":{"kind":"text","value":"State farming organisations and the relevant training packages."},"pd_most_useful":{"kind":"text","value":"Connect the mechanisation work to workforce planning rather than treating them separately."},"pd_avoid":{"kind":"text","value":"Creating a new grower network. Use the ones that exist."},"pd_formats":{"kind":"multi","values":["briefings","articles","peer_groups"],"other":""},"pd_timing":{"kind":"multi","values":["afternoon","no_say"],"other":""}}'::jsonb,
  now() - interval '1 days' - interval '420 seconds',
  now() - interval '1 days',
  420, true
) on conflict (id) do nothing;

insert into public.consultation_contacts
  (id, round_id, interests, name, organisation, broad_role, region, email, phone,
   preferred_contact_method, preferred_contact_time, comments, submitted_at, is_test_data)
values (
  '00000000-0000-4000-9000-000000000001', '2026-round-1', array['farm_host_trial','reference_group','case_study','summary']::text[],
  'TEST DATA — Alex Fielding', 'TEST DATA — Fielding Farms', 'Grower', 'Tasmania, North West',
  'test.alex@example.invalid', '', 'email',
  'Weekday mornings, outside harvest', 'Happy to host a harvester damage demonstration.',
  now() - interval '6 days', true
) on conflict (id) do nothing;
insert into public.consultation_contacts
  (id, round_id, interests, name, organisation, broad_role, region, email, phone,
   preferred_contact_method, preferred_contact_time, comments, submitted_at, is_test_data)
values (
  '00000000-0000-4000-9000-000000000002', '2026-round-1', array['pro_line_measurement','follow_up','review_tool','updates']::text[],
  'TEST DATA — Jordan Pike', 'TEST DATA — Riverbend Packing', 'Packhouse manager', 'Victoria, Ballarat',
  '', '0400 000 000', 'phone',
  'Afternoons', '',
  now() - interval '4 days', true
) on conflict (id) do nothing;
