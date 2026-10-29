// Strength, mobility and drills for runners: the library, a session's detail,
// and the follow-along player (HITFAT video, timer, coach voice).
import * as api from '../api.js';
import { go, back } from '../main.js';
import { t, L } from '../i18n.js';
import { esc, on, mount, icon, dur, uuid, fmtDate, toast, confirmSheet, friendlyError, startOfWeek, skeleton, errorBox } from '../ui.js';
import { WORKOUTS, MOVES, FOCI, byKey, timeline, minutes, title, moveName, moveCue, poster, videoSrc } from '../strength.js';
import * as coach from '../voice.js';

export const WEEK_TARGET = 2;
const weekCount = logs => { const from = startOfWeek().getTime(); return logs.filter(l => Date.parse(l.started_at) >= from).length; };

/** Cards for other screens (Training, Home). */
export const card = (w, cls = 'short') => `<a class="photo ${cls} str-card" href="#/strength/${w.key}" style="background-image:url('${w.img}')"><div class="in">
    <div class="row" style="gap:6px"><span class="chip">${esc(t('st.mins', { n: minutes(w) }))}</span><span class="chip">${esc(t('level.' + w.level))}</span></div>
    <h3 style="margin:8px 0 2px">${esc(title(w))}</h3><div class="muted tiny ellipsis">${esc(L(w).equip)}</div></div></a>`;
export function rail(list = WORKOUTS) {
  return `<div class="hrail">${list.map(w => card(w)).join('')}</div>`;
}
/** Something sensible for today: the warm-up on a run day, otherwise rotate the strength sessions. */
export function suggestion(runToday) {
  if (runToday) return byKey('panas-badan');
  const pool = ['kaki-pelari', 'core-pelari', 'kalis-cedera', 'badan-penuh'], d = new Date();
  return byKey(pool[Math.floor((d - new Date(d.getFullYear(), 0, 1)) / 864e5) % pool.length]);
}
export const strengthThisWeek = async () => weekCount(await api.listStrength({ since: startOfWeek() }).catch(() => []));

/* ───────── library ───────── */
let focus = 'all';
export async function render(view) {
  view.innerHTML = `<header class="topbar"><div class="row"><button class="icon-btn" data-back aria-label="${esc(t('common.back'))}">${icon('back')}</button>
    <h1>${esc(t('st.title'))}</h1></div></header><div id="s-body">${skeleton(3, 150)}</div>`;
  view.querySelector('[data-back]').onclick = () => back('training');
  const body = view.querySelector('#s-body');
  let logs = [];
  try { logs = await api.listStrength(); } catch (e) { console.warn(e); }
  const n = weekCount(logs);
  const root = mount(body, `<div class="card str-hero">
      <div class="ring" style="--p:${Math.min(1, n / WEEK_TARGET) * 100}"><div><b class="num">${n}</b><span>/${WEEK_TARGET}</span></div></div>
      <div><div class="eyebrow">${esc(t('st.thisWeek'))}</div><div style="font-weight:800;font-size:18px;margin-top:4px">${esc(n >= WEEK_TARGET ? t('st.weekDone') : t('st.weekGoal', { n: WEEK_TARGET }))}</div>
      <div class="muted small" style="margin-top:4px">${esc(t('st.why'))}</div></div></div>
    <div class="chips-row" role="group">${FOCI.map(f => `<button class="pill" data-focus="${f}" aria-pressed="${focus === f}">${esc(t('st.focus.' + f))}</button>`).join('')}</div>
    <div id="s-list" class="str-grid"></div>
    <p class="muted tiny" style="margin-top:18px">${esc(t('st.safety'))}</p>`);
  const paint = () => {
    root.querySelector('#s-list').innerHTML = WORKOUTS.filter(w => focus === 'all' || w.focus.includes(focus)).map(w => card(w, 'mid')).join('');
    root.querySelectorAll('[data-focus]').forEach(b => b.setAttribute('aria-pressed', b.dataset.focus === focus));
  };
  paint();
  on(root, '[data-focus]', 'click', (e, b) => { focus = b.dataset.focus; paint(); });
}

