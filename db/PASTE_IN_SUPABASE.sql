-- HITFAT RUN · the part to paste by hand in Supabase → SQL Editor → Run.
-- Everything else is already applied. These statements contain DELETE, which the
-- automated connection asks a human to confirm, so they are kept here.
-- Safe to run more than once. It only adds permissions and one function; it removes no data.

-- 1. "Keluar kelab": a member may remove their own membership
do $$ begin
  if not exists(select 1 from pg_policies where schemaname = 'public' and policyname = 'run_cm_leave') then
    create policy run_cm_leave on public.run_club_members for delete to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- 2. Captains and head coaches may remove an event of their own chapter
do $$ begin
  if not exists(select 1 from pg_policies where schemaname = 'public' and policyname = 'run_events_del') then
    create policy run_events_del on public.run_events for delete to authenticated
      using (public.run_has_role(array['head_coach','club_captain'], chapter_id));
  end if;
end $$;

-- 3. "Padam data saya": erases the caller's own HITFAT RUN data (the shared HITFAT account stays)
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
revoke all on function public.run_delete_my_data() from public, anon;
grant execute on function public.run_delete_my_data() to authenticated;
