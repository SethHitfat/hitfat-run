// DRAFT plans for coach review: Road to HYROX (10 weeks) and Road to 21KM
// (12 weeks). Same format as programs.mjs; every session is marked
// "DRAF — perlu semakan coach" and the plans are seeded as status 'draft',
// so no runner sees them until a head coach has rewritten and published them.
//   node db/seed/programs-draft.mjs > db/006_draft_plans_hyrox_21k.sql
import { continuous, distanceRun, intervals, tempo, WARM, COOL, q, j } from './programs.mjs';

const MARK = { ms: 'DRAF — perlu semakan coach.', en: 'DRAFT — needs coach review.' };
/** Prefix the session text with the draft mark, in both languages. */
function draft(w) {
  for (const l of ['ms', 'en']) {
    const x = w.i18n[l];
    x.main = `${MARK[l]} ${x.main}`;
    x.coach = `${MARK[l]} ${x.coach || ''}`.trim();
  }
  return w;
}
// the strength sessions already in the app (js/strength.js), by key
const STRENGTH = {
  'kaki-pelari': { min: 19, ms: 'Kaki Pelari', en: 'Runner Legs' },
  'kuasa-pecut': { min: 18, ms: 'Kuasa & Pecut', en: 'Power & Speed' },
  'badan-penuh': { min: 22, ms: 'Seluruh Badan di Rumah', en: 'Full Body at Home' },
};
function strength(week, session, key) {
  const s = STRENGTH[key];
  return draft({
    week, session, category: 'strength', duration_min: s.min, intensity: 'moderate', rpe_min: 5, rpe_max: 7,
    steps: [{ kind: 'strength', workout: key }],
    i18n: {
      ms: { title: `Kekuatan: ${s.ms}`, objective: 'Kaki dan core yang kuat untuk larian dan stesen.', warmup: 'Termasuk dalam sesi video.',
        main: `Ikut sesi video HITFAT “${s.ms}” dalam app (${s.min} minit).`, cooldown: 'Jalan perlahan 3 minit dan regangan ringan.', coach: '' },
      en: { title: `Strength: ${s.en}`, objective: 'Strong legs and core for the runs and the stations.', warmup: 'Included in the video session.',
        main: `Follow the HITFAT video session “${s.en}” in the app (${s.min} minutes).`, cooldown: 'Walk 3 minutes and stretch lightly.', coach: '' } } });
}
/** HYROX-style: running repeats with bodyweight "stations" in between. */
function compromised(week, session, reps) {
  return draft({
    week, session, category: 'interval', duration_min: reps * 9 + 20, distance_m: reps * 1000, intensity: 'hard', rpe_min: 6, rpe_max: 8,
    rest_interval: 'station', i18n: {
      ms: { title: `Lari + Stesen ${reps} × 1KM`, objective: 'Biasakan berlari dengan kaki yang sudah penat, seperti dalam HYROX.',
        warmup: WARM.ms + ' Tambah 10 minit lari santai.',
        main: `${reps} kali: lari 1KM pada pace perlumbaan, terus buat 1 stesen tanpa rehat (bergilir: 20 lunge berjalan, 15 burpee, 30 saat wall sit, 20 squat jump).`,
        cooldown: COOL.ms, coach: 'Peralihan dari stesen ke larian ialah kemahiran: mula 200 meter pertama sedikit perlahan.' },
      en: { title: `Run + Station ${reps} × 1KM`, objective: 'Get used to running on tired legs, as in HYROX.',
        warmup: WARM.en + ' Add 10 minutes of easy running.',
        main: `${reps} times: run 1KM at race pace, then go straight into 1 station without rest (rotate: 20 walking lunges, 15 burpees, 30 s wall sit, 20 squat jumps).`,
        cooldown: COOL.en, coach: 'Going from a station back to running is a skill: take the first 200 m a little slower.' } } });
}