/* ───────── one session ───────── */
export async function detail(view, key) {
  const w = byKey(key);
  if (!w) { go('strength', true); return; }
  let done = 0; try { done = (await api.listStrength()).filter(l => l.workout_key === key).length; } catch (e) {}
  view.innerHTML = `<div>
    <div class="photo tall bleed" style="background-image:url('${w.img}')"><div class="in">
      <button class="icon-btn" data-back aria-label="${esc(t('common.back'))}" style="position:absolute;top:calc(var(--safe-t) + 12px);left:16px;background:rgba(0,0,0,.5);color:#fff">${icon('back')}</button>
      <div class="eyebrow">${esc(t('st.title'))}</div>
      <h1 style="margin:6px 0 8px;font-size:38px">${esc(title(w))}</h1>
      <div class="row wrap" style="gap:6px"><span class="chip">${esc(t('st.mins', { n: minutes(w) }))}</span><span class="chip">${esc(t('level.' + w.level))}</span>
        <span class="chip">${esc(L(w).equip)}</span>${done ? `<span class="chip ok">${icon('check', 'width="14" height="14"')} ${esc(t('st.doneN', { n: done }))}</span>` : ''}</div></div></div>
    <p style="margin:18px 0 6px;font-size:16px;line-height:1.5">${esc(L(w).desc)}</p>
    <div class="muted small">${esc(t('st.format', { r: w.rounds, w: w.work, s: w.rest }))}${w.rounds > 1 && w.roundRest ? ' · ' + esc(t('st.roundRest', { s: w.roundRest })) : ''}</div>
    <h2>${esc(t('st.moves', { n: w.moves.length }))}</h2>
    <div class="mv-list">${w.moves.map((m, i) => `<div class="mv"><img src="${poster(m)}" alt="" loading="lazy" width="54" height="96">
      <div class="grow"><div class="muted tiny">${i + 1}</div><div style="font-weight:800">${esc(moveName(m))}</div><div class="muted small">${esc(moveCue(m))}</div></div>
      <div class="num" style="font-size:20px">${w.work}s</div></div>`).join('')}</div>
    <div class="sticky-go"><button class="btn primary block lg" data-go>${icon('play', 'width="18" height="18"')} ${esc(t('st.start'))}</button></div>
  </div>`;
  const root = view.firstElementChild;
  root.querySelector('[data-back]').onclick = () => back('strength');
  root.querySelector('[data-go]').onclick = () => { coach.unlock(); go('strength/' + key + '/play'); };
}

/* ───────── player ───────── */
let P = null;   // the running session: { w, tl, idx, left, running, started, done, wake, timer }
const VOICE = 'hfrun_str_voice';
const voiceOn = () => { try { return localStorage.getItem(VOICE) !== '0'; } catch (e) { return true; } };

export async function play(view, key, params) {
  const w = byKey(key);
  if (!w) { go('strength', true); return; }
  stop();
  coach.unlock(); coach.setVoiceEnabled(voiceOn());
  const tl = timeline(w);
  P = { sw: params?.get('sw') || null, w, tl, idx: 0, left: tl[0].sec * 1000, running: true, last: Date.now(), started: new Date(), spent: 0, done: new Set(), wake: null, timer: null, shown: null, cue: {} };
  view.innerHTML = `<div class="sx" id="sx">
    <div class="sx-top"><button class="sx-x" data-close aria-label="${esc(t('st.end'))}">✕</button>
      <div class="sx-prog">${tl.filter(s => s.kind === 'work').map(() => '<i></i>').join('')}</div>
      <button class="sx-x" data-voice aria-label="${esc(t('run.voice'))}"></button></div>
    <div class="sx-video" id="sx-video"><div class="sx-blur" id="sx-blur"></div><div class="sx-frame" id="sx-frame"></div><div class="sx-tag" id="sx-tag"></div></div>
    <div class="sx-info">
      <div class="eyebrow" id="sx-phase"></div>
      <div class="sx-name" id="sx-name"></div>
      <div class="muted small" id="sx-cue"></div>
      <div class="sx-time num" id="sx-time"></div>
      <div class="bar sx-bar"><i id="sx-bar"></i></div>
      <div class="muted small" id="sx-next" style="margin-top:10px;min-height:20px"></div>
    </div>
    <div class="sx-ctrls"><button class="sx-btn" data-prev aria-label="${esc(t('st.prev'))}">${icon('back')}</button>
      <button class="round" data-pp aria-label="${esc(t('gps.pause'))}"></button>
      <button class="sx-btn" data-skip aria-label="${esc(t('st.skip'))}">${icon('chevron')}</button></div>
  </div>`;
  const root = view.firstElementChild;
  document.body.style.overflow = 'hidden';
  root.querySelector('[data-pp]').onclick = () => { P.running ? pause() : resume(); };
  root.querySelector('[data-skip]').onclick = () => jump(P.idx + 1);
  root.querySelector('[data-prev]').onclick = () => {
    const cur = P.tl[P.idx], into = cur.sec * 1000 - P.left;
    let i = P.idx; if (into < 3000 || cur.kind !== 'work') { i--; while (i > 0 && P.tl[i].kind !== 'work') i--; }
    jump(Math.max(0, i));
  };
  root.querySelector('[data-voice]').onclick = () => {
    const v = !voiceOn(); try { localStorage.setItem(VOICE, v ? '1' : '0'); } catch (e) {} coach.setVoiceEnabled(v); paintVoice(root);
  };
  root.querySelector('[data-close]').onclick = async () => {
    pause();
    if (await confirmSheet(t('st.endQ'), t('st.endHelp'), t('st.end'), true)) finish(view, false);
  };
  paintVoice(root);
  keepAwake();
  window.addEventListener('hashchange', stop, { once: true });
  enter(0);
  P.timer = setInterval(tick, 200);
}
function paintVoice(root) { root.querySelector('[data-voice]').innerHTML = voiceOn() ? '🔊' : '🔇'; }
async function keepAwake() { try { if ('wakeLock' in navigator && P) P.wake = await navigator.wakeLock.request('screen'); } catch (e) {} }
document.addEventListener('visibilitychange', () => { if (P && document.visibilityState === 'visible' && (!P.wake || P.wake.released)) keepAwake(); });
function stop() {
  if (!P) return;
  clearInterval(P.timer); try { P.wake && P.wake.release(); } catch (e) {}
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  document.body.style.overflow = ''; P = null;
}
function pause() { if (!P || !P.running) return; P.running = false; paint(); }
function resume() { if (!P || P.running) return; P.running = true; P.last = Date.now(); paint(); }
function jump(i) {
  if (!P) return;
  if (i >= P.tl.length) { finish(document.getElementById('sx').parentElement, true); return; }
  enter(i);
}

