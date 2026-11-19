// Hand-drawn pixel sprites for the animals: the cat (or fox) asleep, curled up with its tail round
// the front; the owl on the campfire branch; the cat watching the neon city from the rooftop.
// Each sprite is a list of rows, one character per pixel; the letters map to a palette, so one
// drawing can wear different coats.

import { ctxRef, sprite, blit, px } from './kit.js';

// ------------------------------------------------------------------ helpers

/** A copy of `rows` with the pixels in columns x0..x1 moved up by `dy` above row `below`. */
function lift(rows, x0, x1, below, dy = 1) {
  const g = rows.map((r) => r.split(''));
  for (let x = x0; x <= x1; x++) {
    for (let y = 0; y < below; y++) g[y][x] = y + dy < below ? rows[y + dy][x] : rows[below][x];
  }
  return g.map((r) => r.join(''));
}

/** A copy of `rows` with a rectangle replaced by `patch` rows (dots in the patch clear pixels). */
function patch(rows, x, y, p) {
  const g = rows.map((r) => r.split(''));
  p.forEach((line, j) => line.split('').forEach((ch, i) => (g[y + j][x + i] = ch)));
  return g.map((r) => r.join(''));
}

// ------------------------------------------------------------------ the sleeping cat

export const TABBY = {
  pal: { hi: '#f6c088', base: '#e39a52', mid: '#cf8440', dark: '#a8612a', stripe: '#a8612a', cream: '#f5e2c4', creamS: '#dcc3a0', line: '#4a2614' },
  tip: '#a8612a',
  ear: '#cf8440',
};
export const FOX = {
  pal: { hi: '#f9a860', base: '#e27a36', mid: '#c25c20', dark: '#93411a', stripe: '#e27a36', cream: '#f8ecd9', creamS: '#d9c5a8', line: '#2e140a' },
  tip: '#f8ecd9',
  ear: '#2e140a',
};

// o outline · d m b h dark to light (lit from the upper right) · s stripe · w cream · q cream in shade
// p inside of the ears · n nose · t tail tip · k ear tip
// prettier-ignore
const CAT = [
  '...............................o..........o....',
  '..............................oko........oko...',
  '..............................opmo......ompo...',
  '...............ooooooooo.....opbmooooooomppo...',
  '............ooohhhsshhhhoo...ombbbbsbbbbbbho...',
  '..........oohhbbbsshhhhhssoo.obbbbsbbbsbbbbho..',
  '........oosbbbbbssbbbbbsshhooobbbbbbbbbbbbbbho.',
  '.......odsbbbbbssbbbbbssbbhhhobbbbbbbbbbbbbbbo.',
  '......odsbbbbbssbbbbbssbbbbbsobooobbbbbbooobbho',
  '.....odsmbbbbssbbbbbssbbbbbssobbbbbbwwbbbbbbbho',
  '.....odmmbbbssbbbbbssbbbbbssbbobbbbwnnwbbbbbbo.',
  '....odsmmbbbssbbbbbssbbbbbssbbbobbbwwowwbbbbmo.',
  '....oddmmmbssbbbbbssbbbbbssbbbbbommwwwwwwwmmo..',
  '....oddmmmssbbbbbssbbbbbssbbbbbbbooqwwwwwqoo...',
  '....odddmssmmmbbssbbbbbssbbbbbbbbbbowwwwwo.....',
  '....odddmmmmmmmmmmmmmddooooooooooooowwqwwo.....',
  '.....odddmmmmmmddoohshhhshhhshhtttoowwwwwo.....',
  '......oddddmohhhsbbbsbbbsbbbsbbtttoowwwwwo.....',
  '.......ooddobmmmsmmmsmmmsmmmsmmtttooqwqwqo.....',
  '.........ooooooooooooooooooooooooooooooooo.....',
];

