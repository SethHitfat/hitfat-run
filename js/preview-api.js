// Preview mode: the same API as api-live.js, kept entirely in this browser's
// localStorage. Nothing is sent anywhere. The rules mirror the database
// functions (run_enroll, run_reschedule, run_rsvp, run_evaluate_achievements)
// so the app behaves the same way it will once signed in.
const KEY = 'hfrun_preview_data';
const USER = { id: 'preview-user', email: 'pratonton@hitfat.run', user_metadata: { full_name: 'Pelari' } };
const CHAPTER = { id: 'preview-kelantan', slug: 'kelantan', name: 'HITFAT Run Club Kelantan', state: 'Kelantan', city: 'Kota Bharu', is_active: true };

export const session = { user: USER };
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2));
const now = () => new Date().toISOString();
const ymd = d => { d = new Date(d); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dateOf = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const clone = v => JSON.parse(JSON.stringify(v));

function fresh() {
  // one example run so the club screens have something to open; it is labelled as an example
  const d = new Date(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); d.setHours(6, 30, 0, 0);
  return { profile: null, enrollments: [], sessions: [], activities: [], achievements: [], members: [], regs: [],
    events: [{ id: 'preview-event', chapter_id: CHAPTER.id, title: 'Larian Pagi Sabtu (contoh)', starts_at: d.toISOString(), duration_min: 60,
      meeting_point: 'Pintu utama Stadium Sultan Muhammad IV', distance_text: '5KM', pace_groups: '6:00, 7:00, lari/jalan',
      leader_name: 'Kapten HITFAT', capacity: 30, status: 'scheduled', map_url: null,
      description: 'Contoh larian untuk mod pratonton. Larian sebenar diumumkan oleh kapten selepas log masuk.' }] };
}
let db = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch (e) { return fresh(); } })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
const fail = (message, hint) => { const e = new Error(message); if (hint) e.hint = hint; throw e; };

let programs = null;
async function catalog() {
  if (!programs) { const r = await fetch('/preview/programs.json'); if (!r.ok) fail('Pelan pratonton tidak dapat dimuatkan'); programs = await r.json(); }
  return programs;
}
const brief = p => { const { workouts, ...rest } = p; return rest; };
async function template(id) { for (const p of await catalog()) { const w = p.workouts.find(x => x.id === id); if (w) return w; } return null; }

/* ───────── auth & profile ───────── */
export const isNetErr = () => false;
export const clearCache = () => {};
export const signInGoogle = async () => ({ error: null });
export const signInEmail = async () => ({ error: null });
export const signUpEmail = async () => ({ data: { session: null }, error: null });
export const resetPassword = async () => ({ error: null });
export async function signOut() { const { endPreview } = await import('./api.js'); endPreview(); }
export async function getProfile() { return db.profile ? clone(db.profile) : null; }
export async function saveProfile(patch) { db.profile = { ...(db.profile || { user_id: USER.id, created_at: now() }), ...patch, updated_at: now() }; save(); return clone(db.profile); }
export async function sharedName() { return USER.user_metadata.full_name; }
// in preview you are the Kelantan club captain, so the captain tools can be tried too
export async function myRoles() { return [{ role: 'club_captain', chapter_id: CHAPTER.id }]; }
export async function isSuperAdmin() { return false; }

/* ───────── programmes & plan ───────── */
export async function listPrograms() { return (await catalog()).map(brief); }
export async function getProgram(slug) { const p = (await catalog()).find(x => x.slug === slug); return p ? clone(p) : null; }
export async function setProgramStatus() { fail('Tidak tersedia dalam pratonton'); }