function tick() {
  if (!P) return;
  const now = Date.now();
  if (P.running) {
    const d = now - P.last; P.left -= d; P.spent += d;
    const seg = P.tl[P.idx], sec = Math.ceil(P.left / 1000);
    if (seg.kind === 'work' && P.left <= seg.sec * 500) P.done.add(P.idx);
    // 3-2-1 beeps, the side switch, then the next segment
    if (sec <= 3 && sec >= 1 && P.cue.beep !== sec) { P.cue.beep = sec; coach.beep(1); }
    if (seg.kind === 'work' && MOVES[seg.move].sides && !P.cue.side && P.left <= seg.sec * 500) { P.cue.side = true; coach.beep(2, true); coach.say(t('st.v.switch')); }
    if (P.left <= 0) { jump(P.idx + 1); return; }
  }
  P.last = now;
  paint();
}

function enter(i) {
  const seg = P.tl[i], w = P.w;
  P.idx = i; P.left = seg.sec * 1000; P.last = Date.now(); P.cue = {};
  const nm = moveName(seg.move);
  if (seg.kind === 'ready') coach.say(t('st.v.ready', { name: nm, s: w.work }));
  else if (seg.kind === 'work') { coach.beep(1, true); if (i > 1) coach.say(nm); }
  else if (seg.kind === 'roundRest') coach.say(t('st.v.round', { r: seg.round - 1, s: seg.sec, name: nm }));
  else coach.say(t('st.v.rest', { name: nm }));
  paint();
}

function paint() {
  const el = document.getElementById('sx'); if (!el || !P) return;
  const seg = P.tl[P.idx], w = P.w, work = seg.kind === 'work';
  el.classList.toggle('resting', !work); el.classList.toggle('paused', !P.running);
  // the video shows the move being done, or during a rest the one coming up
  if (P.shown !== seg.move) {
    P.shown = seg.move;
    el.querySelector('#sx-blur').style.backgroundImage = `url('${poster(seg.move)}')`;
    el.querySelector('#sx-frame').innerHTML = `<img src="${poster(seg.move)}" alt=""><iframe src="${videoSrc(seg.move)}" allow="autoplay; fullscreen; picture-in-picture" title="${esc(moveName(seg.move))}"></iframe>`;
  }
  el.querySelector('#sx-tag').textContent = work ? '' : seg.kind === 'ready' ? t('st.getReady') : t('st.rest');
  el.querySelector('#sx-phase').textContent = (w.rounds > 1 ? t('st.round', { r: seg.round, n: w.rounds }) + ' · ' : '') + t('st.moveOf', { i: seg.i + 1, n: w.moves.length });
  el.querySelector('#sx-name').textContent = (work ? '' : t('st.nextUp') + ' ') + moveName(seg.move);
  el.querySelector('#sx-cue').textContent = moveCue(seg.move);
  el.querySelector('#sx-time').textContent = dur(Math.max(0, Math.ceil(P.left / 1000)));
  el.querySelector('#sx-bar').style.width = ((1 - P.left / (seg.sec * 1000)) * 100).toFixed(1) + '%';
  const nx = P.tl.slice(P.idx + 1).find(s => s.kind === 'work');
  el.querySelector('#sx-next').textContent = work && nx ? t('run.next', { what: moveName(nx.move), t: nx.sec + 's' }) : '';
  let k = 0; el.querySelectorAll('.sx-prog i').forEach(b => { while (P.tl[k] && P.tl[k].kind !== 'work') k++; b.className = P.done.has(k) ? 'done' : k === P.idx ? 'now' : ''; k++; });
  el.querySelector('[data-pp]').innerHTML = icon(P.running ? 'pause' : 'play');
}

