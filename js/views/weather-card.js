// "Cuaca Larian Hari Ini": Home's weather card. Fills itself in after Home has
// painted and stays hidden when there is no weather to show (offline, error).
import { t, lang } from '../i18n.js';
import { esc } from '../ui.js';
import { getWeather, useMyLocation, LEVELS } from '../weather.js';

const deg = v => `${Math.round(v)}°`;
const hm = d => d.toLocaleTimeString(lang() === 'en' ? 'en-MY' : 'ms-MY', { hour: 'numeric', minute: '2-digit' });
const hourLabel = b => { const [y, m, d] = b.date.split('-').map(Number), s = new Date(y, m - 1, d, b.hour); return `${hm(s)} – ${hm(new Date(s.getTime() + 36e5))}`; };

export async function weatherCard(el) {
  if (!el) return;
  const w = await getWeather();
  if (!el.isConnected) return;
  if (!w) { el.replaceChildren(); return; }
  const lv = LEVELS[w.level];
  el.innerHTML = `<div class="card wx wx-${lv}" style="margin-bottom:12px">
    <div class="row between"><div class="eyebrow">${esc(t('wx.title'))} · ${esc(w.here ? t('wx.here') : t('wx.kb'))}</div>
      <span class="wx-chip">${esc(t('wx.level.' + lv))}</span></div>
    <div class="row" style="align-items:flex-end;gap:16px;margin-top:8px">
      <div><div class="huge-num" style="font-size:64px">${deg(w.feels)}</div><div class="muted tiny">${esc(t('wx.feels'))}</div></div>
      <div class="wx-facts small"><div>${esc(t('wx.temp'))} <b>${deg(w.temp)}</b></div><div>${esc(t('wx.rh'))} <b>${Math.round(w.rh)}%</b></div>
        <div>${esc(t('wx.uv'))} <b>${w.uv != null ? Math.round(w.uv) : '–'}</b></div><div>${esc(t('wx.hi'))} <b>${deg(w.heatIndex)}</b></div></div></div>
    <p class="small" style="margin:12px 0 0">${esc(t('wx.tip.' + lv))}${w.uv >= 8 ? ' ' + esc(t('wx.uvHigh')) : ''}</p>
    ${w.best ? `<div class="wx-best"><span class="eyebrow">${esc(w.best.tomorrow ? t('wx.bestTomorrow') : t('wx.best'))}</span>
      <b>${esc(hourLabel(w.best))}</b><span class="muted small">${esc(t('wx.bestFeels', { t: deg(w.best.feels) }))}</span></div>` : ''}
    ${w.here ? '' : `<button class="link small" data-wx-loc style="margin-top:10px;font-weight:700">${esc(t('wx.useLoc'))}</button>`}
    <div class="muted tiny" style="margin-top:8px">${esc(t('wx.source'))}</div></div>`;
  el.querySelector('[data-wx-loc]')?.addEventListener('click', async () => { if (await useMyLocation()) weatherCard(el); });
}
