import {
  W,
  H,
  ctxRef,
  look,
  rng,
  px,
  disc,
  BAYER,
  bands,
  makeGlow,
  layer,
  shadeEllipse,
  dith,
  hash,
  stroke,
  makeStars,
  drawStars,
  makeLightmap,
  applyLight,
  makeMist,
  makeCloud,
  tod,
  sfx,
} from './kit.js';
import { drawRoofCat, stepCat, drawCatHearts } from './animals.js';

// ------------------------------------------------------------------ scene: neon city

// The neon city at four times of day. Night is the original: a synthwave sky, every sign lit.
// At dawn the sky goes pastel, the haze turns peach and the signs are switching off; by day
// it's a blue sky over pale glass towers with only the odd sign and screen still on; at dusk
// the sky burns orange behind the skyline and the signs are coming on one by one.
// The buildings keep their night colours in the code; tint() lifts them toward the day's light.
const KEEP = new Set(['#ffd98a', '#ff5fd2', '#8a7cb0', '#ffe7a1', '#ff3b3b']); // lamps and neon: never tinted
const TIMES = {
  night: {
    sky: ['#0b0520', '#170a36', '#2c1152', '#521c70', '#8a2d7d', '#c2457e', '#f0708a'],
    sun: { y: 0.3, r: 0.12, cols: ['#fff0a8', '#ffd27a', '#ff8fa0', '#ff5fd2'], glow: 'rgba(255, 120, 200, 0.07)' },
    stars: 1, beams: 1, neon: 1, windows: 1, festoon: true,
    haze: ['rgba(255, 140, 220, 0.14)', 'rgba(255, 140, 220, 0.1)', 'rgba(255, 170, 230, 0.1)'],
    fog: 'rgba(240, 120, 175, 0.24)',
    water: [11, 6, 24], line: '#3a2160', glint: 'rgba(255, 190, 240, 0.2)',
    vignette: 0.45,
  },
  dawn: {
    sky: ['#232a5a', '#3a3a72', '#5c4a88', '#8a5c98', '#c07a9e', '#e8a0a0', '#f8c8a8'],
    sun: { y: 0.4, r: 0.1, cols: ['#fffbe8', '#ffe8c0', '#ffc8b0', '#f0a0b8'], glow: 'rgba(255, 210, 190, 0.08)' },
    stars: 0.25, beams: 0, neon: 0.3, windows: 0.4, festoon: true,
    haze: ['rgba(255, 210, 200, 0.16)', 'rgba(255, 200, 200, 0.12)', 'rgba(255, 230, 220, 0.12)'],
    fog: 'rgba(250, 190, 190, 0.3)',
    water: [56, 48, 86], line: '#7a6aa0', glint: 'rgba(255, 220, 220, 0.22)',
    vignette: 0.35,
    gain: 1.35, lift: [52, 44, 66], tone: [110, 92, 130], mix: 0.25, desat: 0.25,
  },
  day: {
    sky: ['#3e7ed0', '#4a8ad6', '#5a98dc', '#6ea6e0', '#86b6e6', '#a2c6ea', '#bcd4ec'],
    sun: { day: true, y: 0.14, r: 0.045, glow: 'rgba(255, 250, 220, 0.1)' },
    stars: 0, beams: 0, neon: 0.12, windows: 0.06, festoon: false,
    haze: ['rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.14)', 'rgba(255, 255, 255, 0.12)'],
    fog: 'rgba(225, 235, 250, 0.32)',
    water: [50, 84, 120], line: '#9ab8d8', glint: 'rgba(235, 245, 255, 0.35)',
    vignette: 0.18,
    clouds: true,
    gain: 1.6, lift: [70, 88, 108], tone: [112, 132, 160], mix: 0.35, desat: 0.75,
  },
  dusk: {
    sky: ['#1a1040', '#33185a', '#5a2068', '#8a2c6a', '#c8485a', '#f07448', '#ffa848'],
    sun: { y: 0.4, r: 0.11, cols: ['#fff4b0', '#ffc860', '#ff8048', '#e8485a'], glow: 'rgba(255, 150, 90, 0.09)' },
    stars: 0.4, beams: 0.5, neon: 0.7, windows: 0.75, festoon: true,
    haze: ['rgba(255, 170, 150, 0.15)', 'rgba(255, 150, 140, 0.11)', 'rgba(255, 190, 160, 0.1)'],
    fog: 'rgba(245, 140, 140, 0.26)',
    water: [22, 10, 34], line: '#5a2a60', glint: 'rgba(255, 190, 170, 0.22)',
    vignette: 0.4,
    gain: 1.1, lift: [14, 4, 10], tone: [60, 30, 70], mix: 0.12,
  },
};

/** Colour mapper for a time of day: night colours as they are, others lifted toward its light. */
function tinter(T) {
  if (!T.lift) return (h) => h;
  return (h) => {
    if (KEEP.has(h)) return h;
    const n = parseInt(h.slice(1), 16);
    const rgb = [n >> 16, (n >> 8) & 255, n & 255];
    const lum = rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11; // the night's purple, greyed toward daylight
    return '#' + rgb
      .map((v, i) => {
        const a = Math.min(255, (v + (lum - v) * (T.desat || 0)) * T.gain + T.lift[i]);
        return Math.round(a + (T.tone[i] - a) * T.mix).toString(16).padStart(2, '0');
      })
      .join('');
  };
}
/** Whether a lit thing (a window, a sign) is still on at this time of day, steadily per thing. */
const stillOn = (frac, k) => frac >= 1 || hash(k * 1.913 + 0.37) < frac;

const noteSprite = ['..n..', '..nn.', '..n.n', '..n..', '.nn..', 'nnn..', '.n...'];

// the big screen's ad break: a cat, blinking. p pink · k eyes · w nose and mouth
const TV_CAT = ['.p.........p.', '.pp.......pp.', '.ppp.....ppp.', '.ppppppppppp.', 'ppppppppppppp', 'ppkkpppppkkpp', 'ppkkpppppkkpp', 'ppppppwpppppp', '.ppppwpwpppp.', '..ppppppppp..'];

