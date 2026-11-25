import {
  W,
  H,
  ctxRef,
  look,
  rng,
  px,
  disc,
  sprite,
  blit,
  bands,
  makeGlow,
  layer,
  shadeEllipse,
  dith,
  hash,
  poly,
  stroke,
  haloRing,
  makeStars,
  drawStars,
  hdPine,
  makeLightmap,
  applyLight,
  makeShaft,
  makeMist,
  tod,
  sfx,
} from './kit.js';
import { drawHeart } from './animals.js';

// ------------------------------------------------------------------ scene: snowy cabin

// The same cabin at four times of day. Night is the original: moon, stars, aurora and a cold blue
// yard, warm only by the windows and the lamp post. Dawn lights the snowy peaks pink under a
// lilac sky; by day it's a soft blue sky, bright snow and green pines, with the aurora gone and
// the lamp off; at dusk the peaks catch the last orange light and the lamp comes on again.
const TIMES = {
  night: {
    sky: ['#050818', '#08102a', '#0d1a3e', '#142650', '#1d3462', '#284474'],
    moon: true,
    stars: true,
    aurora: true,
    ridges: [
      { rock: '#2f4672', rockS: '#243963', snow: '#c3d2ec', snowS: '#8ba0c8' },
      { rock: '#243c66', rockS: '#182a4e', snow: '#e3ecfb', snowS: '#9db3d8' },
    ],
    pines: ['#142c44', '#1b3a56', '#24506c'], pineSnow: '#aebfdc',
    tall: ['#0f2a3e', '#173b52', '#215068'],
    frame: ['#06111a', '#0a1824', '#0f2230'], frameSnow: '#6f84ac',
    mist: 'rgba(176, 196, 236, 0.32)',
    ambient: '#62729e',
    skyLight: '#8c8c8c',
    lamp: true,
    flakes: '#c9d6ee',
  },
  dawn: {
    sky: ['#4a5694', '#5e66a6', '#8278b6', '#b690bc', '#e6acb6', '#fcd2be'],
    sun: { x: 0.24, y: 0.46, r: 9, c: '#fff0d8', glow: 'rgba(255, 210, 190, 0.10)' },
    ridges: [
      { rock: '#4e4c80', rockS: '#3c3a6c', snow: '#f4ccd4', snowS: '#a69ac4' },
      { rock: '#423f74', rockS: '#302e5e', snow: '#fbe0e2', snowS: '#b4a8cc' },
    ],
    pines: ['#24304e', '#2e3c5e', '#3a4c6e'], pineSnow: '#d8cce0',
    tall: ['#1c2a44', '#263856', '#30486a'],
    frame: ['#1a2036', '#222a44', '#2c3654'], frameSnow: '#a89cc0',
    mist: 'rgba(240, 210, 225, 0.32)',
    ambient: '#c2bcdc',
    skyLight: '#a0a0a0',
    lamp: true,
    flakes: '#e4dcef',
  },
  day: {
    sky: ['#4f86cc', '#6296d4', '#78a8dc', '#90b8e2', '#a8c8ea', '#c0d8f0'],
    sun: { x: 0.72, y: 0.12, r: 8, c: '#fffdf0', glow: 'rgba(255, 255, 240, 0.12)' },
    ridges: [
      { rock: '#6c7e9e', rockS: '#5a6a8c', snow: '#f4f8ff', snowS: '#c4d2ea' },
      { rock: '#5e7092', rockS: '#4c5c7e', snow: '#ffffff', snowS: '#ccd8ee' },
    ],
    pines: ['#24463c', '#30584a', '#3e6c58'], pineSnow: '#eef4fc',
    tall: ['#1c3c30', '#285040', '#346650'],
    frame: ['#122a20', '#1a382a', '#244834'], frameSnow: '#d4e0f0',
    mist: 'rgba(235, 242, 255, 0.34)',
    ambient: '#f2f4f8',
    skyLight: '#ffffff',
    lamp: false,
    flakes: '#ffffff',
  },
  dusk: {
    sky: ['#161a46', '#2a2860', '#523a7a', '#904c7c', '#d0706c', '#f2a070'],
    sun: { x: 0.78, y: 0.47, r: 10, c: '#ffd0a0', glow: 'rgba(255, 170, 120, 0.12)' },
    stars: true,
    ridges: [
      { rock: '#423c70', rockS: '#302c5c', snow: '#f4b898', snowS: '#9a8ab4' },
      { rock: '#38346a', rockS: '#28264f', snow: '#fccaa8', snowS: '#a898bc' },
    ],
    pines: ['#1c2442', '#263252', '#304066'], pineSnow: '#c4b4d0',
    tall: ['#16203a', '#1f2c4c', '#2a3a60'],
    frame: ['#0a0e20', '#10162c', '#182038'], frameSnow: '#8a84ac',
    mist: 'rgba(230, 180, 190, 0.30)',
    ambient: '#9088b8',
    skyLight: '#888888',
    lamp: true,
    flakes: '#dcd2ea',
  },
};

const harePal = { w: '#c4b3a0', k: '#22202c' };
const hareFrames = [
  sprite(['.......w.w.', '.......w.w.', '......wwww.', '..www.wwkw.', '.wwwwwwwww.', 'wwwwwwwww..', 'wwwwwwww...', '.www.www...'], harePal),
  sprite(['........w.w', '.......wwww', '.......wwkw', '..wwwwwwww.', '.wwwwwwww..', 'wwwwwwww...', 'w.w....ww..', '...........'], harePal),
];

