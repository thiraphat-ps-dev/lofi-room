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

const catFrames = new Map(); // one set of frames per coat
function framesFor(look) {
  if (catFrames.has(look)) return catFrames.get(look);
  const C = look.pal;
  const pal = { o: C.line, d: C.dark, m: C.mid, b: C.base, h: C.hi, s: C.stripe, w: C.cream, q: C.creamS, p: '#f0a8a0', n: '#e88a8a', t: look.tip, k: look.ear };
  const rows = look.rows || CAT;
  const breathIn = lift(rows, 9, 28, 9);
  // the right ear flicks back: its tip leans one pixel out
  const flick = (rows) => patch(rows, 40, 0, ['...o.', '..oko', '.ompo']);
  const frames = { rest: sprite(rows, pal), breath: sprite(breathIn, pal), flick: sprite(flick(rows), pal), flickBreath: sprite(flick(breathIn), pal) };
  catFrames.set(look, frames);
  return frames;
}

/**
 * A sleeping cat (or, with FOX, a fox), curled up with its head on the right.
 * (x, y) is where the old drawn cat had its middle: the sprite sits on the surface at y + 12.
 */
export function hdCat(x, y, t, look = TABBY) {
  const f = framesFor(look);
  const inhale = Math.sin(t / 900) > 0.2;
  const flick = Math.floor(t / 2300) % 7 === 0;
  const s = flick ? (inhale ? f.flickBreath : f.flick) : inhale ? f.breath : f.rest;
  const left = Math.round(x) - 20;
  const top = Math.round(y) + 12 - s.h + 1;
  // a soft contact shadow under the curl
  px(left + 6, top + s.h - 1, 34, 1, 'rgba(0, 0, 0, 0.18)');
  blit(s, left, top);
  // whiskers, half-transparent so they catch the light
  const hx = left + 37;
  const hy = top + 10;
  for (const [wx, dir] of [[hx - 6, -1], [hx + 6, 1]]) {
    px(wx + (dir < 0 ? -3 : 1), hy, 3, 1, 'rgba(255, 245, 230, 0.5)');
    px(wx + (dir < 0 ? -3 : 1), hy + 2, 3, 1, 'rgba(255, 245, 230, 0.4)');
  }
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

/** Its eyes: wide and yellow, with a slow blink now and then. */
export function owlEyes(x, y, t) {
  const top = Math.round(y) - OWL.h + 1;
  const blink = Math.floor(t / 180) % 26 === 0;
  for (const ex of [Math.round(x) - 3, Math.round(x) + 3]) {
    if (blink) {
      px(ex - 1, top + 7, 3, 1, '#5c452f');
      continue;
    }
    px(ex - 1, top + 6, 3, 1, '#ffd23f');
    px(ex - 2, top + 7, 5, 1, '#ffd23f');
    px(ex - 1, top + 8, 3, 1, '#e0a42a'); // the lower half, in shade
    px(ex, top + 7, 1, 2, '#1a1008');
    px(ex - 1, top + 6, 1, 1, '#fff6c8');
  }
}

// ------------------------------------------------------------------ the cat on the neon rooftop

// seen from behind, watching the city, backlit by the signs: r rim light · R softer rim
// b fur · l fur catching a little light · k the shadow side at the bottom. Its tail is drawn by the scene.
// prettier-ignore
const ROOF_CAT = sprite([
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
], { r: '#d868e0', R: '#8a3fa0', b: '#2b1a4a', l: '#3a2260', k: '#1d1036' });

/** The rooftop cat sitting on the ledge at y, centred on x. */
export function drawRoofCat(x, y) {
  blit(ROOF_CAT, Math.round(x) - 9, Math.round(y) - ROOF_CAT.h);
}
