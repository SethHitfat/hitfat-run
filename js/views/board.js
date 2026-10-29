// Leaderboard (opt-in) and virtual run challenges.
// Boards only ever show a name the runner chose, total km and run count.
import * as api from '../api.js';
import { state, go, back, isStaff } from '../main.js';
import { t, L } from '../i18n.js';
import { esc, on, mount, icon, ymd, parseYmd, startOfWeek, startOfMonth, fmtDate, km, skeleton, errorBox, emptyState, toast, confirmSheet, friendlyError, openSheet, closeSheet, DAY_MS } from '../ui.js';

// a solo virtual run for short targets, the club together for long ones, the finish line once it is over
const photoOf = c => phase(c) === 'ended' ? '/img/ch-finisher.webp' : c.target_m <= 21100 ? '/img/ch-virtual.webp' : '/img/club-night.webp';
const optedIn = () => !!(state.profile && state.profile.board_opt_in_at && state.profile.board_name);
const todayYmd = () => ymd(new Date());
export const phase = c => c.starts_on > todayYmd() ? 'soon' : c.ends_on < todayYmd() ? 'ended' : 'live';
const daysLeft = c => Math.round((parseYmd(c.ends_on) - parseYmd(todayYmd())) / DAY_MS) + 1;
const daysTo = c => Math.round((parseYmd(c.starts_on) - parseYmd(todayYmd())) / DAY_MS);

/** My distance inside a challenge, from my own runs (Strava never counts). */
export async function myProgress(c) {
  const acts = await api.listActivities({ since: parseYmd(c.starts_on), limit: 1000 });
  return acts.filter(a => a.source !== 'strava' && ymd(a.started_at) <= c.ends_on).reduce((s, a) => s + a.distance_m, 0);
}
export function phaseLabel(c) {
  const p = phase(c);
  return p === 'live' ? t('ch.daysLeft', { n: daysLeft(c) }) : p === 'soon' ? t('ch.startsIn', { n: daysTo(c) }) : t('ch.ended');
}

/** A challenge as a card: for the Club tab and Home. */
export function challengeCard(c, { n = 0, joined = false, mine = 0 } = {}) {
  const frac = Math.min(1, mine / c.target_m);
  return `<a class="photo mid ch-card" href="#/challenge/${c.id}" style="background-image:url('${photoOf(c)}')"><div class="in">
    <div class="row between"><span class="chip ${phase(c) === 'live' ? 'red' : ''}">${esc(phaseLabel(c))}</span>
      ${joined ? `<span class="chip ok">${icon('check', 'width="14" height="14"')} ${esc(t('ch.joined'))}</span>` : `<span class="chip">${esc(t('ch.runners', { n }))}</span>`}</div>
    <div class="eyebrow" style="margin-top:12px">${esc(t('ch.virtual'))} · ${esc(fmtDate(c.starts_on, { day: 'numeric', month: 'short' }))} – ${esc(fmtDate(c.ends_on, { day: 'numeric', month: 'short' }))}</div>
    <h3 style="margin:4px 0 8px;font-size:24px">${esc(L(c.i18n).title)}</h3>
    ${joined ? `<div class="row between small"><b>${km(mine, 1)} / ${km(c.target_m, 0)} km</b><span>${Math.round(frac * 100)}%</span></div>
      <div class="bar" style="margin-top:6px"><i style="width:${(frac * 100).toFixed(1)}%"></i></div>`
      : `<div class="num" style="font-size:40px">${km(c.target_m, 0)}<span class="small" style="font-family:var(--font);margin-left:6px">km</span></div>`}
  </div></a>`;
}
export const medalSvg = (size = 140) => `<svg class="medal" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">
  <path d="M38 4h16l12 30H50zM82 4H66L54 34h16z" fill="#FFE000" opacity=".85"/>
  <circle cx="60" cy="72" r="40" fill="#FFE000"/><circle cx="60" cy="72" r="31" fill="none" stroke="#141000" stroke-width="3" opacity=".35"/>
  <path d="M60 50l6.5 13.2 14.5 2.1-10.5 10.2 2.5 14.5L60 83.2 47 90l2.5-14.5L39 65.3l14.5-2.1z" fill="#141000"/></svg>`;

