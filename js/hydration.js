// Hydration planner: how much to drink on a run and how many HITFAT Hydrate
// sticks, from the expected duration, today's heat level and the runner's own
// sweat tests (Phase 4). Plain arithmetic on rough averages: an estimate only.
export const DURATIONS = [30, 45, 60, 90, 120];
export const BASE_RATE = 0.8;          // L/h with no sweat test, in "safe" weather
export const RATE_PER_LEVEL = 0.2;     // + L/h for each heat level above safe
export const DRINK_SHARE = [0.6, 0.8]; // drink about 60–80 % of what is sweated
export const SODIUM_MG_PER_L = 900;    // typical sweat sodium (a rough average)
export const STICK_SODIUM_MG = 500;    // one HITFAT Hydrate stick

const SWEAT = 'hfrun_sweat';
/** Saved sweat tests, newest first (Phase 4 stores them on the device). */
export function sweatTests() { try { return JSON.parse(localStorage.getItem(SWEAT) || '[]'); } catch (e) { return []; } }
/** Average sweat rate of the last three tests, or null. */
export function measuredRate(tests = sweatTests()) {
  const last = tests.slice(0, 3).map(x => x.rate).filter(r => r > 0);
  return last.length ? last.reduce((a, b) => a + b, 0) / last.length : null;
}

const round50 = ml => Math.max(0, Math.round(ml / 50) * 50);

/**
 * minutes: expected run time; level: 0 safe, 1 caution, 2 danger (null when unknown, treated as safe);
 * measured: the runner's own sweat rate in L/h, or null.
 */
export function planHydration({ minutes, level = 0, measured = null }) {
  const lv = level ?? 0, h = minutes / 60;
  const rate = measured ?? BASE_RATE + RATE_PER_LEVEL * lv;
  const lost = rate * h;                                     // litres sweated
  const waterLow = round50(lost * DRINK_SHARE[0] * 1000), waterHigh = round50(lost * DRINK_SHARE[1] * 1000);
  const water = round50(lost * (DRINK_SHARE[0] + DRINK_SHARE[1]) / 2 * 1000);
  const sodium = Math.round(lost * SODIUM_MG_PER_L);
  let sticks = Math.round(sodium / STICK_SODIUM_MG);
  if (minutes < 45 && lv === 0) sticks = 0;                  // short run in safe weather: water is enough
  if (measured == null) sticks = Math.min(sticks, Math.max(1, Math.floor(h)));   // at most 1 stick an hour without a sweat test
  const every = lv >= 1 || minutes >= 60 ? 15 : 20;          // minutes between sips
  const sips = Math.max(1, Math.floor(minutes / every));
  return { minutes, level: lv, rate: Math.round(rate * 100) / 100, measured: measured != null, water, waterLow, waterHigh,
    sodium, sticks, every, sip: round50(water / sips) || 50 };
}

/* the plan made before a run, kept with that run on this device so its summary can show it */
const KEPT = 'hfrun_hydra';
export function keepPlan(runId, plan) {
  try { const m = JSON.parse(localStorage.getItem(KEPT) || '{}'); m[runId] = { ...plan, at: Date.now() };
    const ids = Object.keys(m).sort((a, b) => m[b].at - m[a].at).slice(0, 200); localStorage.setItem(KEPT, JSON.stringify(Object.fromEntries(ids.map(i => [i, m[i]])))); } catch (e) {}
}
export function keptPlan(runId) { try { return JSON.parse(localStorage.getItem(KEPT) || '{}')[runId] || null; } catch (e) { return null; } }