export async function enroll(programId, startYmd, weekdays) {
  if (!weekdays || !weekdays.length) fail('choose at least one day');
  const p = (await catalog()).find(x => x.id === programId); if (!p) fail('programme not available');
  db.enrollments.forEach(e => { if (e.status === 'active') { e.status = 'stopped'; e.ended_at = now(); } });
  const enr = { id: uuid(), user_id: USER.id, program_id: p.id, start_date: startYmd, weekdays, status: 'active', created_at: now(), ended_at: null };
  db.enrollments.push(enr);
  const day = dateOf(startYmd); let seq = 0;
  for (const w of [...p.workouts].sort((a, b) => a.week - b.week || a.session - b.session)) {
    while (!weekdays.includes(day.getDay())) day.setDate(day.getDate() + 1);
    db.sessions.push({ id: uuid(), enrollment_id: enr.id, user_id: USER.id, template_id: w.id, seq: ++seq, scheduled_date: ymd(day),
      status: 'planned', completed_at: null, activity_id: null, rpe: null, feeling: null, feedback: null });
    day.setDate(day.getDate() + 1);
  }
  save(); return enr.id;
}
async function withProgram(enr) {
  const p = (await catalog()).find(x => x.id === enr.program_id);
  return { ...clone(enr), program: p && { id: p.id, slug: p.slug, i18n: p.i18n, weeks: p.weeks, sessions_per_week: p.sessions_per_week, target_distance_m: p.target_distance_m, goal: p.goal } };
}
export async function activePlan() {
  const enr = db.enrollments.find(e => e.status === 'active'); if (!enr) return null;
  const out = await withProgram(enr);
  out.sessions = await Promise.all(db.sessions.filter(s => s.enrollment_id === enr.id).sort((a, b) => a.seq - b.seq)
    .map(async s => ({ ...clone(s), template: await template(s.template_id) })));
  return out;
}
export async function getSession(id) {
  const s = db.sessions.find(x => x.id === id); if (!s) return null;
  const enr = db.enrollments.find(e => e.id === s.enrollment_id);
  return { ...clone(s), template: await template(s.template_id), enrollment: enr ? await withProgram(enr) : null };
}
const SESSION_FIELDS = ['status', 'completed_at', 'activity_id', 'rpe', 'feeling', 'feedback', 'scheduled_date'];
export async function updateSession(id, patch) {
  const s = db.sessions.find(x => x.id === id); if (!s) fail('session not found');
  for (const k of SESSION_FIELDS) if (k in patch) s[k] = patch[k];
  save(); return clone(s);
}
export async function reschedule(fromYmd) {
  const enr = db.enrollments.find(e => e.status === 'active'); if (!enr) return 0;
  const day = dateOf(fromYmd < ymd(new Date()) ? ymd(new Date()) : fromYmd); let n = 0;
  for (const s of db.sessions.filter(x => x.enrollment_id === enr.id && x.status === 'planned').sort((a, b) => a.seq - b.seq)) {
    while (!enr.weekdays.includes(day.getDay())) day.setDate(day.getDate() + 1);
    s.scheduled_date = ymd(day); day.setDate(day.getDate() + 1); n++;
  }
  save(); return n;
}
const endPlan = status => async id => { const e = db.enrollments.find(x => x.id === id); if (e) { e.status = status; e.ended_at = now(); save(); } };
export const stopPlan = endPlan('stopped');
export const completePlan = endPlan('completed');

/* ───────── activities ───────── */
const withPace = a => ({ ...clone(a), avg_pace_s_km: Math.round(a.moving_time_s * 1000 / a.distance_m) });
export async function saveActivity(act, link) {
  const row = { ...act, user_id: USER.id, updated_at: now() };
  const i = db.activities.findIndex(a => a.id === row.id);
  if (i >= 0) db.activities[i] = { ...db.activities[i], ...row }; else db.activities.push({ ...row, created_at: now() });
  if (link) await updateSession(link.id, { ...link.patch, activity_id: row.id });
  save(); return { saved: withPace(row), queued: false };
}
export const flushOutbox = async () => 0;
export async function saveStrength(log) { db.strength = (db.strength || []).filter(x => x.id !== log.id).concat({ ...log, user_id: USER.id }); save(); return { saved: clone(log), queued: false }; }
export async function listStrength({ since } = {}) {
  return clone((db.strength || []).filter(a => !since || Date.parse(a.started_at) >= new Date(since).getTime()).sort((a, b) => b.started_at.localeCompare(a.started_at)));
}
export const pendingCount = () => 0;
export async function listActivities({ since, limit = 200 } = {}) {
  return db.activities.filter(a => !since || Date.parse(a.started_at) >= new Date(since).getTime())
    .sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, limit).map(withPace);
}
export async function getActivity(id) { const a = db.activities.find(x => x.id === id); return a ? withPace(a) : null; }
export async function deleteActivity(id) {
  db.activities = db.activities.filter(a => a.id !== id);
  db.sessions.forEach(s => { if (s.activity_id === id) s.activity_id = null; }); save();
}
export async function findDuplicate(startedAt, distanceM, ignoreId) {
  const d = new Date(startedAt);
  return db.activities.find(a => a.id !== ignoreId && new Date(a.started_at).toDateString() === d.toDateString()
    && Math.abs(a.distance_m - distanceM) <= distanceM * 0.03) || null;
}

