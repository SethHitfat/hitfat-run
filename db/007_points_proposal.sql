-- HITFAT RUN · Mata HITFAT · PROPOSAL FOR REVIEW. NOT APPLIED. Do not run until approved.
--
-- What it adds (additive only; nothing existing changes):
--   run_point_rules    the rules and their values (editable by super admins)
--   run_points_ledger  one row per point award; append-only; each runner reads only their own
--   run_sync_points()  awards anything due to the caller, idempotently (like run_evaluate_achievements)
--   run_award_sweat_test()  records that a sweat test was completed (no weights stored), max once per 14 days
--   run_my_points()    the caller's balance and breakdown (what Profile shows)
--
-- Rules (same numbers as js/points.js):
--   run_gps 10 (GPS run ≥ 1 km, max 2 a day) · run_manual 5 (manual run ≥ 1 km, max 2 a day)
--   club_run 30 (checked in by the captain; needs the QR check-in feature, RSVP alone earns nothing)
--   challenge 100 (finishing a virtual challenge, once) · sweat_test 20 (once every 14 days)
--   Strava activities never earn points.
--
-- Deliberately NOT in this file (needs a separate decision): redeeming rewards, spending points,
-- prizes, and state-against-state competition.

create table if not exists public.run_point_rules(
  code        text primary key check (code ~ '^[a-z_]{3,30}$'),
  points      integer not null check (points between 0 and 10000),
  per_day     smallint check (per_day between 1 and 20),
  i18n        jsonb not null,
  active      boolean not null default true);

insert into public.run_point_rules(code, points, per_day, i18n) values
  ('run_gps',    10, 2,    '{"ms":"Larian GPS 1KM+","en":"GPS run 1KM+"}'),
  ('run_manual',  5, 2,    '{"ms":"Larian manual 1KM+","en":"Manual run 1KM+"}'),
  ('club_run',   30, null, '{"ms":"Hadir larian kelab","en":"Club run attended"}'),
  ('challenge', 100, null, '{"ms":"Cabaran maya selesai","en":"Virtual challenge finished"}'),
  ('sweat_test', 20, null, '{"ms":"Ujian peluh","en":"Sweat test"}')
on conflict (code) do nothing;

create table if not exists public.run_points_ledger(
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  rule_code     text not null references public.run_point_rules(code),
  points        integer not null,
  -- what earned it: exactly one of these, or a client id for sweat tests
  activity_id   uuid references public.run_activities(id) on delete cascade,   -- a deleted run takes its points with it
  event_id      uuid references public.run_events(id) on delete set null,
  challenge_id  uuid references public.run_challenges(id) on delete set null,
  ref           text check (char_length(ref) <= 64),
  created_at    timestamptz not null default now());
create unique index if not exists run_pl_activity  on public.run_points_ledger(user_id, rule_code, activity_id)  where activity_id is not null;
create unique index if not exists run_pl_event     on public.run_points_ledger(user_id, rule_code, event_id)     where event_id is not null;
create unique index if not exists run_pl_challenge on public.run_points_ledger(user_id, rule_code, challenge_id) where challenge_id is not null;
create index if not exists run_pl_user on public.run_points_ledger(user_id, created_at desc);

alter table public.run_point_rules enable row level security;
alter table public.run_points_ledger enable row level security;
do $$ begin
  if not exists(select 1 from pg_policies where schemaname = 'public' and policyname = 'run_prules_read') then
    create policy run_prules_read on public.run_point_rules for select to authenticated using (true);
  end if;
  if not exists(select 1 from pg_policies where schemaname = 'public' and policyname = 'run_pl_own') then
    -- read your own; nobody writes directly: awards only come from the functions below
    create policy run_pl_own on public.run_points_ledger for select to authenticated using (user_id = auth.uid());
  end if;
end $$;
revoke all on public.run_point_rules, public.run_points_ledger from anon;
revoke insert, update, delete on public.run_points_ledger from authenticated;
revoke insert, update, delete on public.run_point_rules from authenticated;

-- Awards whatever is due to the caller and not yet awarded. Safe to call on every app open.
create or replace function public.run_sync_points()
returns integer language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); n integer := 0; k integer;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  -- runs: GPS or manual, 1 km or more, at most per_day of each kind per Malaysia day
  with r as (
    select a.id, case when a.source = 'gps' then 'run_gps' else 'run_manual' end as code,
           row_number() over (partition by a.source, (a.started_at at time zone 'Asia/Kuala_Lumpur')::date order by a.started_at) as nth
      from public.run_activities a
     where a.user_id = v_uid and a.source in ('gps','manual') and a.distance_m >= 1000)
  insert into public.run_points_ledger(user_id, rule_code, points, activity_id)
  select v_uid, r.code, pr.points, r.id from r join public.run_point_rules pr on pr.code = r.code and pr.active
   where r.nth <= coalesce(pr.per_day, 1000)
  on conflict do nothing;
  get diagnostics k = row_count; n := n + k;
  -- club runs: only once the captain checked you in
  insert into public.run_points_ledger(user_id, rule_code, points, event_id)
  select v_uid, 'club_run', pr.points, er.event_id
    from public.run_event_registrations er join public.run_point_rules pr on pr.code = 'club_run' and pr.active
   where er.user_id = v_uid and er.checked_in_at is not null
  on conflict do nothing;
  get diagnostics k = row_count; n := n + k;
  -- virtual challenges finished (distance inside the challenge dates reached the target)
  insert into public.run_points_ledger(user_id, rule_code, points, challenge_id)
  select v_uid, 'challenge', pr.points, c.id
    from public.run_challenge_entries e join public.run_challenges c on c.id = e.challenge_id
    join public.run_point_rules pr on pr.code = 'challenge' and pr.active
   where e.user_id = v_uid and c.status = 'published'
     and (select coalesce(sum(a.distance_m), 0) from public.run_activities a
           where a.user_id = v_uid and a.source in ('gps','manual')
             and a.started_at >= (c.starts_on::timestamp at time zone 'Asia/Kuala_Lumpur')
             and a.started_at <  ((c.ends_on + 1)::timestamp at time zone 'Asia/Kuala_Lumpur')) >= c.target_m
  on conflict do nothing;
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;

-- A sweat test happened (its weights stay on the device). At most once every 14 days.
create or replace function public.run_award_sweat_test(p_ref text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if exists(select 1 from public.run_points_ledger where user_id = v_uid and rule_code = 'sweat_test' and created_at > now() - interval '14 days') then return false; end if;
  insert into public.run_points_ledger(user_id, rule_code, points, ref)
  select v_uid, 'sweat_test', points, left(p_ref, 64) from public.run_point_rules where code = 'sweat_test' and active;
  return found;
end $$;

-- The caller's balance and breakdown.
create or replace function public.run_my_points()
returns table(total integer, rule_code text, points integer, n integer)
language sql stable security definer set search_path = public as $$
  select (sum(sum(l.points)) over ())::int, l.rule_code, sum(l.points)::int, count(*)::int
    from public.run_points_ledger l where l.user_id = auth.uid() group by l.rule_code;
$$;

revoke all on function public.run_sync_points(), public.run_award_sweat_test(text), public.run_my_points() from public, anon;
grant execute on function public.run_sync_points(), public.run_award_sweat_test(text), public.run_my_points() to authenticated;

-- If approved, run_delete_my_data() also needs: delete from public.run_points_ledger where user_id = v_uid;
-- (kept out of this file because it rewrites that function; it will go in db/PASTE_IN_SUPABASE.sql)
