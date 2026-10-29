// Onboarding → plan matching.   node tests/recommend.test.mjs
globalThis.document = { documentElement: {} }; globalThis.localStorage = { setItem() {}, getItem() {} };
const { recommend } = await import('../js/recommend.js');
let bad = 0; const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) bad++; };
const P = (slug, status = 'published') => ({ slug, status, tier: 'free' });
const live = ['couch-to-5k', 'road-to-5k', 'improve-5k', 'road-to-10k'].map(s => P(s));
const withNew = [...live, P('road-to-hyrox'), P('road-to-21k')], withDrafts = [...live, P('road-to-hyrox', 'draft'), P('road-to-21k', 'draft')];
const r = (goal, cm, progs, extra = {}) => recommend({ goal, continuous_run_min: cm, ...extra }, progs);
ok(r('hyrox', 30, withNew).pick.slug === 'road-to-hyrox', 'HYROX + 30 min → Menuju HYROX once published');
ok(r('half', 60, withNew).pick.slug === 'road-to-21k', 'half + 60 min → Menuju 21KM once published');
ok(r('half', 40, withNew).pick.slug === 'road-to-10k' && /60 minit/.test(r('half', 40, withNew).note), 'half + 40 min → 10KM first, with a note on the 60 minutes needed');
ok(r('hyrox', 15, withNew).pick.slug === 'road-to-5k', 'HYROX + 15 min → 5KM base first');
let x = r('hyrox', 30, withDrafts);
ok(x.wanted === 'road-to-hyrox' && x.pick.slug === 'road-to-10k' && /disemak coach/.test(x.note), 'HYROX plan still a draft → 10KM meanwhile, says it is in coach review');
x = r('half', 60, withDrafts);
ok(x.pick.slug === 'road-to-10k' && /disemak coach/.test(x.note), 'half plan still a draft → 10KM meanwhile');
ok(!r('hyrox', 30, withDrafts).others.some(p => p.status !== 'published'), 'drafts are never offered as alternatives');
ok(r('hyrox', 30, withNew, { has_limitations: true }).pick.slug === 'road-to-hyrox', 'limitations only step down below 20 minutes');
ok(r('first_5k', 15, withNew).pick.slug === 'road-to-5k' && r('start', 0, withNew).pick.slug === 'couch-to-5k', 'existing goals unchanged');
if (bad) { console.error(`${bad} recommend problems`); process.exit(1); }
console.log('recommend ok');
