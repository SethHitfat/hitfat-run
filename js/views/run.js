// RUN: the start screen (map, GPS status, mode, START) and the live run.
// Free run, distance or time goal, or today's plan session with the coach
// calling the run/walk changes. Ends in the log form, pre-filled.
import * as api from '../api.js';
import { go } from '../main.js';
import { t, L } from '../i18n.js';
import { esc, on, icon, km, dur, pace, toast, confirmSheet, today } from '../ui.js';
import { Tracker, loadLeaflet, baseMap, ACC_MAX } from '../gps.js';
import * as coach from '../voice.js';
import { GPS_DRAFT } from './log.js';

const PREFS = 'hfrun_runprefs';
const prefs = (() => { try { return { mode: 'free', km: 5, min: 30, voice: true, autoPause: false, ...JSON.parse(localStorage.getItem(PREFS) || '{}') }; } catch (e) { return { mode: 'free', km: 5, min: 30, voice: true, autoPause: false }; } })();
const savePrefs = () => { try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch (e) {} };

let tracker = null, tick = null, map = null, line = null, me = null, warm = null, preMap = null;

/* A plan session becomes a timeline the coach can call: 5 min brisk walk,
   the session's run/walk steps, 5 min walk to cool down. Distance sessions
   have no steps and become a distance goal instead. */
function timelineFor(tp) {
  if (!tp.steps || !tp.steps.length) return null;
  return [{ kind: 'warm', sec: 300 }, ...tp.steps.map(x => ({ kind: x.kind, sec: x.sec })), { kind: 'cool', sec: 300 }];
}
function segmentAt(tl, e) {
  let t0 = 0;
  for (let i = 0; i < tl.length; i++) { if (e < t0 + tl[i].sec) return { i, seg: tl[i], left: t0 + tl[i].sec - e, into: e - t0 }; t0 += tl[i].sec; }
  return { i: tl.length, seg: null, left: 0, into: 0 };
}

export async function render(view, _, params) {
  if (tracker && tracker.active) return live(view);
  const swId = params.get('sw');
  let session = null;
  try {
    if (swId) session = await api.getSession(swId);
    else { const plan = await api.activePlan(); session = plan && plan.sessions.find(s => s.status === 'planned' && s.scheduled_date === today()) || null; }
  } catch (e) { session = null; }
  if (session && !['easy', 'recovery', 'long', 'tempo', 'threshold', 'interval', 'hill', 'run_walk'].includes(session.template.category)) session = null;
  if (session && swId) prefs.mode = 'session';
  if (!session && prefs.mode === 'session') prefs.mode = 'free';
  start(view, session);
}