// prettier-ignore
const FOX_ROWS = [
  '...............................o..........o....',
  '..............................oko........oko...',
  '..............................opmo......ompo...',
  '...............ooooooooo.....opbmooooooomppo...',
  '............ooohhhhhhhhhoo...ombbbbbbbbbbbho...',
  '..........oohhbbbhhhhhhhhhoo.obbbbbbbbbbbbbho..',
  '........oombbbbbbbbbbbbhhhhooobbbbbbbbbbbbbbho.',
  '.......odmbbbbbbbbbbbbbbbbhhhobbbbbbbbbbbbbbbo.',
  '......odmbbbbbbbbbbbbbbbbbbbhobooobbbbbbooobbho',
  '.....odmmbbbbbbbbbbbbbbbbbbbbobbbbbbwwbbbbbbbho',
  '.....odmmbbbbbbbbbbbbbbbbbbbbbowbbbwnnwbbbbbwo.',
  '....odmmmbbbbbbbbbbbbbbbbbbbbbbobbbwwowwbbbbmo.',
  '....oddmmmbbbbbbbbbbbbbbbbbbbbbbommwwwwwwwmmo..',
  '....oddmmmmbbbbbbbbbbbbbbbbbbbbbbbbotttttto....',
  '....odddmmmmmmbbbbbbbbbbbbbbbbbbbbbottttttto...',
  '....odddmmmmmmmmmmmmmddoooooooooooootttttttto..',
  '.....odddmmmmmmddoohhhhhhhhhhhhhhhhhhtttttttto.',
  '......oddddmohhhhbbbbbbbbbbbbbbbbbbbbbtttttto..',
  '.......ooddobmmmmmmmmmmmmmmmmmmmmmmmmmmtttto...',
  '.........oooooooooooooooooooooooooooooooooo....',
];
FOX.rows = FOX_ROWS; // the fox has its own drawing: a brush of a tail, white tip under the chin

// Poses, as changes to the sleeping drawing. Coordinates are in the drawing above; the head is
// columns 29..46, the closed eyes sit on row 8 at columns 31..33 and 40..42.
//   sleep  curled up, eyes shut          open / openL / openR  awake, looking ahead / left / right
//   up / upL / upR  head raised, looking  yawn  head raised, eyes squeezed shut, mouth wide
const POSES = ['sleep', 'open', 'openL', 'openR', 'up', 'upL', 'upR', 'yawn'];
const HEADROOM = 3; // empty rows on top, so a raised head still fits in the sprite
const EYES = { '': ['geg', 'geg'], L: ['egg', 'egg'], R: ['gge', 'gge'] };

function posed(rows, pose) {
  let out = rows;
  if (pose !== 'sleep' && pose !== 'yawn') {
    const [r7, r8] = EYES[pose.slice(-1) === 'L' ? 'L' : pose.slice(-1) === 'R' ? 'R' : ''];
    out = patch(out, 31, 7, [r7, r8]);
    out = patch(out, 40, 7, [r7, r8]);
  }
  if (pose === 'yawn') out = patch(out, 35, 11, ['oppo', 'oppo']);
  out = [...Array(HEADROOM).fill('.'.repeat(out[0].length)), ...out];
  // raise the head: the head's columns move up two rows; the neck fills in below
  if (pose.startsWith('up') || pose === 'yawn') out = lift(lift(out, 29, 46, 14 + HEADROOM), 29, 46, 14 + HEADROOM);
  return out;
}

const catFrames = new Map(); // frames per coat and pose, made when first needed
function framesFor(look, pose) {
  const key = look;
  if (!catFrames.has(key)) catFrames.set(key, {});
  const byPose = catFrames.get(key);
  if (byPose[pose]) return byPose[pose];
  const C = look.pal;
  const pal = { o: C.line, d: C.dark, m: C.mid, b: C.base, h: C.hi, s: C.stripe, w: C.cream, q: C.creamS, p: '#f0a8a0', n: '#e88a8a', t: look.tip, k: look.ear, g: look.eye || '#b8e06a', e: '#1a1410' };
  const rows = posed(look.rows || CAT, pose);
  const breathIn = lift(rows, 9, 28, 9 + HEADROOM);
  // the right ear flicks back: its tip leans one pixel out
  const up = pose.startsWith('up') || pose === 'yawn' ? 2 : 0;
  const flick = (r) => patch(r, 40, HEADROOM - up, ['...o.', '..oko', '.ompo']);
  byPose[pose] = { rest: sprite(rows, pal), breath: sprite(breathIn, pal), flick: sprite(flick(rows), pal), flickBreath: sprite(flick(breathIn), pal) };
  return byPose[pose];
}

/** Where the cat drawn at (x, y) is on screen, for pointing at it. */
export function catBox(x, y) {
  return { x: Math.round(x) - 20, y: Math.round(y) - 8, w: 47, h: 21 };
}

