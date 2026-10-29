// Running weather: temperature, humidity, feels-like and UV from Open-Meteo
// (no key needed for non-commercial use), a heat index level and the coolest
// hour to run today. Location is rounded to about 1 km before it is sent;
// without permission, Kota Bharu is used. Answers are kept for 30 minutes.
const API = 'https://api.open-meteo.com/v1/forecast';
const API_KEY = '';   // Open-Meteo commercial plan: put the key here (and use customer-api.open-meteo.com)
const KOTA_BHARU = { lat: 6.13, lon: 102.24, here: false };
const CACHE = 'hfrun_wx', GEO_OK = 'hfrun_wx_geo', TTL = 30 * 6e4;

export const LEVELS = ['safe', 'caution', 'danger'];

/** Heat index (°C) from air temperature (°C) and relative humidity (%): NOAA's Rothfusz regression. */
export function heatIndex(tC, rh) {
  const T = tC * 9 / 5 + 32;
  let hi = 0.5 * (T + 61 + (T - 68) * 1.2 + rh * 0.094);
  if ((hi + T) / 2 >= 80) {
    hi = -42.379 + 2.04901523 * T + 10.14333127 * rh - 0.22475541 * T * rh - 6.83783e-3 * T * T - 5.481717e-2 * rh * rh
      + 1.22874e-3 * T * T * rh + 8.5282e-4 * T * rh * rh - 1.99e-6 * T * T * rh * rh;
    if (rh < 13 && T >= 80 && T <= 112) hi -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    else if (rh > 85 && T >= 80 && T <= 87) hi += ((rh - 85) / 10) * ((87 - T) / 5);
  }
  return (hi - 32) * 5 / 9;
}
/** 0 safe (< 32 °C), 1 caution (32–40 °C), 2 danger (41 °C and above): NOAA's bands, run-sized. */
export const levelOf = hiC => hiC >= 41 ? 2 : hiC >= 32 ? 1 : 0;

/** The coolest single hour between 05:00 and 21:00, from now on today (tomorrow once today is over). */
export function bestHour(hourly, now = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  const day = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const pick = (d, fromHour) => {
    let best = null;
    hourly.time.forEach((t, i) => {
      const h = +t.slice(11, 13);
      if (t.slice(0, 10) !== day(d) || h < Math.max(5, fromHour) || h > 20) return;   // a window starting at 20:00 ends at 21:00
      const a = hourly.apparent_temperature[i];
      if (a != null && (!best || a < best.feels)) best = { hour: h, feels: a, temp: hourly.temperature_2m[i], uv: hourly.uv_index?.[i] ?? null, date: t.slice(0, 10) };
    });
    return best;
  };
  const today = pick(now, now.getMinutes() > 30 ? now.getHours() + 1 : now.getHours());
  if (today) return { ...today, tomorrow: false };
  const tm = new Date(now); tm.setDate(tm.getDate() + 1);
  const t2 = pick(tm, 0);
  return t2 ? { ...t2, tomorrow: true } : null;
}

function readCache() { try { const c = JSON.parse(localStorage.getItem(CACHE) || 'null'); return c && Date.now() - c.at < TTL ? c : null; } catch (e) { return null; } }

async function where() {
  if (!('geolocation' in navigator)) return KOTA_BHARU;
  // only once the runner has tapped "use my location" for the weather (a GPS run's permission is not enough)
  let allowed = false;
  try { allowed = localStorage.getItem(GEO_OK) === '1'; } catch (e) {}
  try { const p = await navigator.permissions?.query({ name: 'geolocation' }); if (p?.state === 'denied') allowed = false; } catch (e) {}
  if (!allowed) return KOTA_BHARU;
  return new Promise(ok => navigator.geolocation.getCurrentPosition(
    p => ok({ lat: Math.round(p.coords.latitude * 100) / 100, lon: Math.round(p.coords.longitude * 100) / 100, here: true }),
    () => ok(KOTA_BHARU), { enableHighAccuracy: false, maximumAge: 30 * 6e4, timeout: 8000 }));
}
/** The runner taps "use my location": ask once, remember the yes. */
export async function useMyLocation() {
  return new Promise(ok => navigator.geolocation.getCurrentPosition(
    () => { try { localStorage.setItem(GEO_OK, '1'); localStorage.removeItem(CACHE); } catch (e) {} ok(true); },
    () => ok(false), { enableHighAccuracy: false, maximumAge: 30 * 6e4, timeout: 10000 }));
}

/** Today's running weather, or null when there is none to show (offline, error). */
export async function getWeather() {
  const c = readCache();
  if (c) return summarise(c.data, c.place);
  if (!navigator.onLine) return null;
  const place = await where();
  const q = new URLSearchParams({ latitude: place.lat, longitude: place.lon, timezone: 'auto', forecast_days: '2',
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,uv_index',
    hourly: 'temperature_2m,relative_humidity_2m,apparent_temperature,uv_index', ...(API_KEY ? { apikey: API_KEY } : {}) });
  try {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(`${API}?${q}`, { signal: ctl.signal }); clearTimeout(timer);
    if (!r.ok) return null;
    const data = await r.json();
    if (!data.current || !data.hourly) return null;
    try { localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), data, place })); } catch (e) {}
    return summarise(data, place);
  } catch (e) { return null; }
}

export function summarise(data, place) {
  const cur = data.current, hi = heatIndex(cur.temperature_2m, cur.relative_humidity_2m);
  return { temp: cur.temperature_2m, rh: cur.relative_humidity_2m, feels: cur.apparent_temperature, uv: cur.uv_index,
    heatIndex: hi, level: levelOf(hi), best: bestHour(data.hourly), here: !!place?.here };
}
