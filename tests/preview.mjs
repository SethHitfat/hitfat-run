// Preview mode end to end: no sign-in, no database, everything in localStorage.
//   PLAYWRIGHT=/path/to/playwright node tests/preview.mjs
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), ORIGIN = 'http://127.0.0.1:8798';
const pw = await import(process.env.PLAYWRIGHT || 'playwright'), { chromium } = pw.default || pw;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
let supabaseCalls = 0;
await ctx.route('https://auth.hitfat.io/**', r => { supabaseCalls++; r.abort(); });
await ctx.route(`${ORIGIN}/**`, r => { let p = new URL(r.request().url()).pathname; if (p.endsWith('/')) p += 'index.html';
  const f = join(ROOT, p); return existsSync(f) ? r.fulfill({ status: 200, contentType: TYPES[extname(f)] || 'application/octet-stream', body: readFileSync(f) }) : r.fulfill({ status: 404 }); });
// a fake GPS that runs north at ~6.6 m/s, one fix a second
await ctx.addInitScript(() => {
  let lat = 6.1254, n = 0; const subs = new Map();
  setInterval(() => { lat += 0.00006; n++; const p = { coords: { latitude: lat, longitude: 102.2386, accuracy: 6, speed: null }, timestamp: Date.now() };
    subs.forEach(f => f(p)); }, 1000);
  Object.defineProperty(navigator, 'geolocation', { value: { watchPosition(ok) { const id = Math.random(); subs.set(id, ok); return id; }, clearWatch(id) { subs.delete(id); },
    getCurrentPosition(ok) { ok({ coords: { latitude: lat, longitude: 102.2386, accuracy: 6 }, timestamp: Date.now() }); } } });
});
const page = await ctx.newPage(); page.setDefaultTimeout(12000);
const shot = n => page.screenshot({ path: join(process.env.SHOTS || '/tmp', `pv-${n}.png`) });
const errors = []; page.on('pageerror', e => errors.push(e.message));
let failed = 0; const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) failed++; };
try {
  await page.goto(`${ORIGIN}/`); await page.click('[data-preview]');
  await page.waitForSelector('.ob'); check(await page.locator('.preview-bar').isVisible(), 'preview banner shown');
  const pick = async s => { await page.click(s); await page.click('[data-next]'); };
  await pick('[data-pick=goal][data-v=first_5k]'); await pick('[data-pick=experience][data-v=some]');
  await pick('[data-pick=continuous_run_min][data-v="10"]');
  await page.click('[data-day="1"]'); await page.click('[data-day="4"]'); await page.click('[data-day="6"]'); await page.click('[data-next]');
  await page.click('[data-next]'); await page.click('[data-skip]'); await pick('[data-pick=weekly_km_recent][data-v="3"]');
  await pick('[data-pick=has_limitations][data-v=false]'); await pick('[data-pick=training_location][data-v=road]');
  await page.waitForSelector('#start-box [data-go]');
  check(/Road to 5KM/i.test(await page.locator('.photo h2').innerText()), 'Road to 5KM recommended');
  await page.click('#start-box [data-go]'); await page.waitForSelector('#view a.photo:has-text("Road to 5KM")');
  await page.click('[data-tab=training]'); await page.locator('a.sess').first().click(); await page.click('[data-log]');
  await page.fill('#lf-dist', '2.5'); await page.fill('#lf-m', '18'); await page.click('[data-feel=right]'); await page.click('#log-form [type=submit]');
  await page.waitForSelector('.celebrate'); check((await page.locator('.celebrate h2').count()) === 2, 'two first badges awarded'); await page.click('[data-ok]');
  await page.click('[data-tab=club]'); await page.click('text=Larian Pagi Sabtu (contoh)'); await page.click('[data-rsvp="1"]');
  await page.waitForSelector('text=Anda berdaftar'); check(true, 'RSVP to the example run');
  await page.reload(); await page.waitForSelector('.preview-bar'); await page.click('[data-tab=home]');
  await page.waitForSelector('#view a.photo:has-text("Road to 5KM")'); check((await page.locator('#view .card .huge-num').first().innerText()) === '2.5', 'data kept after reload');
  /* the RUN tab: a distance goal run, then a coached plan session */
  await page.click('[data-tab=run]'); await page.waitForSelector('.run-go'); await page.waitForTimeout(1500); await shot('run-start');
  await page.click('[data-mode=dist]'); check((await page.locator('#goal .num').innerText()) === '5', 'distance goal picker shows 5 km');
  await page.click('[data-step="1"]'); check((await page.locator('#goal .num').innerText()) === '6', 'goal +1 km');
  await page.click('.run-go'); await page.click('#cd'); await page.waitForSelector('#gl');
  await page.waitForTimeout(11000); await shot('run-live');
  const liveKm = parseFloat(await page.locator('#gl-km').innerText()); check(liveKm > 0.005, `live distance grows (${liveKm} km)`);
  check(/km daripada 6/.test(await page.locator('#gl-unit').innerText()), 'goal shown under the distance');
  await page.click('[data-pause]'); await page.waitForSelector('#gl-paused:not(.hide)');
  const box = await page.locator('[data-end]').boundingBox(); await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down(); await page.waitForTimeout(1300); await page.mouse.up();
  await page.waitForSelector('#log-form'); const d = parseFloat(await page.locator('#lf-dist').inputValue());
  check(d >= 0.05 && d < 0.15, `log form pre-filled from GPS (${d} km)`);
  await page.click('#log-form [type=submit]'); await page.waitForTimeout(800); if (await page.locator('[data-ok]').count()) await page.click('[data-ok]');
  await page.click('[data-tab=training]'); const href = await page.locator('a.sess').nth(1).getAttribute('href');
  await page.goto(`${ORIGIN}/#/run?sw=${href.split('/').pop()}`); await page.waitForSelector('.run-go');
  check((await page.locator('[data-mode=session]').getAttribute('aria-pressed')) === 'true', 'plan session preselected');
  await page.click('.run-go'); await page.click('#cd'); await page.waitForSelector('#gl-seg:not(.hide)');
  await page.waitForTimeout(1200); await shot('run-session');
  check(/Panaskan badan/.test(await page.locator('#gl-seg-t').innerText()), 'session starts with the warm-up segment');
  check(/Seterusnya: Lari/.test(await page.locator('#gl-seg-next').innerText()), 'next segment is a run');
  await page.click('[data-pause]'); const b2 = await page.locator('[data-end]').boundingBox(); await page.mouse.move(b2.x + 20, b2.y + 20); await page.mouse.down(); await page.waitForTimeout(1300); await page.mouse.up();
  await page.click('[data-a=yes]'); await page.waitForSelector('[data-tab=home][aria-current=page]'); check(true, 'too-short run discarded');
  await page.click('.preview-bar button'); await page.waitForSelector('#auth-form'); check(true, 'exit preview returns to sign-in');
} catch (e) { console.error(e.message); failed++; }
check(supabaseCalls === 0, `no calls to Supabase in preview (${supabaseCalls})`);
check(errors.length === 0, 'no JavaScript errors ' + errors.join(' | '));
await browser.close();
console.log(failed ? `${failed} FAILED` : 'ALL PREVIEW CHECKS PASSED'); process.exit(failed ? 1 : 0);
