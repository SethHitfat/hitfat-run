// Strength, mobility and drills for runners: app content, not database rows.
// Every move is a HITFAT video on Vimeo (the same library as HITFAT Hybrid);
// img/mv/<id>.jpg is its poster frame. Sessions are timed: work, rest, rounds.
// The database only records which session a runner finished (run_strength_logs).
import { L } from './i18n.js';

/* sides: one-sided moves; the coach calls the switch halfway through */
export const MOVES = {
  squat:      { v: '1183237084', ms: ['Squat', 'Lutut ikut arah jari kaki, dada tegak.'], en: ['Squat', 'Knees track over toes, chest tall.'] },
  revlunge:   { v: '1183237088', ms: ['Lunge Belakang', 'Langkah ke belakang, lutut depan stabil atas buku lali.'], en: ['Reverse Lunge', 'Step back, front knee steady over the ankle.'] },
  altlunge:   { v: '1183237083', ms: ['Lunge Bersilih', 'Kawal turun, tolak balik dengan tumit.'], en: ['Alternating Lunge', 'Control the drop, drive back through the heel.'] },
  sidelunge:  { v: '1183237100', ms: ['Lunge Sisi', 'Punggung ke belakang, kaki lurus sebelah lagi.'], en: ['Side Lunge', 'Hips back, the other leg straight.'] },
  wlunge:     { v: '1183237086', ms: ['Lunge Berjalan', 'Langkah panjang, badan tegak.'], en: ['Walking Lunge', 'Long steps, tall torso.'] },
  bulgarian:  { v: '1183237106', ms: ['Bulgarian Split Squat', 'Kaki belakang atas kerusi. Ganti kaki separuh masa.'], en: ['Bulgarian Split Squat', 'Back foot on a chair. Switch legs halfway.'], sides: true },
  stepup:     { v: '1183237101', ms: ['Step Up', 'Naik kerusi atau kotak, tolak dengan kaki atas.'], en: ['Step Up', 'Chair or box, push through the top leg.'], sides: true },
  wallsit:    { v: '1183237107', ms: ['Wall Sit', 'Peha selari lantai, tahan.'], en: ['Wall Sit', 'Thighs parallel to the floor, hold.'] },
  glute:      { v: '1183237116', ms: ['Glute Bridge Satu Kaki', 'Picit punggung di atas. Ganti kaki separuh masa.'], en: ['Single-Leg Glute Bridge', 'Squeeze at the top. Switch legs halfway.'], sides: true },
  hipthrust:  { v: '1183237118', ms: ['Hip Thrust', 'Belakang atas sofa, pinggul naik penuh.'], en: ['Hip Thrust', 'Upper back on the sofa, full hip lift.'] },
  squatpulse: { v: '1183237070', ms: ['Squat Pulse', 'Kekal rendah, denyut kecil.'], en: ['Squat Pulse', 'Stay low, small pulses.'] },
  pushup:     { v: '1183253182', ms: ['Push Up', 'Badan lurus macam papan. Guna lutut jika perlu.'], en: ['Push Up', 'Body straight as a plank. Drop to knees if needed.'] },
  shouldertap:{ v: '1183253142', ms: ['Plank Sentuh Bahu', 'Pinggul tak bergoyang.'], en: ['Plank Shoulder Tap', 'Hips stay still.'] },
  mtnclimb:   { v: '1183253091', ms: ['Mountain Climber', 'Lutut laju ke dada, bahu atas tangan.'], en: ['Mountain Climber', 'Knees drive fast, shoulders over hands.'] },
  bearwalk:   { v: '1183253122', ms: ['Bear Walk', 'Lutut rendah, belakang rata.'], en: ['Bear Walk', 'Knees low, back flat.'] },
  plank:      { v: '1183253120', ms: ['Plank', 'Perut ketat, jangan biar pinggul jatuh.'], en: ['Plank', 'Brace hard, don’t let the hips sag.'] },
  sideplank:  { v: '1183253111', ms: ['Plank Sisi', 'Pinggul tinggi. Tukar sisi separuh masa.'], en: ['Side Plank', 'Hips high. Switch sides halfway.'], sides: true },
  deadbug:    { v: '1183253124', ms: ['Dead Bug', 'Belakang bawah rapat ke lantai.'], en: ['Dead Bug', 'Low back pressed to the floor.'] },
  birddog:    { v: '1183253105', ms: ['Bird Dog', 'Tangan dan kaki bertentangan, perlahan dan kawal.'], en: ['Bird Dog', 'Opposite arm and leg, slow and controlled.'] },
  hollow:     { v: '1183253094', ms: ['Hollow Hold', 'Belakang bawah rapat, badan macam pisang.'], en: ['Hollow Hold', 'Low back down, banana shape.'] },
  russian:    { v: '1183253093', ms: ['Russian Twist', 'Pusing dari dada, bukan tangan sahaja.'], en: ['Russian Twist', 'Rotate from the chest, not just the arms.'] },
  legraise:   { v: '1183253095', ms: ['Leg Raise', 'Turun perlahan, belakang tak melengkung.'], en: ['Leg Raise', 'Lower slowly, no arching.'] },
  jj:         { v: '1183253175', ms: ['Jumping Jack', 'Ringan atas hujung kaki.'], en: ['Jumping Jack', 'Light on the balls of your feet.'] },
  highknee:   { v: '1183253177', ms: ['High Knees', 'Lutut ke paras pinggul, tangan macam berlari.'], en: ['High Knees', 'Knees to hip height, run with the arms.'] },
  buttkick:   { v: '1218622514', ms: ['Butt Kick', 'Tumit ke punggung, kadens laju.'], en: ['Butt Kick', 'Heels to glutes, quick cadence.'] },
  fastfeet:   { v: '1183253170', ms: ['Fast Feet', 'Langkah kecil secepat mungkin.'], en: ['Fast Feet', 'Tiny steps, as quick as you can.'] },
  askip:      { v: '1218622513', ms: ['A-Skip', 'Lutut naik, kaki mendarat bawah pinggul.'], en: ['A-Skip', 'Knee up, foot lands under the hip.'] },
  bskip:      { v: '1218622515', ms: ['B-Skip', 'Lutut naik, kaki tarik ke bawah macam cakar.'], en: ['B-Skip', 'Knee up, extend and paw the ground back.'] },
  abc:        { v: '1218622559', ms: ['Drill A-B-C', 'Rentak A, B, C berturut-turut. Postur tinggi.'], en: ['A-B-C Drill', 'A, B and C in sequence. Run tall.'] },
  kicking:    { v: '1218622516', ms: ['Kicking Drill', 'Kaki lurus ke depan, tarik balik ke bawah pinggul.'], en: ['Kicking Drill', 'Straight-leg reach, pull back under the hip.'] },
  skater:     { v: '1183253172', ms: ['Skater Jump', 'Mendarat satu kaki, stabil sebelum lompat.'], en: ['Skater Jump', 'Land on one leg, stick it, go again.'] },
  squatjump:  { v: '1183253180', ms: ['Squat Jump', 'Lompat letup, mendarat lembut.'], en: ['Squat Jump', 'Explode up, land soft.'] },
  lungejump:  { v: '1183253154', ms: ['Jump Lunge', 'Tukar kaki di udara, lutut depan stabil.'], en: ['Jump Lunge', 'Switch in the air, front knee stable.'] },
  broadjump:  { v: '1183253161', ms: ['Broad Jump', 'Hayun tangan, lompat jauh ke depan.'], en: ['Broad Jump', 'Swing the arms, jump far forward.'] },
  powerskip:  { v: '1183253156', ms: ['Power Skip', 'Skip setinggi mungkin, lutut dan tangan bertentangan.'], en: ['Power Skip', 'Skip for height, opposite arm and knee.'] },
  tuckjump:   { v: '1183253171', ms: ['Tuck Jump', 'Lutut ke dada, mendarat senyap.'], en: ['Tuck Jump', 'Knees to chest, land quietly.'] },
  sprintspot: { v: '1183253163', ms: ['Pecut Setempat', 'Tangan laju, condong sedikit ke depan.'], en: ['Sprint on the Spot', 'Fast arms, slight forward lean.'] },
  bp_squat:   { v: '1183253127', ms: ['Squat Beg Galas', 'Beg di dada atau belakang, dada tegak.'], en: ['Backpack Squat', 'Pack on chest or back, chest tall.'] },
  bp_deadlift:{ v: '1183253123', ms: ['Deadlift Beg Galas', 'Engsel pinggul, belakang rata.'], en: ['Backpack Deadlift', 'Hinge at the hips, flat back.'] },
  bp_lunge:   { v: '1183253130', ms: ['Lunge Beg Galas', 'Langkah stabil, lutut tak masuk ke dalam.'], en: ['Backpack Lunge', 'Steady steps, knee doesn’t cave in.'] },
  bp_goodmorning: { v: '1183253126', ms: ['Good Morning Beg Galas', 'Lutut lembut, rasa regangan hamstring.'], en: ['Backpack Good Morning', 'Soft knees, feel the hamstrings.'] },
  bottle_row: { v: '1183253141', ms: ['Row Botol', 'Tarik siku ke belakang, picit belikat.'], en: ['Bottle Row', 'Elbows back, squeeze the shoulder blades.'] },
  bottle_press: { v: '1183253145', ms: ['Tekan Bahu Botol', 'Perut ketat, tekan lurus ke atas.'], en: ['Bottle Shoulder Press', 'Brace, press straight up.'] },
};

