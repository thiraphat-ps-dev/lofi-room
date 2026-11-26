// Festivals on the real calendar, in every scene: fireworks for the new year (heaviest round
// midnight), lights strung up for Christmas, sky lanterns for Loy Krathong and Yi Peng, red lanterns
// and firecrackers for Chinese New Year, splashes of water for Songkran.
//
// What floats in the sky is drawn by weather.js inside the scene's open sky (behind a window frame
// in the room and the café); what hangs at the top of the picture is drawn over everything.
// `?festival=newyear` in the address (or LofiScenes.festival('newyear')) shows one on any day.

import { W, H, ctxRef, tod, px, sfx, rng, moonPhase } from './kit.js';

// Chinese New Year's day, by year (month 0-11, day)
const CNY = { 2027: [1, 6], 2028: [0, 26], 2029: [1, 13], 2030: [1, 3], 2031: [0, 23], 2032: [1, 11] };

const dayMs = 864e5;
const at = (y, m, d, h = 0) => new Date(y, m, d, h).getTime();

/** Loy Krathong: the full moon that falls in November (the night it is closest to full). */
function loyKrathong(y) {
  let best = null;
  for (let d = at(y, 9, 28, 21); d < at(y, 10, 30, 21); d += dayMs) {
    const off = Math.abs(moonPhase(new Date(d)) - 0.5);
    if (!best || off < best.off) best = { d, off };
  }
  return new Date(best.d);
}

/** The festival on at `date`, or null. */
export function festivalAt(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const ms = date.getTime();
  if ((m === 11 && d === 31 && date.getHours() >= 17) || (m === 0 && d === 1 && date.getHours() < 3)) return 'newyear';
  if (m === 11 && d >= 20 && d <= 26) return 'christmas';
  if (m === 3 && d >= 13 && d <= 15) return 'songkran';
  const lk = loyKrathong(y);
  if (ms >= at(y, lk.getMonth(), lk.getDate() - 1) && ms < at(y, lk.getMonth(), lk.getDate() + 2)) return 'loykrathong';
  const c = CNY[y];
  if (c && ms >= at(y, c[0], c[1] - 1) && ms < at(y, c[0], c[1] + 3)) return 'cny';
  return null;
}
export const FESTIVALS = ['newyear', 'christmas', 'loykrathong', 'cny', 'songkran'];

/** Minutes from midnight on New Year's Eve (negative before), for the countdown and the big show. */
export function toMidnight(date = new Date()) {
  const next = date.getMonth() === 11 ? at(date.getFullYear() + 1, 0, 1) : at(date.getFullYear(), 0, 1);
  return (date.getTime() - next) / 60000;
}

let held = null; // a festival shown on any day (preview), or null for the calendar
const rand = rng(1225);
const st = {
  id: null,
  shells: [],
  sparks: [],
  wait: 12 * 2,
  lanterns: [],
  lanternWait: 0,
  drops: [],
  dropWait: 12 * 3,
  crackerWait: 12 * 15,
  flash: 0,
  pops: [], // the bright core of a burst, for a few frames
};
let rects = null; // { open, box, area } from the weather

export function holdFestival(id) {
  held = FESTIVALS.includes(id) ? id : null;
  return festivalNow();
}
export function festivalNow() {
  return held || festivalAt();
}
const night = () => tod === 'night' || tod === 'dusk';

/** Called when the scene is (re)built, with the sky rectangles the weather worked out. */
export function buildFestival(r) {
  rects = r;
  st.shells = [];
  st.sparks = [];
  st.drops = [];
  if (st.lanterns.length && rects) for (const l of st.lanterns) l.x = rects.box.x + rand() * rects.box.w;
}

// ------------------------------------------------------------------ stepping

const FW = ['#ff5a6a', '#ffd24a', '#6ad8ff', '#9dff7a', '#ff8ad8', '#ffffff', '#ffb04a', '#b58cff'];

function launch() {
  const [ox, oy, ow, oh] = rects.open;
  const kind = rand() < 0.2 ? 'willow' : rand() < 0.35 ? 'ring' : 'peony';
  st.shells.push({
    x: ox + ow * (0.1 + rand() * 0.8),
    y: oy + oh + 12,
    vy: -(4.2 + rand() * 1.6),
    burstY: oy + oh * (0.25 + rand() * 0.35),
    col: FW[Math.floor(rand() * FW.length)],
    col2: rand() < 0.4 ? FW[Math.floor(rand() * FW.length)] : null,
    kind,
    r: Math.min(34, Math.max(16, oh * 0.5)),
  });
  sfx('firework');
}

function burst(sh) {
  const n = sh.kind === 'ring' ? 40 : 70 + Math.floor(rand() * 20);
  const speed = sh.r / 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.2;
    const v = speed * (sh.kind === 'ring' ? 1 : 0.4 + rand() * 0.6);
    st.sparks.push({
      x: sh.x,
      y: sh.y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: sh.kind === 'willow' ? 30 + rand() * 10 : 18 + rand() * 10,
      max: 0,
      col: sh.kind === 'willow' ? '#ffd27a' : i % 2 && sh.col2 ? sh.col2 : sh.col,
      g: sh.kind === 'willow' ? 0.07 : 0.04,
    });
    st.sparks[st.sparks.length - 1].max = st.sparks[st.sparks.length - 1].life;
  }
  st.flash = 1;
  st.pops.push({ x: sh.x, y: sh.y, life: 3, col: sh.col });
}