function start(view, session) {
  const saved = Tracker.recoverable(), supported = 'geolocation' in navigator;
  const modes = [['free', t('run.free')], ['dist', t('run.dist')], ['time', t('run.time')], ...(session ? [['session', t('run.session')]] : [])];
  view.innerHTML = `<div class="run-start">
    <div class="run-map"><div id="pre-map"></div>
      <div class="run-map-top"><h1>${esc(t('tab.run'))}</h1><span class="acc" id="pre-acc"><i></i><span>${esc(supported ? t('gps.searching') : t('gps.unsupported'))}</span></span></div></div>
    ${saved ? `<div class="card" style="margin-top:12px;border-color:var(--accent)"><b>${esc(t('gps.recoverT'))}</b>
      <p class="muted small" style="margin:6px 0 12px">${esc(t('gps.recover', { km: km(saved.dist), t: dur(saved.acc / 1000) }))}</p>
      <div class="row"><button class="btn sm primary" data-restore>${esc(t('gps.continue'))}</button><button class="btn sm ghost" data-discard>${esc(t('gps.discard'))}</button></div></div>` : ''}
    <div class="seg" style="margin-top:16px" role="group">${modes.map(([k, l]) => `<button data-mode="${k}" aria-pressed="${prefs.mode === k}">${esc(l)}</button>`).join('')}</div>
    <div class="run-goal" id="goal"></div>
    <button class="run-go" data-start ${supported ? '' : 'disabled'}>START</button>
    <div class="run-opts">
      <label class="row"><input type="checkbox" data-pref="voice" ${prefs.voice ? 'checked' : ''}><span>${esc(t('run.voice'))}</span></label>
      <label class="row"><input type="checkbox" data-pref="autoPause" ${prefs.autoPause ? 'checked' : ''}><span>${esc(t('run.autoPause'))}</span></label>
    </div>
    <p class="muted tiny" style="text-align:center;margin:14px 0 0">${esc(t('run.screenOn'))} <a class="link" href="#/settings">${esc(t('run.why'))}</a></p>
    <a class="btn ghost block" style="margin-top:14px" href="#/log${session ? '?sw=' + session.id : ''}">${esc(t('gps.manualInstead'))}</a>
  </div>`;
  const root = view.firstElementChild;

  const paintGoal = () => {
    const g = root.querySelector('#goal');
    if (prefs.mode === 'dist' || prefs.mode === 'time') {
      const v = prefs.mode === 'dist' ? prefs.km : prefs.min;
      g.innerHTML = `<button class="icon-btn" data-step="-1" aria-label="−">−</button><div style="text-align:center"><div class="num" style="font-size:72px">${prefs.mode === 'dist' ? v.toFixed(v % 1 ? 1 : 0) : v}</div>
        <div class="eyebrow">${esc(prefs.mode === 'dist' ? 'km' : t('unit.minutes'))}</div></div><button class="icon-btn" data-step="1" aria-label="+">+</button>`;
    } else if (prefs.mode === 'session' && session) {
      const tp = session.template;
      g.innerHTML = `<div style="text-align:center"><div class="eyebrow">${esc(t('plan.weekSession', { w: tp.week, s: tp.session }))}</div>
        <div style="font-weight:800;font-size:22px;margin-top:4px">${esc(L(tp.i18n).title)}</div>
        <div class="muted small" style="margin-top:4px">${esc(timelineFor(tp) ? t('run.sessionCoach') : t('run.sessionDist', { km: (tp.distance_m / 1000).toFixed(1) }))}</div></div>`;
    } else g.innerHTML = `<div style="text-align:center"><div class="num" style="font-size:72px">0.00</div><div class="eyebrow">${esc(t('run.freeHelp'))}</div></div>`;
  };
  paintGoal();
  on(root, '[data-mode]', 'click', (e, b) => { prefs.mode = b.dataset.mode; savePrefs(); root.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', x === b)); paintGoal(); });
  on(root, '[data-step]', 'click', (e, b) => {
    const d = +b.dataset.step;
    if (prefs.mode === 'dist') prefs.km = Math.min(100, Math.max(1, prefs.km + d * (prefs.km < 5 ? 0.5 : 1)));
    else prefs.min = Math.min(300, Math.max(5, prefs.min + d * (prefs.min < 30 ? 5 : 10)));
    savePrefs(); paintGoal();
  });
  root.addEventListener('change', e => { const k = e.target.dataset.pref; if (k) { prefs[k] = e.target.checked; savePrefs(); } });
  on(root, '[data-discard]', 'click', () => { Tracker.discard(); start(view, session); });
  on(root, '[data-restore]', 'click', () => { begin(view, null, saved); });
  on(root, '[data-start]', 'click', async () => {
    if (saved && !await confirmSheet(t('gps.replaceQ'), t('gps.replace'), 'START', true)) return;
    begin(view, session);
  });

  // a live map and GPS reading before the start, so the runner can wait for a good signal
  loadLeaflet().then(L => {
    if (!root.isConnected) return;
    preMap = baseMap(L, root.querySelector('#pre-map'), false);
    if ('geolocation' in navigator) warm = navigator.geolocation.watchPosition(p => {
      const acc = p.coords.accuracy, el = root.querySelector('#pre-acc'); if (!el) return;
      el.className = 'acc ' + (acc <= 15 ? 'good' : acc <= ACC_MAX ? 'ok' : 'bad');
      el.querySelector('span').textContent = t('gps.accuracy', { m: Math.round(acc) });
      const pt = [p.coords.latitude, p.coords.longitude];
      if (!preMap._me) { preMap._me = L.circleMarker(pt, { radius: 8, color: '#000', weight: 3, fillColor: '#FFE000', fillOpacity: 1 }).addTo(preMap); preMap.setView(pt, 16); }
      else preMap._me.setLatLng(pt);
    }, () => { const el = root.querySelector('#pre-acc'); if (el) { el.className = 'acc bad'; el.querySelector('span').textContent = t('gps.denied'); } },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  }).catch(() => {});
  window.addEventListener('hashchange', stopWarm, { once: true });
}
function stopWarm() { if (warm != null) navigator.geolocation.clearWatch(warm); warm = null; if (preMap) { preMap.remove(); preMap = null; } }

function begin(view, session, restoreFrom) {
  coach.unlock(); coach.setVoiceEnabled(prefs.voice); stopWarm();
  tracker = new Tracker(() => paintLive(), {
    onSplit: (n, sec) => {
      coach.beep(1, true);
      const s = tracker.s;
      coach.say(t('voice.km', { n, t: coach.spokenDuration(tracker.elapsed() / 1000, t), p: coach.spokenDuration(sec, t) }));
      if (s.goal && s.goal.type === 'dist' && s.dist >= s.goal.v && !s.goalDone) { s.goalDone = true; coach.beep(3, true); coach.say(t('voice.goal')); }
    },
    onAutoPause: p => coach.say(t(p ? 'voice.autoPause' : 'voice.resume')),
  });
  tracker.autoPause = prefs.autoPause;
  if (restoreFrom) { tracker.restore(restoreFrom); live(view); return; }
  const tl = session && prefs.mode === 'session' ? timelineFor(session.template) : null;
  const goal = prefs.mode === 'dist' ? { type: 'dist', v: prefs.km * 1000 } : prefs.mode === 'time' ? { type: 'time', v: prefs.min * 60 }
    : prefs.mode === 'session' && session && !tl && session.template.distance_m ? { type: 'dist', v: session.template.distance_m } : null;
  countdown(view, () => {
    tracker.begin(session && prefs.mode === 'session' ? session.id : null, { goal, timeline: tl, segDone: -1, title: session ? L(session.template.i18n).title : null });
    coach.beep(1, true);
    coach.say(tl ? t('voice.sessionStart') : goal ? t(goal.type === 'dist' ? 'voice.startDist' : 'voice.startTime', { v: goal.type === 'dist' ? (goal.v / 1000).toFixed(1) : coach.spokenDuration(goal.v, t) }) : t('voice.start'));
    live(view);
  });
}
function countdown(view, done) {
  view.innerHTML = `<div class="run-count num" id="cd">3</div>`;
  document.body.style.overflow = 'hidden';
  let n = 3, over = false; coach.beep(1);
  const go_ = () => { if (over) return; over = true; clearInterval(timer); done(); };
  const el = view.querySelector('#cd'), timer = setInterval(() => { n--; if (n <= 0) return go_(); el.textContent = n; coach.beep(1); }, 1000);
  el.onclick = go_;
  // leaving during the countdown cancels the run before it starts
  window.addEventListener('hashchange', () => { if (!over) { over = true; clearInterval(timer); document.body.style.overflow = ''; } }, { once: true });
}

function live(view) {
  view.innerHTML = `<div class="gps-live" id="gl">
    <div class="row between"><span class="acc" id="gl-acc"><i></i><span>${esc(t('gps.searching'))}</span></span>
      <span class="tiny" style="font-weight:800;letter-spacing:.1em" id="gl-state"></span>
      <button class="tiny" style="font-weight:800;color:var(--accent)" data-map>${esc(t('gps.map'))}</button></div>
    <div class="mapbox hide" id="gl-map"></div>
    <div class="main">
      <div class="seg-panel hide" id="gl-seg"><div class="row between"><div><div class="eyebrow" id="gl-seg-n"></div><div class="seg-name" id="gl-seg-t"></div></div>
        <div class="num" style="font-size:40px" id="gl-seg-r"></div></div><div class="bar" style="margin-top:10px"><i id="gl-seg-bar"></i></div>
        <div class="muted tiny" style="margin-top:8px" id="gl-seg-next"></div></div>
      <div class="num huge" id="gl-km">0.00</div><div class="eyebrow" id="gl-unit">${esc(t('unit.km'))}</div>
      <div class="trio"><div><div class="num" id="gl-pace">–</div><div class="l">${esc(t('gps.pace'))}</div></div>
        <div><div class="num" id="gl-time">0:00</div><div class="l">${esc(t('gps.time'))}</div></div>
        <div><div class="num" id="gl-avg">–</div><div class="l">${esc(t('gps.avg'))}</div></div></div></div>
    <div class="ctrls" id="gl-run"><button class="round" data-pause aria-label="${esc(t('gps.pause'))}">${icon('pause')}</button></div>
    <div class="ctrls hide" id="gl-paused">
      <button class="round sm hold" data-end aria-label="${esc(t('gps.holdEnd'))}"><span class="fill"></span>${icon('stop')}</button>
      <button class="round white" data-resume aria-label="${esc(t('gps.resume'))}">${icon('play')}</button></div>
    <p class="tiny" style="text-align:center;color:#B5B5B5;min-height:16px;margin:12px 0 0" id="gl-hint"></p></div>`;
  const root = view.firstElementChild;
  document.body.style.overflow = 'hidden';
  on(root, '[data-pause]', 'click', () => { tracker.pause(); coach.say(t('voice.paused')); });
  on(root, '[data-resume]', 'click', () => { tracker.resume(); coach.say(t('voice.resume')); });
  on(root, '[data-map]', 'click', () => toggleMap(root));
  // hold to end, so a pocket tap never ends a run
  const end = root.querySelector('[data-end]'), fill = end.querySelector('.fill'); let h = null, t0 = 0;
  const up = () => { clearInterval(h); h = null; fill.style.transform = 'scaleY(0)'; };
  end.addEventListener('pointerdown', e => { e.preventDefault(); t0 = Date.now(); root.querySelector('#gl-hint').textContent = t('gps.keepHolding');
    h = setInterval(() => { const f = Math.min(1, (Date.now() - t0) / 1000); fill.style.transform = `scaleY(${f})`; if (f >= 1) { up(); finish(); } }, 30); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => end.addEventListener(ev, up));
  clearInterval(tick); tick = setInterval(onTick, 500);
  window.addEventListener('hashchange', leave, { once: true });
  paintLive();
}
function leave() { clearInterval(tick); tick = null; document.body.style.overflow = ''; if (map) { map.remove(); map = line = me = null; } if (tracker && tracker.active) { tracker.pause(); toast(t('gps.leftPaused')); } }

/* time-based cues: plan segments and time goals */
function onTick() {
  const s = tracker && tracker.s; if (!s) return;
  if (s.status === 'running') {
    const e = tracker.elapsed() / 1000;
    if (s.timeline) {
      const at = segmentAt(s.timeline, e);
      if (at.i !== s.segDone) {
        s.segDone = at.i;
        if (!at.seg) { coach.beep(2, true); coach.say(t('voice.sessionDone')); }
        else { coach.beep(at.seg.kind === 'run' ? 2 : 1, at.seg.kind === 'run'); coach.say(t('voice.seg.' + at.seg.kind, { t: coach.spokenDuration(at.seg.sec, t) })); }
      } else if (at.seg && at.left <= 3.4 && at.left > 2.6) coach.beep(1);
    }
    if (s.goal && s.goal.type === 'time') {
      if (!s.goalHalf && e >= s.goal.v / 2) { s.goalHalf = true; coach.say(t('voice.half')); }
      if (!s.goalDone && e >= s.goal.v) { s.goalDone = true; coach.beep(3, true); coach.say(t('voice.goal')); }
    }
    if (Math.floor(e) % 5 === 0) tracker.persist();
  }
  paintLive();
}

function paintLive() {
  const el = document.getElementById('gl'); if (!el || !tracker || !tracker.active) return;
  const s = tracker.s, e = tracker.elapsed() / 1000, f = tracker.lastFix;
  el.classList.toggle('paused', s.status === 'paused');
  const timeGoal = s.goal && s.goal.type === 'time';
  el.querySelector('#gl-km').textContent = timeGoal ? dur(Math.max(0, s.goal.v - e)) : km(s.dist);
  el.querySelector('#gl-unit').textContent = timeGoal ? t('run.timeLeft') : s.goal ? t('run.ofKm', { km: (s.goal.v / 1000).toFixed(1) }) : t('unit.km');
  el.querySelector('#gl-time').textContent = timeGoal ? km(s.dist) : dur(e);
  el.querySelector('#gl-pace').textContent = pace(tracker.currentPace());
  el.querySelector('#gl-avg').textContent = s.dist > 50 ? pace(e / (s.dist / 1000)) : '–';
  el.querySelector('#gl-state').textContent = s.status === 'paused' ? (s.autoPaused ? t('run.autoPaused') : t('gps.paused')) : (s.title || t('gps.running')).toUpperCase();
  el.querySelector('#gl-run').classList.toggle('hide', s.status !== 'running');
  el.querySelector('#gl-paused').classList.toggle('hide', s.status !== 'paused');
  const seg = el.querySelector('#gl-seg');
  if (s.timeline) {
    const at = segmentAt(s.timeline, e); seg.classList.remove('hide');
    if (at.seg) {
      const nx = s.timeline[at.i + 1];
      el.querySelector('#gl-seg-n').textContent = t('run.segOf', { i: at.i + 1, n: s.timeline.length });
      el.querySelector('#gl-seg-t').textContent = t('run.segName.' + at.seg.kind);
      el.querySelector('#gl-seg-t').className = 'seg-name ' + at.seg.kind;
      el.querySelector('#gl-seg-r').textContent = dur(at.left);
      el.querySelector('#gl-seg-bar').style.width = (at.into / at.seg.sec * 100).toFixed(1) + '%';
      el.querySelector('#gl-seg-next').textContent = nx ? t('run.next', { what: t('run.segName.' + nx.kind), t: dur(nx.sec) }) : '';
    } else { el.querySelector('#gl-seg-n').textContent = ''; el.querySelector('#gl-seg-t').textContent = t('run.sessionComplete'); el.querySelector('#gl-seg-r').textContent = ''; el.querySelector('#gl-seg-bar').style.width = '100%'; el.querySelector('#gl-seg-next').textContent = ''; }
  } else if (s.goal) {
    seg.classList.remove('hide');
    const cur = s.goal.type === 'dist' ? s.dist : e, frac = Math.min(1, cur / s.goal.v);
    el.querySelector('#gl-seg-n').textContent = t('run.goal');
    el.querySelector('#gl-seg-t').textContent = s.goal.type === 'dist' ? (s.goal.v / 1000).toFixed(1) + ' km' : dur(s.goal.v);
    el.querySelector('#gl-seg-t').className = 'seg-name';
    el.querySelector('#gl-seg-r').textContent = Math.round(frac * 100) + '%';
    el.querySelector('#gl-seg-bar').style.width = (frac * 100).toFixed(1) + '%';
    el.querySelector('#gl-seg-next').textContent = '';
  } else seg.classList.add('hide');
  const acc = el.querySelector('#gl-acc'), stale = !f || Date.now() - f.t > 15000;
  acc.className = 'acc ' + (tracker.error === 1 || stale ? 'bad' : f.acc <= 15 ? 'good' : f.acc <= ACC_MAX ? 'ok' : 'bad');
  acc.querySelector('span').textContent = tracker.error === 1 ? t('gps.denied') : stale ? t('gps.searching') : t('gps.accuracy', { m: Math.round(f.acc) });
  el.querySelector('#gl-hint').textContent = s.status === 'paused' ? t('gps.holdEnd') : tracker.error === 1 ? t('gps.deniedHelp') : '';
  if (map && f) { line.setLatLngs(s.pts); me ? me.setLatLng(f.pt) : (me = window.L.circleMarker(f.pt, { radius: 8, color: '#000', weight: 3, fillColor: '#FFE000', fillOpacity: 1 }).addTo(map)); }
}
async function toggleMap(root) {
  const box = root.querySelector('#gl-map'); box.classList.toggle('hide');
  root.querySelector('.main').classList.toggle('compact', !box.classList.contains('hide'));
  if (box.classList.contains('hide') || map) { map && map.invalidateSize(); return; }
  try { const L = await loadLeaflet(); map = baseMap(L, box, true); line = L.polyline(tracker.s.pts, { color: '#FFE000', weight: 5 }).addTo(map);
    if (tracker.lastFix) map.setView(tracker.lastFix.pt, 16); }
  catch (e) { box.classList.add('hide'); toast(t('gps.noMap')); }
}

async function finish() {
  const s = tracker.s;
  if (s.dist < 50) {
    if (!await confirmSheet(t('gps.shortQ'), t('gps.short'), t('gps.discard'), true)) return;
    tracker.stop(); leave(); go('home', true); return;
  }
  coach.say(t('voice.finish', { km: (s.dist / 1000).toFixed(2), t: coach.spokenDuration(tracker.elapsed() / 1000, t) }));
  const out = tracker.finish();
  try { sessionStorage.setItem(GPS_DRAFT, JSON.stringify(out)); } catch (e) {}
  leave();
  if (out.gaps) toast(t('gps.gaps', { n: out.gaps }));
  go('log?gps=1' + (out.sw ? '&sw=' + out.sw : ''), true);
}
