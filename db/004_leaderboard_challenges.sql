-- HITFAT RUN · Phase 2b: opt-in leaderboard and virtual run challenges. Additive only.
--
-- Privacy rules this file enforces:
--   * nobody appears on a board until they opt in with a name of their choice
--   * a board shows that name, total km and number of runs: never routes, times,
--     places, dates or anything from Strava (only HITFAT GPS and manual runs count)
--   * opting out takes effect immediately; the runs themselves stay private
--   * challenge participant lists are only names of runners who opted in

-- ── opt-in ──
alter table public.run_profiles add column if not exists board_name text check (char_length(btrim(board_name)) between 2 and 30);
alter table public.run_profiles add column if not exists board_opt_in_at timestamptz;

-- ── virtual run challenges (a distance to cover between two dates, anywhere) ──
create table if not exists public.run_challenges(
  id          uuid primary key default gen_random_uuid(),
  slug        text unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  i18n        jsonb not null check (jsonb_typeof(i18n -> 'ms') = 'object' and char_length(i18n -> 'ms' ->> 'title') between 3 and 80),
  target_m    integer not null check (target_m between 1000 and 1000000),
  starts_on   date not null,
  ends_on     date not null,
  chapter_id  uuid references public.run_chapters(id) on delete cascade,   -- null: open to every chapter
  status      text not null default 'published' check (status in ('draft','published','archived')),
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint run_ch_dates check (ends_on >= starts_on and ends_on - starts_on <= 92));
create index if not exists run_ch_dates_idx on public.run_challenges(ends_on desc);

create table if not exists public.run_challenge_entries(
  challenge_id uuid not null references public.run_challenges(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (challenge_id, user_id));

alter table public.run_challenges enable row level security;
alter table public.run_challenge_entries enable row level security;
do $$ begin
  if not exists(select 1 from pg_policies where schemaname = 'public' and policyname = 'run_ch_read') then
    create policy run_ch_read on public.run_challenges for select to authenticated
      using (status = 'published' or public.run_has_role(array['head_coach','running_coach'], chapter_id));
  end if;
  if not exists(select 1 from pg_policies where schemaname = 'public' and policyname = 'run_ch_write') then
    -- head and running coaches (and super admins) set challenges; captains run events
    create policy run_ch_write on public.run_challenges for all to authenticated
      using (public.run_has_role(array['head_coach','running_coach'], chapter_id))
      with check (public.run_has_role(array['head_coach','running_coach'], chapter_id));
  end if;
  if not exists(select 1 from pg_policies where schemaname = 'public' and policyname = 'run_che_own') then
    -- your own entries only; joining is possible while a published challenge is still open
    create policy run_che_own on public.run_challenge_entries for all to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid() and exists(select 1 from public.run_challenges c
                   where c.id = challenge_id and c.status = 'published' and c.ends_on >= (now() at time zone 'Asia/Kuala_Lumpur')::date));
  end if;
end $$;
revoke all on public.run_challenges, public.run_challenge_entries from anon;
revoke update on public.run_challenge_entries from authenticated;

-- ── boards ──
-- Distance per opted-in runner between two dates (Malaysia time), optionally one chapter, optionally GPS only.
create or replace function public.run_leaderboard(p_from date, p_to date, p_chapter uuid default null, p_gps_only boolean default false)
returns table(rank integer, name text, km numeric, runs integer, me boolean)
language sql stable security definer set search_path = public as $$
  with r as (
    select p.user_id, btrim(p.board_name) as name,
           coalesce(sum(a.distance_m), 0) as m, count(a.id)::int as n
      from public.run_profiles p
      left join public.run_activities a on a.user_id = p.user_id
           and a.source in ('manual','gps') and (not p_gps_only or a.source = 'gps')
           and a.started_at >= (p_from::timestamp at time zone 'Asia/Kuala_Lumpur')
           and a.started_at <  ((p_to + 1)::timestamp at time zone 'Asia/Kuala_Lumpur')
     where auth.uid() is not null and p_to >= p_from and p_to - p_from <= 92
       and p.board_opt_in_at is not null and p.board_name is not null
       and (p_chapter is null or exists(select 1 from public.run_club_members cm where cm.user_id = p.user_id and cm.chapter_id = p_chapter))
     group by p.user_id, p.board_name)
  select (rank() over (order by m desc))::int, name, round(m / 1000.0, 1), n, user_id = auth.uid()
    from r where m > 0 order by m desc, name limit 100;