/* ───────── achievements (same rules as run_evaluate_achievements) ───────── */
export async function evaluateAchievements() {
  const acts = db.activities, maxM = Math.max(0, ...acts.map(a => a.distance_m));
  const done = db.sessions.filter(s => s.status === 'completed').length;
  const rsvp = db.regs.filter(r => r.status === 'going' && db.events.some(e => e.id === r.event_id && e.status === 'scheduled' && Date.parse(e.starts_at) < Date.now())).length;
  const months = {}; acts.forEach(a => { const d = new Date(a.started_at), k = d.getFullYear() * 12 + d.getMonth(); months[k] = (months[k] || 0) + a.distance_m / 1000; });
  const bestMonth = Math.max(0, ...Object.values(months));
  const weekOf = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.getTime(); };
  const weeks = [...new Set(acts.map(a => weekOf(a.started_at)))].sort((a, b) => a - b);
  let streak = 0, run = 0; weeks.forEach((w, i) => { run = i && Math.round((w - weeks[i - 1]) / 6048e5) === 1 ? run + 1 : 1; streak = Math.max(streak, run); });
  const planDone = db.enrollments.some(e => { const s = db.sessions.filter(x => x.enrollment_id === e.id); return s.length && s.every(x => x.status === 'completed'); });
  const codes = [[acts.length >= 1, 'first_run'], [maxM >= 5000, 'first_5k'], [maxM >= 10000, 'first_10k'], [maxM >= 21097, 'first_half'],
    [done >= 1, 'first_workout'], [done >= 10, 'workouts_10'], [streak >= 4, 'consistency_4w'], [rsvp >= 1, 'first_club_run'],
    [bestMonth >= 50, 'month_50k'], [bestMonth >= 100, 'month_100k'], [planDone, 'plan_complete']].filter(([ok]) => ok).map(([, c]) => c);
  const fresh = codes.filter(c => !db.achievements.some(a => a.code === c));
  fresh.forEach(code => db.achievements.push({ code, earned_at: now() })); save();
  return fresh;
}
export async function listAchievements() { return clone(db.achievements); }

/* ───────── club ───────── */
export async function listChapters() { return [clone(CHAPTER)]; }
export async function myChapters() { return clone(db.members); }
export async function joinChapter(id) { if (!db.members.some(m => m.chapter_id === id)) db.members.push({ chapter_id: id, joined_at: now() }); save(); }
export async function leaveChapter(id) { db.members = db.members.filter(m => m.chapter_id !== id); save(); }
const withChapter = e => ({ ...clone(e), chapter: { slug: CHAPTER.slug, name: CHAPTER.name } });
export async function listEvents({ chapterId, upcoming = true, limit = 30 } = {}) {
  const cut = upcoming ? Date.now() - 6 * 36e5 : Date.now();
  return db.events.filter(e => (!chapterId || e.chapter_id === chapterId) && (upcoming ? Date.parse(e.starts_at) >= cut : Date.parse(e.starts_at) < cut))
    .sort((a, b) => upcoming ? a.starts_at.localeCompare(b.starts_at) : b.starts_at.localeCompare(a.starts_at)).slice(0, limit).map(withChapter);
}
export async function getEvent(id) { const e = db.events.find(x => x.id === id); return e ? withChapter(e) : null; }
export async function eventCounts(ids) {
  return Object.fromEntries(ids.map(id => [id, db.regs.filter(r => r.event_id === id && r.status === 'going').length]).filter(([, n]) => n));
}
export async function myRegistrations(ids) { return clone(db.regs.filter(r => !ids || ids.includes(r.event_id))); }
export async function myRunHistory() {
  return db.regs.filter(r => r.status === 'going').map(r => { const e = db.events.find(x => x.id === r.event_id);
    return { ...clone(r), event: e && { id: e.id, title: e.title, starts_at: e.starts_at, meeting_point: e.meeting_point, status: e.status } }; });
}
export async function rsvp(eventId, going) {
  const e = db.events.find(x => x.id === eventId);
  if (!e || e.status !== 'scheduled') fail('event not open');
  let r = db.regs.find(x => x.event_id === eventId);
  if (!going) { if (r) r.status = 'cancelled'; save(); return 'cancelled'; }
  if (Date.parse(e.starts_at) + e.duration_min * 6e4 < Date.now()) fail('event has finished');
  if (e.capacity && db.regs.filter(x => x.event_id === eventId && x.status === 'going').length >= e.capacity) fail('event is full', 'full');
  if (r) r.status = 'going'; else db.regs.push(r = { event_id: eventId, status: 'going', created_at: now(), checked_in_at: null });
  await joinChapter(e.chapter_id); save(); return 'going';
}
export async function createEvent(ev) { const e = { ...ev, id: uuid(), status: 'scheduled', created_at: now() }; db.events.push(e); save(); return clone(e); }
export async function updateEvent(id, patch) { const e = db.events.find(x => x.id === id); Object.assign(e, patch); save(); return clone(e); }
export async function guestList(eventId) {
  return db.regs.filter(r => r.event_id === eventId && r.status === 'going').map(r => ({ user_id: USER.id, status: r.status, created_at: r.created_at, name: 'Anda (pratonton)' }));
}

/* ───────── privacy ───────── */
export async function deleteMyRunData() { db = fresh(); save(); }

