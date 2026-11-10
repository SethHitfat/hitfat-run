// Share cards: a run or a strength session drawn as an image for Instagram
// Stories, WhatsApp and the feed. Drawn on the device, nothing is uploaded.
// Routes hide their first and last 200 m by default, so a card never shows
// where someone lives.
import { t } from './i18n.js';
import { esc, openSheet, closeSheet, toast } from './ui.js';
import { haversine } from './gps.js';
import { LIME, LIME_HI, INK, HF_PATH } from './brand.js';

const Y = LIME, D = '"Fira Sans Extra Condensed", "Arial Narrow", sans-serif', SIZES = { story: [1080, 1920], post: [1080, 1350] };
const PRIVATE_M = 200;

/** Drop the route's first and last metres. */
export function trimRoute(pts, m = PRIVATE_M) {
  if (!pts || pts.length < 2) return pts || [];
  const cut = arr => { let d = 0, i = 1; while (i < arr.length && d < m) { d += haversine(arr[i - 1], arr[i]); i++; } return arr.slice(i - 1); };
  const a = cut(pts), b = cut(a.slice().reverse()).reverse();
  return b.length > 1 ? b : [];
}

function img(src) { return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; }); }
function cover(ctx, im, w, h) {
  const s = Math.max(w / im.width, h / im.height), iw = im.width * s, ih = im.height * s;
  ctx.drawImage(im, (w - iw) / 2, (h - ih) / 2, iw, ih);
}
function drawRoute(ctx, pts, x, y, w, h, lw) {
  const lat0 = pts.reduce((s, p) => s + p[0], 0) / pts.length, k = Math.cos(lat0 * Math.PI / 180);
  const xy = pts.map(p => [p[1] * k, -p[0]]);
  const xs = xy.map(p => p[0]), ys = xy.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const s = Math.min(w / ((maxX - minX) || 1e-9), h / ((maxY - minY) || 1e-9));
  const ox = x + (w - (maxX - minX) * s) / 2, oy = y + (h - (maxY - minY) * s) / 2;
  const P = xy.map(p => [ox + (p[0] - minX) * s, oy + (p[1] - minY) * s]);
  ctx.save(); ctx.lineJoin = ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(226,255,99,.55)'; ctx.shadowBlur = lw * 2.2;
  ctx.strokeStyle = Y; ctx.lineWidth = lw; ctx.beginPath();
  P.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
  ctx.shadowBlur = 0;
  const dot = (p, f) => { ctx.beginPath(); ctx.arc(p[0], p[1], lw * 1.1, 0, Math.PI * 2); ctx.fillStyle = f; ctx.fill(); ctx.lineWidth = lw * .45; ctx.strokeStyle = '#000'; ctx.stroke(); };
  dot(P[0], '#fff'); dot(P[P.length - 1], Y);
  ctx.restore();
}
/* the HF shield (viewBox 317 × 389) in neon, then HITFAT RUN CLUB in heavy italic capitals */
function wordmark(ctx, x, y, size) {
  const h = size * 1.5, k = h / 389.25;
  ctx.save(); ctx.translate(x, y - h * .82); ctx.scale(k, k); ctx.fillStyle = Y; ctx.fill(new Path2D(HF_PATH), 'evenodd'); ctx.restore();
  ctx.font = `italic 900 ${size}px ${D}`; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff';
  ctx.fillText('HITFAT RUN CLUB', x + 317.25 * k + 22, y);
}
/* ||| then a label, as on the club's posters */
function marked(ctx, text, x, y, size, color) {
  ctx.fillStyle = color; const bw = size * .16, gap = size * .14;
  for (let i = 0; i < 3; i++) ctx.fillRect(x + i * (bw + gap), y - size * .78, bw, size * .78);
  ctx.font = `800 ${size}px Inter, sans-serif`; ctx.fillText(text, x + 3 * (bw + gap) + size * .3, y);
}
/* track lanes to a vanishing point, behind the numbers */
function lanes(ctx, W, top, H) {
  const vx = W / 2;
  for (let i = -7; i <= 7; i++) { ctx.beginPath(); ctx.moveTo(vx, top); ctx.lineTo(vx + i * W * .2, H);
    ctx.strokeStyle = Math.abs(i) <= 1 ? 'rgba(226,255,99,.55)' : 'rgba(226,255,99,.13)'; ctx.lineWidth = Math.abs(i) <= 1 ? 4 : 2; ctx.stroke(); }
  for (const f of [.12, .28, .5, .78]) { const yy = top + (H - top) * f; ctx.fillStyle = 'rgba(226,255,99,.05)'; ctx.fillRect(0, yy, W, 2); }
}
function fit(ctx, text, font, max) { let s = font.size; do { ctx.font = `${font.weight} ${s}px ${font.family}`; s -= 4; } while (ctx.measureText(text).width > max && s > 20); }

/**
 * d: { big, unit, title, date, stats: [[value, label] x3], photo, route }
 * o: { style: 'route'|'photo', format: 'story'|'post' }
 */
