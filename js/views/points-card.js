// Mata HITFAT on Profile: read-only. Shows the ledger once it is live, and
// until then an estimate from the runner's own data with the proposed rules.
import * as api from '../api.js';
import { t } from '../i18n.js';
import { esc } from '../ui.js';
import { estimatePoints, RULES } from '../points.js';
import { sweatTests } from '../hydration.js';
import { myProgress } from './board.js';

export async function pointsCard(el) {
  if (!el) return;
  let pts = null, estimate = false;
  try { pts = await api.myPoints(); } catch (e) { console.warn('points', e); }
  if (!pts) {
    estimate = true;
    const [acts, hist, chs, mine] = await Promise.all([api.listActivities({ limit: 1000 }).catch(() => []), api.myRunHistory().catch(() => []),
      api.listChallenges().catch(() => []), api.myChallenges().catch(() => [])]);
    const joined = chs.filter(c => mine.some(m => m.challenge_id === c.id));
    const finished = (await Promise.all(joined.map(async c => (await myProgress(c).catch(() => 0)) >= c.target_m ? c.id : null))).filter(Boolean);
    pts = estimatePoints({ acts, checkIns: hist, finished, sweat: sweatTests() });
  }
  if (!el.isConnected) return;
  el.innerHTML = `<div class="card pts">
    <div class="row between"><div class="eyebrow">${esc(t('pts.balance'))}</div>${estimate ? `<span class="chip">${esc(t('pts.estimate'))}</span>` : ''}</div>
    <div class="num" style="font-size:56px;color:var(--accent-text);margin-top:4px">${pts.total}<span class="small" style="font-family:var(--font);color:var(--muted)"> ${esc(t('pts.unit'))}</span></div>
    <div class="pts-rules">${Object.keys(RULES).map(k => `<div><span>${esc(t('pts.rule.' + k))}</span><b>${pts.by[k] || 0}</b></div>`).join('')}</div>
    <p class="muted tiny" style="margin:10px 0 0">${esc(t(estimate ? 'pts.noteEstimate' : 'pts.note'))}</p></div>`;
}