/* ───────── leaderboard & challenges ─────────
   Preview has no other runners, so the boards show a few clearly labelled
   examples next to you (only once you opt in), as the real board would. */
const EXAMPLES = [['Aina (contoh)', 1.0], ['Hakim (contoh)', 0.8], ['Mei Ling (contoh)', 0.55], ['Ravi (contoh)', 0.3]];
const mKL = d => ymd(d);
const myKm = (from, to, gpsOnly) => db.activities.filter(a => (!gpsOnly || a.source === 'gps') && mKL(a.started_at) >= from && mKL(a.started_at) <= to)
  .reduce((s, a) => [s[0] + a.distance_m, s[1] + 1], [0, 0]);
function board(rows) {
  rows.sort((a, b) => b.km - a.km); let r = 0, last = null;
  return rows.map((x, i) => { if (x.km !== last) { r = i + 1; last = x.km; } return { ...x, rank: r }; });
}
export async function leaderboard({ from, to, gpsOnly = false }) {
  const span = (dateOf(to) - dateOf(from)) / 864e5 + 1, rows = EXAMPLES.map(([name, perDay]) => ({ name, km: +(perDay * span).toFixed(1), runs: Math.ceil(span / 2.5), me: false }));
  const [m, n] = myKm(from, to, gpsOnly);
  if (db.profile?.board_opt_in_at && m > 0) rows.push({ name: db.profile.board_name, km: +(m / 1000).toFixed(1), runs: n, me: true });
  return board(rows);
}
export async function setBoard(name) { return saveProfile(name ? { board_name: name.trim(), board_opt_in_at: now() } : { board_opt_in_at: null }); }
const CH = [
  { id: 'preview-ch-10k', slug: 'virtual-10k', target_m: 10000, status: 'published', chapter_id: null, offset: [-21, 9],
    i18n: { ms: { title: 'Virtual 10K (contoh)', desc: 'Kumpul 10 km dalam tempoh cabaran, di mana-mana sahaja. Semua larian GPS dan manual HITFAT dikira.' },
            en: { title: 'Virtual 10K (example)', desc: 'Cover 10 km during the challenge, anywhere. Every HITFAT GPS and manual run counts.' } } },
  { id: 'preview-ch-50k', slug: 'cabaran-50k', target_m: 50000, status: 'published', chapter_id: null, offset: [10, 39],
    i18n: { ms: { title: 'Cabaran 50KM (contoh)', desc: '50 km dalam sebulan: kira-kira 12 km seminggu.' }, en: { title: '50KM Challenge (example)', desc: '50 km in a month: about 12 km a week.' } } },
];
const chOut = c => { const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return ymd(x); }; const { offset, ...rest } = c; return { ...clone(rest), starts_on: d(offset[0]), ends_on: d(offset[1]) }; };
export async function listChallenges() { return [...(db.challenges || []), ...CH.map(chOut)]; }
export async function getChallenge(id) { return (await listChallenges()).find(c => c.id === id) || null; }
export async function challengeCounts(ids) { const e = db.entries || []; return Object.fromEntries(ids.map(id => [id, 23 + e.filter(x => x.challenge_id === id).length])); }
export async function myChallenges() { return clone(db.entries || []); }
export async function joinChallenge(id) {
  const c = await getChallenge(id); if (!c || c.ends_on < ymd(new Date())) fail('Cabaran ini sudah tamat');
  db.entries = (db.entries || []).filter(x => x.challenge_id !== id).concat({ challenge_id: id, joined_at: now() }); save();
}
export async function leaveChallenge(id) { db.entries = (db.entries || []).filter(x => x.challenge_id !== id); save(); }
export async function challengeBoard(id) {
  const c = await getChallenge(id); if (!c) return [];
  const span = Math.max(1, Math.min((Date.now() - dateOf(c.starts_on)) / 864e5, (dateOf(c.ends_on) - dateOf(c.starts_on)) / 864e5 + 1));
  const rows = c.starts_on > ymd(new Date()) ? [] : EXAMPLES.map(([name, perDay]) => ({ name, km: +(perDay * span).toFixed(1), me: false }));
  const [m] = myKm(c.starts_on, c.ends_on, false);
  if (db.profile?.board_opt_in_at && (db.entries || []).some(x => x.challenge_id === id)) rows.push({ name: db.profile.board_name, km: +(m / 1000).toFixed(1), me: true });
  return board(rows).map(x => ({ ...x, done: x.km * 1000 >= c.target_m }));
}
export async function myPoints() { return null; }   // no ledger in preview: Profile shows the estimate
export async function createChallenge() { fail('Tidak tersedia dalam pratonton'); }
export async function archiveChallenge() { fail('Tidak tersedia dalam pratonton'); }