export function stepFestival() {
  const id = festivalNow();
  st.id = id;
  if (!rects) return;
  // fireworks: on New Year's Eve, thick round midnight; a few at Chinese New Year
  const fireworks = night() && (id === 'newyear' || id === 'cny');
  if (fireworks && --st.wait <= 0) {
    const m = held ? -1 : toMidnight();
    const peak = id === 'newyear' && Math.abs(m) < 12;
    st.wait = 12 * (peak ? 0.4 + rand() * 0.9 : id === 'newyear' ? 2 + rand() * 4 : 5 + rand() * 9);
    launch();
    if (peak && rand() < 0.4) launch();
  }
  for (const sh of st.shells) {
    sh.y += sh.vy;
    sh.vy += 0.12;
    if (sh.y <= sh.burstY || sh.vy > -1) {
      sh.done = true;
      burst(sh);
    }
  }
  st.shells = st.shells.filter((s) => !s.done);
  for (const p of st.sparks) {
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.95;
    p.vy = p.vy * 0.95 + p.g;
    p.life--;
  }
  st.sparks = st.sparks.filter((p) => p.life > 0);
  if (st.flash > 0) st.flash = Math.max(0, st.flash - 0.25);
  st.pops = st.pops.filter((p) => --p.life > 0);

  // sky lanterns rising for Loy Krathong / Yi Peng
  if (id === 'loykrathong' && night()) {
    const { box } = rects;
    const spawn = (y, f) =>
      st.lanterns.push({
        x: box.x + rand() * box.w,
        y,
        vy: -(0.1 + rand() * 0.18),
        vx: (rand() - 0.5) * 0.06,
        p: rand() * 7,
        f,
        big: rand() < 0.35,
      });
    // the first evening of it: a sky already scattered with lanterns, not an empty one filling up
    if (!st.lanterns.length) for (let i = 0; i < 40; i++) spawn(box.y + box.h * (0.05 + rand() * 0.7), 24);
    if (--st.lanternWait <= 0 && st.lanterns.length < 90) {
      st.lanternWait = 12 * (0.2 + rand() * 0.6);
      spawn(box.y + box.h * (0.45 + rand() * 0.25), 0);
    }
  }
  for (const l of st.lanterns) {
    l.y += l.vy;
    l.x += l.vx + Math.sin(l.f / 40 + l.p) * 0.04;
    l.f++;
  }
  st.lanterns = st.lanterns.filter((l) => l.y > (rects.box.y || 0) - 6 && (id === 'loykrathong' || l.f < 12 * 4));

  // Songkran: someone just out of view throws a bowl of water
  if (id === 'songkran' && !night() && --st.dropWait <= 0) {
    st.dropWait = 12 * (3 + rand() * 6);
    const left = rand() < 0.5;
    for (let i = 0; i < 30; i++)
      st.drops.push({ x: left ? -2 : W + 2, y: H * (0.55 + rand() * 0.25), vx: (left ? 1 : -1) * (2 + rand() * 4), vy: -(2.5 + rand() * 3), life: 30 });
  }
  for (const d of st.drops) {
    d.x += d.vx;
    d.y += d.vy;
    d.vy += 0.3;
    d.life--;
  }
  st.drops = st.drops.filter((d) => d.life > 0 && d.y < H + 4);

  // firecrackers going off somewhere at Chinese New Year
  if (id === 'cny' && --st.crackerWait <= 0) {
    st.crackerWait = 12 * (18 + rand() * 25);
    sfx('crackers');
  }
}

// ------------------------------------------------------------------ drawing

