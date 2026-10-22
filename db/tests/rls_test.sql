-- Permission tests for the Phase 1 schema. Run against a scratch database that
-- has tests/supabase_stub.sql, 001 and 002 applied:   db/tests/run.sh
-- Every block either passes silently or aborts the script with a message.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
set client_min_messages = warning;

create schema if not exists t;
grant usage on schema t to authenticated, anon;
create or replace function t.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, false) $$;
-- run `q` and require it to fail with SQLSTATE `code`
create or replace function t.expect_error(q text, code text) returns void language plpgsql as $$
begin
  begin execute q;
  exception when others then
    if sqlstate = code then return; end if;
    raise exception 'expected % but got % (%) for: %', code, sqlstate, sqlerrm, q;
  end;
  raise exception 'expected % but statement succeeded: %', code, q;
end $$;
grant execute on all functions in schema t to authenticated, anon;

-- people
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'aisyah@test'),   -- member
  ('00000000-0000-0000-0000-00000000000b', 'badrul@test'),   -- member
  ('00000000-0000-0000-0000-00000000000c', 'chong@test'),    -- club captain, Kelantan
  ('00000000-0000-0000-0000-00000000000d', 'devi@test'),     -- head coach
  ('00000000-0000-0000-0000-00000000000e', 'ezra@test'),     -- running coach
  ('00000000-0000-0000-0000-00000000000f', 'farid@test');    -- captain of another chapter
insert into public.run_chapters(id, slug, name) values ('00000000-0000-0000-0000-0000000000c2', 'terengganu', 'HITFAT Run Club Terengganu');
insert into public.run_staff(user_id, role, chapter_id) values
  ('00000000-0000-0000-0000-00000000000c', 'club_captain', (select id from run_chapters where slug='kelantan')),
  ('00000000-0000-0000-0000-00000000000d', 'head_coach', null),
  ('00000000-0000-0000-0000-00000000000e', 'running_coach', null),
  ('00000000-0000-0000-0000-00000000000f', 'club_captain', '00000000-0000-0000-0000-0000000000c2');

set role authenticated;

-- ── 1. programmes under review are invisible to members ──
select t.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select count(*) from run_programs) = 0, 'member sees unpublished programmes';
  assert (select count(*) from run_workout_templates) = 0, 'member sees unpublished workouts';
end $$;
select t.expect_error($q$ select run_enroll((select id from run_programs limit 1), current_date, '{1,3,5}') $q$, '22023');

-- a running coach can read and edit drafts but cannot publish
select t.as_user('00000000-0000-0000-0000-00000000000e');
do $$ begin assert (select count(*) from run_programs) = 4, 'running coach cannot see drafts'; end $$;
select t.expect_error($q$ update run_programs set status = 'published' where slug = 'road-to-5k' $q$, '42501');

-- the head coach publishes
select t.as_user('00000000-0000-0000-0000-00000000000d');
update run_programs set status = 'published', published_at = now(), reviewed_by = auth.uid() where slug in ('couch-to-5k','road-to-5k','improve-5k','road-to-10k');
do $$ begin assert (select count(*) from run_programs where status = 'published') = 4, 'head coach could not publish'; end $$;

-- ── 2. members read published content and enrol ──
select t.as_user('00000000-0000-0000-0000-00000000000a');
do $$ declare v uuid; n int; bad int; begin
  assert (select count(*) from run_workout_templates) = 87, 'member cannot read published workouts';
  v := run_enroll((select id from run_programs where slug = 'road-to-5k'), current_date, '{1,3,6}');
  select count(*), count(*) filter (where extract(dow from scheduled_date) not in (1,3,6)) into n, bad
    from run_scheduled_workouts where enrollment_id = v;
  assert n = 18, 'expected 18 scheduled sessions, got ' || n;
  assert bad = 0, 'sessions scheduled on days the runner did not choose';
  assert (select count(distinct scheduled_date) from run_scheduled_workouts where enrollment_id = v) = 18, 'two sessions on one day';
  -- enrolling again replaces the active plan
  perform run_enroll((select id from run_programs where slug = 'couch-to-5k'), current_date, '{2,4}');
  assert (select count(*) from run_enrollments where status = 'active') = 1, 'two active plans';
  assert (select status from run_enrollments where id = v) = 'stopped', 'old plan not stopped';