$$;

-- How many runners joined each challenge (a number, never who).
create or replace function public.run_challenge_counts(p_ids uuid[])
returns table(challenge_id uuid, n integer)
language sql stable security definer set search_path = public as $$
  select e.challenge_id, count(*)::int from public.run_challenge_entries e
   where auth.uid() is not null and e.challenge_id = any(p_ids) group by e.challenge_id;
$$;

-- A challenge's board: entrants who opted in, distance inside the challenge dates.
create or replace function public.run_challenge_board(p_challenge uuid)
returns table(rank integer, name text, km numeric, done boolean, me boolean)
language sql stable security definer set search_path = public as $$
  with c as (select * from public.run_challenges where id = p_challenge and status = 'published'),
  r as (
    select e.user_id, btrim(p.board_name) as name, coalesce(sum(a.distance_m), 0) as m
      from c join public.run_challenge_entries e on e.challenge_id = c.id
      join public.run_profiles p on p.user_id = e.user_id and p.board_opt_in_at is not null and p.board_name is not null
      left join public.run_activities a on a.user_id = e.user_id and a.source in ('manual','gps')
           and a.started_at >= (c.starts_on::timestamp at time zone 'Asia/Kuala_Lumpur')
           and a.started_at <  ((c.ends_on + 1)::timestamp at time zone 'Asia/Kuala_Lumpur')
     where auth.uid() is not null
     group by e.user_id, p.board_name)
  select (rank() over (order by m desc))::int, name, round(m / 1000.0, 1), m >= (select target_m from c), user_id = auth.uid()
    from r order by m desc, name limit 200;
$$;

revoke all on function public.run_leaderboard(date, date, uuid, boolean), public.run_challenge_counts(uuid[]), public.run_challenge_board(uuid) from public, anon;
grant execute on function public.run_leaderboard(date, date, uuid, boolean), public.run_challenge_counts(uuid[]), public.run_challenge_board(uuid) to authenticated;

-- ── the first two challenges ──
insert into public.run_challenges(slug, i18n, target_m, starts_on, ends_on) values
  ('virtual-10k-oktober-2026',
   '{"ms":{"title":"Virtual 10K Oktober","desc":"Kumpul 10 km sepanjang Oktober, di mana-mana sahaja: satu larian atau banyak larian pendek. Semua larian GPS dan manual HITFAT dikira."},
     "en":{"title":"Virtual 10K October","desc":"Cover 10 km during October, anywhere you like: one run or many short ones. Every HITFAT GPS and manual run counts."}}',
   10000, '2026-10-01', '2026-10-31'),
  ('cabaran-50k-november-2026',
   '{"ms":{"title":"Cabaran 50KM November","desc":"50 km dalam sebulan: kira-kira 12 km seminggu. Bina konsistensi bersama kelab."},
     "en":{"title":"50KM November Challenge","desc":"50 km in a month: about 12 km a week. Build consistency with the club."}}',
   50000, '2026-11-01', '2026-11-30')
on conflict (slug) do nothing;

-- "delete my data" also covers challenge entries and the board opt-in
create or replace function public.run_delete_my_data()
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  delete from public.run_user_achievements where user_id = v_uid;
  delete from public.run_event_registrations where user_id = v_uid;
  delete from public.run_challenge_entries where user_id = v_uid;
  delete from public.run_club_members where user_id = v_uid;
  delete from public.run_scheduled_workouts where user_id = v_uid;
  delete from public.run_activities where user_id = v_uid;
  delete from public.run_strength_logs where user_id = v_uid;
  delete from public.run_enrollments where user_id = v_uid;
  delete from public.run_profiles where user_id = v_uid;
end $$;
