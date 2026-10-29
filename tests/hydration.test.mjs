// Hydration planner rules.   node tests/hydration.test.mjs
globalThis.localStorage = { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); }, removeItem(k) { delete this._[k]; } };
const { planHydration, measuredRate, sweatRate, saveSweatTest, sweatTests, setSweatOwner, clearHydrationData } = await import('../js/hydration.js');
let bad = 0; const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) bad++; };
const p = (minutes, level, measured) => planHydration({ minutes, level, measured });
let x = p(60, 0);
ok(x.rate === 0.8 && x.water === 550 && x.waterLow === 500 && x.waterHigh === 650, `60 min safe: 0.8 L/h, ~550 ml (500–650) [${x.rate}, ${x.water}, ${x.waterLow}–${x.waterHigh}]`);
ok(x.sodium === 720 && x.sticks === 1, `60 min safe: 720 mg sodium → 1 stick [${x.sodium}, ${x.sticks}]`);
x = p(60, 1); ok(x.rate === 1.0 && x.every === 15, `caution adds 0.2 L/h, sip every 15 min [${x.rate}, ${x.every}]`);
x = p(60, 2); ok(x.rate === 1.2 && x.water === 850, `danger: 1.2 L/h, ~850 ml [${x.rate}, ${x.water}]`);
x = p(30, 0); ok(x.sticks === 0 && x.every === 20, `30 min safe: no stick, sip every 20 min [${x.sticks}, ${x.every}]`);
x = p(30, 1); ok(x.sticks === 1, `30 min caution: 1 stick allowed (450 mg → 1) [${x.sticks}, ${x.sodium} mg]`);
x = p(120, 2); ok(x.sticks === 2, `120 min danger: 2160 mg → 4 by sodium, capped at 1 an hour = 2 [${x.sticks}]`);
x = p(90, 0); ok(x.sticks === 1, `90 min safe: capped at 1 (floor of 1.5 h) [${x.sticks}]`);
x = p(120, 2, 1.8); ok(x.sticks === 6 && x.measured, `with a sweat test (1.8 L/h) no hourly cap: 3240 mg → 6 [${x.sticks}]`);
x = p(45, 0); ok(x.sticks === 1, `45 min safe counts as long enough for a stick [${x.sticks}]`);
x = p(60, null); ok(x.level === 0 && x.rate === 0.8, 'unknown weather is treated as safe');
ok(measuredRate([{ rate: 1.0 }, { rate: 1.2 }, { rate: 1.4 }, { rate: 3 }]) === 1.2, 'measured rate: average of the last three tests only');
ok(measuredRate([]) === null, 'no tests: no measured rate');
ok(sweatRate({ before: 70.4, after: 69.6, drunkMl: 300, minutes: 50 }) === 1.32, `sweat rate ((70.4 − 69.6) + 0.3) ÷ 50/60 = 1.32 L/h [${sweatRate({ before: 70.4, after: 69.6, drunkMl: 300, minutes: 50 })}]`);
ok(sweatRate({ before: 70, after: 71, drunkMl: 0, minutes: 60 }) === null, 'heavier after and nothing drunk: refused');
ok(sweatRate({ before: 70, after: 64, drunkMl: 0, minutes: 60 }) === null, '6 L/h: refused as impossible');
setSweatOwner('a'); saveSweatTest({ id: '1', rate: 1.1 }); setSweatOwner('b');
ok(sweatTests().length === 0, 'tests are per runner: B sees none of A\'s');
setSweatOwner('a'); ok(sweatTests().length === 1, 'A still has hers'); clearHydrationData(); ok(sweatTests().length === 0, 'delete my data clears them');
if (bad) { console.error(`${bad} hydration problems`); process.exit(1); }
console.log('hydration ok');
