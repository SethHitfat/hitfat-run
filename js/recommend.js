// Which plan to recommend from the onboarding answers. Pure, so it can be tested.
import { t } from './i18n.js';

export function recommend(ans, programs) {
  const cm = ans.continuous_run_min || 0, g = ans.goal;
  let slug, note = '';
  if (g === 'start' || g === 'fitness' || cm < 10) slug = 'couch-to-5k';
  else if (g === 'first_5k') slug = 'road-to-5k';
  else if (g === 'improve_5k') slug = cm >= 30 ? 'improve-5k' : 'road-to-5k';
  // HYROX needs about 30 minutes of running, a half marathon about 60; below that, build the base first
  else if (g === 'hyrox') slug = cm >= 30 ? 'road-to-hyrox' : 'road-to-5k';
  else if (g === 'half') slug = cm >= 60 ? 'road-to-21k' : cm >= 30 ? 'road-to-10k' : 'road-to-5k';
  else slug = cm >= 30 ? 'road-to-10k' : 'road-to-5k';
  const goalName = g ? t('goal.' + g) : '';
  if (g === 'marathon') note = t('ob.rec.notYet', { goal: goalName });
  if ((g === 'hyrox' && slug !== 'road-to-hyrox') || (g === 'half' && slug !== 'road-to-21k')) note = t('ob.rec.base', { goal: goalName, n: g === 'hyrox' ? 30 : 60 });
  if (g === 'improve_10k' && slug === 'road-to-10k') note = t('ob.rec.improve10');
  if (ans.has_limitations && slug !== 'couch-to-5k' && cm < 20) slug = 'couch-to-5k';
  const pub = programs.filter(p => p.status === 'published' && p.tier === 'free');
  let pick = pub.find(p => p.slug === slug) || null;
  // a HYROX or 21KM plan still in coach review is not offered yet: the 10KM plan builds toward it meanwhile
  if (!pick && (slug === 'road-to-hyrox' || slug === 'road-to-21k')) { note = t('ob.rec.review', { goal: goalName }); pick = pub.find(p => p.slug === 'road-to-10k') || null; }
  return { pick, others: pub.filter(p => p !== pick), note, wanted: slug };
}
