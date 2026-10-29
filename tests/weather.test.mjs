// Heat index, levels and the best hour to run.   node tests/weather.test.mjs
import { heatIndex, levelOf, bestHour } from '../js/weather.js';
let bad = 0; const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) bad++; };
const F = c => c * 9 / 5 + 32;
// NOAA table points: 90°F/70% → 106°F, 86°F/90% → 105°F, 80°F/40% → 80°F
ok(Math.abs(F(heatIndex((90 - 32) * 5 / 9, 70)) - 106) < 1.5, `90°F 70% ≈ 106°F (${F(heatIndex((90 - 32) * 5 / 9, 70)).toFixed(1)})`);
ok(Math.abs(F(heatIndex((86 - 32) * 5 / 9, 90)) - 105) < 1.5, `86°F 90% ≈ 105°F (${F(heatIndex((86 - 32) * 5 / 9, 90)).toFixed(1)})`);
ok(Math.abs(F(heatIndex((80 - 32) * 5 / 9, 40)) - 80) < 1.5, `80°F 40% ≈ 80°F (${F(heatIndex((80 - 32) * 5 / 9, 40)).toFixed(1)})`);
ok(levelOf(heatIndex(26, 85)) === 0, `Kota Bharu dawn 26 °C 85% is safe (${heatIndex(26, 85).toFixed(1)} °C)`);
ok(levelOf(heatIndex(31, 70)) === 1, `31 °C 70% needs caution (${heatIndex(31, 70).toFixed(1)} °C)`);
ok(levelOf(heatIndex(34, 70)) === 2, `34 °C 70% is danger (${heatIndex(34, 70).toFixed(1)} °C)`);

// a day: cool at 06:00, hot at noon, cooling at night
const day = '2026-10-29', next = '2026-10-30', time = [], feels = [];
for (const d of [day, next]) for (let h = 0; h < 24; h++) { time.push(`${d}T${String(h).padStart(2, '0')}:00`); feels.push(h < 5 ? 24 : 26 + 10 * Math.sin(Math.PI * (h - 5) / 17) + (d === next ? 0.5 : 0)); }
const hourly = { time, apparent_temperature: feels, temperature_2m: feels.map(f => f - 3), uv_index: feels.map(() => 1) };
const at = h => new Date(2026, 9, 29, h, 0);
ok(bestHour(hourly, at(4)).hour === 5 && !bestHour(hourly, at(4)).tomorrow, 'before dawn: 05:00 today (night hours before 5am never count)');
ok(bestHour(hourly, at(12)).hour === 20, `at noon: the coolest hour left today is 20:00 (${bestHour(hourly, at(12)).hour})`);
const late = bestHour(hourly, at(22));
ok(late.tomorrow && late.hour === 5, `at 22:00: tomorrow 05:00 (${late.hour}, tomorrow ${late.tomorrow})`);
if (bad) { console.error(`${bad} weather problems`); process.exit(1); }
console.log('weather ok');