end $$;
-- a runner cannot rewrite which workout a session is, nor forge an enrolment
select t.expect_error($q$ update run_scheduled_workouts set template_id = template_id $q$, '42501');
select t.expect_error($q$ insert into run_enrollments(user_id, program_id, start_date, weekdays)
  select auth.uid(), id, current_date, '{1}' from run_programs limit 1 $q$, '42501');
-- reschedule moves only unfinished sessions, never into the past
do $$ begin
  assert run_reschedule(current_date + 7) = 27, 'reschedule count';
  assert (select min(scheduled_date) from run_scheduled_workouts s join run_enrollments e on e.id = s.enrollment_id
          where e.status = 'active') >= current_date + 7, 'rescheduled into the past';
end $$;

-- paid tiers need an entitlement
reset role;
update run_programs set tier = 'plus' where slug = 'improve-5k';
insert into run_tier_skus values ('plus', 'run_plus_monthly');
set role authenticated;
select t.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin assert (select count(*) from run_workout_templates w join run_programs p on p.id = w.program_id where p.slug = 'improve-5k') = 0, 'plus content readable without entitlement'; end $$;
select t.expect_error($q$ select run_enroll((select id from run_programs where slug = 'improve-5k'), current_date, '{1,3,5}') $q$, '42501');
reset role;
insert into plus_entitlements(user_id, sku, kind, expires_at) values ('00000000-0000-0000-0000-00000000000a', 'run_plus_monthly', 'pass', now() + interval '30 days');
set role authenticated;
select t.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin assert (select count(*) from run_workout_templates w join run_programs p on p.id = w.program_id where p.slug = 'improve-5k') = 18, 'entitled runner cannot read plus content'; end $$;
reset role;
update run_programs set tier = 'free' where slug = 'improve-5k';
set role authenticated;

-- ── 3. activities are private; duplicates are impossible ──
select t.as_user('00000000-0000-0000-0000-00000000000a');
insert into run_activities(id, started_at, distance_m, moving_time_s, source) values
  ('10000000-0000-0000-0000-000000000001', now() - interval '1 day', 5200, 1900, 'manual');
insert into run_activities(id, started_at, distance_m, moving_time_s, source) values
  ('10000000-0000-0000-0000-000000000001', now() - interval '1 day', 5200, 1900, 'manual')
  on conflict (id) do nothing;
do $$ begin assert (select count(*) from run_activities) = 1, 'retried submit created a duplicate'; end $$;
select t.expect_error($q$ insert into run_activities(id, started_at, distance_m, moving_time_s) values (gen_random_uuid(), now(), 5000, 300) $q$, '23514');  -- 1:00/km
select t.expect_error($q$ insert into run_activities(id, user_id, started_at, distance_m, moving_time_s) values
  (gen_random_uuid(), '00000000-0000-0000-0000-00000000000b', now(), 5000, 1800) $q$, '42501');                                         -- on someone else's behalf
insert into run_profiles(user_id, goal, level) values (auth.uid(), 'first_5k', 'beginner');
select t.expect_error($q$ update run_profiles set has_limitations = true, limitations = 'lutut' $q$, '23514');                       -- health data needs consent
update run_profiles set has_limitations = true, limitations = 'lutut', health_consent_at = now();

select t.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select count(*) from run_activities) = 0, 'B sees A''s activities';
  assert (select count(*) from run_profiles) = 0, 'B sees A''s profile';
  assert (select count(*) from run_scheduled_workouts) = 0, 'B sees A''s calendar';
  assert (select count(*) from run_enrollments) = 0, 'B sees A''s enrolment';
end $$;
update run_activities set distance_m = 1 where true;   -- RLS: silently touches nothing
delete from run_activities where true;
-- coaches have no access to runners' private data in Phase 1
select t.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin assert (select count(*) from run_activities) = 0 and (select count(*) from run_profiles) = 0, 'coach sees private runner data'; end $$;
select t.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin assert (select distance_m from run_activities) = 5200, 'B changed A''s activity'; end $$;

