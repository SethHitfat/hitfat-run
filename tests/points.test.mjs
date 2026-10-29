// Mata HITFAT estimate: the same rules as db/007_points_proposal.sql.   node tests/points.test.mjs
import { estimatePoints, RULES } from '../js/points.js';
let bad = 0; const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) bad++; };
const at = h => new Date(Date.UTC(2026, 9, 29, h)).toISOString();   // 29 Oct, UTC hours (Malaysia = +8)
const run = (h, m, source = 'gps') => ({ started_at: at(h), distance_m: m, source });
// the same day as the SQL check: 3 GPS (cap 2), 1 manual, 1 short, 1 Strava
let x = estimatePoints({ acts: [run(1, 5000), run(2, 3000), run(3, 2000), run(0, 4000, 'manual'), run(4, 800), run(5, 10000, 'strava')] });
ok(x.by.run_gps === 20 && x.by.run_manual === 5 && x.total === 25, `matches the SQL check: GPS capped at 2 a day, manual 5, short and Strava none [${JSON.stringify(x.by)}]`);
x = estimatePoints({ acts: [run(15, 5000), run(17, 5000), run(14, 5000)] });   // 23:00 and 01:00 Malaysia time fall on different days
ok(x.by.run_gps === 30, `the day is Malaysia time: 22:00, 23:00 and 01:00 next day are two days [${x.by.run_gps}]`);
ok(estimatePoints({ checkIns: [{ checked_in_at: at(1) }, { checked_in_at: null }] }).by.club_run === RULES.club_run.points, 'club run counts only when checked in');
ok(estimatePoints({ finished: ['c1', 'c1', 'c2'] }).by.challenge === 200, 'each finished challenge once');
const d = day => new Date(Date.UTC(2026, 9, day)).toISOString();
ok(estimatePoints({ sweat: [{ at: d(1) }, { at: d(5) }, { at: d(20) }] }).by.sweat_test === 40, 'sweat tests at most once every 14 days');
ok(estimatePoints({ acts: [{ ...run(1, 5000), queued: true }] }).total === 0, 'a run not yet sent earns nothing until it is saved');
if (bad) { console.error(`${bad} points problems`); process.exit(1); }
console.log('points ok');
