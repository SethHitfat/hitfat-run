// Writes preview/programs.json: the same plans as the database seed, for the
// no-login preview mode (js/preview-api.js).
//   node db/seed/preview.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROGRAMS } from './programs.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = PROGRAMS.map(p => ({
  id: p.slug, slug: p.slug, i18n: p.i18n, goal: p.goal, level: p.level, weeks: p.weeks, sessions_per_week: p.sessions_per_week,
  target_distance_m: p.target_distance_m, tier: 'free', status: 'published', sort: p.sort,
  workouts: p.workouts.map(w => ({ id: `${p.slug}-${w.week}-${w.session}`, program_id: p.slug, week: w.week, session: w.session, category: w.category,
    i18n: w.i18n, duration_min: w.duration_min ?? null, distance_m: w.distance_m ?? null, intensity: w.intensity ?? null,
    rpe_min: w.rpe_min ?? null, rpe_max: w.rpe_max ?? null, hr_zone: null, rest_interval: w.rest_interval ?? null, video_url: null, steps: w.steps ?? null })),
}));
mkdirSync(join(root, 'preview'), { recursive: true });
writeFileSync(join(root, 'preview', 'programs.json'), JSON.stringify(out));
console.log(`preview/programs.json: ${out.length} plans, ${out.reduce((n, p) => n + p.workouts.length, 0)} sessions`);
