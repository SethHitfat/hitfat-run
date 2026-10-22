// Share cards: a run or a strength session drawn as an image for Instagram
// Stories, WhatsApp and the feed. Drawn on the device, nothing is uploaded.
// Routes hide their first and last 200 m by default, so a card never shows
// where someone lives.
import { t } from './i18n.js';
import { esc, openSheet, closeSheet, toast } from './ui.js';
import { haversine } from './gps.js';

const Y = '#FFE000', SIZES = { story: [1080, 1920], post: [1080, 1350] };
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
  ctx.shadowColor = 'rgba(255,224,0,.55)'; ctx.shadowBlur = lw * 2.2;
  ctx.strokeStyle = Y; ctx.lineWidth = lw; ctx.beginPath();
  P.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
  ctx.shadowBlur = 0;
  const dot = (p, f) => { ctx.beginPath(); ctx.arc(p[0], p[1], lw * 1.1, 0, Math.PI * 2); ctx.fillStyle = f; ctx.fill(); ctx.lineWidth = lw * .45; ctx.strokeStyle = '#000'; ctx.stroke(); };
  dot(P[0], '#fff'); dot(P[P.length - 1], Y);
  ctx.restore();
}
function wordmark(ctx, x, y, size) {
  ctx.font = `800 ${size}px Inter, sans-serif`; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff';
  ctx.fillText('HITFAT', x, y); const w = ctx.measureText('HITFAT ').width;
  ctx.fillStyle = Y; ctx.fillText('RUN CLUB', x + w, y);
}
function fit(ctx, text, font, max) { let s = font.size; do { ctx.font = `${font.weight} ${s}px ${font.family}`; s -= 4; } while (ctx.measureText(text).width > max && s > 20); }

/**
 * d: { big, unit, title, date, stats: [[value, label] x3], photo, route }
 * o: { style: 'route'|'photo', format: 'story'|'post' }
 */
export async function draw(d, o) {
  const [W, H] = SIZES[o.format], c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'), M = 80;
  try { await Promise.all(['700 200px Oswald', '800 60px Inter', '600 40px Inter'].map(f => document.fonts.load(f))); } catch (e) {}
  const hasRoute = d.route && d.route.length > 1, useRoute = o.style === 'route' && hasRoute;
  // background
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (!useRoute && d.photo) {
    try { cover(ctx, await img(d.photo), W, H); } catch (e) {}
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(.3, 'rgba(0,0,0,.05)'); g.addColorStop(.55, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,.92)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createRadialGradient(W * .8, -H * .05, 0, W * .8, -H * .05, H * .9);
    g.addColorStop(0, '#2a2504'); g.addColorStop(.6, '#000'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 2;
    for (let x = 0; x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 90) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }
  // top: wordmark and date
  wordmark(ctx, M, M + 46, 50);
  ctx.font = '600 34px Inter, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText(d.date, M, M + 104);
  // the stats block, measured from the bottom
  const bigSize = o.format === 'story' ? 300 : 250, statY = H - M - 20, bigY = statY - 170, titleY = bigY - bigSize * .9 - 30;
  if (useRoute) drawRoute(ctx, d.route, M + 20, M + 180, W - 2 * M - 40, titleY - (M + 180) - 70, o.format === 'story' ? 14 : 12);
  ctx.fillStyle = Y; fit(ctx, d.title, { weight: 800, size: 58, family: 'Inter, sans-serif' }, W - 2 * M); ctx.fillText(d.title, M, titleY);
  ctx.font = `700 ${bigSize}px Oswald, sans-serif`; ctx.fillStyle = '#fff'; ctx.fillText(d.big, M - 8, bigY);
  const bw = ctx.measureText(d.big).width;
  ctx.font = '700 64px Oswald, sans-serif'; ctx.fillStyle = Y; ctx.fillText(d.unit, M + bw + 12, bigY);
  // three stats
  const cw = (W - 2 * M) / 3;
  d.stats.forEach(([v, l], i) => {
    const x = M + i * cw;
    ctx.font = '700 72px Oswald, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(v, x, statY - 46);
    ctx.font = '700 26px Inter, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.fillText(l.toUpperCase(), x, statY);
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