export const FOCI = ['all', 'legs', 'core', 'injury', 'drills', 'power'];
export const WORKOUTS = [
  { key: 'panas-badan', img: '/img/run-track.jpg', focus: ['drills'], level: 'beginner', rounds: 1, work: 40, rest: 10, roundRest: 0,
    moves: ['jj', 'wlunge', 'highknee', 'buttkick', 'askip', 'skater', 'fastfeet'],
    ms: { title: 'Panas Badan Pra-Larian', desc: 'Enam minit sebelum setiap larian: sendi bergerak, nadi naik, kaki sedia.', equip: 'Tiada alat' },
    en: { title: 'Pre-Run Warm-Up', desc: 'Six minutes before every run: joints moving, heart rate up, legs ready.', equip: 'No equipment' } },
  { key: 'kaki-pelari', img: '/img/str-legs.jpg', focus: ['legs'], level: 'beginner', rounds: 3, work: 40, rest: 20, roundRest: 60,
    moves: ['squat', 'revlunge', 'glute', 'sidelunge', 'stepup', 'wallsit'],
    ms: { title: 'Kaki Pelari', desc: 'Kuatkan quad, glute dan hamstring supaya langkah kekal kuat di kilometer terakhir.', equip: 'Kerusi' },
    en: { title: 'Runner Legs', desc: 'Quads, glutes and hamstrings strong enough to hold your stride in the last kilometre.', equip: 'Chair' } },
  { key: 'core-pelari', img: '/img/str-core.jpg', focus: ['core'], level: 'beginner', rounds: 2, work: 30, rest: 15, roundRest: 45,
    moves: ['deadbug', 'birddog', 'plank', 'sideplank', 'hollow', 'russian'],
    ms: { title: 'Core Pelari', desc: 'Badan stabil bermakna kurang tenaga terbuang. Postur kekal tinggi bila penat.', equip: 'Tiada alat' },
    en: { title: 'Runner Core', desc: 'A stable trunk wastes less energy and keeps you tall when you tire.', equip: 'No equipment' } },
  { key: 'kalis-cedera', img: '/img/str-mobility.jpg', focus: ['injury', 'legs'], level: 'beginner', rounds: 2, work: 40, rest: 20, roundRest: 60,
    moves: ['glute', 'hipthrust', 'sidelunge', 'bulgarian', 'birddog', 'sideplank'],
    ms: { title: 'Kalis Kecederaan', desc: 'Glute, pinggul dan lutut: kawasan yang paling kerap cedera pada pelari. Buat dua kali seminggu.', equip: 'Kerusi atau sofa' },
    en: { title: 'Injury-Proof', desc: 'Glutes, hips and knees, where runners get hurt most. Do it twice a week.', equip: 'Chair or sofa' } },
  { key: 'drill-larian', img: '/img/str-drills.jpg', focus: ['drills'], level: 'intermediate', rounds: 2, work: 30, rest: 30, roundRest: 60,
    moves: ['highknee', 'buttkick', 'askip', 'bskip', 'abc', 'kicking', 'fastfeet'],
    ms: { title: 'Drill Larian', desc: 'Teknik langkah yang lebih cekap: kadens, angkat lutut, pendaratan bawah pinggul. Bagus sebelum sesi laju.', equip: 'Ruang 20 meter' },
    en: { title: 'Running Drills', desc: 'A more efficient stride: cadence, knee lift, landing under the hip. Great before speed sessions.', equip: '20 metres of space' } },
  { key: 'kuasa-pecut', img: '/img/str-power.jpg', focus: ['power'], level: 'intermediate', rounds: 3, work: 20, rest: 40, roundRest: 60,
    moves: ['squatjump', 'skater', 'lungejump', 'broadjump', 'powerskip', 'tuckjump'],
    ms: { title: 'Kuasa & Pecut', desc: 'Pliometrik untuk kaki yang lebih reaktif dan pecutan akhir yang lebih laju. Mendarat lembut.', equip: 'Tiada alat' },
    en: { title: 'Power & Speed', desc: 'Plyometrics for springier legs and a faster finishing kick. Land softly.', equip: 'No equipment' } },
  { key: 'badan-penuh', img: '/img/str-home.jpg', focus: ['legs', 'core'], level: 'intermediate', rounds: 3, work: 40, rest: 20, roundRest: 60,
    moves: ['squat', 'pushup', 'altlunge', 'shouldertap', 'glute', 'mtnclimb', 'bearwalk'],
    ms: { title: 'Seluruh Badan di Rumah', desc: 'Satu sesi untuk kaki, core dan bahagian atas badan. Sesuai pada hari tiada larian.', equip: 'Tiada alat' },
    en: { title: 'Full Body at Home', desc: 'Legs, core and upper body in one session. Ideal on a non-running day.', equip: 'No equipment' } },
  { key: 'beg-galas', img: '/img/str-backpack.jpg', focus: ['legs'], level: 'intermediate', rounds: 3, work: 40, rest: 20, roundRest: 60,
    moves: ['bp_squat', 'bp_deadlift', 'bp_lunge', 'bp_goodmorning', 'bottle_row', 'bottle_press'],
    ms: { title: 'Beg Galas & Botol', desc: 'Kekuatan berbeban tanpa gim: isi beg dengan buku, guna botol air sebagai dumbbell.', equip: 'Beg galas, 2 botol air' },
    en: { title: 'Backpack & Bottles', desc: 'Loaded strength with no gym: fill a backpack with books, use water bottles as dumbbells.', equip: 'Backpack, 2 water bottles' } },
];
export const byKey = k => WORKOUTS.find(w => w.key === k) || null;
export const GET_READY = 10;