export async function draw(d, o) {
  const [W, H] = SIZES[o.format], c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'), M = 80;
  try { await Promise.all([`italic 900 200px ${D}`, `800 72px ${D}`, '800 60px Inter', '600 40px Inter'].map(f => document.fonts.load(f))); } catch (e) {}
  const hasRoute = d.route && d.route.length > 1, useRoute = o.style === 'route' && hasRoute;
  // background
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
  if (!useRoute && d.photo) {
    try { cover(ctx, await img(d.photo), W, H); } catch (e) {}
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(.3, 'rgba(0,0,0,.05)'); g.addColorStop(.55, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,.92)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createRadialGradient(W * .8, -H * .05, 0, W * .8, -H * .05, H * .9);
    g.addColorStop(0, '#2B3112'); g.addColorStop(.6, INK); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // the lighter diagonal band from the identity
    ctx.save(); ctx.globalAlpha = .07; ctx.fillStyle = LIME_HI; ctx.beginPath(); ctx.moveTo(W * .55, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H * .35); ctx.lineTo(W * .2, H * .62); ctx.closePath(); ctx.fill(); ctx.restore();
    lanes(ctx, W, H * .62, H);
  }
  // top: wordmark and date
  wordmark(ctx, M, M + 46, 50);
  marked(ctx, d.date.toUpperCase(), M, M + 112, 28, 'rgba(255,255,255,.8)');
  // the stats block, measured from the bottom
  const bigSize = o.format === 'story' ? 300 : 250, statY = H - M - 20, bigY = statY - 170, titleY = bigY - bigSize * .9 - 30;
  if (useRoute) drawRoute(ctx, d.route, M + 20, M + 180, W - 2 * M - 40, titleY - (M + 180) - 70, o.format === 'story' ? 14 : 12);
  ctx.fillStyle = Y; fit(ctx, d.title.toUpperCase(), { weight: 800, size: 72, family: D }, W - 2 * M); ctx.fillText(d.title.toUpperCase(), M, titleY);
  ctx.font = `italic 900 ${bigSize * 1.08}px ${D}`; ctx.fillStyle = '#fff'; ctx.fillText(d.big, M - 8, bigY);
  const bw = ctx.measureText(d.big).width;
  ctx.font = `italic 900 76px ${D}`; ctx.fillStyle = Y; ctx.fillText(d.unit, M + bw + 12, bigY);
  // three stats
  const cw = (W - 2 * M) / 3;
  d.stats.forEach(([v, l], i) => {
    const x = M + i * cw;
    ctx.font = `800 80px ${D}`; ctx.fillStyle = '#fff'; ctx.fillText(v, x, statY - 46);
    marked(ctx, l.toUpperCase(), x, statY, 22, 'rgba(226,255,99,.85)');
  });
  ctx.fillStyle = Y; ctx.fillRect(M, bigY + 40, 120, 8);
  return c;
}

const blobOf = c => new Promise(ok => c.toBlob(ok, 'image/png'));

/** The share sheet: live preview, style and size, then share or save. */
export function openShare(d) {
  const hasRoute = d.route && d.route.length > 1;
  const o = { style: hasRoute ? 'route' : 'photo', format: 'story', hide: true };
  const seg = (k, opts) => `<div class="seg" role="group" style="margin-top:10px">${opts.map(([v, l]) => `<button type="button" data-${k}="${v}" aria-pressed="${o[k] === v}">${esc(l)}</button>`).join('')}</div>`;
  const b = openSheet(`<div class="share">
    <h2 style="margin:4px 0 12px">${esc(t('share.title'))}</h2>
    <div class="share-prev"><img id="sh-img" alt="${esc(t('share.preview'))}"></div>
    ${hasRoute ? seg('style', [['route', t('share.route')], ['photo', t('share.photo')]]) : ''}
    ${seg('format', [['story', t('share.story')], ['post', t('share.post')]])}
    ${hasRoute ? `<label class="row" style="margin-top:12px;gap:10px;font-weight:600"><input type="checkbox" id="sh-hide" checked style="width:20px;height:20px;accent-color:var(--accent)"> ${esc(t('share.hide'))}</label>` : ''}
    <button class="btn primary block lg" style="margin-top:16px" data-go>${esc(t('share.share'))}</button>
    <button class="btn ghost block" style="margin-top:10px" data-save>${esc(t('share.save'))}</button></div>`);
  let canvas = null, n = 0;
  const paint = async () => {
    const me = ++n, route = hasRoute ? (o.hide ? trimRoute(d.route) : d.route) : null;
    const c = await draw({ ...d, route }, o); if (me !== n) return;
    canvas = c; b.querySelector('#sh-img').src = c.toDataURL('image/jpeg', .8);
    b.querySelector('.share-prev').style.aspectRatio = o.format === 'story' ? '9/16' : '4/5';
  };
  b.addEventListener('click', e => {
    const s = e.target.closest('[data-style],[data-format]'); if (!s) return;
    const k = s.dataset.style ? 'style' : 'format'; o[k] = s.dataset[k];
    b.querySelectorAll(`[data-${k}]`).forEach(x => x.setAttribute('aria-pressed', x === s)); paint();
  });
  b.querySelector('#sh-hide')?.addEventListener('change', e => { o.hide = e.target.checked; paint(); });
  const file = async () => new File([await blobOf(canvas)], `hitfat-run-${Date.now()}.png`, { type: 'image/png' });
  const save = async () => { const a = document.createElement('a'); a.href = URL.createObjectURL(await file()); a.download = 'hitfat-run.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast(t('share.saved')); };
  b.querySelector('[data-save]').onclick = () => canvas && save();
  b.querySelector('[data-go]').onclick = async () => {
    if (!canvas) return;
    const f = await file();
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f], text: t('share.text') }); closeSheet(); } catch (e) { /* cancelled */ }
    } else save();
  };
  paint();
}