-- ── 4. achievements are awarded by the server only ──
select t.expect_error($q$ insert into run_user_achievements(user_id, code) values (auth.uid(), 'month_100k') $q$, '42501');
do $$ declare got text[]; begin
  select array_agg(c order by c) into got from run_evaluate_achievements() c;
  assert got = '{first_5k,first_run}', 'unexpected achievements: ' || coalesce(got::text, 'none');
  assert (select count(*) from run_evaluate_achievements()) = 0, 'achievement awarded twice';
end $$;

-- ── 5. events: only captains/coaches of that chapter create them ──
select t.expect_error($q$ insert into run_events(chapter_id, title, starts_at, meeting_point, created_by)
  select id, 'Larian Pagi', now() + interval '2 days', 'Stadium Sultan Muhammad IV', auth.uid() from run_chapters where slug = 'kelantan' $q$, '42501');
select t.as_user('00000000-0000-0000-0000-00000000000f');   -- captain elsewhere
select t.expect_error($q$ insert into run_events(chapter_id, title, starts_at, meeting_point, created_by)
  select id, 'Larian Pagi', now() + interval '2 days', 'Stadium', auth.uid() from run_chapters where slug = 'kelantan' $q$, '42501');
select t.as_user('00000000-0000-0000-0000-00000000000c');   -- Kelantan captain
insert into run_events(id, chapter_id, title, starts_at, meeting_point, capacity, created_by)
  select '20000000-0000-0000-0000-000000000001', id, 'Larian Pagi Sabtu', now() + interval '2 days', 'Stadium Sultan Muhammad IV', 1, auth.uid()
    from run_chapters where slug = 'kelantan';

-- ── 6. RSVP respects capacity; the guest list is staff-only ──
select t.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin assert run_rsvp('20000000-0000-0000-0000-000000000001', true) = 'going', 'rsvp failed'; end $$;
do $$ begin assert run_rsvp('20000000-0000-0000-0000-000000000001', true) = 'going', 'repeat rsvp failed'; end $$;  -- idempotent, not "full"
select t.expect_error($q$ insert into run_event_registrations(event_id, user_id) values ('20000000-0000-0000-0000-000000000001', auth.uid()) $q$, '42501');
do $$ begin assert (select count(*) from run_club_members) = 1, 'rsvp did not join the chapter'; end $$;
select t.as_user('00000000-0000-0000-0000-00000000000b');
select t.expect_error($q$ select run_rsvp('20000000-0000-0000-0000-000000000001', true) $q$, 'P0001');   -- full
do $$ begin
  assert (select count(*) from run_event_registrations) = 0, 'B sees who is going';
  assert (select going from run_event_counts(array['20000000-0000-0000-0000-000000000001'::uuid])) = 1, 'count wrong';
end $$;
select t.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin assert run_rsvp('20000000-0000-0000-0000-000000000001', false) = 'cancelled', 'cancel failed'; end $$;
select t.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin assert run_rsvp('20000000-0000-0000-0000-000000000001', true) = 'going', 'freed place not available'; end $$;
select t.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin assert (select count(*) from run_event_registrations) = 2, 'captain cannot see the guest list'; end $$;
select t.as_user('00000000-0000-0000-0000-00000000000f');
do $$ begin assert (select count(*) from run_event_registrations) = 0, 'other chapter''s captain sees the guest list'; end $$;

-- ── 7. staff table cannot be self-promoted ──
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.expect_error($q$ insert into run_staff(user_id, role) values (auth.uid(), 'super_admin') $q$, '42501');
do $$ begin assert (select count(*) from run_staff) = 0, 'member sees staff list'; end $$;

-- ── 8. anon sees nothing ──
reset role; set role anon;
select t.expect_error($q$ select count(*) from run_programs $q$, '42501');
select t.expect_error($q$ select run_rsvp('20000000-0000-0000-0000-000000000001', true) $q$, '42501');

