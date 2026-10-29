// Mata HITFAT (skeleton, read-only). The rules live here and in the proposed
// db/007_points_proposal.sql; keep the two the same. Until the database side
// is approved and live, Profile shows an ESTIMATE computed from the runner's
// own data with these rules. Nothing can be redeemed yet.
export const RULES = {
  run_gps:    { points: 10, perDay: 2 },   // a GPS run of 1 km or more
  run_manual: { points: 5,  perDay: 2 },   // a manual run of 1 km or more (easier to get wrong, so fewer points)
  club_run:   { points: 30 },              // a club run the captain checked you in to (RSVP alone does not count)
  challenge:  { points: 100 },             // finishing a virtual challenge, once per challenge
  sweat_test: { points: 20, everyDays: 14 },  // a completed sweat test, at most once every 14 days
};
export const MIN_RUN_M = 1000;

const dayKL = iso => new Date(new Date(iso).getTime() + 8 * 36e5).toISOString().slice(0, 10);   // Malaysia date

/**
 * acts: the runner's runs; checkIns: club runs with checked_in_at; finished: ids of challenges completed;
 * sweat: sweat tests (with `at`). Strava runs never earn points.
 */
export function estimatePoints({ acts = [], checkIns = [], finished = [], sweat = [] }) {
  const by = { run_gps: 0, run_manual: 0, club_run: 0, challenge: 0, sweat_test: 0 }, perDay = {};
  for (const a of [...acts].sort((x, y) => x.started_at.localeCompare(y.started_at))) {
    if (a.queued || a.distance_m < MIN_RUN_M || (a.source !== 'gps' && a.source !== 'manual')) continue;
    const rule = a.source === 'gps' ? 'run_gps' : 'run_manual', k = rule + dayKL(a.started_at);
    if ((perDay[k] = (perDay[k] || 0) + 1) > RULES[rule].perDay) continue;
    by[rule] += RULES[rule].points;
  }
  by.club_run = checkIns.filter(r => r.checked_in_at).length * RULES.club_run.points;
  by.challenge = new Set(finished).size * RULES.challenge.points;
  let last = -Infinity;
  for (const s of [...sweat].sort((x, y) => String(x.at).localeCompare(String(y.at)))) {
    const t = Date.parse(s.at); if (t - last < RULES.sweat_test.everyDays * 864e5) continue;
    last = t; by.sweat_test += RULES.sweat_test.points;
  }
  return { total: Object.values(by).reduce((a, b) => a + b, 0), by };
}