/* ───────── opt-in ───────── */
export function optInSheet(onDone) {
  const p = state.profile || {}, guess = p.board_name || (state.name || '').split(' ').slice(0, 2).map((w, i) => i ? w[0] + '.' : w).join(' ');
  const b = openSheet(`<div><h2 style="margin:4px 0 8px">${esc(t('lb.optT'))}</h2>
    <p class="muted" style="margin:0 0 12px">${esc(t('lb.optBody'))}</p>
    <div class="card" style="margin-bottom:14px"><div class="row" style="gap:10px;align-items:flex-start">${icon('check', 'width="18" height="18" style="flex:none;color:var(--accent)"')}<span>${esc(t('lb.shown'))}</span></div>
      <div class="row" style="gap:10px;align-items:flex-start;margin-top:10px"><span style="flex:none;width:18px;text-align:center;color:var(--muted)">✕</span><span class="muted">${esc(t('lb.notShown'))}</span></div></div>
    <label for="lb-name">${esc(t('lb.name'))}</label>
    <input id="lb-name" maxlength="30" value="${esc(guess)}" autocomplete="nickname">
    <div class="muted tiny" style="margin-top:6px">${esc(t('lb.nameHelp'))}</div>
    <div class="err small" id="lb-err" style="min-height:18px;margin-top:6px"></div>
    <button class="btn primary block lg" data-yes>${esc(t('lb.agree'))}</button>
    ${optedIn() ? `<button class="btn ghost block danger" style="margin-top:10px" data-board-out>${esc(t('lb.leave'))}</button>` : `<button class="btn ghost block" style="margin-top:10px" data-no>${esc(t('common.cancel'))}</button>`}</div>`);
  b.querySelector('[data-no]')?.addEventListener('click', closeSheet);
  b.querySelector('[data-yes]').onclick = async e => {
    const name = b.querySelector('#lb-name').value.trim();
    if (name.length < 2) { b.querySelector('#lb-err').textContent = t('lb.nameErr'); return; }
    e.target.disabled = true;
    try { state.profile = await api.setBoard(name); closeSheet(); toast(t('lb.joinedToast')); onDone && onDone(); }
    catch (x) { b.querySelector('#lb-err').textContent = friendlyError(x); e.target.disabled = false; }
  };
  b.querySelector('[data-board-out]')?.addEventListener('click', async () => {
    try { state.profile = await api.setBoard(null); closeSheet(); toast(t('lb.leftToast')); onDone && onDone(); } catch (x) { toast(friendlyError(x)); }
  });
}

function rows(list, { showRuns = true, target = 0 } = {}) {
  if (!list.length) return `<div class="card muted">${esc(t('lb.empty'))}</div>`;
  return `<div class="lb">${list.map(r => `<div class="lb-row ${r.me ? 'me' : ''} ${r.rank <= 3 ? 'top top' + r.rank : ''}">
      <div class="lb-rank num">${r.rank}</div>
      <div class="grow ellipsis"><b>${esc(r.name)}</b>${r.me ? ` <span class="chip" style="margin-left:4px">${esc(t('lb.you'))}</span>` : ''}
        ${showRuns ? `<div class="muted tiny">${esc(t('lb.runs', { n: r.runs }))}</div>` : r.done ? `<div class="tiny" style="color:var(--accent-text);font-weight:700">${esc(t('ch.finisher'))}</div>` : ''}</div>
      <div class="num lb-km">${Number(r.km).toFixed(1)}<span>km</span></div></div>`).join('')}</div>`;
}