/** The session as a flat timeline: get ready, then work and rest for every move, every round. */
export function timeline(w) {
  const out = [{ kind: 'ready', sec: GET_READY, move: w.moves[0], round: 1, i: 0 }];
  for (let r = 1; r <= w.rounds; r++) w.moves.forEach((m, i) => {
    out.push({ kind: 'work', sec: w.work, move: m, round: r, i });
    const last = i === w.moves.length - 1, next = last ? (r < w.rounds ? w.moves[0] : null) : w.moves[i + 1];
    if (!next) return;
    const sec = last ? w.roundRest || w.rest : w.rest;
    if (sec) out.push({ kind: last && w.roundRest ? 'roundRest' : 'rest', sec, move: next, round: last ? r + 1 : r, i: last ? 0 : i + 1 });
  });
  return out;
}
export const totalSec = w => timeline(w).reduce((s, x) => s + x.sec, 0);
export const minutes = w => Math.round(totalSec(w) / 60);
export const title = w => L(w).title;
export const moveName = k => L(MOVES[k])[0];
export const moveCue = k => L(MOVES[k])[1];
export const poster = k => `/img/mv/${MOVES[k].v}.jpg`;
/* the same player options HITFAT Hybrid uses: silent, looping, inline on iPhone */
export const videoSrc = k => `https://player.vimeo.com/video/${MOVES[k].v}?dnt=1&title=0&byline=0&portrait=0&playsinline=1&autoplay=1&muted=1&autopause=0&loop=1&controls=0`;