// Little things that happen now and then (one every 20 to 60 seconds, never the same twice running):
// fireworks over the skyline, a sign shorting out in a spray of sparks, the big screen cutting to
// static for a cat ad, a passing neon shower, the express train, the cat looking round or flicking an ear.
const EVENTS = ['fireworks', 'sign', 'screen', 'shower', 'cat', 'train', 'fireworks', 'cat'];
// the rooftop cat's habits, as poses held for a number of frames (12 a second); see drawRoofCat()
const CAT = {
  twitch: [['twitch', 5], ['sit', 10], ['twitch', 4], ['sit', 0]],
  left: [['turnL', 36], ['sit', 0]],
  right: [['turnR', 36], ['sit', 0]],
  up: [['up', 12 * 9], ['sit', 0]], // watching the fireworks
  pet: [['turnR', 14], ['sit', 3], ['turnL', 16], ['turnR', 20], ['sit', 0]],
};
const FIRE = ['#ff5fd2', '#4ff0ff', '#ffd23f', '#9dff6a', '#ff7a5c', '#b48aff', '#ffffff'];
const SCREEN = 12 * 9; // how long the ad break lasts
const pickOf = (list) => list[Math.floor(Math.random() * list.length)];

function catDo(s, habit, force = false) {
  const c = s.cat;
  if (!force && (c.pose !== 'sit' || c.script.length)) return;
  c.script = CAT[habit].slice();
  c.hold = 0;
}

/** A shell climbs out from behind the skyline at x and bursts at height top. */
function launch(s, x = W * (0.12 + Math.random() * 0.76), top = H * (0.06 + Math.random() * 0.12)) {
  s.fw.shells.push({ x, y: s.water - 8, top, c: pickOf(FIRE), v: 6 + Math.random() });
  sfx('firework');
}

function burst(s, sh) {
  const n = 28 + Math.floor(Math.random() * 12);
  const speed = 2.5 + Math.random() * 0.9;
  const c2 = Math.random() < 0.4 ? pickOf(FIRE) : sh.c;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
    const v = speed * (0.85 + Math.random() * 0.3);
    const life = 24 + Math.floor(Math.random() * 12);
    s.fw.parts.push({ x: sh.x, y: sh.y, px: sh.x, py: sh.y, qx: sh.x, qy: sh.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, c: i % 2 ? c2 : sh.c });
  }
  s.fw.flash = { c: sh.c, a: 1 };
  s.fw.pops.push({ x: sh.x, y: sh.y, c: sh.c, f: 0 });
}

function start(s, e) {
  if (e === 'fireworks') {
    s.fw.queue = 4 + Math.floor(Math.random() * 5);
    catDo(s, 'up');
  } else if (e === 'sign' && !s.short) {
    const seen = s.signs.filter((sg) => sg.on && sg.x > 4 && sg.x < W - 14);
    if (seen.length) {
      s.short = { sg: pickOf(seen), f: 0 };
      sfx('spark');
    }
  } else if (e === 'screen' && s.eq && !s.screen) s.screen = { f: 0 };
  else if (e === 'shower') {
    s.shower.target = 1;
    s.shower.hold = 12 * (16 + Math.random() * 14);
  } else if (e === 'train' && s.train.x <= -400) s.train.next = 1;
  else if (e === 'cat') {
    if (Math.random() < 0.35) s.swish = 12 * 4;
    else catDo(s, pickOf(['twitch', 'left', 'right']));
  }
}

const signSize = (sg) => (sg.kind === 'v' ? [9, sg.glyphs.length * 7 + 3] : [sg.w, 11]);

/** Whether a sign is lit at t: mostly steady with the odd flicker, unless it is the one shorting out. */
function signLit(s, sg, t) {
  const sh = s.short;
  if (sh && sh.sg === sg) {
    if (sh.f < 30) return hash(sh.f * 3.1 + sg.x) > 0.45;
    if (sh.f < 66) return false;
    if (sh.f < 86) return hash(sh.f * 1.7 + sg.y) > 0.35;
  }
  return Math.sin(t / 500 + sg.p) > -0.8 && Math.floor(t / 80 + sg.p * 7) % 47 !== 0;
}

/** What is on the rooftop at screen point (x, y): 'cat', 'boom' or null. The rooftop slides with the view. */
function roofThing(s, x, y) {
  const { x: vx, y: vy } = look(performance.now());
  const rx = x + Math.round(vx * 5);
  const ry = y + Math.round(vy * 2);
  if (Math.abs(rx - s.catX) <= 10 && ry >= s.ledge - 33 && ry < s.ledge + 2) return 'cat';
  const b = s.boom;
  if (b && rx >= b.x - 2 && rx < b.x + 36 && ry >= b.y - 16 && ry < b.y + 16) return 'boom';
  return null;
}

function drawFireworks(s) {
  const fw = s.fw;
  if (fw.flash) px(-4, 0, W + 8, s.water, fw.flash.c + Math.round(fw.flash.a * 34).toString(16).padStart(2, '0'));
  for (const sh of fw.shells) {
    const x = Math.round(sh.x);
    const y = Math.round(sh.y);
    px(x, y, 1, 2, '#ffe7a1');
    for (let k = 1; k < 4; k++) if (dith(x, y + k, 1 - k / 4)) px(x, y + 1 + k * 2, 1, 1, '#ffb070');
  }
  for (const p of fw.parts) {
    const f = p.life / p.max;
    if (f < 0.3 && p.life % 2) continue; // fading out: every other frame
    px(p.qx, p.qy, 1, 1, p.c + '30');
    px(p.px, p.py, 1, 1, p.c + '70');
    px(p.x, p.y, 1, 1, f > 0.85 ? '#ffffff' : p.c);
    if (f > 0.6) px(p.x - 1, p.y - 1, 3, 3, p.c + '28');
  }
  // the bang: a bright core that blooms and fades over a few frames
  for (const p of fw.pops) {
    const r = 2 + p.f * 2;
    px(p.x - r, p.y - r, r * 2 + 1, r * 2 + 1, p.c + ['50', '38', '24', '14', '0a'][p.f]);
    if (p.f < 2) px(p.x - 1, p.y - 1, 3, 3, '#ffffff');
  }
}

