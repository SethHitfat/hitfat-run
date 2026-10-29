// "Pelan Hidrasi": the planner card on the RUN start screen, and the short
// hydration card on a saved run. Uses today's heat level when there is a
// forecast and the runner's own sweat tests when there are any.
import { t } from '../i18n.js';
import { esc, on } from '../ui.js';
import { getWeather, LEVELS } from '../weather.js';
import { DURATIONS, planHydration, measuredRate, keptPlan } from '../hydration.js';

const nearest = m => DURATIONS.reduce((a, b) => Math.abs(b - m) < Math.abs(a - m) ? b : a);

export function advice(p) {
  return p.sticks ? t('hyd.say', { ml: p.water, n: p.sticks, m: p.every }) : t('hyd.sayWater', { ml: p.water, m: p.every });
}

/** The planner. onPlan(plan) is called with every change, so the start button can keep it with the run. */
export async function hydrationPlanner(old, { minutes, onPlan }) {
  if (!old) return;
  const el = old.cloneNode(false); old.replaceWith(el);   // a fresh element: no listeners left from an earlier paint
  const w = await getWeather().catch(() => null);
  if (!el.isConnected) return;
  const level = w ? w.level : null, measured = measuredRate();
  let pick = nearest(minutes || 45);
  const paint = () => {
    const p = planHydration({ minutes: pick, level, measured });
    onPlan && onPlan(p);
    el.innerHTML = `<div class="card hyd">
      <div class="row between"><div class="eyebrow">${esc(t('hyd.title'))}</div>
        <span class="chip">${esc(w ? t('wx.level.' + LEVELS[w.level]) : t('hyd.noWeather'))}</span></div>
      <div class="muted small" style="margin-top:6px">${esc(t('hyd.howLong'))}</div>
      <div class="chips-row hyd-mins" role="group" style="margin:8px 0 0;padding:0">${DURATIONS.map(m => `<button class="pill" data-min="${m}" aria-pressed="${m === pick}">${m} min</button>`).join('')}</div>
      <div class="hyd-out">
        <div class="hyd-big"><div><span class="num">${p.water}</span><span class="u">ml</span><div class="l">${esc(t('hyd.water'))}</div></div>
          <div><span class="num">${p.sticks}</span><span class="u">stick</span><div class="l">HITFAT Hydrate</div></div></div>
        <p style="margin:10px 0 0;font-weight:600">${esc(advice(p))}</p>
        <div class="muted tiny" style="margin-top:6px">${esc(t(p.measured ? 'hyd.basisTest' : 'hyd.basis', { r: p.rate.toFixed(1), mg: p.sodium, lo: p.waterLow, hi: p.waterHigh }))}</div>
      </div>
      <a class="link small" href="#/sweat" style="display:inline-block;margin-top:10px;font-weight:700">${esc(measured ? t('hyd.retest') : t('hyd.test'))}</a>
      <div class="muted tiny" style="margin-top:8px">${esc(t('hyd.disclaimer'))}</div></div>`;
  };
  paint();
  on(el, '[data-min]', 'click', (e, b) => { pick = +b.dataset.min; paint(); });
}

/** On a saved run: what was planned (GPS runs started with the planner) and what the actual time suggests. */
export function hydrationSummary(activity) {
  const kept = keptPlan(activity.id), min = Math.max(1, Math.round(activity.moving_time_s / 60));
  if (min < 10 && !kept) return '';   // a very short manual log needs no card; a run planned at the start always gets one
  const p = planHydration({ minutes: min, level: kept ? kept.level : null, measured: measuredRate() });
  return `<div class="card hyd" style="margin-top:16px"><div class="eyebrow">${esc(t('hyd.card'))}</div>
    <div class="hyd-big" style="margin-top:8px"><div><span class="num">${p.water}</span><span class="u">ml</span><div class="l">${esc(t('hyd.forActual', { n: min }))}</div></div>
      <div><span class="num">${p.sticks}</span><span class="u">stick</span><div class="l">HITFAT Hydrate</div></div></div>
    ${kept ? `<div class="muted small" style="margin-top:8px">${esc(t('hyd.planned', { ml: kept.water, n: kept.sticks, m: kept.minutes }))}</div>` : `<div class="muted small" style="margin-top:8px">${esc(t('hyd.noPlan'))}</div>`}
    <div class="muted small" style="margin-top:4px">${esc(t('hyd.after'))}</div>
    <div class="muted tiny" style="margin-top:8px">${esc(t('hyd.disclaimer'))}</div></div>`;
}