/**
 * A cat (or, with FOX, a fox), curled up with its head on the right, in one of the POSES.
 * (x, y) is where the old drawn cat had its middle: the sprite sits on the surface at y + 12.
 */
export function hdCat(x, y, t, look = TABBY, pose = 'sleep') {
  if (!POSES.includes(pose)) pose = 'sleep';
  const f = framesFor(look, pose);
  const inhale = Math.sin(t / 900) > 0.2;
  const flick = pose === 'sleep' && Math.floor(t / 2300) % 7 === 0;
  const s = flick ? (inhale ? f.flickBreath : f.flick) : inhale ? f.breath : f.rest;
  const left = Math.round(x) - 20;
  const top = Math.round(y) + 12 - s.h + 1 + HEADROOM; // top of the drawing itself, under the headroom
  const up = pose.startsWith('up') || pose === 'yawn' ? 2 : 0;
  // a soft contact shadow under the curl
  px(left + 6, top + s.h - 1 - HEADROOM, 34, 1, 'rgba(0, 0, 0, 0.18)');
  blit(s, left, top - HEADROOM);
  // whiskers, half-transparent so they catch the light
  const hx = left + 37;
  const hy = top + 10 - up;
  for (const [wx, dir] of [[hx - 6, -1], [hx + 6, 1]]) {
    px(wx + (dir < 0 ? -3 : 1), hy, 3, 1, 'rgba(255, 245, 230, 0.5)');
    px(wx + (dir < 0 ? -3 : 1), hy + 2, 3, 1, 'rgba(255, 245, 230, 0.4)');
  }
  if (pose !== 'sleep') return;
  // floating z's
  const zt = (t / 1300) % 3;
  if (zt < 2.2) {
    const zx = hx + 8 + Math.floor(zt * 3);
    const zy = top - 4 - Math.floor(zt * 6);
    const a = zt < 1.8 ? 0.85 : 0.4;
    ctxRef.fillStyle = `rgba(244, 233, 216, ${a})`;
    ctxRef.fillRect(zx, zy, 5, 1);
    ctxRef.fillRect(zx + 3, zy + 1, 1, 1);
    ctxRef.fillRect(zx + 2, zy + 2, 1, 1);
    ctxRef.fillRect(zx + 1, zy + 3, 1, 1);
    ctxRef.fillRect(zx, zy + 4, 5, 1);
  }
}

/** A small pixel heart, rising from a cat that has been petted; `a` fades it out. */
export function drawHeart(x, y, a = 1) {
  ctxRef.fillStyle = `rgba(255, 120, 150, ${a})`;
  const X = Math.round(x);
  const Y = Math.round(y);
  ctxRef.fillRect(X, Y, 2, 1);
  ctxRef.fillRect(X + 3, Y, 2, 1);
  ctxRef.fillRect(X - 1, Y + 1, 7, 2);
  ctxRef.fillRect(X, Y + 3, 5, 1);
  ctxRef.fillRect(X + 1, Y + 4, 3, 1);
  ctxRef.fillRect(X + 2, Y + 5, 1, 1);
  ctxRef.fillStyle = `rgba(255, 220, 230, ${a})`;
  ctxRef.fillRect(X, Y + 1, 1, 1);
}

// ------------------------------------------------------------------ the cat's habits

// What a cat does when it stirs, as poses held for a number of frames (12 a second); it always
// ends back asleep. A scene keeps a catMind() in its state, calls stepCat() every update, and
// starts one of these with stirCat() or petCat().
const HABITS = {
  look: [['open', 18], ['openL', 14], ['openR', 14], ['open', 10], ['sleep', 0]], // a look round
  yawn: [['open', 12], ['up', 10], ['yawn', 14], ['up', 8], ['open', 10], ['sleep', 0]],
  startle: [['up', 6], ['upL', 18], ['open', 14], ['sleep', 0]], // thunder, a noise
  pet: [['up', 30], ['yawn', 12], ['up', 10], ['open', 18], ['sleep', 0]], // looks up at you, yawns, settles
};

export const catMind = () => ({ pose: 'sleep', script: [], hold: 0, hearts: [] });

