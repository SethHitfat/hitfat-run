-- HITFAT RUN · Phase 2a: strength, mobility and drills for runners.
-- The workouts themselves are app content (js/strength.js, videos on Vimeo);
-- the database only keeps each runner's own completed sessions. Additive only.

create table if not exists public.run_strength_logs(
  -- client-generated, so a retried save is an upsert and never a duplicate
  id           uuid primary key,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workout_key  text not null check (workout_key ~ '^[a-z0-9-]{1,40}$'),
  started_at   timestamptz not null check (started_at > '2000-01-01' and started_at < now() + interval '1 day'),
  duration_s   integer not null check (duration_s between 30 and 14400),
  moves_done   smallint check (moves_done between 0 and 500),
  rpe          smallint check (rpe between 1 and 10),
  created_at   timestamptz not null default now());
create index if not exists run_str_user_started on public.run_strength_logs(user_id, started_at desc);

alter table public.run_strength_logs enable row level security;
do $$ begin
  if not exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'run_strength_logs' and policyname = 'run_str_own') then
    create policy run_str_own on public.run_strength_logs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
revoke all on public.run_strength_logs from anon;
-- a log is a record of what happened: it can be saved or removed, never rewritten
revoke update on public.run_strength_logs from authenticated;

-- "delete my data" also erases strength sessions
create or replace function public.run_delete_my_data()
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  delete from public.run_user_achievements where user_id = v_uid;
  delete from public.run_event_registrations where user_id = v_uid;
  delete from public.run_club_members where user_id = v_uid;
  delete from public.run_scheduled_workouts where user_id = v_uid;
  delete from public.run_activities where user_id = v_uid;
  delete from public.run_strength_logs where user_id = v_uid;
  delete from public.run_enrollments where user_id = v_uid;
  delete from public.run_profiles where user_id = v_uid;
end $$;
