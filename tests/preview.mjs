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
const page = await ctx.newPage(); page.setDefaultTimeout(12000);
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
  await page.click('.preview-bar button'); await page.waitForSelector('#auth-form'); check(true, 'exit preview returns to sign-in');
} catch (e) { console.error(e.message); failed++; }
check(supabaseCalls === 0, `no calls to Supabase in preview (${supabaseCalls})`);
check(errors.length === 0, 'no JavaScript errors ' + errors.join(' | '));
await browser.close();
console.log(failed ? `${failed} FAILED` : 'ALL PREVIEW CHECKS PASSED'); process.exit(failed ? 1 : 0);