// a deer crossing the yard, facing right. b coat · d dark · l pale belly and tail · a antlers · k hooves and nose
const deerPal = { b: '#7a5a44', d: '#4e3828', l: '#c8b090', a: '#8a7458', k: '#1a1410' };
// prettier-ignore
const deerFrames = [sprite(['..........a...a..', '..........aa.aa..', '...........aaa...', '...........dbbd..', '............bbbb.', '............bbbbk', '...........bbb...', '..lbbbbbbbbbbb...', '.lbbbbbbbbbbbb...', '.lbbbbbbbbbbbb...', '..dbbllllllbbd...', '..d.d.....d.d....', '..d.d.....d.d....', '..k.k.....k.k....'], deerPal), sprite(['..........a...a..', '..........aa.aa..', '...........aaa...', '...........dbbd..', '............bbbb.', '............bbbbk', '...........bbb...', '..lbbbbbbbbbbb...', '.lbbbbbbbbbbbb...', '.lbbbbbbbbbbbb...', '..dbbllllllbbd...', '...dd.....dd.....', '..d..d...d..d....', '..k..k...k..k....'], deerPal)];
// stopped to look round, tail up
// prettier-ignore
const deerLook = sprite(['..........a...a..', '..........aa.aa..', '...........aaa...', '...........dbbd..', '............bbbb.', '............bbbbk', '...........bbb...', '.lbbbbbbbbbbbb...', '..bbbbbbbbbbbb...', '.lbbbbbbbbbbbb...', '..dbbllllllbbd...', '..d.d.....d.d....', '..d.d.....d.d....', '..k.k.....k.k....'], deerPal);
// a robin, facing left: b brown · r red breast · k beak · l legs
const robinPal = { b: '#6a4a3a', r: '#e0503c', k: '#2a2020', l: '#3a2a20' };
const robin = sprite(['.bb...', 'kbbbbb', '.rrbb.', '..l...'], robinPal);
const robinPeck = sprite(['......', '.bb...', 'kbbbbb', '.rlbb.'], robinPal);

// Little things that happen now and then (one every 20 to 60 seconds, never the same twice running):
// a gust of blizzard, someone opening the door to look at the snow, the window cat moving or pawing
// at the glass, a deer crossing the yard, snow sliding off the roof, the aurora flaring, a robin on the snowman.
const EVENTS = ['blizzard', 'door', 'cat', 'deer', 'roof', 'aurora', 'robin', 'cat', 'deer'];

function start(s, e) {
  if (e === 'blizzard') {
    s.wind.target = 1;
    s.wind.hold = 12 * (12 + Math.random() * 10);
  } else if (e === 'door' && !s.door) {
    s.door = { f: 0 };
    sfx('creak');
  }
  else if (e === 'cat') catDo(s, Math.random() < 0.5 ? 'paw' : 'move');
  else if (e === 'deer' && !s.deer) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    s.deer = { x: dir > 0 ? -20 : W + 20, dir, f: 0, stop: 0, stopAt: W * (0.25 + Math.random() * 0.5) };
  } else if (e === 'roof') {
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) s.clumps.push({ x: s.cx - 6 + Math.random() * (s.cw + 12), y: s.cy + 2, v: 0, wait: i * 5, thud: i === 0 });
  } else if (e === 'aurora' && !s.flare) s.flare = { f: 0, dur: 12 * 14 };
  else if (e === 'robin' && !s.robin) s.robin = { phase: 'in', f: 0, x: -8, y: H * 0.35 };
}

/** The cat in the window: 'paw' at the glass, or 'move' to the other window. */
function catDo(s, what) {
  const c = s.wcat;
  if (c.f > 0) return;
  c.what = what;
  c.f = what === 'paw' ? 12 * 3 : 12 * 5;
}

/** The door swings open on the warm room, light spills over the snow, someone stands looking out, and it shuts. */
function drawDoor(s, flick) {
  const { dx, cy, ground } = s;
  const f = s.door.f;
  const end = 12 * 8;
  const open = Math.min(1, f / 5, (end - f) / 5);
  if (open <= 0) return;
  const w = Math.round(14 * open);
  // the light on the snow first, then the doorway over it
  const reach = Math.round(26 * open);
  poly([[dx, cy + 46], [dx + w, cy + 46], [dx + w + reach * 0.7, cy + 46 + reach], [dx - reach * 0.6, cy + 46 + reach]], (x, y) => (dith(x, y, 0.55 * (1 - (y - cy - 46) / (reach + 1))) ? 'rgba(255, 200, 120, 0.35)' : null));
  px(dx, cy + 18, w, 27, flick ? '#ffb453' : '#ffc46a');
  px(dx, cy + 18, w, 6, '#ffd890');
  if (f > 14 && f < end - 14 && w > 8) {
    // someone in the doorway, mug in hand
    const px0 = dx + Math.round(w / 2) - 3;
    px(px0 + 1, cy + 22, 4, 4, '#2a1a14');
    px(px0, cy + 26, 6, 13, '#2a1a14');
    px(px0 + 1, cy + 39, 2, 6, '#2a1a14');
    px(px0 + 4, cy + 39, 2, 6, '#2a1a14');
    px(px0 + 6, cy + 30, 2, 2, '#e8e0d0');
    if (Math.floor(f / 8) % 2) px(px0 + 6, cy + 27, 1, 2, 'rgba(255, 255, 255, 0.35)'); // steam
  }
  px(dx + w, cy + 18, 14 - w, 27, '#3c241a'); // the door, swung in
  px(dx + w, cy + 18, Math.min(2, 14 - w), 27, '#5a3524');
}

const onWindow = (s, x, y) => s.windows.findIndex((wx) => x >= wx - 2 && x < wx + 18 && y >= s.wy - 2 && y < s.wy + 16);
const onDoor = (s, x, y) => x >= s.dx - 2 && x < s.dx + 16 && y >= s.cy + 16 && y < s.cy + 46;
const onHare = (s, x, y) => s.hare.wait <= 0 && x >= s.hare.x - 2 && x < s.hare.x + 13 && y >= s.hareY - 8 && y < s.hareY + 9;
const onRobin = (s, x, y) => s.robin?.phase === 'sit' && Math.abs(x - s.perch.x - 3) < 6 && Math.abs(y - s.perch.y - 2) < 6;