/** The big screen during the ad break: static, a blinking cat, static again. */
function drawScreen(s) {
  const e = s.eq;
  const f = s.screen.f;
  px(e.x, e.y, e.w, e.h, '#07030f');
  if (f < 14 || f > SCREEN - 10) {
    for (let y = 0; y < e.h; y++)
      for (let x = 0; x < e.w; x++) {
        const v = hash(x * 13.1 + y * 7.7 + f * 3.3);
        if (v > 0.45) px(e.x + x, e.y + y, 1, 1, v > 0.8 ? '#d5e8ff' : '#6a5a9a');
      }
    return;
  }
  px(e.x, e.y, e.w, e.h, '#1a0c34');
  const k = 2;
  const ox = e.x + ((e.w - 13 * k) >> 1);
  const oy = e.y + ((e.h - 10 * k) >> 1);
  const blink = f % 40 > 36;
  TV_CAT.forEach((row, j) => {
    for (let i = 0; i < 13; i++) {
      let ch = row[i];
      if (ch === '.') continue;
      if (blink && ch === 'k' && j === 5) ch = 'p';
      px(ox + i * k, oy + j * k, k, k, ch === 'p' ? '#ff5fd2' : ch === 'k' ? '#07030f' : '#ffffff');
    }
  });
  if (!blink) {
    px(ox + 2 * k, oy + 5 * k, 1, 1, '#ffffff');
    px(ox + 9 * k, oy + 5 * k, 1, 1, '#ffffff');
  }
  for (let y = e.y + ((f >> 1) % 4); y < e.y + e.h; y += 4) px(e.x, y, e.w, 1, 'rgba(0, 0, 0, 0.25)');
}

function drawGlyph(g, x, y, color) {
  ctxRef.fillStyle = color;
  for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (g[j] & (1 << i)) ctxRef.fillRect(x + i, y + j, 1, 1);
}