-- ── 8b. strength logs are private to their owner and never rewritten ──
reset role; set role authenticated;
select t.as_user('00000000-0000-0000-0000-00000000000a');
insert into run_strength_logs(id, workout_key, started_at, duration_s, rpe) values ('40000000-0000-0000-0000-00000000000a', 'kaki-pelari', now(), 1200, 6);
select t.expect_error($q$ insert into run_strength_logs(id, user_id, workout_key, started_at, duration_s) values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000b', 'core-pelari', now(), 600) $q$, '42501');
select t.expect_error($q$ insert into run_strength_logs(id, workout_key, started_at, duration_s) values (gen_random_uuid(), 'Bad Key!', now(), 600) $q$, '23514');
select t.expect_error($q$ update run_strength_logs set duration_s = 9999 $q$, '42501');
select t.as_user('00000000-0000-0000-0000-00000000000b');
insert into run_strength_logs(id, workout_key, started_at, duration_s) values ('40000000-0000-0000-0000-00000000000b', 'core-pelari', now(), 700);
do $$ begin assert (select count(*) from run_strength_logs) = 1, 'runner sees someone else''s strength log'; end $$;
reset role; set role anon;
select t.expect_error($q$ select count(*) from run_strength_logs $q$, '42501');

-- ── 8c. boards show only runners who opted in, only totals, never Strava ──
reset role; set role authenticated;
select t.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin assert (select count(*) from run_leaderboard(current_date - 7, current_date)) = 0, 'runner on the board without opting in'; end $$;
update run_profiles set board_name = 'Aisyah K', board_opt_in_at = now();
do $$ begin
  assert (select count(*) from run_leaderboard(current_date - 7, current_date)) = 1, 'opted-in runner missing';
  assert (select km from run_leaderboard(current_date - 7, current_date)) = 5.2, 'wrong km';
  assert (select me from run_leaderboard(current_date - 7, current_date)), 'me flag';
  assert (select count(*) from run_leaderboard(current_date - 7, current_date, null, true)) = 0, 'GPS-only counted a manual run';
end $$;
select t.as_user('00000000-0000-0000-0000-00000000000b');
insert into run_profiles(user_id) values (auth.uid()) on conflict do nothing;
insert into run_activities(id, started_at, distance_m, moving_time_s, source) values ('10000000-0000-0000-0000-0000000000b1', now() - interval '2 hours', 3000, 1100, 'gps');
insert into run_activities(id, started_at, distance_m, moving_time_s, source, external_id) values ('10000000-0000-0000-0000-0000000000b2', now() - interval '3 hours', 9000, 3000, 'strava', 's1');
do $$ begin
  assert (select count(*) from run_leaderboard(current_date - 7, current_date)) = 1, 'B (not opted in) appears on the board';
  assert not (select me from run_leaderboard(current_date - 7, current_date)), 'me flag for someone else';
  assert (select count(*) from run_activities) = 2, 'the board leaked A''s runs to B';
end $$;
update run_profiles set board_name = 'Badrul', board_opt_in_at = now();
do $$ begin assert (select km from run_leaderboard(current_date - 7, current_date) where me) = 3.0, 'a Strava run counted on the board'; end $$;
select t.expect_error($q$ update run_profiles set board_name = 'x' $q$, '23514');
do $$ begin assert (select count(*) from run_leaderboard(current_date - 200, current_date)) = 0, 'a range over 92 days is refused'; end $$;

-- challenges: coaches set them, members join open ones, counts are numbers only
select t.as_user('00000000-0000-0000-0000-00000000000d');
insert into run_challenges(id, slug, i18n, target_m, starts_on, ends_on) values
  ('50000000-0000-0000-0000-000000000001', 'test-open', '{"ms":{"title":"Cabaran Ujian"}}', 5000, current_date - 3, current_date + 3),
  ('50000000-0000-0000-0000-000000000002', 'test-closed', '{"ms":{"title":"Cabaran Lama"}}', 5000, current_date - 30, current_date - 1);
select t.as_user('00000000-0000-0000-0000-00000000000c');
select t.expect_error($q$ insert into run_challenges(slug, i18n, target_m, starts_on, ends_on) values ('captain-try', '{"ms":{"title":"Tidak boleh"}}', 5000, current_date, current_date + 5) $q$, '42501');
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.expect_error($q$ insert into run_challenges(slug, i18n, target_m, starts_on, ends_on) values ('member-try', '{"ms":{"title":"Tidak boleh"}}', 5000, current_date, current_date + 5) $q$, '42501');
insert into run_challenge_entries(challenge_id) values ('50000000-0000-0000-0000-000000000001');
select t.expect_error($q$ insert into run_challenge_entries(challenge_id) values ('50000000-0000-0000-0000-000000000002') $q$, '42501');
select t.expect_error($q$ insert into run_challenge_entries(challenge_id, user_id) values ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b') $q$, '42501');
select t.as_user('00000000-0000-0000-0000-00000000000b');
insert into run_challenge_entries(challenge_id) values ('50000000-0000-0000-0000-000000000001');
do $$ begin
  assert (select count(*) from run_challenge_entries) = 1, 'B sees A''s challenge entry';
  assert (select n from run_challenge_counts(array['50000000-0000-0000-0000-000000000001'::uuid])) = 2, 'participant count';
  assert (select count(*) from run_challenge_board('50000000-0000-0000-0000-000000000001')) = 2, 'challenge board';
  assert (select done from run_challenge_board('50000000-0000-0000-0000-000000000001') where name = 'Aisyah K'), 'A has 5.2 of 5 km: done';
  assert not (select done from run_challenge_board('50000000-0000-0000-0000-000000000001') where me), 'B has 3 of 5 km';
end $$;
select t.as_user('00000000-0000-0000-0000-00000000000a');
update run_profiles set board_opt_in_at = null;
select t.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select count(*) from run_leaderboard(current_date - 7, current_date) where not me) = 0, 'opt-out not immediate';
  assert (select count(*) from run_challenge_board('50000000-0000-0000-0000-000000000001') where not me) = 0, 'opt-out not immediate on challenge board';
end $$;
select t.as_user('00000000-0000-0000-0000-00000000000a');
update run_profiles set board_opt_in_at = now();
reset role; set role anon;
select t.expect_error($q$ select * from run_leaderboard(current_date - 7, current_date) $q$, '42501');
select t.expect_error($q$ select count(*) from run_challenges $q$, '42501');

-- ── 9. delete my data removes every HITFAT RUN row for the caller only ──
reset role; set role authenticated;
select t.as_user('00000000-0000-0000-0000-00000000000a');
select run_delete_my_data();
reset role;
do $$ begin
  assert (select count(*) from run_activities where user_id = '00000000-0000-0000-0000-00000000000a') = 0, 'activities left';
  assert (select count(*) from run_scheduled_workouts where user_id = '00000000-0000-0000-0000-00000000000a') = 0, 'calendar left';
  assert (select count(*) from run_profiles where user_id = '00000000-0000-0000-0000-00000000000a') = 0, 'profile left';
  assert (select count(*) from run_user_achievements where user_id = '00000000-0000-0000-0000-00000000000a') = 0, 'achievements left';
  assert (select count(*) from run_strength_logs where user_id = '00000000-0000-0000-0000-00000000000a') = 0, 'strength logs left';
  assert (select count(*) from run_challenge_entries where user_id = '00000000-0000-0000-0000-00000000000a') = 0, 'challenge entries left';
  assert (select count(*) from run_challenge_entries where user_id = '00000000-0000-0000-0000-00000000000b') = 1, 'deleted someone else''s challenge entry';
  assert (select count(*) from run_strength_logs where user_id = '00000000-0000-0000-0000-00000000000b') = 1, 'deleted someone else''s strength log';
  assert (select count(*) from run_event_registrations where user_id = '00000000-0000-0000-0000-00000000000b') = 1, 'deleted someone else''s data';
  assert exists(select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000a'), 'shared account removed';
end $$;

\echo ALL RLS TESTS PASSED