/* ───────── leaderboard ───────── */
const LB = { period: 'week', scope: 'all', gps: false };
export async function render(view) {
  view.innerHTML = `<header class="topbar"><div class="row"><button class="icon-btn" data-back aria-label="${esc(t('common.back'))}">${icon('back')}</button>
    <h1>${esc(t('lb.title'))}</h1></div><button class="btn sm" data-opt>${esc(t('lb.settings'))}</button></header><div id="lb-body">${skeleton(6, 56)}</div>`;
  view.querySelector('[data-back]').onclick = () => back('club');
  view.querySelector('[data-opt]').onclick = () => optInSheet(() => paint());
  const body = view.querySelector('#lb-body');
  const chapters = await api.myChapters().catch(() => []), all = await api.listChapters().catch(() => []);
  const myCh = all.find(c => chapters.some(m => m.chapter_id === c.id));
  async function paint() {
    const now = new Date(), from = ymd(LB.period === 'week' ? startOfWeek(now) : startOfMonth(now)), to = ymd(now);
    let list = [];
    try { list = await api.leaderboard({ from, to, chapterId: LB.scope === 'chapter' && myCh ? myCh.id : null, gpsOnly: LB.gps }); }
    catch (e) { body.innerHTML = errorBox(e, true); body.querySelector('[data-retry]').onclick = paint; return; }
    const me = list.find(r => r.me);
    const root = mount(body, `
      ${optedIn() ? '' : `<div class="card lb-cta"><div class="eyebrow">${esc(t('lb.optEyebrow'))}</div>
        <div style="font-weight:800;font-size:20px;margin:4px 0 6px">${esc(t('lb.ctaT'))}</div><p class="muted small" style="margin:0 0 12px">${esc(t('lb.cta'))}</p>
        <button class="btn primary" data-join>${esc(t('lb.join'))}</button></div>`}
      <div class="seg" role="group" style="margin-top:14px"><button data-period="week" aria-pressed="${LB.period === 'week'}">${esc(t('lb.week'))}</button><button data-period="month" aria-pressed="${LB.period === 'month'}">${esc(t('lb.month'))}</button></div>
      <div class="row between" style="margin-top:12px;gap:10px;flex-wrap:wrap">
        ${myCh ? `<div class="chips-row" style="margin:0;padding:0"><button class="pill" data-scope="all" aria-pressed="${LB.scope === 'all'}">${esc(t('lb.allClubs'))}</button><button class="pill" data-scope="chapter" aria-pressed="${LB.scope === 'chapter'}">${esc(myCh.name.replace('HITFAT Run Club ', ''))}</button></div>` : '<span></span>'}
        <label class="row small" style="gap:8px;font-weight:700"><input type="checkbox" data-gps ${LB.gps ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--accent)">${esc(t('lb.gpsOnly'))}</label></div>
      ${me ? `<div class="card lb-me"><div class="num" style="font-size:44px;color:var(--accent)">#${me.rank}</div><div class="grow"><div class="eyebrow">${esc(t('lb.yourRank'))}</div>
        <div style="font-weight:800">${esc(me.name)}</div></div><div class="num" style="font-size:30px">${Number(me.km).toFixed(1)}<span class="small" style="font-family:var(--font)"> km</span></div></div>` : ''}
      <div style="margin-top:14px">${rows(list)}</div>
      <p class="muted tiny" style="margin-top:16px">${esc(t('lb.rules'))}</p>`);
    on(root, '[data-join]', 'click', () => optInSheet(() => paint()));
    on(root, '[data-period]', 'click', (e, b) => { LB.period = b.dataset.period; paint(); });
    on(root, '[data-scope]', 'click', (e, b) => { LB.scope = b.dataset.scope; paint(); });
    root.addEventListener('change', e => { if (e.target.matches('[data-gps]')) { LB.gps = e.target.checked; paint(); } });
  }
  paint();
}

