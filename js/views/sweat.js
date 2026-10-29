// Guided sweat test: weigh before, run 45–60 minutes, weigh after and enter
// what you drank. Sweat rate = ((before − after) kg + drunk L) ÷ hours.
// Kept on this device; the hydration planner uses the last three tests.
import * as api from '../api.js';
import { go, back } from '../main.js';
import { t } from '../i18n.js';
import { esc, on, icon, uuid, fmtDate, toast, confirmSheet } from '../ui.js';
import { getWeather, LEVELS } from '../weather.js';
import { sweatTests, saveSweatTest, deleteSweatTest, sweatDraft, setSweatDraft, sweatRate, measuredRate } from '../hydration.js';

const kg = v => parseFloat(String(v).replace(',', '.'));

export async function render(view) {
  const draft = sweatDraft();
  view.innerHTML = `<header class="topbar"><div class="row"><button class="icon-btn" data-back aria-label="${esc(t('common.back'))}">${icon('back')}</button>
    <h1>${esc(t('sw.title'))}</h1></div></header><div id="sw-body"></div>`;
  view.querySelector('[data-back]').onclick = () => back('run');
  const body = view.querySelector('#sw-body');
  if (!draft) return intro(body);
  return after(body, draft);
}

function steps(n) {
  return `<div class="sw-steps">${[1, 2, 3].map(i => `<div class="${i < n ? 'done' : i === n ? 'now' : ''}"><b>${i}</b><span>${esc(t('sw.step' + i))}</span></div>`).join('')}</div>`;
}

function history() {
  const tests = sweatTests(), avg = measuredRate(tests);
  if (!tests.length) return '';
  const levels = new Set(tests.slice(0, 3).map(x => x.level));
  return `<h2>${esc(t('sw.history'))}</h2>
    <div class="card"><div class="row between"><div><div class="eyebrow">${esc(t('sw.avg', { n: Math.min(3, tests.length) }))}</div>
      <div class="num" style="font-size:44px;color:var(--accent-text)">${avg.toFixed(2)}<span class="small" style="font-family:var(--font);color:var(--muted)"> ${esc(t('sw.lph'))}</span></div></div></div>
      ${tests.length >= 2 && levels.size < 2 ? `<p class="muted small" style="margin:8px 0 0">${esc(t('sw.tryOther'))}</p>` : ''}</div>
    <div class="card list" style="margin-top:10px">${tests.map(x => `<div class="row between">
      <div><b>${x.rate.toFixed(2)} ${esc(t('sw.lph'))}</b><div class="muted tiny">${esc(fmtDate(x.at))} · ${x.minutes} min · ${esc(x.level != null ? t('wx.level.' + LEVELS[x.level]) : t('hyd.noWeather'))}${x.feels != null ? ` · ${Math.round(x.feels)}°` : ''}</div></div>
      <button class="link small danger" data-del="${x.id}">${esc(t('common.delete'))}</button></div>`).join('')}</div>`;
}

/* step 1: weigh before */
function intro(body) {
  body.innerHTML = `<div>${steps(1)}
    <p style="margin:16px 0 8px;font-size:16px;line-height:1.5">${esc(t('sw.why'))}</p>
    <div class="card"><b>${esc(t('sw.howT'))}</b>
      <ul class="muted small" style="padding-left:18px;margin:8px 0 0"><li>${esc(t('sw.how1'))}</li><li>${esc(t('sw.how2'))}</li><li>${esc(t('sw.how3'))}</li><li>${esc(t('sw.how4'))}</li></ul></div>
    <form id="sw1" style="margin-top:16px"><label for="sw-before">${esc(t('sw.before'))}</label>
      <input id="sw-before" inputmode="decimal" placeholder="70.4" autocomplete="off" required>
      <div class="error" id="sw-err"></div>
      <button class="btn primary block lg" type="submit">${esc(t('sw.start'))}</button></form>
    ${history()}
    <p class="muted tiny" style="margin-top:16px">${esc(t('sw.local'))} ${esc(t('hyd.disclaimer'))}</p></div>`;
  const root = body.firstElementChild;
  root.querySelector('#sw1').onsubmit = e => {
    e.preventDefault();
    const b = kg(root.querySelector('#sw-before').value);
    if (!(b >= 25 && b <= 250)) return (root.querySelector('#sw-err').textContent = t('sw.errWeight'));
    setSweatDraft({ before: Math.round(b * 10) / 10, at: Date.now() });
    after(body, sweatDraft());
  };
  bindHistory(root, () => intro(body));
}