export function stepCat(c) {
  if (c.hold > 0) c.hold--;
  else if (c.script.length) [c.pose, c.hold] = c.script.shift();
  c.hearts = c.hearts.filter((h) => {
    h.y -= 0.35;
    h.x += Math.sin(h.life / 5) * 0.2;
    return --h.life > 0;
  });
}

/** Wake it for a moment with one of the HABITS, unless it is already up to something. */
export function stirCat(c, habit) {
  if (c.pose !== 'sleep' || c.script.length) return false;
  c.script = HABITS[habit].slice();
  return true;
}

/** Petted: it looks up at you, with hearts rising from its head. (x, y) is where hdCat() draws it. */
export function petCat(c, x, y) {
  if (c.pose === 'sleep' || !c.script.length) c.script = HABITS.pet.slice();
  c.hold = 0;
  c.hearts.push({ x: x + 20, y: y - 14, life: 34 }, { x: x + 26, y: y - 10, life: 26 });
}

export const onCat = (x, y, px0, py0) => {
  const b = catBox(x, y);
  return px0 >= b.x && px0 < b.x + b.w && py0 >= b.y && py0 < b.y + b.h;
};

export function drawCatHearts(c) {
  for (const h of c.hearts) drawHeart(h.x, h.y, Math.min(1, h.life / 12));
}

// ------------------------------------------------------------------ the owl on the campfire branch

// in the dark at the edge of the firelight, lit a little from the left. o outline · d m h dark to light · f facial disc · e eye socket
// c breast · s streaks · b beak · y talons. The eyes themselves are drawn by owlEyes(), so they can blink.
// prettier-ignore
const OWL = sprite([
  '..o.........o..',
  '..oho.....odo..',
  '..ohhooooomdo..',
  '.ohhhhmmmmmddo.',
  'ohhffffmffffmdo',
  'ohfeeefffeeefdo',
  'oheeeeefeeeeedo',
  'oheeeeefeeeeedo',
  'oheeeeebeeeeedo',
  'ohfeeefbfeeefdo',
  'ohhffffbffffmdo',
  '.ohhfffffffmdo.',
  'ohhmccccccccmdo',
  'ohhmcscccsccmdo',
  'ohhmccscccscmdo',
  'ohmhcscccsccmdo',
  'ohhmccscccscmdo',
  'ohmhcscccsccmdo',
  'ohhmccscccscmdo',
  '.ohmhcccccccmdo',
  '.ohhmccscccmddo',
  '..ohmcccccmddo.',
  '...ohmmmmmddo..',
  '...oyyo.oyyo...',
], { o: '#0a0705', d: '#21180f', m: '#3c2c1e', h: '#5c452f', f: '#7a6044', e: '#160f0a', c: '#6e5638', s: '#45352a', b: '#b8862e', y: '#a8782a' });

/** The owl standing on a branch with its talons at (x, y). */
export function drawOwl(x, y) {
  blit(OWL, Math.round(x) - 7, Math.round(y) - OWL.h + 1);
}

/**
 * Its eyes: wide and yellow, with a slow blink now and then. `turn` is where it is looking:
 * 'ahead', 'left' or 'right' (the face shifts a pixel), or 'back', with its head turned right round.
 */
export function owlEyes(x, y, t, turn = 'ahead') {
  const top = Math.round(y) - OWL.h + 1;
  const left = Math.round(x) - 7;
  if (turn === 'back') {
    // the back of its head: mottled feathers over the face, tufts still up
    for (let r = 4; r <= 11; r++)
      for (let c = r === 4 || r === 11 ? 3 : 2; c <= (r === 4 || r === 11 ? 11 : 12); c++) px(left + c, top + r, 1, 1, (c * 3 + r) % 5 === 0 ? '#21180f' : c < 7 ? '#5c452f' : '#3c2c1e');
    return;
  }
  const shift = turn === 'left' ? -1 : turn === 'right' ? 1 : 0;
  const blink = Math.floor(t / 180) % 26 === 0;
  for (const ex0 of [Math.round(x) - 3, Math.round(x) + 3]) {
    const ex = ex0 + shift;
    if (blink) {
      px(ex - 1, top + 7, 3, 1, '#5c452f');
      continue;
    }
    px(ex - 1, top + 6, 3, 1, '#ffd23f');
    px(ex - 2, top + 7, 5, 1, '#ffd23f');
    px(ex - 1, top + 8, 3, 1, '#e0a42a'); // the lower half, in shade
    px(ex + shift, top + 7, 1, 2, '#1a1008');
    px(ex - 1, top + 6, 1, 1, '#fff6c8');
  }
}