/* ───────── one challenge ───────── */
export async function challenge(view, id) {
  view.innerHTML = `<div id="ch-body">${skeleton(3, 160)}</div>`;
  const body = view.querySelector('#ch-body');
  try {
    const c = await api.getChallenge(id);
    if (!c) { body.innerHTML = `<div class="card">${emptyState(t('ch.missingT'), t('ch.missing'))}</div>`; return; }
    const [counts, mine, board] = await Promise.all([api.challengeCounts([c.id]), api.myChallenges(), api.challengeBoard(c.id).catch(() => [])]);
    const joined = mine.some(m => m.challenge_id === c.id), p = phase(c);
    const m = joined ? await myProgress(c) : 0, frac = Math.min(1, m / c.target_m), done = joined && m >= c.target_m;
    const root = mount(body, `
      <div class="photo tall bleed" style="background-image:url('${photoOf(c)}')"><div class="in">
        <button class="icon-btn" data-back aria-label="${esc(t('common.back'))}" style="position:absolute;top:calc(var(--safe-t) + 12px);left:16px;background:rgba(0,0,0,.5);color:#fff">${icon('back')}</button>
        <div class="row" style="gap:6px"><span class="chip ${p === 'live' ? 'red' : ''}">${esc(phaseLabel(c))}</span><span class="chip">${esc(t('ch.runners', { n: counts[c.id] || 0 }))}</span></div>
        <div class="eyebrow" style="margin-top:12px">${esc(t('ch.virtual'))} · ${esc(fmtDate(c.starts_on, { day: 'numeric', month: 'long' }))} – ${esc(fmtDate(c.ends_on, { day: 'numeric', month: 'long' }))}</div>
        <h1 style="margin:6px 0 4px;font-size:36px">${esc(L(c.i18n).title)}</h1>
        <div class="num" style="font-size:56px">${km(c.target_m, 0)}<span class="small" style="font-family:var(--font);margin-left:8px">km</span></div></div></div>
      ${L(c.i18n).desc ? `<p style="margin:18px 0 0;font-size:16px;line-height:1.5">${esc(L(c.i18n).desc)}</p>` : ''}
      ${joined ? `<div class="card ch-progress" style="margin-top:16px">
          ${done ? `<div class="ch-medal">${medalSvg(120)}<div><div class="eyebrow">${esc(t('ch.finisher'))}</div><div style="font-weight:900;font-size:22px">${esc(t('ch.doneT'))}</div></div></div>` : ''}
          <div class="row between" style="align-items:flex-end"><div><div class="eyebrow">${esc(t('ch.progress'))}</div>
            <div class="num" style="font-size:52px">${km(m, 1)}<span class="small" style="font-family:var(--font);color:var(--muted)"> / ${km(c.target_m, 0)} km</span></div></div>
            <div class="num" style="font-size:28px;color:var(--accent)">${Math.round(frac * 100)}%</div></div>
          <div class="bar" style="margin-top:10px;height:10px"><i style="width:${(frac * 100).toFixed(1)}%"></i></div>
          ${!done && p === 'live' ? `<div class="muted small" style="margin-top:10px">${esc(t('ch.perDay', { km: ((c.target_m - m) / 1000 / Math.max(1, daysLeft(c))).toFixed(1), n: daysLeft(c) }))}</div>` : ''}
          ${done ? `<button class="btn primary block" style="margin-top:14px" data-share>${icon('share', 'width="18" height="18"')} ${esc(t('ch.shareMedal'))}</button>` : ''}
        </div>` : ''}
      <div style="margin-top:16px">
        ${!joined && p !== 'ended' ? `<button class="btn primary block lg" data-join>${esc(t('ch.join'))}</button>` : ''}
        ${joined && p !== 'ended' ? `<a class="btn block" href="#/run">${icon('run', 'width="18" height="18"')} ${esc(t('ch.goRun'))}</a>` : ''}
      </div>
      <p class="muted small" style="margin:14px 0 0">${esc(t('ch.counts'))}</p>
      <h2>${esc(t('ch.board'))}</h2>
      ${joined && !optedIn() ? `<div class="notice small" style="margin-bottom:12px">${esc(t('ch.hiddenYou'))} <button class="link" data-opt style="font-weight:700">${esc(t('lb.join'))}</button></div>` : ''}
      ${rows(board, { showRuns: false })}
      ${joined && p !== 'ended' ? `<button class="btn ghost block danger" style="margin-top:20px" data-leave>${esc(t('ch.leave'))}</button>` : ''}
      ${isStaff(['head_coach', 'running_coach']) && c.status === 'published' && !String(c.id).startsWith('preview') ? `<button class="btn ghost block" style="margin-top:10px" data-archive>${esc(t('ch.archive'))}</button>` : ''}`);
    root.querySelector('[data-back]').onclick = () => back('club');
    const again = () => challenge(view, id);
    on(root, '[data-join]', 'click', async (e, b) => {
      b.disabled = true;
      try { await api.joinChallenge(c.id); toast(t('ch.joinedToast')); if (!optedIn()) optInSheet(again); await again(); }
      catch (x) { toast(friendlyError(x)); b.disabled = false; }
    });
    on(root, '[data-opt]', 'click', () => optInSheet(again));
    on(root, '[data-leave]', 'click', async () => {
      if (!await confirmSheet(t('ch.leaveQ'), t('ch.leaveHelp'), t('ch.leave'), true)) return;
      try { await api.leaveChallenge(c.id); await again(); } catch (x) { toast(friendlyError(x)); }
    });
    on(root, '[data-archive]', 'click', async () => {
      if (!await confirmSheet(t('ch.archiveQ'), t('ch.archiveHelp'), t('ch.archive'), true)) return;
      try { await api.archiveChallenge(c.id); go('club', true); } catch (x) { toast(friendlyError(x)); }
    });
    on(root, '[data-share]', 'click', async () => (await import('../share.js')).openShare({
      big: km(m, 1), unit: 'KM', title: '🏅 ' + L(c.i18n).title, photo: photoOf(c),
      date: `${fmtDate(c.starts_on, { day: 'numeric', month: 'short' })} – ${fmtDate(c.ends_on, { day: 'numeric', month: 'short', year: 'numeric' })}`,
      stats: [[km(c.target_m, 0) + ' km', t('ch.target')], [t('ch.finisherShort'), t('ch.status')], [String(counts[c.id] || 0), t('ch.runnersShort')]] }));
  } catch (e) { console.error(e); body.innerHTML = errorBox(e, true); body.querySelector('[data-retry]').onclick = () => challenge(view, id); }
}