/** Fireworks, inside the open sky (weather.js has clipped to it). */
export function drawFestivalSky(c) {
  if (!st.shells.length && !st.sparks.length && !st.pops.length) return;
  if (st.flash > 0) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(90, 70, 110, ${st.flash * 0.12})`;
    c.fillRect(...rects.open);
    c.restore();
  }
  for (const p of st.pops) {
    const r = 4 - p.life;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = p.col;
    c.globalAlpha = 0.5;
    c.fillRect(Math.round(p.x) - r, Math.round(p.y) - r, r * 2 + 1, r * 2 + 1);
    c.globalAlpha = 1;
    c.fillStyle = '#ffffff';
    c.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3);
    c.restore();
  }
  for (const sh of st.shells) {
    px(Math.round(sh.x), Math.round(sh.y), 1, 2, '#fff2d0');
    px(Math.round(sh.x), Math.round(sh.y) + 3, 1, 2, 'rgba(255, 220, 160, 0.4)');
  }
  c.save();
  c.globalCompositeOperation = 'lighter'; // sparks add up where they cross, like light does
  for (const p of st.sparks) {
    const k = p.life / p.max;
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    c.globalAlpha = Math.min(1, k * 1.8);
    px(x, y, k > 0.3 ? 2 : 1, k > 0.3 ? 2 : 1, p.col);
    c.globalAlpha = Math.min(1, k * 1.8) * 0.35;
    px(Math.round(x - p.vx * 1.5), Math.round(y - p.vy * 1.5), 1, 1, p.col); // a short tail
    if (k < 0.5 && (p.life + x) % 3 === 0) {
      c.globalAlpha = 1;
      px(x, y, 1, 1, '#ffffff'); // glitter as it dies
    }
  }
  c.restore();
}

/** Sky lanterns, inside the outside area (weather.js has clipped to it). */
export function drawLanterns(c, t) {
  for (const l of st.lanterns) {
    const fade = Math.min(1, l.f / 24);
    const high = 1 - Math.max(0, Math.min(1, (l.y - rects.box.y) / (rects.box.h * 0.8)));
    const small = l.big ? high > 0.75 : high > 0.45; // far up, they shrink to a point
    const x = Math.round(l.x);
    const y = Math.round(l.y);
    const fl = 0.75 + 0.25 * Math.sin(t / 130 + l.p * 5);
    c.globalAlpha = fade * (1 - high * 0.45);
    if (small) {
      px(x, y, 1, 1, '#ffc36a');
    } else {
      const w = l.big ? 3 : 2;
      px(x - 2, y - 2, w + 4, w + 5, `rgba(255, 140, 50, ${0.12 * fl})`); // the glow round it
      px(x - 1, y - 1, w + 2, w + 3, `rgba(255, 160, 70, ${0.22 * fl})`);
      px(x, y, w, w + 1, '#ffae4a'); // the paper, lit from inside
      px(x, y, w, 1, '#ffe2a8');
      px(x + Math.floor(w / 2), y + w, 1, 1, '#fff4d0'); // the flame at the open bottom
    }
    c.globalAlpha = 1;
  }
}

/** What hangs over the whole picture: Christmas lights, red lanterns, flying water. */
export function drawFestivalFront(t) {
  const id = st.id;
  if (!id) return;
  const c = ctxRef;
  if (id === 'christmas') {
    // a string of lights sagging across the top, twinkling in turns
    const cols = ['#ff5a5a', '#ffd24a', '#5ad1ff', '#7dff7a', '#ff8ad8'];
    const span = Math.max(80, Math.round(W / 4));
    const sag = (x) => 5 + Math.round(Math.sin(((((x % span) + span) % span) / span) * Math.PI) * 9);
    for (let x = 0; x < W; x++) px(x, sag(x), 1, 1, '#1c2a1e');
    const tick = Math.floor(t / 650);
    for (let i = 0, x = 6; x < W; i++, x += 12) {
      const y = sag(x) + 1;
      const on = (i + tick) % 3 !== 0;
      const col = cols[i % cols.length];
      if (on && night()) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = col + '30';
        c.fillRect(x - 3, y - 1, 7, 7);
        c.restore();
      }
      px(x, y, 2, 3, on ? col : '#3a3a40');
      px(x, y - 1, 2, 1, '#2a2a2a');
    }
  }
  if (id === 'cny') {
    // red lanterns hanging from the top, swaying a little
    const n = Math.max(2, Math.round(W / 170));
    for (let i = 0; i < n; i++) {
      const x0 = Math.round(((i + 0.5) / n) * W);
      const len = 14 + ((i * 7) % 3) * 8;
      const sway = Math.round(Math.sin(t / 1400 + i * 1.7) * 2);
      const cx = x0 + sway;
      const cy = len + 6;
      for (let y = 0; y < len; y++) px(x0 + Math.round((sway * y) / len), y, 1, 1, '#3a1a1a');
      if (night()) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = 'rgba(255, 70, 40, 0.12)';
        c.beginPath();
        c.arc(cx, cy, 14, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
      for (let y = -5; y <= 5; y++) {
        const half = Math.round(Math.sqrt(1 - (y / 6) ** 2) * 7);
        px(cx - half, cy + y, half * 2 + 1, 1, y < -2 ? '#ff4a3a' : '#d8282c');
      }
      for (const dx of [-3, 0, 3]) px(cx + dx, cy - 4, 1, 9, '#a81a22'); // ribs
      px(cx - 3, cy - 6, 7, 1, '#f2c14e');
      px(cx - 3, cy + 6, 7, 1, '#f2c14e');
      px(cx, cy + 7, 1, 5, '#e8b030');
      px(cx - 1, cy + 11, 3, 2, '#d8282c');
    }
  }
  if (st.drops.length) {
    for (const d of st.drops) px(Math.round(d.x), Math.round(d.y), d.life > 20 ? 2 : 1, d.life > 20 ? 2 : 1, d.life % 4 ? 'rgba(190, 232, 255, 0.85)' : '#ffffff');
  }
}

/** Is there anything in the sky to draw? (So weather.js can skip the clip otherwise.) */
export const festivalSky = () => st.shells.length > 0 || st.sparks.length > 0 || st.pops.length > 0 || st.lanterns.length > 0;