const DRAFT_PROGRAMS = [
  { slug: 'road-to-hyrox', goal: 'hyrox', level: 'intermediate', weeks: 10, sessions_per_week: 4, target_distance_m: 8000, sort: 60,
    i18n: {
      ms: { title: 'Menuju HYROX', summary: 'DRAF — perlu semakan coach. Sepuluh minggu larian, interval 1KM dan kekuatan untuk 8 × 1KM dan stesen HYROX.', who: 'Untuk yang boleh lari 30 minit berterusan dan mahu tamat HYROX pertama.' },
      en: { title: 'Road to HYROX', summary: 'DRAFT — needs coach review. Ten weeks of running, 1KM intervals and strength for the 8 × 1KM and HYROX stations.', who: 'For runners who can run 30 minutes continuously and want to finish a first HYROX.' } },
    workouts: (() => {
      const w = [], easy = [30, 35, 35, 40, 30, 40, 45, 45, 30, 25], reps = [3, 4, 4, 5, 3, 5, 6, 6, 4, 0];
      const rot = ['kuasa-pecut', 'kaki-pelari', 'badan-penuh'];
      for (let wk = 1; wk <= 10; wk++) {
        w.push(draft(continuous(wk, 1, easy[wk - 1])));
        w.push(strength(wk, 2, rot[(wk - 1) % 3]));
        w.push(draft(wk === 10 ? tempo(wk, 3, 12) : intervals(wk, 3, 3 + Math.min(4, Math.floor(wk / 2)), 1000, 120)));
        w.push(wk === 10
          ? draft(distanceRun(wk, 4, 8, 'tempo',
            { title: 'Simulasi HYROX', obj: 'Latihan penuh sebelum hari perlumbaan.', main: '8 × 1KM, setiap satu diikuti satu stesen berat badan. Pace terkawal, fokus pada peralihan.', coach: 'Ini latihan, bukan perlumbaan. Simpan tenaga untuk hari sebenar.' },
            { title: 'HYROX Simulation', obj: 'A full rehearsal before race day.', main: '8 × 1KM, each followed by one bodyweight station. Controlled pace, focus on the transitions.', coach: 'This is practice, not the race. Save your energy for the real day.' }))
          : wk === 5 || wk === 9 ? strength(wk, 4, 'badan-penuh') : compromised(wk, 4, reps[wk - 1]));
      }
      return w; })() },

  { slug: 'road-to-21k', goal: 'half', level: 'intermediate', weeks: 12, sessions_per_week: 4, target_distance_m: 21097, sort: 50,
    i18n: {
      ms: { title: 'Menuju 21KM', summary: 'DRAF — perlu semakan coach. Dua belas minggu ke separuh maraton: larian jauh beransur, tempo, interval dan kekuatan.', who: 'Untuk yang boleh lari 10KM atau 60 minit berterusan.' },
      en: { title: 'Road to 21KM', summary: 'DRAFT — needs coach review. Twelve weeks to a half marathon: gradual long runs, tempo, intervals and strength.', who: 'For runners who can run 10KM or 60 minutes continuously.' } },
    workouts: (() => {
      const w = [], lng = [8, 9, 10, 8, 11, 12, 14, 11, 15, 16, 18, 21.1], easy = [40, 40, 45, 35, 45, 50, 50, 40, 50, 50, 45, 30];
      const rot = ['kaki-pelari', 'kuasa-pecut', 'badan-penuh'];
      for (let wk = 1; wk <= 12; wk++) {
        const light = wk === 4 || wk === 8 || wk === 12;
        w.push(draft(continuous(wk, 1, easy[wk - 1])));
        w.push(strength(wk, 2, rot[(wk - 1) % 3]));
        w.push(draft(light ? continuous(wk, 3, 25, { category: 'recovery', ms: 'Larian Pemulihan 25 minit', en: 'Recovery Run 25 min' })
          : wk % 2 ? tempo(wk, 3, 15 + wk * 2) : intervals(wk, 3, 4 + Math.floor(wk / 4), 1000, 120)));
        const km = lng[wk - 1];
        w.push(draft(wk === 12
          ? distanceRun(wk, 4, 21.1, 'long',
            { title: 'Hari Perlumbaan: 21KM', obj: 'Tamatkan separuh maraton.', main: 'Lari 21.1KM. Mula lebih perlahan dari pace sasaran, minum mengikut pelan hidrasi.', coach: 'Separuh pertama sabar. Separuh kedua milik anda.' },
            { title: 'Race Day: 21KM', obj: 'Finish the half marathon.', main: 'Run 21.1KM. Start slower than target pace, drink to your hydration plan.', coach: 'Be patient in the first half. The second half is yours.' })
          : distanceRun(wk, 4, km, 'long',
            { title: `Larian Jauh ${km}KM`, obj: 'Panjangkan daya tahan ke arah 21KM.', main: `${km}KM pada pace perbualan. Bawa air.`, coach: 'Lari awal pagi, sebelum panas tengah hari.' },
            { title: `Long Run ${km}KM`, obj: 'Extend your endurance toward 21KM.', main: `${km}KM at conversational pace. Carry water.`, coach: 'Run early in the morning, before the midday heat.' })));
      }
      return w; })() },
];

export { DRAFT_PROGRAMS };
if (import.meta.url === `file://${process.argv[1]}`) printSql();
function printSql() {
  let out = `-- GENERATED by db/seed/programs-draft.mjs. NOT APPLIED to production: for review first.
-- Adds two DRAFT plans (status 'draft': invisible to runners) and their sessions.
-- If a plan with the same slug exists, its sessions are left untouched (on conflict do nothing).
begin;
`;
  for (const p of DRAFT_PROGRAMS) {
    const n = p.weeks * p.sessions_per_week;
    if (p.workouts.length !== n) throw new Error(`${p.slug}: ${p.workouts.length} workouts, expected ${n}`);
    out += `
insert into public.run_programs(slug, i18n, goal, level, weeks, sessions_per_week, target_distance_m, tier, status, sort)
values (${q(p.slug)}, ${j(p.i18n)}, ${q(p.goal)}, ${q(p.level)}, ${p.weeks}, ${p.sessions_per_week}, ${q(p.target_distance_m)}, 'free', 'draft', ${p.sort})
on conflict (slug) do nothing;
`;
    for (const w of p.workouts) out += `insert into public.run_workout_templates(program_id, week, session, category, i18n, duration_min, distance_m, intensity, rpe_min, rpe_max, rest_interval, steps)
select id, ${w.week}, ${w.session}, ${q(w.category)}, ${j(w.i18n)}, ${q(w.duration_min)}, ${q(w.distance_m)}, ${q(w.intensity)}, ${q(w.rpe_min)}, ${q(w.rpe_max)}, ${q(w.rest_interval)}, ${j(w.steps)}
  from public.run_programs where slug = ${q(p.slug)}
on conflict (program_id, week, session) do nothing;
`;
  }
  process.stdout.write(out + '\ncommit;\n');
}
