// Home: what to do today, how the week is going, what's next with the club.
import * as api from '../api.js';
import { state, go } from '../main.js';
import { t, L, lang } from '../i18n.js';
import { esc, on, mount, icon, photoFor, bg, km, durWords, fmtDate, fmtTime, today, skeleton, errorBox, toast, friendlyError } from '../ui.js';
import { thisWeek, consistency, planProgress } from '../stats.js';
import { byCode } from '../achievements.js';
import { sessionTitle, sessionMeta } from './training.js';
import { card as strengthCard, suggestion, WEEK_TARGET } from './strength.js';
import { startOfWeek } from '../ui.js';

export async function render(view) {
  const h = new Date().getHours();
  const greet = t(h < 12 ? 'home.morning' : h < 15 ? 'home.noon' : h < 19 ? 'home.evening' : 'home.night', { name: state.name.split(' ')[0] || t('home.runner') });
  view.innerHTML = `<header class="topbar"><div><div class="eyebrow">${esc(fmtDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
      <h1 style="margin-top:4px">${esc(greet)}</h1></div></header>
    <div id="h-body">${skeleton(4, 120)}</div>
    <button class="fab" data-log aria-label="${esc(t('log.title'))}">${icon('plus')}</button>`;
  view.querySelector('[data-log]').onclick = () => go('log');
  const body = view.querySelector('#h-body');
  try { await paint(body); }
  catch (e) { console.error(e); body.innerHTML = errorBox(e, true); body.querySelector('[data-retry]').onclick = () => render(view); }
}

async function paint(body) {
  const since = Date.now() - 35 * 864e5;
  const [plan, acts, earned, chapters, str] = await Promise.all([
    api.activePlan(), api.listActivities({ since }), api.listAchievements(), api.myChapters().catch(() => []),
    api.listStrength({ since: startOfWeek() }).catch(() => []),
  ]);
  const events = await api.listEvents({ chapterId: chapters[0]?.chapter_id, limit: 1 }).catch(() => []);
  const ev = events[0] || null;
  const [counts, regs] = ev ? await Promise.all([api.eventCounts([ev.id]).catch(() => ({})), api.myRegistrations([ev.id]).catch(() => [])]) : [{}, []];

  const wk = thisWeek(acts), cons = consistency(acts, 4), pp = plan ? planProgress(plan) : null;
  const goalLabel = plan ? L(plan.program.i18n).title : state.profile?.goal ? t('goal.' + state.profile.goal) : '';

  const root = mount(body, `
    ${plan ? `<a class="photo tall" href="#/training" ${bg(photoFor({ plan: plan.program.slug, treadmill: state.profile?.training_location === 'treadmill' }))}><div class="in">
        <div class="row between"><div class="eyebrow">${esc(t('home.goal'))}</div>${pp.finished ? `<span class="chip ok">${esc(t('plan.finished'))}</span>` : ''}</div>
        <h2 style="margin:6px 0 2px;font-size:40px">${esc(goalLabel)}</h2>
        <div class="muted">${esc(t('home.weekOf', { w: pp.week, n: pp.weeks }))} · ${esc(t('home.sessionsDone', { d: pp.done, n: pp.total }))}</div>
        <div class="bar" style="margin-top:14px"><i style="width:${(pp.done / pp.total * 100).toFixed(1)}%"></i></div>
        <div class="weeks" style="margin-top:12px" aria-hidden="true">${Array.from({ length: pp.weeks }, (_, i) => {
          const ws = plan.sessions.filter(s => s.template.week === i + 1);
          return `<i class="${ws.length && ws.every(s => s.status === 'completed') ? 'done' : i + 1 === pp.week ? 'now' : ''}"></i>`; }).join('')}</div>
      </div></a>` : `<div class="photo tall" ${bg(photoFor({ plan: 'road-to-10k' }))}><div class="in">
        <div class="eyebrow">${esc(t('home.goal'))}</div>
        <h2 style="margin:6px 0 8px;font-size:40px">${esc(goalLabel || t('home.noPlanT'))}</h2>
        <p class="muted" style="margin:0 0 16px">${esc(t('home.noPlan'))}</p>
        <a class="btn primary" href="#/programs" style="align-self:flex-start">${esc(t('home.choosePlan'))}</a></div></div>`}

    ${plan ? todayCard(plan, pp) : ''}

    <h2 class="row between"><span>${esc(t('st.forRunners'))}</span><span class="chip ${str.length >= WEEK_TARGET ? 'ok' : ''}" style="font-family:var(--font)">${esc(t('st.weekCount', { n: str.length, of: WEEK_TARGET }))}</span></h2>
    ${strengthCard(suggestion(!!(pp && pp.next && pp.next.scheduled_date === today())), 'mid')}

    <h2>${esc(t('home.week'))}</h2>
    <div class="card">
      <div class="huge-num">${km(wk.dist, 1)}</div><div class="eyebrow" style="margin-top:6px">${esc(t('stat.distance'))} · km</div>
      <div class="strip" style="margin-top:20px">
        <div><div class="num">${esc(durWords(wk.time))}</div><div class="l">${esc(t('stat.time'))}</div></div>
        <div><div class="num">${plan ? `${pp.weekDone}<span class="small">/${pp.weekPlanned}</span>` : wk.n}</div><div class="l">${esc(plan ? t('stat.plannedDone') : t('stat.runs'))}</div></div>
        <div><div class="num">${cons.active}<span class="small">/${cons.of}</span></div><div class="l">${esc(t('stat.consistency'))}</div></div>
      </div>
      ${acts.length === 0 ? `<p class="muted small" style="margin:14px 0 0">${esc(t('home.noRuns'))}</p>` : ''}
    </div>

    <h2>${esc(t('home.clubRun'))}</h2>
    ${ev ? `<a class="photo mid" href="#/event/${ev.id}" ${bg(photoFor({ category: 'long' }))}><div class="in">
        <div class="row between"><span class="chip red">${esc(fmtDate(ev.starts_at))} · ${esc(fmtTime(ev.starts_at))}</span>
          ${regs.some(r => r.status === 'going') ? `<span class="chip ok">${icon('check', 'width="14" height="14"')} ${esc(t('club.going'))}</span>` : ''}</div>
        <h3 style="margin:10px 0 4px">${esc(ev.title)}</h3>
        <div class="muted small row" style="gap:6px">${icon('pin', 'width="16" height="16"')}<span class="ellipsis">${esc(ev.meeting_point)}</span></div>
        ${ev.capacity ? `<div class="muted small" style="margin-top:4px">${esc(t('club.spots', { n: Math.max(0, ev.capacity - (counts[ev.id] || 0)) }))}</div>` : ''}
      </div></a>` : `<div class="card">${esc(t('home.noEvents'))} <a class="link" href="#/club">${esc(t('home.seeClub'))}</a></div>`}

    <h2>${esc(t('home.milestones'))}</h2>
    ${earned.length ? `<div class="card"><div class="row wrap" style="gap:16px">${earned.slice(-4).reverse().map(e => { const b = byCode(e.code); return b ? `<div class="row" style="gap:10px;min-width:45%">
        <div class="icon-btn" style="background:var(--accent);color:var(--accent-ink)">${icon(b.icon)}</div><div><div style="font-weight:700">${esc(b[lang()][0])}</div><div class="muted tiny">${esc(fmtDate(e.earned_at))}</div></div></div>` : ''; }).join('')}</div>
        <a class="link small" href="#/profile" style="display:inline-block;margin-top:12px">${esc(t('home.allBadges'))}</a></div>`
      : `<div class="card muted">${esc(t('home.noBadges'))}</div>`}

    <h2>${esc(t('home.connected'))}</h2>
    <div class="card row"><div class="icon-btn" style="background:#FC4C02;color:#fff;font-weight:800;font-size:13px">S</div>
      <div class="grow"><div style="font-weight:700">Strava</div><div class="muted small">${esc(t('home.stravaSoon'))}</div></div>
      <span class="chip">${esc(t('home.notConnected'))}</span></div>`);

  on(root, '[data-resched]', 'click', async (e, b) => {
    b.disabled = true;
    try { const n = await api.reschedule(today()); toast(t('plan.rescheduled', { n })); await paint(body); }
    catch (err) { toast(friendlyError(err)); b.disabled = false; }
  });
}