/* ───────── coach: new challenge ───────── */
export async function create(view) {
  if (!isStaff(['head_coach', 'running_coach'])) { go('club', true); return; }
  const d = new Date(), first = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 1)), last = ymd(new Date(d.getFullYear(), d.getMonth() + 2, 0));
  view.innerHTML = `<form id="chf"><header class="topbar"><div class="row"><button type="button" class="icon-btn" data-back aria-label="${esc(t('common.back'))}">${icon('back')}</button>
      <h1>${esc(t('ch.new'))}</h1></div></header>
    <label for="cf-t">${esc(t('ch.fTitle'))}</label><input id="cf-t" required minlength="3" maxlength="80" placeholder="${esc(t('ch.fTitlePh'))}">
    <label for="cf-te">${esc(t('ch.fTitleEn'))}</label><input id="cf-te" maxlength="80">
    <label for="cf-d">${esc(t('ch.fDesc'))}</label><textarea id="cf-d" rows="3" maxlength="400"></textarea>
    <label for="cf-km">${esc(t('ch.fTarget'))}</label><input id="cf-km" type="number" min="1" max="1000" step="1" required value="50" inputmode="numeric">
    <div class="row" style="gap:12px"><div class="grow"><label for="cf-s">${esc(t('ch.fStart'))}</label><input id="cf-s" type="date" required value="${first}"></div>
      <div class="grow"><label for="cf-e">${esc(t('ch.fEnd'))}</label><input id="cf-e" type="date" required value="${last}"></div></div>
    <div class="muted tiny" style="margin-top:8px">${esc(t('ch.fHelp'))}</div>
    <div class="err small" id="cf-err" style="min-height:18px;margin-top:10px"></div>
    <button class="btn primary block lg" type="submit">${esc(t('ch.publish'))}</button></form>`;
  const f = view.querySelector('#chf');
  f.querySelector('[data-back]').onclick = () => back('club');
  f.onsubmit = async e => {
    e.preventDefault();
    const v = id => f.querySelector(id).value.trim(), s = v('#cf-s'), en = v('#cf-e'), target = Math.round(+v('#cf-km') * 1000);
    const err = f.querySelector('#cf-err');
    if (en < s || (parseYmd(en) - parseYmd(s)) / DAY_MS > 92) return (err.textContent = t('ch.fDatesErr'));
    const title = v('#cf-t'), slug = (title.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'cabaran') + '-' + s.replace(/-/g, '');
    const i18n = { ms: { title, desc: v('#cf-d') }, ...(v('#cf-te') ? { en: { title: v('#cf-te'), desc: v('#cf-d') } } : {}) };
    const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    try { const c = await api.createChallenge({ slug, i18n, target_m: target, starts_on: s, ends_on: en, status: 'published' }); toast(t('ch.created')); go('challenge/' + c.id, true); }
    catch (x) { err.textContent = friendlyError(x); btn.disabled = false; }
  };
}