/* ───────── done ───────── */
function finish(view, complete) {
  if (!P) return;
  const { w, started, done, sw } = P, secs = Math.round(P.spent / 1000), moves = done.size;
  stop();
  if (complete) { coach.beep(3, true); coach.say(t('st.v.done')); }
  if (secs < 30) { toast(t('st.tooShort')); go('strength/' + w.key, true); return; }
  view.innerHTML = `<div class="str-done">
    <div class="photo tall bleed" style="background-image:url('${w.img}')"><div class="in">
      <div class="eyebrow">${esc(complete ? t('st.complete') : t('st.partial'))}</div>
      <h1 style="margin:6px 0 14px;font-size:38px">${esc(title(w))}</h1>
      <div class="strip"><div><div class="num">${esc(dur(secs))}</div><div class="l">${esc(t('gps.time'))}</div></div>
        <div><div class="num">${moves}</div><div class="l">${esc(t('st.movesDone'))}</div></div>
        <div><div class="num">${w.rounds}</div><div class="l">${esc(t('st.rounds'))}</div></div></div></div></div>
    <div class="card" style="margin-top:16px">
      <label for="fb-rpe">${esc(t('log.rpe'))}: <b id="rpe-v">6</b>/10 · <span id="rpe-l">${esc(t('rpe.6'))}</span></label>
      <input type="range" id="fb-rpe" min="1" max="10" value="6"></div>
    <button class="btn primary block lg" style="margin-top:16px" data-save>${esc(t('st.save'))}</button>
    <button class="btn ghost block" style="margin-top:10px" data-discard>${esc(t('gps.discard'))}</button></div>`;
  const root = view.firstElementChild;
  window.scrollTo(0, 0);
  let rpe = 6;
  root.querySelector('#fb-rpe').oninput = e => { rpe = +e.target.value; root.querySelector('#rpe-v').textContent = rpe; root.querySelector('#rpe-l').textContent = t('rpe.' + rpe); };
  root.querySelector('[data-discard]').onclick = () => go('strength', true);
  root.querySelector('[data-save]').onclick = async e => {
    e.target.disabled = true;
    try {
      const r = await api.saveStrength({ id: uuid(), workout_key: w.key, started_at: started.toISOString(), duration_s: Math.min(14400, secs), moves_done: moves, rpe });
      // started from a plan session: that session is done too
      if (sw) await api.updateSession(sw, { status: 'completed', completed_at: new Date().toISOString(), rpe }).catch(e => console.warn('plan session', e));
      toast(r.queued ? t('log.queued') : t('st.saved'));
      // saved: offer the share card, then back to the library
      e.target.remove(); root.querySelector('[data-discard]').remove(); root.querySelector('#fb-rpe').disabled = true;
      root.insertAdjacentHTML('beforeend', `<button class="btn primary block lg" style="margin-top:16px" data-share>${icon('share', 'width="18" height="18"')} ${esc(t('share.btn'))}</button>
        <a class="btn ghost block" style="margin-top:10px" href="#/strength">${esc(t('st.finish'))}</a>`);
      root.querySelector('[data-share]').onclick = async () => (await import('../share.js')).openShare({
        big: String(Math.max(1, Math.round(secs / 60))), unit: 'MIN', title: title(w),
        date: fmtDate(started, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        stats: [[String(moves), t('st.movesDone')], [String(w.rounds), t('st.rounds')], [rpe + '/10', 'RPE']], photo: w.img });
    } catch (err) { toast(friendlyError(err)); e.target.disabled = false; }
  };
}