/** Where the owl standing at (x, y) is, for pointing at it. */
export const onOwl = (x, y, px0, py0) => Math.abs(px0 - x) <= 9 && py0 > y - OWL.h - 2 && py0 <= y + 2;

// ------------------------------------------------------------------ the cat on the neon rooftop

// seen from behind, watching the city, backlit by the signs: r rim light · R softer rim
// b fur · l fur catching a little light · k the shadow side at the bottom. Its tail is drawn by the scene.
// The head is its own sprite (rows 0 to 9, the neck row shared with the body) so it can turn and look up.
const ROOF_PAL = { r: '#d868e0', R: '#8a3fa0', b: '#2b1a4a', l: '#3a2260', k: '#1d1036' };
// prettier-ignore
const ROOF_HEAD = sprite([
  '.....r.......r.....',
  '.....rr.....rr.....',
  '.....rbr...rbr.....',
  '.....rlbbbbbbr.....',
  '....rlbbbbbbbbr....',
  '....rlbbbbbbbbr....',
  '....rlbbbbbbbbr....',
  '....rlbbbbbbbbr....',
  '.....rlbbbbbbr.....',
  '......rlbbbbr......',
], ROOF_PAL);
// one ear flicked back
// prettier-ignore
const ROOF_TWITCH = sprite([
  '.............r.....',
  '....r.......rr.....',
  '....rrbr...rbr.....',
  '.....rlbbbbbbr.....',
  '....rlbbbbbbbbr....',
  '....rlbbbbbbbbr....',
  '....rlbbbbbbbbr....',
  '....rlbbbbbbbbr....',
  '.....rlbbbbbbr.....',
  '......rlbbbbr......',
], ROOF_PAL);
// prettier-ignore
const ROOF_BODY = sprite([
  '......rlbbbbr......',
  '......rlbbbbr......',
  '.....rlbbbbbbr.....',
  '....rlbbbbbbbbr....',
  '....rlbbbbbbbbr....',
  '...rlbbbbbbbbbbr...',
  '...rlbbbbbbbbbbr...',
  '...rlbbbbbbbbbbr...',
  '..rlbbbbbbbbbbbbr..',
  '..rlbbbbbbbbbbbbr..',
  '..rlbbbbbbbbbbbbr..',
  '.rlbbbbbbbbbbbbbbr.',
  '.rlbbbbbbbbbbbbbbr.',
  '.rlbbbbbbbbbbbbbbr.',
  '.RlbbbbbbbbbbbbbbR.',
  'RlbbbbbbbbbbkbkbkbR',
  'RlbbbbbbbbbkbkbkbkR',
  'RlbbbbbbbbbbkbkbkbR',
  'RlbbbbbbbbbkbkbkbkR',
  'RlbbbbbbbbbkkkkkkkR',
  '.RlbbbbbbbbkkkkkkR.',
  '..kkkkkkkkkkkkkkk..',
], ROOF_PAL);

/**
 * The rooftop cat sitting on the ledge at y, centred on x. pose: 'sit', 'twitch' (an ear flicks),
 * 'up' (looking up at the sky), 'turnL' / 'turnR' (looking round, an eye catching the neon).
 */
export function drawRoofCat(x, y, pose = 'sit') {
  const X = Math.round(x) - 9;
  const Y = Math.round(y) - 31;
  blit(ROOF_BODY, X, Y + 9);
  const dx = pose === 'turnL' ? -1 : pose === 'turnR' ? 1 : 0;
  blit(pose === 'twitch' ? ROOF_TWITCH : ROOF_HEAD, X + dx, Y - (pose === 'up' ? 1 : 0));
  if (dx) {
    const ex = dx < 0 ? X + 4 : X + 14;
    px(ex, Y + 6, 1, 1, '#c8ff6a'); // the eye
    for (let i = 1; i <= 3; i++) px(ex + dx * i, Y + 7 + (i > 2 ? 1 : 0), 1, 1, 'rgba(216, 104, 224, 0.55)'); // whiskers
  }
}
