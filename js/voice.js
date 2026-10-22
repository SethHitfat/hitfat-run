// The coach in your ear: spoken cues (speech synthesis) and beeps (Web Audio).
// Browsers only allow audio after a tap, so START calls unlock() first.
import { lang } from './i18n.js';

let ctx = null, voice = null, enabled = true;
export const setVoiceEnabled = v => { enabled = !!v; };

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const vs = speechSynthesis.getVoices(), want = lang() === 'en' ? /^en/i : /^(ms|id)/i;
  voice = vs.find(v => want.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

export function unlock() {
  try { if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } } catch (e) {}
  try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch (e) {}
  pickVoice();
}
export function say(text, force) {
  if ((!enabled && !force) || !('speechSynthesis' in window) || !text) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice ? voice.lang : (lang() === 'en' ? 'en-GB' : 'ms-MY'); if (voice) u.voice = voice; u.rate = 1.02;
    speechSynthesis.speak(u);
  } catch (e) {}
}
export function beep(n = 1, high = false) {
  if (!ctx) return;
  for (let i = 0; i < n; i++) {
    try {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * 0.22;
      o.frequency.value = high ? 1320 : 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.start(t); o.stop(t + 0.18);
    } catch (e) {}
  }
}
/* "6 minit 12 saat" — written out so the speech engine says it naturally */
export function spokenDuration(sec, t) {
  sec = Math.round(sec); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return [h && t('voice.hours', { n: h }), m && t('voice.minutes', { n: m }), (s && !h) && t('voice.seconds', { n: s })].filter(Boolean).join(' ') || t('voice.seconds', { n: 0 });
}