const neon = {
  id: 'city',
  name: 'เมืองนีออน',
  en: 'Neon city',
  accent: '#ff5fd2',
  init() {
    const r = rng(41);
    const T = TIMES[tod] || TIMES.night;
    const c = tinter(T);
    // a window lit at night, or dark glass by day
    const glass = (col, x, y) => (stillOn(T.windows, x * 31 + y * 7) ? col : c('#1a0c34'));
    const narrow = W < 420;
    const water = Math.round(H * 0.64);
    const track = water - 16; // deck of the elevated line
    const ledge = Math.round(H * 0.87); // the rooftop we are sitting on
    const sun = { x: Math.round(W * 0.68), y: Math.round(H * T.sun.y), r: Math.round(H * T.sun.r) };
    const SIGN = ['#ff5fd2', '#4ff0ff', '#ffd23f', '#9dff6a', '#ff7a5c', '#b48aff'];
    const pick = (list) => list[Math.floor(r() * list.length)];
    // made-up signage: symmetric 5x5 glyphs
    const glyph = () => {
      const rows = [];
      for (let j = 0; j < 5; j++) {
        let bits = 0;
        for (let i = 0; i < 3; i++) if (r() < 0.6) bits |= (1 << i) | (1 << (4 - i));
        rows.push(bits);
      }
      return rows;
    };
    const row = (minH, maxH, wMin, wMax) => {
      const out = [];
      let x = -6;
      while (x < W) {
        const w = wMin + Math.floor(r() * (wMax - wMin));
        out.push({ x, w, top: water - Math.round(H * (minH + r() * (maxH - minH))), kind: r(), seed: Math.floor(r() * 1000) });
        x += w + (r() < 0.25 ? 2 : 0);
      }
      return out;
    };
    const back = row(0.2, 0.46, 12, 30);
    const mid = row(0.14, 0.36, 18, 40);
    const front = row(0.1, 0.3, 26, 56);
    const signs = [];
    const tvs = [];
    const beacons = [];
    let eq = null;

    const sky = layer(() => {
      bands(0, 0, W, water, T.sky);
      ctxRef.drawImage(makeGlow(sun.x, sun.y, sun.r * 2.5, sun.r * 2.5, T.sun.glow, 4), 0, 0);
      if (T.sun.day) {
        disc(sun.x, sun.y, sun.r, '#fff8dc');
        disc(sun.x - 1, sun.y - 1, sun.r - 2, '#fffdf2');
        if (T.clouds) {
          const cr = rng(5);
          for (let k = 0; k < Math.max(3, Math.round(W / 220)); k++) {
            const w = 50 + Math.floor(cr() * 70);
            const cl = makeCloud(cr, w, 14 + Math.floor(cr() * 8), ['#ffffff', '#f2f6fc', '#dce6f4', '#c4d2ea']);
            ctxRef.drawImage(cl, Math.round(cr() * W - w / 2), Math.round(H * (0.05 + cr() * 0.22)));
          }
        }
        return;
      }
      const [s0, s1, s2, s3] = T.sun.cols;
      // retro sun: yellow into pink, sliced by widening gaps
      shadeEllipse(sun.x, sun.y, sun.r, sun.r, (nx, ny, x, y) => {
        const v = (ny + 1) / 2;
        if (v > 0.5) {
          const low = (v - 0.5) * 2;
          if ((low * 5) % 1 < 0.16 + low * 0.42) return null;
        }
        if (v < 0.35) return dith(x, y, v / 0.35) ? s1 : s0;
        if (v < 0.7) return dith(x, y, (v - 0.35) / 0.35) ? s2 : s1;
        return dith(x, y, (v - 0.7) / 0.3) ? s3 : s2;
      });
    });

    const city = layer(() => {
      for (const b of back) {
        px(b.x, b.top, b.w, water - b.top, c('#2b1654'));
        px(b.x, b.top, 1, water - b.top, c('#3a2068'));
        if (b.kind < 0.3) {
          px(b.x + (b.w >> 1), b.top - 14, 1, 14, c('#2b1654'));
          px(b.x + (b.w >> 1) - 2, b.top - 4, 5, 4, c('#2b1654'));
        } else if (b.kind < 0.5) px(b.x + 3, b.top - 5, b.w - 6, 5, c('#2b1654'));
        for (let y = b.top + 4; y < water; y += 5) for (let x = b.x + 2; x < b.x + b.w - 2; x += 4) if (r() < 0.16) px(x, y, 1, 2, glass('#6a48b0', x, y));
      }
      const midLit = ['#8a62d0', '#d070c8', '#5a9ae0', '#f0a0d8'];
      for (const b of mid) {
        px(b.x, b.top, b.w, water - b.top, c('#1d0f40'));
        px(b.x, b.top, 1, water - b.top, c('#2c1858'));
        px(b.x + b.w - 2, b.top, 2, water - b.top, c('#160a32'));
        if (b.kind < 0.35) {
          px(b.x + 4, b.top - 6, b.w - 8, 6, c('#1d0f40'));
          px(b.x + 8, b.top - 11, b.w - 16, 5, c('#1d0f40'));
        }
        for (let y = b.top + 4; y < water - 2; y += 5) for (let x = b.x + 3; x < b.x + b.w - 4; x += 5) if (r() < 0.26) px(x, y, 2, 2, glass(pick(midLit), x, y));
      }
      const lit = ['#ff9fe4', '#8ff6ff', '#ffd98a', '#c6a4ff'];
      for (const b of front) {
        const tall = water - b.top;
        px(b.x, b.top, b.w, tall, c('#120824'));
        px(b.x, b.top, 2, tall, c('#22124a'));
        px(b.x, b.top, b.w, 1, c('#3a2068'));
        px(b.x + b.w - 3, b.top, 3, tall, c('#0c051a'));
        const own = lit[b.seed % lit.length];
        for (let y = b.top + 6; y < track - 6; y += 8) {
          px(b.x + 2, y + 5, b.w - 5, 1, c('#1b0d36'));
          for (let x = b.x + 5; x < b.x + b.w - 7; x += 6) {
            if (r() < 0.36) {
              px(x, y, 3, 4, glass(r() < 0.75 ? own : pick(lit), x, y));
              px(x, y + 3, 3, 1, 'rgba(0, 0, 0, 0.25)');
              if (r() < 0.3) px(x, y, 3, 2, 'rgba(0, 0, 0, 0.3)');
              if (r() < 0.08) tvs.push({ x, y });
            } else px(x, y, 3, 4, c('#1a0c34'));
          }
        }
        // on the roof: a water tank, an antenna with a beacon, or vents and maybe a billboard
        if (b.kind < 0.3) {
          const tx = b.x + 5;
          px(tx, b.top - 10, 10, 8, c('#1c0e38'));
          px(tx, b.top - 10, 10, 1, c('#3a2068'));
          px(tx + 1, b.top - 12, 8, 2, c('#120824'));
          px(tx + 1, b.top - 2, 1, 2, c('#120824'));
          px(tx + 8, b.top - 2, 1, 2, c('#120824'));
        } else if (b.kind < 0.6) {
          const ax = b.x + Math.floor(b.w * 0.6);
          px(ax, b.top - 18, 1, 18, c('#120824'));
          px(ax - 2, b.top - 12, 5, 1, c('#120824'));
          px(ax - 1, b.top - 8, 3, 1, c('#120824'));
          beacons.push({ x: ax, y: b.top - 19, p: r() * 6 });
        } else {
          px(b.x + 4, b.top - 4, 7, 4, c('#1c0e38'));
          px(b.x + 4, b.top - 4, 7, 1, c('#3a2068'));
          if (b.w > 34 && r() < 0.85) {
            const w = Math.min(b.w - 16, 44);
            const count = Math.floor((w - 3) / 7);
            px(b.x + 16, b.top - 4, 1, 4, c('#120824'));
            px(b.x + 13 + w, b.top - 4, 1, 4, c('#120824'));
            signs.push({ kind: 'h', x: b.x + 13, y: b.top - 16, w: count * 7 + 3, c: pick(SIGN), p: r() * 10, glyphs: Array.from({ length: count }, glyph) });
          }
        }
        const fit = Math.min(6, Math.floor((tall - 34) / 7));
        if (fit >= 2 && r() < 0.55)
          signs.push({ kind: 'v', x: b.x + b.w - 13, y: b.top + 7, c: pick(SIGN), p: r() * 10, glyphs: Array.from({ length: fit }, glyph) });
      }
      // a big screen showing an equaliser, on a wide building near the middle
      const host = front.find((b) => b.x > W * 0.3 && b.w > 38 && water - b.top > 60) || front.find((b) => b.w > 38 && water - b.top > 60);
      if (host) {
        for (let i = signs.length - 1; i >= 0; i--) if (signs[i].kind === 'v' && signs[i].x > host.x && signs[i].x < host.x + host.w) signs.splice(i, 1);
        eq = { x: host.x + 6, y: host.top + 8, w: Math.min(host.w - 13, 38), h: 24 };
        px(eq.x - 2, eq.y - 2, eq.w + 4, eq.h + 4, c('#2c1858'));
        px(eq.x - 1, eq.y - 1, eq.w + 2, eq.h + 2, c('#07030f'));
      }
      // the elevated line: deck, railing lamps and piers standing in the water
      for (let x = 10; x < W; x += 46) {
        px(x, track + 4, 4, water - track, c('#1d1036'));
        px(x, track + 4, 1, water - track, c('#2c1858'));
        px(x - 3, track + 4, 10, 2, c('#241446'));
      }
      px(0, track, W, 3, c('#34205e'));
      px(0, track, W, 1, c('#5a3a9a'));
      px(0, track + 3, W, 1, c('#1a0e34'));
      for (let x = 4, i = 0; x < W; x += 23, i++) {
        px(x, track - 3, 1, 3, c('#34205e'));
        if (i % 2) px(x, track - 4, 1, 1, '#ffd98a');
      }
    });

    // mirror the skyline into the water once; the draw loop ripples it row by row
    const rh = H - water;
    const refl = document.createElement('canvas');
    refl.width = W;
    refl.height = rh;
    const rc = refl.getContext('2d');
    const [wr, wg, wb] = T.water;
    rc.fillStyle = T.water === TIMES.night.water ? '#0b0618' : `rgb(${wr}, ${wg}, ${wb})`;
    rc.fillRect(0, 0, W, rh);
    rc.save();
    rc.translate(0, rh);
    rc.scale(1, -1);
    rc.drawImage(sky, 0, water - rh, W, rh, 0, 0, W, rh);
    rc.drawImage(city, 0, water - rh, W, rh, 0, 0, W, rh);
    rc.restore();
    for (let y = 0; y < rh; y++) {
      rc.fillStyle = `rgba(${wr}, ${wg}, ${wb}, ${0.42 + (y / rh) * 0.45})`;
      rc.fillRect(0, y, W, 1);
    }

    const catX = Math.round(W * (narrow ? 0.5 : 0.57));
    const boom = narrow ? null : { x: Math.round(W * 0.66), y: ledge - 15 };
    const fg = layer(() => {
      // parapet wall
      px(0, ledge, W, H - ledge, c('#0d0719'));
      px(0, ledge, W, 2, c('#4a2a7a'));
      px(0, ledge + 2, W, 1, c('#1d1036'));
      for (let y = ledge + 9, i = 0; y < H; y += 7, i++) {
        px(0, y, W, 1, c('#170c2c'));
        for (let x = i % 2 ? 0 : 9; x < W; x += 18) px(x, y - 6, 1, 6, c('#170c2c'));
      }
      // a can beside it
      px(catX - 20, ledge - 7, 5, 7, c('#2a1d45'));
      px(catX - 20, ledge - 7, 5, 1, c('#8a7cb0'));
      px(catX - 20, ledge - 4, 5, 1, c('#ff5fd2'));
      if (!narrow) {
        // plants in pots
        const pot = (x) => {
          px(x - 5, ledge - 9, 11, 9, c('#1c1232'));
          px(x - 6, ledge - 10, 13, 2, c('#34205e'));
          px(x + 4, ledge - 8, 2, 8, c('#120a22'));
        };
        const p1 = Math.round(W * 0.46);
        pot(p1);
        for (const [lx, ly] of [[-6, -4], [6, -5], [-8, -10], [8, -11], [-3, -12], [4, -14], [0, -18], [-5, -17], [6, -19]])
          shadeEllipse(p1 + lx, ledge - 10 + ly, 4.5, 2.6, (nx, ny) => (Math.abs(ny) < 0.2 ? c('#0d2a26') : nx - ny > 0.5 ? c('#2f7a6a') : c('#16433c')));
        const p2 = p1 + 20;
        pot(p2);
        for (const [bx, bh] of [[-4, 14], [-2, 20], [0, 25], [2, 18], [4, 12]]) {
          for (let k = 0; k < bh; k++) px(p2 + bx + Math.round((k / bh) * (bx / 2)), ledge - 10 - k, k > bh - 3 ? 1 : 2, 1, k % 5 === 0 ? c('#2f7a6a') : c('#16433c'));
        }
        // boombox
        const { x: bx, y: by } = boom;
        px(bx, by, 30, 15, c('#1c1232'));
        px(bx, by, 30, 1, c('#4a2a7a'));
        px(bx + 28, by, 2, 15, c('#120a22'));
        px(bx + 6, by - 4, 18, 1, c('#34205e'));
        px(bx + 6, by - 4, 1, 4, c('#34205e'));
        px(bx + 23, by - 4, 1, 4, c('#34205e'));
        stroke(bx + 27, by, bx + 34, by - 14, c('#34205e'));
        for (const sx of [bx + 6, bx + 23]) {
          disc(sx, by + 8, 4, c('#07030f'));
          disc(sx, by + 8, 2, c('#34205e'));
          px(sx, by + 8, 1, 1, c('#8a7cb0'));
        }
        px(bx + 11, by + 3, 8, 6, c('#07030f'));
      }
    });

    // which signs are on at this time of day (all at night; few by day)
    for (const sg of signs) sg.on = stillOn(T.neon, sg.x * 13 + sg.y);
    return {
      T,
      c,
      narrow,
      water,
      track,
      ledge,
      rh,
      sky,
      city,
      refl,
      fg,
      signs,
      tvs,
      beacons,
      eq,
      catX,
      boom,
      stars: makeStars(r, W * 0.2, H * 0.4, ['#f3d9ff', '#c9a8ff', '#ffffff']),
      train: { x: -400, next: 50 },
      blimp: { x: W * 0.12, y: Math.round(H * 0.17) },
      beams: [
        { x: W * 0.22, a: -1.9, v: 0.006 },
        { x: W * 0.5, a: -1.2, v: -0.005 },
        { x: W * 0.86, a: -1.6, v: 0.004 },
      ],
      haze: Array.from({ length: 6 }, () => ({ x: r() * W, y: H * 0.14 + r() * H * 0.3, w: 50 + r() * 90, v: 0.08 + r() * 0.1 })),
      cars: Array.from({ length: narrow ? 3 : 7 }, (_, i) => ({ x: r() * W, y: Math.round(H * (0.33 + (i % 3) * 0.055)), v: (i % 2 ? -1 : 1) * (1.2 + r() * 1.4) })),
      notes: [],
      cat: { pose: 'sit', script: [], hold: 0, hearts: [] },
      ev: { wait: 12 * 5, last: null },
      fw: { shells: [], parts: [], pops: [], queue: 0, gap: 0, flash: null },
      sparks: [],
      short: null,
      screen: null,
      shower: { level: 0, target: 0, hold: 0, drops: [], rings: [] },
      swish: 0,
      happy: 0,
      boomKick: 0,
      // each sign washes the wall around it in its own colour
      signGlow: layer(() => {
        for (const sg of signs) {
          const w = sg.kind === 'v' ? 9 : sg.w;
          const h = sg.kind === 'v' ? sg.glyphs.length * 7 + 3 : 11;
          ctxRef.drawImage(makeGlow(sg.x + w / 2, sg.y + h / 2, w / 2 + 16, h / 2 + 14, sg.c + '1e', 3), 0, 0);
        }
        if (eq) ctxRef.drawImage(makeGlow(eq.x + eq.w / 2, eq.y + eq.h / 2, eq.w / 2 + 18, eq.h / 2 + 16, '#4ff0ff1a', 3), 0, 0);
      }),
      // pink haze rising off the water, hiding the feet of the skyline
      fog: makeMist(water - 80, water - 30, water - 17, T.fog, 0.7, W + 24),
      lightmap: makeLightmap('#ffffff', [], { vignette: T.vignette }),
      // string lights over the rooftop, right above us
      festoon: (() => {
        const x0 = Math.round(W * (narrow ? 0.05 : 0.22));
        const x1 = W + 12;
        const sag = H * 0.13;
        const wire = [];
        for (let x = x0; x <= x1; x++) {
          const f = (x - x0) / (x1 - x0);
          wire.push([x, Math.round(-6 + f * (H * 0.05 + 6) + Math.sin(f * Math.PI) * sag)]);
        }
        return { wire, bulbs: wire.filter((_, i) => i % 19 === 9) };
      })(),
    };
  },
  update(s) {
    for (const h of s.haze) {
      h.x += h.v;
      if (h.x > W) h.x = -h.w;
    }
    s.blimp.x += 0.18;
    if (s.blimp.x > W + 50) s.blimp.x = -60;
    for (const b of s.beams) {
      b.a += b.v;
      if (b.a < -2.3 || b.a > -0.8) b.v *= -1;
    }
    for (const c of s.cars) {
      c.x += c.v;
      if (c.x > W + 10) c.x = -10;
      if (c.x < -10) c.x = W + 10;
    }
    const tr = s.train;
    if (tr.x > -400) {
      tr.x += 6;
      if (tr.x > W + 20) {
        tr.x = -400;
        tr.next = 110 + Math.floor(Math.random() * 150);
      }
    } else if (--tr.next <= 0) {
      tr.x = -260;
      sfx('train');
    }
    if (s.boom && Math.random() < (s.boomKick > 0 ? 0.45 : 0.07)) s.notes.push({ x: s.boom.x + 8 + Math.random() * 14, y: s.boom.y - 6, life: 0, c: Math.random() < 0.5 ? '#ff8fe0' : '#7ff6ff', p: Math.random() * 6 });
    for (const n of s.notes) {
      n.y -= 0.7;
      n.life++;
    }
    s.notes = s.notes.filter((n) => n.life < 46);

    stepCat(s.cat); // the cat works through whatever it is doing, a pose at a time
    if (s.swish > 0) s.swish--;
    if (s.happy > 0) s.happy--;
    if (s.boomKick > 0) s.boomKick--;

    // fireworks: shells climb out from behind the skyline, burst, and the sparks drift down and fade
    const fw = s.fw;
    if (fw.queue > 0 && --fw.gap <= 0) {
      launch(s);
      if (Math.random() < 0.3) launch(s);
      fw.queue--;
      fw.gap = 8 + Math.floor(Math.random() * 18);
    }
    fw.shells = fw.shells.filter((sh) => {
      sh.y -= sh.v;
      sh.v = Math.max(2.5, sh.v * 0.985);
      if (sh.y > sh.top) return true;
      burst(s, sh);
      return false;
    });
    fw.parts = fw.parts.filter((p) => {
      p.qx = p.px;
      p.qy = p.py;
      p.px = p.x;
      p.py = p.y;
      p.vx *= 0.95;
      p.vy = p.vy * 0.95 + 0.03;
      p.x += p.vx;
      p.y += p.vy;
      return --p.life > 0;
    });
    if (fw.flash && (fw.flash.a -= 0.1) <= 0) fw.flash = null;
    fw.pops = fw.pops.filter((p) => ++p.f < 5);

    // a sign shorting out: it stutters, spits sparks, dies, and buzzes back
    if (s.short) {
      const { sg } = s.short;
      if (s.short.f < 34 && Math.random() < 0.5) {
        const [w, h] = signSize(sg);
        s.sparks.push({ x: sg.x + Math.random() * w, y: sg.y + h, vx: (Math.random() - 0.5) * 1.2, vy: -Math.random() * 0.8, life: 12 + Math.floor(Math.random() * 10) });
      }
      if (++s.short.f > 96) s.short = null;
    }
    s.sparks = s.sparks.filter((p) => {
      p.vy += 0.12;
      p.x += p.vx;
      p.y += p.vy;
      return --p.life > 0 && p.y < s.water;
    });
    if (s.screen && ++s.screen.f > SCREEN) s.screen = null;

    // a passing shower, the rain lit up by the signs
    const sw = s.shower;
    if (sw.hold > 0) sw.hold--;
    else sw.target = 0;
    sw.level += (sw.target - sw.level) * 0.03;
    if (sw.target === 0 && sw.level < 0.01) sw.level = 0;
    const want = Math.round(W * 0.3 * sw.level);
    while (sw.drops.length < want) sw.drops.push({ x: Math.random() * (W + 30), y: Math.random() * H, v: 6 + Math.random() * 3, near: Math.random() < 0.3 });
    if (sw.drops.length > want) sw.drops.length = want;
    for (const d of sw.drops) {
      d.y += d.v;
      d.x -= d.v * 0.2;
      if (d.y > H) {
        if (Math.random() < 0.4) sw.rings.push({ x: d.x, y: s.water + 3 + Math.random() * (s.ledge - s.water - 6), life: 6 });
        d.y = -8;
        d.x = Math.random() * (W + 30);
      }
    }
    sw.rings = sw.rings.filter((g) => --g.life > 0);

    if (--s.ev.wait <= 0) {
      const pick = EVENTS.filter((e) => e !== s.ev.last);
      const e = pick[Math.floor(Math.random() * pick.length)];
      start(s, e);
      s.ev.last = e;
      s.ev.wait = 12 * (20 + Math.random() * 40);
    }
  },
  hot(s, x, y) {
    return !!roofThing(s, x, y);
  },
  // levels for the ambience: rain on the rooftop while the neon shower passes
  sound: (s) => ({ rain: s.shower.level }),
  poke(s, x, y) {
    const thing = roofThing(s, x, y);
    if (thing === 'cat') {
      catDo(s, 'pet', true);
      s.happy = 12 * 4;
      sfx(s.cat.hearts.length ? 'meow' : 'purr');
      s.cat.hearts.push({ x: s.catX - 4, y: s.ledge - 38, life: 34 }, { x: s.catX + 3, y: s.ledge - 34, life: 26 });
    } else if (thing === 'boom') {
      s.boomKick = 12 * 3;
      sfx('boing');
    }
    else if (y < s.track - 40 && s.fw.shells.length < 3) launch(s, x - Math.round(look(performance.now()).x * 2), y); // a hidden one: tap the sky
  },
  draw(s, t) {
    const { water, track, ledge } = s;
    const { T, c } = s;
    ctxRef.drawImage(s.sky, 0, 0);
    if (T.stars) {
      ctxRef.globalAlpha = T.stars;
      drawStars(s.stars, t);
      ctxRef.globalAlpha = 1;
    }
    // searchlights sweeping the haze
    ctxRef.fillStyle = T.beams === 1 ? 'rgba(220, 200, 255, 0.08)' : `rgba(220, 200, 255, ${0.08 * T.beams})`;
    if (T.beams) for (const b of s.beams) {
      for (let d = 0; d < H * 0.85; d += 1) {
        const x = Math.round(b.x + Math.cos(b.a) * d);
        const y = Math.round(water - H * 0.1 + Math.sin(b.a) * d);
        if (BAYER[y & 3][x & 3] < 9) {
          const w = 1 + d * 0.08;
          ctxRef.fillRect(Math.round(x - w / 2), y, Math.round(w), 1);
        }
      }
    }
    for (const h of s.haze) {
      const x = Math.round(h.x);
      const y = Math.round(h.y);
      const w = Math.round(h.w);
      px(x, y, w, 1, T.haze[0]);
      px(x + 8, y + 1, w - 20, 1, T.haze[1]);
      px(x + 14, y - 1, w - 36, 1, T.haze[2]);
    }
    // traffic in the sky lanes
    for (const c of s.cars) {
      const dir = Math.sign(c.v);
      px(c.x - dir * 5, c.y, 5, 1, 'rgba(255, 255, 255, 0.14)');
      px(c.x, c.y, 3, 1, dir > 0 ? '#fff3c0' : '#ff5a6a');
    }
    // blimp with a scrolling light strip
    const bx = Math.round(s.blimp.x);
    const by = s.blimp.y;
    px(bx - 31, by - 7, 7, 5, c('#2c1d50'));
    px(bx - 31, by + 3, 7, 5, c('#2c1d50'));
    shadeEllipse(bx, by, 26, 8, (nx, ny) => c(ny < -0.45 ? '#5a4690' : ny > 0.5 ? '#241640' : '#3a2a66'));
    px(bx - 6, by + 8, 12, 3, c('#1c1232'));
    for (let k = 0; k < 3; k++) px(bx - 4 + k * 4, by + 9, 2, 1, '#ffe7a1');
    const strip = Math.floor(t / 2400) % 2 ? '#4ff0ff' : '#ff5fd2';
    for (let k = 0; k < 15; k++) px(bx - 15 + k * 2, by - 1, 1, 3, (k + Math.floor(t / 160)) % 5 < 3 ? strip : c('#2a1d45'));
    if (Math.floor(t / 700) % 2) px(bx + 26, by, 1, 1, '#ff3b3b');

    // ---- the city and the water, a little behind the rooftop: they drift with the view
    const { x: vx, y: vy } = look(t);
    ctxRef.save();
    ctxRef.translate(Math.round(vx * 2), 0);
    drawFireworks(s);
    ctxRef.drawImage(s.city, 0, 0);
    if (T.neon === 1) ctxRef.drawImage(s.signGlow, 0, 0);
    else if (T.neon > 0.5) {
      ctxRef.globalAlpha = T.neon * 0.6;
      ctxRef.drawImage(s.signGlow, 0, 0);
      ctxRef.globalAlpha = 1;
    }
    for (const tv of s.tvs) if (stillOn(T.windows, tv.x * 31 + tv.y * 7)) px(tv.x, tv.y, 3, 3, Math.floor(t / 170 + tv.x) % 3 ? '#6fa8ff' : '#d5e8ff');
    for (const b of s.beacons) if (Math.sin(t / 450 + b.p) > 0.2) {
      px(b.x - 1, b.y - 1, 3, 3, 'rgba(255, 60, 60, 0.3)');
      px(b.x, b.y, 1, 1, '#ff4a4a');
    }
    // neon signs: mostly steady, with the odd flicker
    for (const sg of s.signs) {
      const on = sg.on && signLit(s, sg, t);
      const col = on ? sg.c : c('#3a2050');
      const vertical = sg.kind === 'v';
      const w = vertical ? 9 : sg.w;
      const h = vertical ? sg.glyphs.length * 7 + 3 : 11;
      if (on) px(sg.x - 2, sg.y - 2, w + 4, h + 4, sg.c + '22');
      px(sg.x, sg.y, w, h, c('#0b0618'));
      px(sg.x, sg.y, w, 1, col);
      px(sg.x, sg.y + h - 1, w, 1, col);
      px(sg.x, sg.y, 1, h, col);
      px(sg.x + w - 1, sg.y, 1, h, col);
      sg.glyphs.forEach((g, i) => drawGlyph(g, sg.x + 2 + (vertical ? 0 : i * 7), sg.y + 3 + (vertical ? i * 7 : 0), on ? '#ffffff' : col));
      if (on) sg.glyphs.forEach((g, i) => drawGlyph(g, sg.x + 2 + (vertical ? 0 : i * 7), sg.y + 3 + (vertical ? i * 7 : 0), sg.c + 'aa'));
    }
    for (const p of s.sparks) px(p.x, p.y, 1, 1, p.life > 8 ? '#fff2a8' : '#ffb03f');
    // the big screen: equaliser bars, cyan below and pink on top
    if (s.screen) drawScreen(s);
    else if (s.eq) {
      const e = s.eq;
      const n = Math.floor(e.w / 5);
      for (let i = 0; i < n; i++) {
        const level = Math.abs(Math.sin(t / 230 + i * 1.3) * Math.sin(t / 370 + i * 0.7));
        const bh = Math.round((0.2 + 0.8 * level) * (e.h - 3));
        const x = e.x + 1 + i * 5;
        px(x, e.y + e.h - 1 - bh, 4, bh, '#4ff0ff');
        if (bh > e.h * 0.55) px(x, e.y + e.h - 1 - bh, 4, Math.round(bh - e.h * 0.55), '#ff5fd2');
        px(x, e.y + e.h - 3 - bh, 4, 1, '#ffffff');
      }
    }
    // the night train
    const tr = s.train;
    if (tr.x > -400) {
      const x0 = Math.round(tr.x);
      for (let c = 0; c < 4; c++) {
        const cx = x0 + c * 60;
        px(cx, track - 13, 58, 11, '#d8d2ef');
        px(cx, track - 13, 58, 2, '#f4f0ff');
        px(cx, track - 6, 58, 1, '#ff5fd2');
        px(cx, track - 5, 58, 3, '#7a6fa8');
        for (let k = 4; k < 52; k += 8) {
          px(cx + k, track - 11, 6, 4, '#ffe7a1');
          if ((k + c) % 3 === 0) px(cx + k + 2, track - 10, 2, 3, '#5a4a6a');
        }
        px(cx + 4, track - 2, 6, 2, '#1d1036');
        px(cx + 46, track - 2, 6, 2, '#1d1036');
      }
      px(x0 + 238, track - 9, 2, 3, '#ffffff');
      for (let k = 0; k < 34; k++) if (dith(k, 0, 0.9 * (1 - k / 34))) px(x0 + 240 + k, track - 9 - k / 12, 1, 3 + k / 5, 'rgba(255, 250, 215, 0.22)');
    }

    ctxRef.drawImage(s.fog, Math.round(-12 + Math.sin(t / 6000) * 10), 0);

    // water: the mirrored skyline, wobbling a little more with depth
    px(-8, water, W + 16, s.rh, c('#0b0618'));
    for (let y = 0; y < s.rh; y += 2) {
      const off = Math.round(Math.sin(y / 5 + t / 520) * (1 + y / 40));
      ctxRef.drawImage(s.refl, 0, y, W, 2, off, water + y, W, 2);
    }
    const tick = Math.floor(t / 170);
    for (const sg of s.signs) {
      if (!sg.on || (s.short?.sg === sg && !signLit(s, sg, t))) continue;
      const w = sg.kind === 'v' ? 9 : sg.w;
      for (let y = water + 3; y < Math.min(ledge, water + 70); y += 2) {
        if ((y + tick + sg.x) % 5 === 0) continue;
        px(sg.x + ((y + tick) % 3) - 1, y, w, 1, sg.c + '2e');
      }
    }
    if (s.eq)
      for (let y = 2 * water - s.eq.y - s.eq.h; y < Math.min(ledge, 2 * water - s.eq.y); y += 2)
        if ((y + tick) % 4) px(s.eq.x + ((y + tick) % 3) - 1, y, s.eq.w, 1, (y + tick) % 3 ? '#4ff0ff30' : '#ff5fd230');
    if (tr.x > -400)
      for (let y = water + 2; y < water + 26; y += 3) px(Math.round(tr.x) + ((y + tick) % 4), y, 240, 1, 'rgba(255, 231, 161, 0.13)');
    // the fireworks and the shower on the water
    if (s.fw.flash) px(-8, water, W + 16, ledge - water, s.fw.flash.c + Math.round(s.fw.flash.a * 12).toString(16).padStart(2, '0'));
    for (const p of s.fw.parts) {
      const ry = 2 * water - p.y;
      if (ry > water + 1 && ry < ledge && p.life % 3) px(p.x + ((Math.round(ry) + tick) % 3) - 1, ry, 1, 1, p.c + '50');
    }
    for (const g of s.shower.rings) {
      if (g.life > 3) px(g.x - 1, g.y, 3, 1, 'rgba(255, 190, 240, 0.35)');
      else {
        px(g.x - 3, g.y, 1, 1, 'rgba(255, 190, 240, 0.25)');
        px(g.x + 3, g.y, 1, 1, 'rgba(255, 190, 240, 0.25)');
      }
    }
    px(-8, water, W + 16, 1, T.line);
    ctxRef.fillStyle = T.glint;
    for (let i = 0; i < W / 9; i++) {
      const a = hash(i * 7.31 + Math.floor(t / 400 + i * 0.3));
      ctxRef.fillRect(Math.round(hash(i * 3.7) * W), Math.round(water + 4 + a * (ledge - water - 6)), 3 + Math.floor(a * 6), 1);
    }

    ctxRef.restore();

    // ---- the rooftop we sit on, nearest of all
    ctxRef.save();
    ctxRef.translate(-Math.round(vx * 5), -Math.round(vy * 2));
    px(-12, ledge, W + 24, H - ledge, c('#0d0719')); // spare wall beyond both edges for the slide
    ctxRef.drawImage(s.fg, 0, 0);
    drawRoofCat(s.catX, ledge, s.cat.pose);
    // the cat's tail sweeps along the ledge: quicker when it is restless, curled high when petted
    const swing = Math.sin(t / (s.swish > 0 || s.happy > 0 ? 220 : 700));
    for (let k = 0; k < 18; k++) {
      const lift = k > 9 ? (k - 9) * (s.happy > 0 ? 1.3 + swing * 0.3 : 0.55 + swing * 0.45) : 0;
      px(s.catX + 6 + k, ledge - 3 - lift, 2, 3, c('#2b1a4a'));
      px(s.catX + 6 + k, ledge - 4 - lift, 2, 1, c('#d868e0'));
    }
    if (s.boom) {
      const { x, y } = s.boom;
      for (let i = 0; i < 4; i++) {
        const level = Math.abs(Math.sin(t / (s.boomKick > 0 ? 90 : 210) + i * 1.7));
        px(x + 12 + i * 2, y + 8 - Math.round(level * 4), 1, 1 + Math.round(level * 4), i % 2 ? '#4ff0ff' : '#ff5fd2');
      }
      if (Math.floor(t / 500) % 2) px(x + 2, y + 2, 1, 1, '#ff3b3b');
      for (const n of s.notes) {
        if (n.life > 36 && n.life % 2) continue;
        const nx = Math.round(n.x + Math.sin(n.life / 6 + n.p) * 3);
        ctxRef.fillStyle = n.c;
        for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (noteSprite[j][i] === 'n') ctxRef.fillRect(nx + i, Math.round(n.y) + j, 1, 1);
      }
    }
    drawCatHearts(s.cat);
    if (s.shower.level > 0.05) {
      const tk = Math.floor(t / 120);
      for (let i = 0; i < (W / 14) * s.shower.level; i++) if (hash(i * 5.31 + tk) < 0.5) px(hash(i * 2.7 + tk) * W, ledge - 1, 2, 1, 'rgba(230, 210, 255, 0.5)');
    }
    ctxRef.restore();

    // the shower, in front of everything
    const sw = s.shower;
    if (sw.level > 0) {
      px(0, 0, W, H, `rgba(20, 10, 40, ${0.14 * sw.level})`);
      for (const d of sw.drops) {
        const c = d.near ? 'rgba(230, 210, 255, 0.45)' : 'rgba(200, 170, 255, 0.25)';
        const len = d.near ? 4 : 3;
        px(d.x, d.y, 1, len, c);
        px(d.x - 1, d.y + len, 1, 2, c);
      }
    }

    applyLight(s.lightmap);
    ctxRef.save();
    ctxRef.translate(-Math.round(vx * 9), -Math.round(vy * 4));
    for (const [x, y] of s.festoon.wire) px(x, y, 1, 1, c('#1a0e2c'));
    s.festoon.bulbs.forEach(([x, y], i) => {
      const swing = Math.round(Math.sin(t / 1300 + i) * 0.6);
      const bright = T.festoon && Math.sin(t / 900 + i * 2.1) > -0.6;
      px(x + swing, y + 1, 1, 2, c('#1a0e2c'));
      if (bright) {
        px(x - 3 + swing, y + 1, 7, 8, 'rgba(255, 210, 140, 0.07)');
        px(x - 1 + swing, y + 2, 3, 5, 'rgba(255, 210, 140, 0.16)');
      }
      px(x + swing - 1, y + 3, 3, 3, bright ? '#ffd98a' : '#8a6a4a');
      if (bright) px(x + swing, y + 3, 1, 1, '#fffbe8');
    });
    ctxRef.restore();
  },
};

export default neon;