function todayCard(plan, pp) {
  const n = pp.next, missed = pp.missed.length;
  const miss = missed ? `<div class="notice" style="margin-top:12px"><b>${esc(t('plan.missed', { n: missed }))}</b> ${esc(t('plan.missedHelp'))}
      <div style="margin-top:10px"><button class="btn sm dark" data-resched>${esc(t('plan.reschedule'))}</button></div></div>` : '';
  if (!n) return pp.finished ? `<div class="card" style="margin-top:12px"><b>${esc(t('plan.allDone'))}</b><p class="muted small" style="margin:6px 0 10px">${esc(t('plan.allDoneHelp'))}</p>
      <a class="btn sm primary" href="#/programs">${esc(t('home.choosePlan'))}</a></div>` : miss;
  const isToday = n.scheduled_date === today();
  return `<h2>${esc(isToday ? t('home.today') : t('home.next', { d: fmtDate(n.scheduled_date, { weekday: 'long', day: 'numeric', month: 'short' }) }))}</h2>
    <a class="photo mid" href="#/workout/${n.id}" ${bg(photoFor({ category: n.template.category, treadmill: state.profile?.training_location === 'treadmill' }))}><div class="in">
      <div class="row between"><span class="chip red">${esc(t('cat.' + n.template.category))}</span><span class="chip">${esc(t('plan.weekSession', { w: n.template.week, s: n.template.session }))}</span></div>
      <h3 style="margin:12px 0 10px;font-size:24px">${esc(sessionTitle(n))}</h3>
      <div class="today">
        <div><div class="huge-num" style="font-size:72px">${n.template.distance_m ? (n.template.distance_m / 1000).toFixed(n.template.distance_m % 1000 ? 1 : 0) : n.template.duration_min}</div>
          <div class="eyebrow" style="margin-top:4px">${n.template.distance_m ? 'km' : esc(t('unit.minutes'))}${n.template.rpe_min ? ' · RPE ' + n.template.rpe_min + '–' + n.template.rpe_max : ''}</div></div>
        <span class="go-btn" aria-hidden="true">${isToday ? esc(t('wo.go')) : icon('chevron', 'width="28" height="28"')}</span>
      </div>
    </div></a>${miss}`;
}