/* step 2 (go run) and step 3 (weigh after) on one screen: the runner comes back to it */
async function after(body, draft) {
  const since = new Date(draft.at - 5 * 6e4);
  // the run done since weighing in, if there is one, fills in the minutes
  const runs = await api.listActivities({ since, limit: 5 }).catch(() => []);
  const run = runs.filter(a => a.source !== 'strava').sort((a, b) => a.started_at.localeCompare(b.started_at))[0] || null;
  const mins = run ? Math.round(run.moving_time_s / 60) : '';
  body.innerHTML = `<div>${steps(run ? 3 : 2)}
    <div class="card" style="margin-top:16px"><div class="eyebrow">${esc(t('sw.weighedIn', { kg: draft.before.toFixed(1) }))}</div>
      <p style="margin:6px 0 12px">${esc(t('sw.goRun'))}</p>
      <a class="btn block" href="#/run">${icon('run', 'width="18" height="18"')} ${esc(t('sw.runNow'))}</a></div>
    <form id="sw3" style="margin-top:16px"><h2 style="margin-top:0">${esc(t('sw.step3'))}</h2>
      <label for="sw-after">${esc(t('sw.after'))}</label><input id="sw-after" inputmode="decimal" placeholder="69.6" autocomplete="off" required>
      <label for="sw-drunk">${esc(t('sw.drunk'))}</label><input id="sw-drunk" inputmode="numeric" placeholder="400" value="0" required>
      <label for="sw-min">${esc(t('sw.minutes'))}</label><input id="sw-min" inputmode="numeric" placeholder="50" value="${mins}" required>
      ${run ? `<div class="muted tiny" style="margin-top:6px">${esc(t('sw.fromRun', { d: fmtDate(run.started_at), n: mins }))}</div>` : ''}
      <div class="error" id="sw-err"></div>
      <button class="btn primary block lg" type="submit">${esc(t('sw.calc'))}</button>
      <button class="btn ghost block" type="button" style="margin-top:10px" data-cancel>${esc(t('sw.cancel'))}</button></form></div>`;
  const root = body.firstElementChild;
  root.querySelector('[data-cancel]').onclick = async () => {
    if (!await confirmSheet(t('sw.cancelQ'), t('sw.cancelHelp'), t('sw.cancel'), true)) return;
    setSweatDraft(null); intro(body);
  };
  root.querySelector('#sw3').onsubmit = async e => {
    e.preventDefault();
    const err = root.querySelector('#sw-err');
    const a = kg(root.querySelector('#sw-after').value), drunk = parseInt(root.querySelector('#sw-drunk').value, 10) || 0, m = parseInt(root.querySelector('#sw-min').value, 10);
    if (!(a >= 25 && a <= 250)) return (err.textContent = t('sw.errWeight'));
    if (!(m >= 20 && m <= 240)) return (err.textContent = t('sw.errMinutes'));
    if (drunk < 0 || drunk > 5000) return (err.textContent = t('sw.errDrunk'));
    const rate = sweatRate({ before: draft.before, after: a, drunkMl: drunk, minutes: m });
    if (rate == null) return (err.textContent = t('sw.errRate'));
    const w = await getWeather().catch(() => null);
    const test = { id: uuid(), at: new Date().toISOString(), before: draft.before, after: Math.round(a * 10) / 10, drunk_ml: drunk, minutes: m, rate,
      level: w ? w.level : null, feels: w ? w.feels : null, run_id: run ? run.id : null };
    saveSweatTest(test); setSweatDraft(null);
    result(body, test, m < 45 || m > 60);
  };
}

function result(body, test, offWindow) {
  const avg = measuredRate();
  body.innerHTML = `<div>${steps(4)}
    <div class="card sw-result" style="margin-top:16px"><div class="eyebrow">${esc(t('sw.yourRate'))}</div>
      <div class="num" style="font-size:72px;color:var(--accent-text)">${test.rate.toFixed(2)}<span class="small" style="font-family:var(--font);color:var(--muted)"> ${esc(t('sw.lph'))}</span></div>
      <p class="muted small" style="margin:6px 0 0">${esc(t('sw.explain', { b: test.before.toFixed(1), a: test.after.toFixed(1), d: test.drunk_ml, m: test.minutes }))}</p>
      ${offWindow ? `<p class="small" style="margin:8px 0 0">${esc(t('sw.offWindow'))}</p>` : ''}
      <p style="margin:12px 0 0;font-weight:600">${esc(t('sw.used', { r: avg.toFixed(2) }))}</p></div>
    <p class="muted small" style="margin-top:12px">${esc(t('sw.repeat'))}</p>
    <a class="btn primary block lg" href="#/run" style="margin-top:12px">${esc(t('sw.toRun'))}</a>
    ${history()}
    <p class="muted tiny" style="margin-top:16px">${esc(t('sw.local'))} ${esc(t('hyd.disclaimer'))}</p></div>`;
  toast(t('sw.saved')); window.scrollTo(0, 0);
  bindHistory(body.firstElementChild, () => intro(body));
}

function bindHistory(root, repaint) {
  on(root, '[data-del]', 'click', async (e, b) => {
    if (!await confirmSheet(t('sw.delQ'), t('sw.delHelp'), t('common.delete'), true)) return;
    deleteSweatTest(b.dataset.del); repaint();
  });
}