const cabin = {
  id: 'snow',
  name: 'กระท่อมหิมะ',
  en: 'Snowy cabin',
  accent: '#9fe3ff',
  init() {
    const r = rng(23);
    const T = TIMES[tod] || TIMES.night;
    const narrow = W < 420;
    const ground = Math.round(H * 0.66);
    const cw = 80;
    const ch = 45;
    const cx = narrow ? Math.round(W / 2 - cw / 2) : Math.round(W * 0.5);
    const cy = ground + 6 - ch; // top of the log wall
    const dx = cx + 33; // door
    const wy = cy + 17; // window top
    const windows = [cx + 8, cx + 56];
    const chx = cx + 52;
    const chy = cy - 42;
    const lampX = cx + cw + (narrow ? 16 : 44);
    const moon = { x: Math.round(W * 0.34), y: Math.round(H * 0.13) };
    const SNOW = '#f4f8ff';

    const sky = layer(() => {
      bands(0, 0, W, ground, T.sky);
      if (T.moon) {
        haloRing(moon.x, moon.y, 9, 28, 'rgba(210, 225, 255, 0.12)');
        disc(moon.x, moon.y, 9, '#f4f7ff');
        disc(moon.x + 5, moon.y - 2, 8, '#14234a');
      } else {
        // the sun: low behind the peaks at dawn and dusk, high and small by day
        const S = T.sun;
        const sx = Math.round(W * S.x);
        const sy = Math.round(H * S.y);
        ctxRef.drawImage(makeGlow(sx, sy, S.r * 10, S.r * 6, S.glow, 4), 0, 0);
        haloRing(sx, sy, S.r, S.r * 3, S.glow);
        disc(sx, sy, S.r, S.c);
      }
    });

    const ridge = (base, amp, seed) =>
      Array.from({ length: W + 2 }, (_, x) =>
        Math.round(base - (1 - Math.abs(Math.sin(x / 71 + seed))) * amp - (1 - Math.abs(Math.sin(x / 31 + seed * 2.3))) * amp * 0.4 - Math.sin(x / 7 + seed) * amp * 0.04),
      );
    const paintRidge = (rd, base, C) => {
      for (let x = 0; x < W; x++) {
        const top = rd[x];
        const cap = Math.max(0, Math.round((base - top) * 0.42 + Math.sin(x / 2.3) * 1.5 + Math.sin(x / 5.1) * 2));
        for (let y = top; y < ground; y++) {
          const d = y - top;
          const sx = Math.max(4, Math.min(W - 4, Math.round(x + d * 0.5)));
          const lit = rd[sx + 4] - rd[sx - 4] < 0; // the face that looks toward the moon
          px(x, y, 1, 1, d < cap ? (lit ? C.snow : C.snowS) : lit ? C.rock : C.rockS);
        }
      }
    };

    const far = layer(() => {
      paintRidge(ridge(H * 0.5, H * 0.2, 1.3), H * 0.5, T.ridges[0]);
      paintRidge(ridge(H * 0.58, H * 0.14, 4.1), H * 0.58, T.ridges[1]);
    });

    const land = layer(() => {
      for (let x = 0; x < W; x += 5 + Math.floor(r() * 6)) hdPine(x, ground + 1, 12 + Math.floor(r() * 14), T.pines, T.pineSnow);

      // snowfield with drifts
      bands(0, ground, W, H - ground, ['#e9f1fb', '#d6e2f4', '#c0d0ea', '#a9bcdc', '#93a8cd']);
      for (let i = 0; i < Math.round(W / 50); i++) {
        const x0 = r() * W;
        const y0 = ground + 16 + r() * (H - ground - 22);
        const len = 30 + r() * 50;
        for (let k = 0; k < len; k++) {
          const yy = y0 - Math.round(Math.sin((k / len) * Math.PI) * 3);
          px(x0 + k, yy, 1, 1, '#f8fbff');
          if (dith(Math.round(x0 + k), Math.round(y0 + 1), 0.6)) px(x0 + k, y0 + 1, 1, 1, '#9db1d6');
        }
      }
      for (let i = 0; i < W * 0.3; i++) px(r() * W, ground + 4 + r() * (H - ground - 4), 1, 1, '#ffffff');

      // tall pines either side, the nearest drawn last
      const trees = [];
      for (let i = 0; i < Math.round(W / 24); i++) {
        const x = Math.round(r() * W);
        if (x > cx - 76 && x < lampX + 30) continue;
        trees.push({ x, base: ground + 2 + Math.round(r() * 28), h: 44 + Math.floor(r() * 60) });
      }
      trees.sort((a, b) => a.base - b.base);
      for (const tr of trees) {
        shadeEllipse(tr.x + 5, tr.base + 1, tr.h * 0.28, 3, (nx, ny, x, y) => (dith(x, y, 0.5) ? '#9db1d6' : null));
        hdPine(tr.x, tr.base, tr.h, T.tall, '#eef4fd');
      }

      // fence on both sides of the yard
      const fence = (x0, x1) => {
        if (x1 - x0 < 20) return;
        for (const ry of [ground + 8, ground + 13]) {
          px(x0, ry, x1 - x0, 2, '#7a5844');
          px(x0, ry - 1, x1 - x0, 1, SNOW);
        }
        for (let x = x0; x <= x1; x += 12) {
          px(x, ground + 4, 3, 14, '#6b4b3a');
          px(x + 2, ground + 4, 1, 14, '#4f3629');
          px(x - 1, ground + 2, 5, 2, SNOW);
        }
      };
      fence(Math.max(-6, cx - 150), cx - 64);
      fence(lampX + 14, Math.min(W + 6, lampX + 158));

      // footprints from the door toward us
      for (let k = 0; k < 14; k++) {
        const f = k / 14;
        const fy = ground + 12 + Math.round(f * (H - ground - 14));
        const fx = dx + 6 + Math.round(Math.sin(f * 2.2) * 26) + (k % 2 ? 4 : -2);
        const size = 2 + Math.round(f * 2);
        px(fx, fy, size + 1, size, '#a9bcdc');
        px(fx, fy, size + 1, 1, '#8ea4cc');
      }

      // ---- the cabin: log walls with round log ends at the corners
      const LOG = { a: '#8a5638', hi: '#a56d48', lo: '#5e3826', end: '#c79a6a', endLo: '#8a5e3e' };
      for (let y = cy; y < cy + ch; y += 5) {
        px(cx, y, cw, 5, LOG.a);
        px(cx, y, cw, 1, LOG.hi);
        px(cx, y + 4, cw, 1, LOG.lo);
        for (let k = 0; k < 3; k++) px(cx + 6 + Math.floor(r() * (cw - 14)), y + 2, 2 + Math.floor(r() * 4), 1, LOG.lo);
        for (const ex of [cx - 2, cx + cw - 3]) {
          px(ex, y, 5, 5, LOG.end);
          px(ex + 1, y + 1, 3, 3, LOG.endLo);
          px(ex + 2, y + 2, 1, 1, LOG.end);
        }
      }
      px(cx - 2, cy + 6, cw + 4, 3, 'rgba(20, 10, 10, 0.3)');

      // roof under a blanket of snow, with a couple of bare patches
      const rh = 30;
      for (let k = 0; k <= rh; k++) {
        const inset = Math.round((k / rh) * 23);
        const x0 = cx - 9 + inset;
        const x1 = cx + cw + 9 - inset;
        const y = cy - k;
        const v = 1 - k / rh;
        for (let x = x0; x < x1; x++) {
          const edge = x - x0 < 3;
          px(x, y, 1, 1, edge || (v > 0.6 && dith(x, y, (v - 0.6) * 1.8)) ? '#c6d6ee' : v > 0.3 && dith(x, y, (v - 0.3) * 1.2) ? '#e6eefa' : '#ffffff');
        }
      }
      for (const [ox, oy, w] of [[12, 9, 13], [60, 6, 9]]) {
        px(cx + ox, cy - oy, w, 4, '#5a3a2c');
        for (let i = 0; i < w; i += 4) px(cx + ox + i, cy - oy, 1, 4, '#472c20');
        px(cx + ox, cy - oy + 2, w, 1, '#472c20');
        px(cx + ox - 1, cy - oy - 1, w + 2, 1, '#c6d6ee');
      }
      // stone chimney
      px(chx, chy, 12, 28, '#676370');
      for (let j = 0; j < 28; j += 4) {
        px(chx, chy + j, 12, 1, '#4a4654');
        for (let i = (j / 4) % 2 ? 3 : 7; i < 12; i += 8) px(chx + i, chy + j, 1, 4, '#4a4654');
        if (r() < 0.6) px(chx + 1 + Math.floor(r() * 7), chy + j + 1, 3, 2, '#7f7b88');
      }
      px(chx + 9, chy, 3, 28, 'rgba(10, 10, 30, 0.25)');
      px(chx - 2, chy - 3, 16, 4, SNOW);
      px(chx - 2, chy, 16, 1, '#b9cbe6');
      px(chx + 3, chy - 3, 6, 2, '#2a2630');
      px(chx - 4, chy + 25, 20, 4, '#ffffff');
      // eave: a thick lip of snow with icicles
      px(cx - 11, cy, cw + 22, 4, SNOW);
      px(cx - 12, cy + 1, cw + 24, 2, SNOW);
      px(cx - 11, cy + 3, cw + 22, 1, '#b9cbe6');
      px(cx - 8, cy + 4, cw + 16, 2, '#3c241a');
      for (let x = cx - 9; x < cx + cw + 9; x += 3 + Math.floor(r() * 4)) {
        const len = 2 + Math.floor(r() * 6);
        px(x, cy + 4, 1, len, '#dcebff');
        px(x, cy + 4, 1, Math.ceil(len / 2), '#ffffff');
      }

      // door with a wreath, a stone step and a wall lantern
      px(dx - 2, cy + 16, 18, 29, '#3c241a');
      px(dx, cy + 18, 14, 27, '#5a3524');
      for (let i = 0; i < 14; i += 4) px(dx + i, cy + 18, 1, 27, '#472a1c');
      px(dx, cy + 18, 14, 1, '#6e4530');
      px(dx + 11, cy + 33, 2, 2, '#e8c98a');
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        px(dx + 6 + Math.cos(a) * 4, cy + 25 + Math.sin(a) * 4, 2, 2, k % 3 ? '#2f7a4a' : '#49a868');
      }
      px(dx + 2, cy + 24, 1, 1, '#e0453c');
      px(dx + 10, cy + 27, 1, 1, '#e0453c');
      px(dx + 6, cy + 29, 3, 2, '#e0453c');
      px(dx - 6, cy + 45, 26, 3, '#7d7986');
      px(dx - 7, cy + 44, 28, 2, SNOW);
      px(dx + 18, cy + 21, 4, 1, '#23252f');
      px(dx + 19, cy + 22, 3, 5, '#23252f');

      // window frames, shutters and snowy sills (the panes are lit at run time)
      for (const wx of windows) {
        px(wx - 2, wy - 2, 20, 18, '#3c241a');
        for (const sx of [wx - 6, wx + 18]) {
          px(sx, wy - 1, 4, 16, '#2f6a52');
          px(sx, wy - 1, 1, 16, '#3f8a6a');
          for (let j = 1; j < 15; j += 3) px(sx + 1, wy + j, 3, 1, '#24523f');
        }
        px(wx - 3, wy + 15, 22, 2, SNOW);
        px(wx - 3, wy + 17, 22, 1, '#b9cbe6');
      }

      // snow banked against the walls
      for (let x = cx - 12; x < cx + cw + 12; x++) {
        if (x >= dx - 7 && x <= dx + 21) continue;
        const hh = Math.round(3 + Math.sin(x / 7) * 1.5 + Math.sin(x / 3) * 0.7);
        px(x, ground + 6 - hh, 1, hh + 2, SNOW);
      }

      // firewood stacked by the wall
      for (let row = 0; row < 4; row++)
        for (let k = 0; k < 5 - (row > 2 ? 1 : 0); k++) {
          const lx = cx - 29 + k * 5 + (row % 2 ? 2 : 0);
          const ly = ground + 4 - row * 5;
          disc(lx, ly, 2, '#9a6a44');
          px(lx - 1, ly - 1, 3, 3, '#c79a6a');
          px(lx, ly, 1, 1, '#7a4e30');
        }
      px(cx - 32, ground - 14, 25, 2, SNOW);
      px(cx - 30, ground - 16, 18, 2, SNOW);

      // snowman
      const smx = cx - 54;
      const sb = ground + 16;
      const ball = (bx, by, rr) =>
        shadeEllipse(bx, by, rr, rr, (nx, ny, x, y) => {
          const l = nx * 0.6 - ny * 0.6;
          if (nx * nx + ny * ny > 0.8 && l < 0.3) return '#9fb2d6';
          return l > 0.5 ? '#ffffff' : l > -0.2 ? '#eaf1fb' : dith(x, y, 0.5) ? '#d3dff2' : '#c3d2ec';
        });
      shadeEllipse(smx + 3, sb + 1, 15, 3, (nx, ny, x, y) => (dith(x, y, 0.6) ? '#8ea4cc' : null));
      ball(smx, sb - 9, 10);
      ball(smx, sb - 23, 7.5);
      ball(smx, sb - 34, 5.5);
      stroke(smx - 7, sb - 24, smx - 16, sb - 31, '#5a3a28');
      stroke(smx - 13, sb - 29, smx - 16, sb - 26, '#5a3a28');
      stroke(smx + 7, sb - 24, smx + 16, sb - 30, '#5a3a28');
      stroke(smx + 13, sb - 28, smx + 15, sb - 33, '#5a3a28');
      px(smx - 7, sb - 40, 14, 2, '#22202c');
      px(smx - 4, sb - 47, 9, 7, '#22202c');
      px(smx - 4, sb - 42, 9, 1, '#c94a4a');
      px(smx - 2, sb - 36, 1, 1, '#22202c');
      px(smx + 2, sb - 36, 1, 1, '#22202c');
      px(smx, sb - 34, 5, 1, '#f08a3c');
      px(smx, sb - 33, 3, 1, '#d9722a');
      for (const [mx2, my2] of [[-2, -31], [-1, -30], [0, -30], [1, -30], [2, -31]]) px(smx + mx2, sb + my2 - 1, 1, 1, '#22202c');
      px(smx - 6, sb - 30, 12, 2, '#d8453c');
      px(smx + 3, sb - 28, 3, 6, '#d8453c');
      px(smx + 3, sb - 22, 1, 1, '#d8453c');
      px(smx + 5, sb - 22, 1, 1, '#d8453c');
      px(smx, sb - 24, 1, 1, '#22202c');
      px(smx, sb - 20, 1, 1, '#22202c');
      px(smx, sb - 13, 1, 1, '#22202c');

      // iron lamp post
      px(lampX, ground - 34, 2, 48, '#23252f');
      px(lampX - 2, ground + 12, 6, 3, '#23252f');
      px(lampX - 1, ground + 11, 4, 2, SNOW);
      px(lampX - 3, ground - 43, 8, 9, '#23252f');
      px(lampX - 4, ground - 45, 10, 2, '#23252f');
      px(lampX - 2, ground - 42, 6, 7, T.lamp ? '#ffe08a' : '#b8c0cc');
      px(lampX, ground - 42, 2, 7, T.lamp ? '#fff6d0' : '#d8e0ea');
      px(lampX - 5, ground - 48, 12, 3, SNOW);
      px(lampX - 3, ground - 50, 8, 2, SNOW);
    });

    const glow = layer(() => {
      for (const g of [
        makeGlow(cx + cw / 2, cy + 26, 120, 64, 'rgba(255, 190, 110, 0.06)', 3),
        makeGlow(windows[0] + 8, ground + 15, 34, 11, 'rgba(255, 190, 100, 0.13)', 3),
        makeGlow(windows[1] + 8, ground + 15, 34, 11, 'rgba(255, 190, 100, 0.13)', 3),
        ...(T.lamp
          ? [makeGlow(lampX + 1, ground - 30, 48, 56, 'rgba(255, 220, 140, 0.085)', 4), makeGlow(lampX + 1, ground + 15, 38, 9, 'rgba(255, 220, 140, 0.15)', 3)]
          : []),
      ])
        ctxRef.drawImage(g, 0, 0);
    });

    const stars = makeStars(r, W * 0.35, ground * 0.85, ['#dfe8ff', '#b9c9f0', '#fff3d0']); // always made, so the rest stays the same
    return {
      T,
      ground,
      cx,
      cy,
      dx,
      wy,
      windows,
      lampX,
      chimney: { x: chx + 6, y: chy - 4 },
      sky,
      land,
      glow,
      stars: T.stars ? (tod === 'dusk' ? stars.filter((st) => st.y < ground * 0.25) : stars) : [], // dusk: the first few, high up
      snowFar: Array.from({ length: Math.round(W * 0.9) }, () => ({ x: r() * W, y: r() * H, v: 0.5 + r() * 0.6, p: r() * 6 })),
      snowNear: Array.from({ length: Math.round(W * 0.35) }, () => ({ x: r() * W, y: r() * H, v: 1.2 + r() * 1.1, p: r() * 6 })),
      far,
      mist: makeMist(H * 0.47, ground - 8, ground + 3, T.mist, 0.7, W + 60),
      lightmap: makeLightmap(
        T.ambient,
        [
          { poly: [[0, 0], [W, 0], [W, ground * 0.8], [0, ground * 0.8]], from: [0, 0], to: [0, ground * 0.8], color: T.skyLight },
          T.moon ? { x: moon.x, y: moon.y, r: 260, color: '#34446a' } : { x: W * T.sun.x, y: H * T.sun.y, r: 260, color: '#4a3a40' },
          { x: cx + cw / 2, y: cy + 26, r: 150, ry: 85, color: '#a8683c' },
          ...windows.flatMap((wx) => [
            { x: wx + 8, y: wy + 8, r: 46, color: '#ffb060' },
            { x: wx + 8, y: ground + 15, r: 44, ry: 12, color: '#ffc080' },
          ]),
          { x: dx + 20, y: cy + 24, r: 30, color: '#ffb060' },
          ...(T.lamp
            ? [
                { x: lampX + 1, y: ground - 38, r: 110, ry: 120, color: '#ffd890' },
                { x: lampX + 1, y: ground + 15, r: 56, ry: 13, color: '#ffe0a0' },
              ]
            : []),
        ],
        { vignette: T.lamp ? 0.35 : 0.15 },
      ),
      lampShaft: T.lamp && makeShaft(
        [
          [lampX - 3, ground - 35],
          [lampX + 5, ground - 35],
          [lampX + 26, ground + 16],
          [lampX - 24, ground + 16],
        ],
        [lampX + 1, ground - 35],
        [lampX + 1, ground + 16],
        'rgba(255, 222, 150, 0.16)',
        0.6,
      ),
      // tall pines right in front of us, framing the yard
      frame: layer(() => {
        const pal = T.frame;
        // the trunk would hang below the screen, so sink each tree by its trunk height
        const tall = (h) => [H + Math.round(h * 0.08) + 4, h];
        const [b1, h1] = tall(Math.round(H * (narrow ? 0.5 : 0.72)));
        const [b2, h2] = tall(Math.round(H * (narrow ? 0.55 : 0.8)));
        hdPine(narrow ? -10 : -4, b1, h1, pal, T.frameSnow);
        hdPine(W + (narrow ? 8 : 2), b2, h2, pal, T.frameSnow);
      }),
      bokeh: Array.from({ length: 10 }, () => ({ x: r() * W, y: r() * H, v: 2.2 + r() * 1.2, p: r() * 6 })),
      smoke: [],
      shooting: null,
      hare: { x: -14, wait: 70, phase: 0, rest: 0, bolt: 0 },
      cw,
      perch: { x: cx - 54 + 11, y: ground + 16 - 34 }, // the tip of the snowman's right arm
      deerY: ground + 30,
      ev: { wait: 12 * 5, last: null },
      wind: { level: 0, target: 0, hold: 0 },
      gusts: [],
      door: null,
      wcat: { at: 1, what: null, f: 0, hearts: [] },
      deer: null,
      clumps: [],
      puffs: [],
      flare: null,
      robin: null,
      hareY: ground + Math.round((H - ground) * 0.5),
    };
  },
  update(s) {
    for (const f of s.snowFar) {
      f.y += f.v;
      f.p += 0.08;
      if (f.y > H) {
        f.y = -2;
        f.x = Math.random() * W;
      }
    }
    for (const f of [...s.snowNear, ...s.bokeh]) {
      f.y += f.v;
      f.p += 0.1;
      if (f.y > H) {
        f.y = -3;
        f.x = Math.random() * W;
      }
    }
    // a blizzard blows through: the flakes drive sideways, spindrift streams over the snow
    const wd = s.wind;
    if (wd.hold > 0) wd.hold--;
    else wd.target = 0;
    wd.level += (wd.target - wd.level) * 0.03;
    if (wd.target === 0 && wd.level < 0.01) wd.level = 0;
    if (wd.level > 0) {
      for (const f of s.snowFar) f.x = (f.x + wd.level * 1.6) % W;
      for (const f of s.snowNear) f.x = (f.x + wd.level * 2.8) % W;
      for (const f of s.bokeh) f.x = (f.x + wd.level * 3.4) % W;
      for (const p of s.smoke) p.x += wd.level * 1.4;
      if (Math.random() < wd.level) s.gusts.push({ x: -10, y: Math.random() * H, v: 5 + Math.random() * 4, len: 4 + Math.floor(Math.random() * 8) });
    }
    s.gusts = s.gusts.filter((g) => (g.x += g.v) < W + 12);
    if (Math.random() < 0.22) s.smoke.push({ x: s.chimney.x, y: s.chimney.y, life: 0, w: Math.random() * 6 });
    for (const p of s.smoke) {
      p.y -= 0.9;
      p.x += 0.45 + Math.sin(p.life / 9 + p.w) * 0.3;
      p.life++;
    }
    s.smoke = s.smoke.filter((p) => p.life < 70);
    if (s.shooting) {
      s.shooting.x += 7;
      s.shooting.y += 2.6;
      if (++s.shooting.life > 20) s.shooting = null;
    } else if (Math.random() < 1 / 320) s.shooting = { x: Math.random() * W * 0.6, y: 10 + Math.random() * H * 0.15, life: 0 };
    const h = s.hare;
    if (h.bolt > 0) h.bolt--;
    if (h.wait > 0) {
      if (--h.wait === 0) h.x = -14;
    } else if (h.rest > 0) h.rest--;
    else {
      h.phase = (h.phase + 1) % 11;
      if (h.phase < 7) h.x += h.bolt > 0 ? 5 : 2.4;
      else if (h.phase === 10 && Math.random() < 0.15) h.rest = 20 + Math.floor(Math.random() * 30);
      if (h.x > W + 14) h.wait = 160 + Math.floor(Math.random() * 300);
    }

    if (s.door && ++s.door.f > 12 * 8) s.door = null;
    const c = s.wcat;
    if (c.f > 0) {
      c.f--;
      if (c.what === 'move' && c.f === 12 * 2) c.at = 1 - c.at; // reappears at the other window
      if (c.f === 0) c.what = null;
    }
    c.hearts = c.hearts.filter((h2) => {
      h2.y -= 0.35;
      return --h2.life > 0;
    });

    const d = s.deer;
    if (d) {
      if (d.stop > 0) d.stop--;
      else {
        d.x += d.dir * 1.1;
        d.f++;
        if (d.stopAt && Math.abs(d.x - d.stopAt) < 1) {
          d.stop = 12 * (4 + Math.random() * 4);
          d.stopAt = 0;
        }
      }
      if (d.x < -30 || d.x > W + 30) s.deer = null;
    }

    for (const k of s.clumps) {
      if (k.wait > 0) k.wait--;
      else {
        k.v += 0.35;
        k.y += k.v;
        if (k.y >= s.ground + 2) {
          k.done = true;
          if (k.thud) sfx('whoomph');
          for (let i = 0; i < 8; i++) s.puffs.push({ x: k.x + 2, y: s.ground + 2, vx: (Math.random() - 0.5) * 1.6, vy: -0.4 - Math.random() * 1.1, life: 10 + Math.floor(Math.random() * 8) });
        }
      }
    }
    s.clumps = s.clumps.filter((k) => !k.done);
    s.puffs = s.puffs.filter((p) => {
      p.vy += 0.08;
      p.x += p.vx;
      p.y += p.vy;
      return --p.life > 0;
    });
    if (s.flare && ++s.flare.f > s.flare.dur) s.flare = null;

    // the robin flies in to the snowman's arm, pecks about, and goes
    const rb = s.robin;
    if (rb) {
      rb.f++;
      if (rb.phase === 'in') {
        const ddx = s.perch.x - rb.x;
        const ddy = s.perch.y - rb.y;
        const dist = Math.hypot(ddx, ddy);
        const step = Math.min(dist, Math.max(0.8, dist * 0.08));
        rb.x += (ddx / (dist || 1)) * step;
        rb.y += (ddy / (dist || 1)) * step;
        if (dist < 1) {
          Object.assign(rb, { phase: 'sit', f: 0, stay: 12 * (10 + Math.random() * 10) });
          sfx('chirp');
        }
      } else if (rb.phase === 'sit') {
        if (rb.f > rb.stay) Object.assign(rb, { phase: 'out', f: 0 });
      } else {
        rb.x += 2.2;
        rb.y -= 1;
        if (rb.x > W + 10 || rb.y < -10) s.robin = null;
      }
    }

    if (--s.ev.wait <= 0) {
      const pick = EVENTS.filter((e) => e !== s.ev.last);
      const e = pick[Math.floor(Math.random() * pick.length)];
      start(s, e);
      s.ev.last = e;
      s.ev.wait = 12 * (20 + Math.random() * 40);
    }
  },
  // levels for the ambience: the wind rises with a blizzard
  sound: (s) => ({ wind: 1 + s.wind.level * 1.2 }),
  hot(s, x, y) {
    const w = onWindow(s, x, y);
    return (w >= 0 && w === s.wcat.at && s.wcat.what !== 'move') || onDoor(s, x, y) || onHare(s, x, y) || onRobin(s, x, y);
  },
  poke(s, x, y) {
    const w = onWindow(s, x, y);
    if (w >= 0 && w === s.wcat.at && s.wcat.what !== 'move') {
      catDo(s, 'paw');
      s.wcat.hearts.push({ x: s.windows[w] + 9, y: s.wy - 4, life: 30 });
      sfx('meow');
    } else if (onDoor(s, x, y)) {
      if (!s.door) {
        s.door = { f: 0 };
        sfx('creak');
      }
    } else if (onHare(s, x, y)) {
      s.hare.bolt = 12 * 3;
      s.hare.rest = 0;
      sfx('boing');
    } else if (onRobin(s, x, y)) {
      Object.assign(s.robin, { phase: 'out', f: 0 });
      sfx('chirp');
      sfx('wings');
    }
    else if (y < s.ground * 0.45 && !s.shooting) s.shooting = { x: x - 20, y: y - 8, life: 0 }; // a hidden one: tap the sky
  },
  draw(s, t) {
    ctxRef.drawImage(s.sky, 0, 0);
    drawStars(s.stars, t);
    if (s.shooting) {
      const { x, y } = s.shooting;
      for (let k = 0; k < 14; k++) px(x - k * 2.6, y - k, k < 3 ? 2 : 1, 1, `rgba(255, 255, 255, ${1 - k / 14})`);
    }
    // aurora: a bright lower edge with rays fading upward, green into violet (now and then it flares up)
    const flare = s.flare ? Math.sin(Math.PI * (s.flare.f / s.flare.dur)) * 0.8 : 0;
    for (let x = 0; x < (s.T.aurora ? W : 0); x++) {
      const base = Math.round(H * 0.3 + Math.sin(x / 61 + t / 4000) * 14 + Math.sin(x / 23 + t / 2600) * 5);
      const power = (0.6 + 0.4 * Math.sin(x / 27 + t / 1500 + Math.sin(x / 53 + t / 3100) * 2)) * (1 + flare);
      const ray = 0.8 + 0.2 * Math.sin(x * 1.3 + t / 900);
      const len = 26 + power * 40;
      let band = -1;
      for (let k = 0; k < len; k++) {
        const f = k / len;
        if (!dith(x, base - k, (1 - f) * (1 - f * 0.3) * power * ray)) continue;
        const b = f < 0.22 ? 0 : f < 0.58 ? 1 : 2;
        if (b !== band) {
          band = b;
          ctxRef.fillStyle = ['rgba(140, 255, 190, 0.5)', 'rgba(80, 215, 190, 0.38)', 'rgba(140, 110, 220, 0.34)'][b];
        }
        ctxRef.fillRect(x, base - k, 1, 1);
      }
    }
    ctxRef.drawImage(s.far, 0, 0);
    ctxRef.drawImage(s.mist, Math.round(-30 + Math.sin(t / 7000) * 24), 0);
    ctxRef.drawImage(s.land, 0, 0);
    for (const p of s.smoke) disc(Math.round(p.x), Math.round(p.y), 2 + Math.floor(p.life / 14), `rgba(205, 212, 228, ${0.3 * (1 - p.life / 70)})`);
    const h = s.hare;
    if (h.wait <= 0) {
      const hop = h.rest <= 0 && h.phase < 7;
      const lift = hop ? Math.round(Math.sin((h.phase / 7) * Math.PI) * 5) : 0;
      px(h.x + 1, s.hareY + 8, 9, 1, 'rgba(110, 135, 180, 0.6)');
      blit(hareFrames[hop ? 1 : 0], h.x, s.hareY - lift);
    }
    const d = s.deer;
    if (d) {
      const img = d.stop > 0 ? (Math.floor(d.stop / 18) % 2 ? deerLook : deerFrames[0]) : deerFrames[Math.floor(d.f / 4) % 2];
      const x = Math.round(d.x) - 8;
      const y = s.deerY - img.h;
      px(x + 2, s.deerY, 13, 1, 'rgba(110, 135, 180, 0.6)');
      if (d.dir > 0) blit(img, x, y);
      else
        for (let j = 0; j < img.h; j++)
          for (let i = 0; i < img.w; i++) {
            const ch = img.rows[j][img.w - 1 - i];
            if (ch !== '.') px(x + i, y + j, 1, 1, deerPal[ch]);
          }
    }
    for (const k of s.clumps) if (k.wait <= 0) {
      px(k.x, k.y, 5, 3, '#f4f8ff');
      px(k.x + 1, k.y - 1, 3, 1, '#f4f8ff');
    }
    for (const p of s.puffs) px(p.x, p.y, 1, 1, '#f4f8ff');
    const rb = s.robin;
    if (rb) {
      if (rb.phase === 'sit') blit(Math.floor(rb.f / 10) % 7 === 3 ? robinPeck : robin, s.perch.x, s.perch.y);
      else {
        const up = Math.floor(rb.f / 2) % 2;
        px(rb.x, rb.y + 1, 5, 2, '#6a4a3a');
        px(rb.x + 1, rb.y + 2, 2, 1, '#e0503c');
        px(rb.x + 1, rb.y + (up ? -1 : 2), 3, 1, '#4a3428');
      }
    }

    // ---- light pass: a cold blue night, warm only near the cabin and the lamp
    applyLight(s.lightmap);

    // firelight inside: panes, curtains and muntins
    const flick = Math.sin(t / 130) * Math.sin(t / 310) > 0.5;
    s.windows.forEach((wx, i) => {
      const wy = s.wy;
      px(wx, wy, 16, 14, flick ? '#ffc25e' : '#ffd277');
      px(wx, wy, 16, 4, flick ? '#ffd88a' : '#ffe6a0');
      px(wx, wy + 11, 16, 3, '#f0a24a');
      px(wx, wy, 3, 14, '#c9584a');
      px(wx + 13, wy, 3, 14, '#c9584a');
      px(wx + 3, wy, 2, 5, '#c9584a');
      px(wx + 11, wy, 2, 5, '#c9584a');
      const c = s.wcat;
      if (i === c.at && !(c.what === 'move' && c.f > 12 * 2 - 1 && c.f < 12 * 4)) {
        // a cat watching the snow
        px(wx + 6, wy + 9, 5, 5, '#3c241a');
        px(wx + 6, wy + 7, 1, 2, '#3c241a');
        px(wx + 10, wy + 7, 1, 2, '#3c241a');
        px(wx + 6, wy + 8, 5, 1, '#3c241a');
        if (c.what === 'paw' && Math.floor(c.f / 6) % 2) px(wx + 11, wy + 5, 2, 4, '#3c241a'); // pawing at the snow on the glass
      }
      px(wx + 7, wy, 2, 14, '#3c241a');
      px(wx, wy + 6, 16, 2, '#3c241a');
    });
    for (const h2 of s.wcat.hearts) drawHeart(h2.x, h2.y, Math.min(1, h2.life / 12));
    if (s.door) drawDoor(s, flick);
    px(s.dx + 20, s.cy + 23, 1, 3, flick ? '#ffc25e' : '#ffe08a');
    // lamp glass (off by day)
    if (s.T.lamp) {
      px(s.lampX - 2, s.ground - 42, 6, 7, '#ffe08a');
      px(s.lampX, s.ground - 42, 2, 7, '#fff6d0');
    }

    ctxRef.drawImage(s.glow, 0, 0);
    if (s.lampShaft) ctxRef.drawImage(s.lampShaft, 0, 0);
    ctxRef.fillStyle = s.T.flakes;
    for (const f of s.snowFar) ctxRef.fillRect(Math.round(f.x + Math.sin(f.p) * 2), Math.round(f.y), 1, 1);
    for (const f of s.snowNear) {
      const x = Math.round(f.x + Math.sin(f.p) * 3);
      const lit = s.T.lamp && Math.abs(x - s.lampX) < 26 && f.y > s.ground - 60 && f.y < s.ground + 14;
      ctxRef.fillStyle = lit ? '#ffe9b0' : '#ffffff';
      ctxRef.fillRect(x, Math.round(f.y), 2, 2);
    }

    for (const g of s.gusts) px(g.x, g.y, g.len, 1, 'rgba(235, 242, 255, 0.45)');
    if (s.wind.level > 0.2) {
      // spindrift streaming low over the snowfield
      const tk = Math.floor(t / 70);
      for (let i = 0; i < W / 10; i++) {
        const a = hash(i * 3.3 + tk * 0.7);
        if (a > s.wind.level) continue;
        px(((hash(i * 7.1) * W + tk * 9) % (W + 20)) - 10, s.ground + 8 + hash(i * 1.9) * (H - s.ground - 10), 6, 1, 'rgba(235, 242, 255, 0.3)');
      }
    }

    // ---- foreground: the framing pines, and big soft flakes drifting right past us
    const { x: vx, y: vy } = look(t);
    ctxRef.drawImage(s.frame, -Math.round(vx * 7), -Math.round(vy * 3));
    for (const f of s.bokeh) {
      const x = Math.round(f.x + Math.sin(f.p) * 5 - vx * 10);
      const y = Math.round(f.y);
      px(x - 1, y - 1, 4, 4, 'rgba(235, 242, 255, 0.22)');
      px(x, y, 2, 2, 'rgba(255, 255, 255, 0.55)');
    }
  },
};

export default cabin;
