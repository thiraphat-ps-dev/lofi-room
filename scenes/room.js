import {
  W,
  H,
  ctxRef,
  drawInto,
  look,
  rng,
  px,
  disc,
  bands,
  makeGlow,
  layer,
  shadeEllipse,
  dith,
  poly,
  stroke,
  makeLightmap,
  applyLight,
  makeShaft,
  makeMotes,
  updateMotes,
  drawMotes,
  tod,
  sfx,
  phaseMoon,
  beat,
} from './kit.js';
import { drawWeather } from './weather.js';
import { hdCat, catMind, stepCat, stirCat, petCat, onCat, drawCatHearts } from './animals.js';

// Little things that happen now and then, so the room isn't the same loop every minute.
// One starts every 20 to 60 seconds (the first soon after the room opens), never the same twice in a row.
const EVENTS = ['car', 'plane', 'moth', 'cat', 'downpour', 'gust', 'car', 'cat'];

// ------------------------------------------------------------------ scene: rainy room

// The same rainy evening at four times of day. Night is the original: a deep sky with the moon
// and a city of lit windows. Dawn and dusk glow pink and orange low over the skyline, with fewer
// windows lit; by day it's a grey, overcast sky, pale buildings and only the odd lamp on in the
// city, and the room fills with soft window light (the desk lamp stays on).
const TIMES = {
  night: {
    sky: ['#090d26', '#0f1638', '#161e48', '#1f2758', '#2b2c63'],
    moon: true,
    haze: ['#1a2150', '#232a60'],
    far: '#1c2350', farLit: '#3d4a8a',
    mid: ['#151a3d', '#1b2148'], midLit: '#8a7a4a', mist: '#2a3270',
    near: ['#0d1130', '#0a0d26', '#262c5a', '#151a40'],
    windowsOn: 0.75,
    cloud: 'rgba(30, 36, 80, 0.55)',
    ambient: '#584e86',
    glass: '#3a4580', beam: '#55639f', beamPool: '#6a76b0', above: '#6a4858',
    shaft: 'rgba(170, 190, 255, 0.13)', mote: 'rgba(200, 215, 255, 0.55)',
    rain: ['rgba(123, 140, 207, 0.55)', 'rgba(170, 185, 240, 0.8)'],
  },
  dawn: {
    sky: ['#2a2a5e', '#4a3a72', '#7e4f84', '#c97a88', '#f0a98a'],
    sun: { color: '#ffd2a0', glow: 'rgba(255, 190, 150, 0.12)' },
    haze: ['#6a4a78', '#8a5a7e'],
    far: '#5a4670', farLit: '#9a7a9a',
    mid: ['#3e3260', '#4a3c6c'], midLit: '#c09a6a', mist: '#7a5a80',
    near: ['#241e44', '#1c1838', '#4a3e6a', '#2e2850'],
    windowsOn: 0.35,
    cloud: 'rgba(190, 120, 140, 0.45)',
    ambient: '#7a6894',
    glass: '#7a5a88', beam: '#8a6a90', beamPool: '#9a7a9c', above: '#7a5868',
    shaft: 'rgba(255, 200, 190, 0.11)', mote: 'rgba(255, 220, 210, 0.55)',
    rain: ['rgba(200, 170, 200, 0.5)', 'rgba(235, 210, 230, 0.75)'],
  },
  day: {
    sky: ['#8a96ac', '#98a3b7', '#a6b0c2', '#b4bdcc', '#c0c8d4'],
    haze: ['#9aa4b6', '#a4adbe'],
    far: '#8892a6', farLit: '#9aa4b6',
    mid: ['#6e7890', '#78829a'], midLit: '#c8c09a', mist: '#9aa4b8',
    near: ['#4a5268', '#40485e', '#626a80', '#58607a'],
    windowsOn: 0.08,
    cloud: 'rgba(120, 128, 146, 0.45)',
    ambient: '#d6d2e2',
    glass: '#b4bcd8', beam: '#a8b0cc', beamPool: '#b0b8d2', above: '#aaa2bc',
    fill: '#2e2c38', // daylight from the window reaching right across the room
    glow: 0.35, // the fairy lights and the candle hardly show against the daylight
    shade: 0.3, // and the front of the desk isn't lost in shadow
    shaft: 'rgba(225, 232, 248, 0.10)', mote: 'rgba(235, 240, 255, 0.45)',
    rain: ['rgba(90, 100, 130, 0.45)', 'rgba(120, 130, 160, 0.6)'],
  },
  dusk: {
    sky: ['#221e50', '#4a3474', '#94477a', '#d86a5e', '#f39a58'],
    sun: { color: '#ffb070', glow: 'rgba(255, 150, 90, 0.14)' },
    haze: ['#5a3a6a', '#7a4a6a'],
    far: '#4a3466', farLit: '#c08a6a',
    mid: ['#2e2452', '#38305e'], midLit: '#d8a860', mist: '#6a4070',
    near: ['#1a1636', '#14122e', '#3e3060', '#221e44'],
    windowsOn: 0.55,
    cloud: 'rgba(150, 70, 100, 0.5)',
    ambient: '#685480',
    glass: '#6a4a7a', beam: '#7a5a88', beamPool: '#8a6a94', above: '#7a4a58',
    shaft: 'rgba(255, 180, 140, 0.12)', mote: 'rgba(255, 210, 180, 0.6)',
    rain: ['rgba(180, 140, 190, 0.5)', 'rgba(225, 190, 220, 0.75)'],
  },
};

function strike(s) {
  s.flash = 1;
  sfx('thunder', { near: Math.random() });
  // a big one wakes the cat for a moment
  if (Math.random() < 0.6) stirCat(s.cat, 'startle');
}

function start(s, e) {
  const { win } = s;
  if (e === 'car') s.car = { f: 0, dur: 30 + Math.floor(Math.random() * 16), dir: Math.random() < 0.5 ? 1 : -1 };
  else if (e === 'plane' && !s.plane) s.plane = { x: win.x + win.w + 8, y: win.y + 8 + Math.random() * Math.min(26, win.h * 0.3), v: -(0.25 + Math.random() * 0.15) };
  else if (e === 'moth' && !s.moth && !s.narrow) s.moth = { f: 0, dur: 12 * (12 + Math.random() * 8), seed: Math.random() * 10 };
  else if (e === 'downpour') {
    s.rain.target = 1.5;
    s.rain.hold = 12 * (18 + Math.random() * 12);
  } else if (e === 'gust') s.gust = 24;
  else if (e === 'cat') stirCat(s.cat, Math.random() < 0.5 ? 'look' : 'yawn');
}

const rainyRoom = {
  id: 'room',
  name: 'ห้องฝนตก',
  en: 'Rainy room',
  accent: '#ffb35c',
  // the room is rainy by nature: a storm brings the thunder in, fog greys the city, clear dries the glass
  sky: {
    native: 'rain',
    kinds: ['rain', 'storm', 'fog', 'clear'],
    area: (s) => [[s.win.x, s.win.y, s.win.w, s.win.h]],
    open: (s) => [s.win.x, s.win.y, s.win.w, Math.round(s.win.h * 0.4)],
    inline: true,
    react(s, w) {
      const want = { storm: 1.5, fog: 0.3, clear: 0 }[w.kind];
      if (want !== undefined) {
        s.rain.target = want;
        s.rain.hold = 12;
      }
      return ['rain', 'storm'];
    },
    strike: (s) => strike(s),
  },
  init() {
    const r = rng(7);
    const T = TIMES[tod] || TIMES.night;
    const narrow = W < 420;
    const win = {
      x: narrow ? 14 : Math.round(W * 0.19),
      y: Math.round(H * 0.12),
      w: narrow ? W - 28 : Math.min(Math.round(W * 0.42), 600),
      h: Math.round(H * 0.37),
    };
    win.w -= win.w % 2;
    const deskY = Math.round(H * 0.62);
    const lampX = narrow ? W - 46 : Math.round(W * 0.85);
    const moon = { x: win.x + Math.round(win.w * 0.78), y: win.y + 26 };
    const horizon = win.y + win.h;

    // three layers of city: far haze, middle, near (near windows flicker at run time)
    const city = (minH, maxH, wMin, wMax, gap) => {
      const out = [];
      // a little wider than the glass, so the parallax shift never shows an edge
      let x = win.x - 16;
      while (x < win.x + win.w + 16) {
        const w = wMin + Math.floor(r() * (wMax - wMin));
        const top = horizon - minH - Math.floor(r() * (maxH - minH));
        out.push({ x, w, top, roof: r() });
        x += w + (r() < gap ? 3 : 0);
      }
      return out;
    };
    const far = city(30, 70, 10, 24, 0.2);
    const mid = city(18, 58, 14, 30, 0.3);
    const near = city(10, 44, 18, 36, 0.35).map((b) => {
      const windows = [];
      for (let wy = b.top + 5; wy < horizon - 3; wy += 6)
        for (let wx = b.x + 3; wx < b.x + b.w - 4; wx += 5)
          if (r() < 0.45) windows.push({ x: wx, y: wy, on: r() < T.windowsOn, warm: r() < 0.7, blind: r() < 0.25 });
      return { ...b, windows };
    });

    const bg = layer(() => {
      // wall: deep plum, darker toward the corners, with a fine wallpaper
      bands(0, 0, W, deskY, ['#231a38', '#2b2142', '#30254a']);
      for (let y = 4; y < deskY; y += 10)
        for (let x = (y / 10) % 2 ? 0 : 5; x < W; x += 10) {
          px(x, y, 1, 1, '#3a2e58');
          px(x + 1, y + 1, 1, 1, '#342950');
        }
      // sky and moon
      bands(win.x, win.y, win.w, win.h, T.sky);
      if (T.sun) {
        // the sun is down behind the skyline: a soft glow where it will rise or has set
        const gx = win.x + Math.round(win.w * 0.3);
        for (let k = 0; k < 5; k++) {
          const rr = 18 + k * 12;
          for (let y = -rr; y <= 0; y++)
            for (let x = -rr * 2; x <= rr * 2; x++) {
              const d = Math.hypot(x / 2, y) / rr;
              const yy = horizon - 20 + y;
              if (d < 1 && yy >= win.y && dith(gx + x, yy, (1 - d) * 0.35)) px(gx + x, yy, 1, 1, T.sun.glow);
            }
        }
        shadeEllipse(gx, horizon - 26, 7, 7, () => T.sun.color);
      }
      if (T.moon) for (let k = 0; k < 4; k++) {
        const rr = 9 + k * 4;
        for (let y = -rr; y <= rr; y++)
          for (let x = -rr; x <= rr; x++) {
            const d = Math.hypot(x, y) / rr;
            if (d < 1 && d > 0.6 && dith(moon.x + x, moon.y + y, (1 - d) * 0.5)) px(moon.x + x, moon.y + y, 1, 1, 'rgba(240, 230, 200, 0.10)');
          }
      }
      if (T.moon) {
        shadeEllipse(moon.x, moon.y, 9, 9, (nx, ny) => (nx - ny > 0.9 ? '#fff6dc' : nx - ny < -0.8 ? '#d8cba3' : '#f3e7c4'));
        disc(moon.x - 3, moon.y - 2, 2, '#e2d5ae');
        disc(moon.x + 2, moon.y + 3, 1, '#e2d5ae');
        px(moon.x + 4, moon.y - 4, 2, 2, '#e2d5ae');
        phaseMoon(moon.x, moon.y, 9);
      }
      // framed print on the right wall
      if (!narrow) {
        const fx = Math.round(W * 0.66);
        const fy = Math.round(H * 0.12);
        const fw = 64;
        const fh = 44;
        px(fx - 4, fy - 4, fw + 8, fh + 8, '#4b3a64');
        px(fx - 4, fy - 4, fw + 8, 1, '#6d5a8a');
        px(fx - 4, fy + fh + 3, fw + 8, 1, '#2f2442');
        px(fx - 2, fy - 2, fw + 4, fh + 4, '#efe3cf');
        bands(fx, fy, fw, fh, ['#3a2a6a', '#8a3f78', '#e0654f', '#f7a45c', '#ffd383']);
        disc(fx + 44, fy + 22, 7, '#fff0c0');
        for (let k = 0; k < fw; k++) {
          const hh = Math.round(10 + Math.abs(Math.sin(k / 9)) * 9 + Math.sin(k / 3) * 2);
          px(fx + k, fy + fh - hh, 1, hh, k % 4 ? '#3a2150' : '#45285e');
          const h2 = Math.round(5 + Math.abs(Math.sin(k / 6 + 1)) * 6);
          px(fx + k, fy + fh - h2, 1, h2, '#2a1840');
        }
        // shelf with books, a candle and a succulent
        const sy = Math.round(H * 0.44);
        px(fx - 14, sy, 96, 4, '#9a6a4e');
        px(fx - 14, sy, 96, 1, '#b8866a');
        px(fx - 14, sy + 4, 96, 2, '#5a3a2a');
        for (const bx of [fx - 6, fx + 70]) {
          px(bx, sy + 6, 3, 8, '#5a3a2a');
          px(bx + 3, sy + 6, 1, 6, '#3d271d');
        }
        const spines = [
          ['#4a6fb3', 18],
          ['#b0495c', 16],
          ['#d9b46a', 19],
          ['#5f9a6e', 15],
          ['#8a62b8', 17],
        ];
        let bx = fx - 8;
        for (const [c, h] of spines) {
          px(bx, sy - h, 5, h, c);
          px(bx, sy - h, 1, h, 'rgba(255,255,255,0.18)');
          px(bx + 1, sy - h + 3, 3, 1, 'rgba(255,255,255,0.35)');
          px(bx + 1, sy - 4, 3, 1, 'rgba(0,0,0,0.25)');
          bx += 6;
        }
        // a leaning book
        for (let k = 0; k < 16; k++) px(bx + 2 + Math.floor(k / 4), sy - 1 - k, 4, 1, '#c06a3a');
        // succulent
        const px0 = fx + 52;
        px(px0, sy - 8, 12, 8, '#c9774a');
        px(px0, sy - 8, 12, 2, '#df8e60');
        px(px0 + 1, sy - 2, 10, 2, '#a85e38');
        for (const [ox, oy, h] of [[2, -12, 5], [5, -15, 7], [8, -12, 5], [4, -10, 3], [7, -10, 3]]) {
          px(px0 + ox, sy - 8 + oy + 8 - h, 2, h, '#6fbf7a');
          px(px0 + ox, sy - 8 + oy + 8 - h, 1, h, '#8fd89a');
        }
      }
    });

    // far and middle city on their own layers, so they can slide behind the glass
    const cityFar = layer(() => {
      // a low haze over the far skyline
      bands(win.x - 16, horizon - 40, win.w + 32, 40, ['rgba(0,0,0,0)', ...T.haze]);
      for (const b of far) px(b.x, b.top, b.w, horizon - b.top, T.far);
      for (const b of far) for (let y = b.top + 4; y < horizon; y += 7) if ((b.x + y) % 3 === 0) px(b.x + 3, y, 1, 1, T.farLit);
    });
    const cityMid = layer(() => {
      for (const b of mid) {
        px(b.x, b.top, b.w, horizon - b.top, T.mid[0]);
        px(b.x, b.top, 1, horizon - b.top, T.mid[1]);
        if (b.roof < 0.3) px(b.x + 3, b.top - 4, 6, 4, T.mid[0]);
        const lit = Math.round(5 / Math.max(0.1, T.windowsOn / 0.75)); // fewer lit windows by day
        for (let y = b.top + 4; y < horizon; y += 5) for (let x = b.x + 2; x < b.x + b.w - 2; x += 4) if ((x * 7 + y * 3) % lit === 0) px(x, y, 2, 1, T.midLit);
      }
      // mist rising off the wet street below
      for (let y = horizon - 14; y < horizon; y++)
        for (let x = win.x - 16; x < win.x + win.w + 16; x++) if (dith(x, y, ((y - horizon + 14) / 14) * 0.55)) px(x, y, 1, 1, T.mist);
    });

    const fg = layer(() => {
      // window frame with bevels
      const F = { base: '#5b4672', hi: '#7a6194', lo: '#3f2f55' };
      const bevel = (x, y, w, h) => {
        px(x, y, w, h, F.base);
        px(x, y, w, 1, F.hi);
        px(x, y, 1, h, F.hi);
        px(x, y + h - 1, w, 1, F.lo);
        px(x + w - 1, y, 1, h, F.lo);
      };
      bevel(win.x - 7, win.y - 7, win.w + 14, 7);
      bevel(win.x - 7, win.y + win.h, win.w + 14, 7);
      bevel(win.x - 7, win.y, 7, win.h);
      bevel(win.x + win.w, win.y, 7, win.h);
      bevel(win.x + win.w / 2 - 2, win.y, 5, win.h);
      bevel(win.x, win.y + Math.floor(win.h / 2) - 2, win.w, 4);
      // sill
      px(win.x - 14, win.y + win.h + 7, win.w + 28, 6, '#6d5585');
      px(win.x - 14, win.y + win.h + 7, win.w + 28, 1, '#9a84b3');
      px(win.x - 14, win.y + win.h + 13, win.w + 28, 2, '#3f2f55');
      // glass highlights
      const glare = (gx, gy, len) => {
        for (let k = 0; k < len; k++) px(gx + k, gy - k, 1, 1, 'rgba(255,255,255,0.10)');
        for (let k = 0; k < len * 0.6; k++) px(gx + 5 + k, gy - k, 1, 1, 'rgba(255,255,255,0.06)');
      };
      glare(win.x + 10, win.y + 34, 26);
      glare(win.x + win.w / 2 + 10, win.y + win.h / 2 + 30, 18);
      // curtains: soft folds with four shades and a tasselled tie-back
      px(win.x - 34, win.y - 20, win.w + 68, 3, '#3b2c55');
      px(win.x - 34, win.y - 20, win.w + 68, 1, '#55437a');
      disc(win.x - 36, win.y - 19, 3, '#c9a46a');
      disc(win.x + win.w + 36, win.y - 19, 3, '#c9a46a');
      const folds = ['#5c2c46', '#7b3f5e', '#93506f', '#a8637f'];
      const curtain = (cx, dir) => {
        const tall = win.h + 36;
        const tieY = Math.round(tall * 0.62);
        for (let y = 0; y < tall; y++) {
          const tie = Math.abs(y - tieY) / tieY;
          const width = Math.round(14 + tie * 16);
          for (let k = 0; k < width; k++) {
            const phase = (k / width) * Math.PI * 3 + (dir > 0 ? 0 : 1);
            const v = (Math.sin(phase) + 1) / 2;
            let idx = Math.min(3, Math.floor(v * 4));
            if (dith(k, y, v * 4 - idx) && idx < 3) idx++;
            px(dir > 0 ? cx + k : cx - k, win.y - 17 + y, 1, 1, folds[idx]);
          }
          if (y === tall - 1) px(dir > 0 ? cx : cx - width, win.y - 17 + y, width, 1, '#4a2238');
        }
        const tx = dir > 0 ? cx : cx - 18;
        px(tx, win.y - 17 + tieY, 19, 3, '#c9a46a');
        px(tx, win.y - 17 + tieY, 19, 1, '#e8c98a');
        px(dir > 0 ? tx + 16 : tx + 1, win.y - 14 + tieY, 2, 7, '#c9a46a');
      };
      curtain(win.x - 30, 1);
      curtain(win.x + win.w + 29, -1);

      // desk: wood with grain and a lit top edge
      px(0, deskY, W, 4, '#a8765a');
      px(0, deskY, W, 1, '#c8967a');
      bands(0, deskY + 4, W, 8, ['#86583f', '#7a523d']);
      px(0, deskY + 12, W, H - deskY - 12, '#563728');
      px(0, deskY + 12, W, 2, '#3d271d');
      for (let y = deskY + 16; y < H; y += 5)
        for (let x = 0; x < W; x += 1) if (Math.sin(x / 23 + y * 0.7) > 0.93) px(x, y, 1, 1, '#4c3022');
      for (let x = 20; x < W; x += 110) {
        px(x, deskY + 22, 70, 30, '#5e3d2c');
        px(x, deskY + 22, 70, 1, '#71493a');
        px(x, deskY + 51, 70, 1, '#3d271d');
        px(x + 29, deskY + 34, 12, 3, '#c9a46a');
        px(x + 29, deskY + 34, 12, 1, '#e8c98a');
      }

      // desk lamp: weighted base, two-part arm, shade with a lit rim
      const L = { metal: '#4b4064', metalHi: '#6c5f8c', shade: '#e7a24c', shadeHi: '#ffc778', shadeLo: '#b9752f' };
      shadeEllipse(lampX, deskY - 2, 16, 3, (nx, ny) => (ny < -0.2 ? '#5a4d78' : '#3b3150'));
      for (let k = 0; k < 40; k++) px(lampX - 1 + Math.round(k * 0.2), deskY - 4 - k, 3, 1, k % 10 === 0 ? L.metalHi : L.metal);
      disc(lampX + 7, deskY - 45, 3, L.metalHi);
      for (let k = 0; k < 22; k++) px(lampX + 7 + k, deskY - 46 - Math.round(k * 0.55), 3, 2, L.metal);
      const sx = lampX + 26;
      const sy = deskY - 66;
      for (let k = 0; k < 16; k++) {
        const w = 10 + k * 1.2;
        px(sx - 2 + 8 - w / 2, sy + k, w, 1, k < 3 ? L.shadeHi : k > 12 ? L.shadeLo : L.shade);
      }
      px(sx - 5, sy + 16, 26, 2, '#fff1c9');
      px(sx + 1, sy + 18, 14, 2, 'rgba(255, 241, 201, 0.6)');

      if (!narrow) {
        // open notebook with handwriting and a pencil
        const nx = Math.round(W * 0.36);
        const ny = deskY - 5;
        px(nx + 3, ny + 5, 54, 2, 'rgba(0,0,0,0.25)');
        px(nx, ny, 26, 6, '#efe6d6');
        px(nx + 28, ny, 26, 6, '#f6eee0');
        px(nx + 26, ny, 2, 6, '#b0a089');
        px(nx, ny - 1, 54, 1, '#d8ccb6');
        for (let k = 0; k < 3; k++) {
          for (let x = 2; x < 24; x += 1) if (Math.sin(x * 1.7 + k) > -0.2) px(nx + x, ny + 1 + k * 2, 1, 1, '#6f6a8a');
          for (let x = 30; x < 50 - k * 6; x += 1) if (Math.sin(x * 1.3 + k * 2) > -0.1) px(nx + x, ny + 1 + k * 2, 1, 1, '#6f6a8a');
        }
        px(nx + 36, ny + 7, 22, 2, '#f2c14e');
        px(nx + 36, ny + 8, 22, 1, '#d39a2c');
        px(nx + 58, ny + 7, 3, 2, '#f2b5a0');
        px(nx + 34, ny + 7, 2, 2, '#3a2a20');
        // headphones
        const hx = Math.round(W * 0.7);
        for (let k = 0; k <= 16; k++) {
          const a = Math.PI * (k / 16);
          px(hx + 10 - Math.cos(a) * 10, deskY - 4 - Math.sin(a) * 9, 2, 2, k % 4 ? '#6c5f8c' : '#8a7cb0');
        }
        shadeEllipse(hx + 1, deskY - 3, 3, 3, (nx2) => (nx2 > 0.2 ? '#f07a8a' : '#c94a5c'));
        shadeEllipse(hx + 20, deskY - 3, 3, 3, (nx2) => (nx2 > 0.2 ? '#f07a8a' : '#c94a5c'));
        // book stack and a potted plant by the lamp
        const stack = [
          ['#4a6fb3', 30, 0],
          ['#b0495c', 26, 2],
          ['#d9b46a', 28, -1],
        ];
        stack.forEach(([c, w, off], i) => {
          const yy = deskY - 6 - i * 6;
          px(lampX - 70 + off, yy, w, 6, c);
          px(lampX - 70 + off, yy, w, 1, 'rgba(255,255,255,0.25)');
          px(lampX - 70 + off + w - 3, yy + 1, 3, 4, '#efe6d6');
        });
        const pp = lampX - 32;
        px(pp, deskY - 14, 16, 14, '#c9774a');
        px(pp, deskY - 14, 16, 3, '#df8e60');
        px(pp + 2, deskY - 3, 12, 3, '#a85e38');
        // a leafy plant: overlapping shaded leaves around a short stem
        px(pp + 7, deskY - 22, 2, 9, '#3f7a48');
        const leaves = [[-6, -6], [6, -7], [-9, -12], [9, -13], [-3, -14], [4, -16], [-6, -20], [6, -21], [0, -25]];
        for (const [lx, ly] of leaves) {
          shadeEllipse(pp + 8 + lx, deskY - 14 + ly, 4.5, 2.6, (nx, ny, xx, yy) => {
            const l = nx * 0.6 - ny * 0.7;
            if (Math.abs(ny) < 0.18 && Math.abs(nx) < 0.7) return '#3f7a48';
            return l > 0.35 ? '#8fd89a' : l > -0.2 ? '#5fb06b' : '#3f8a4c';
          });
        }
      }
    });

    // ---- light: a dim night room, lit by the lamp, the moon through the glass, a candle and
    // the fairy lights. Everything is drawn plainly, then multiplied by this map.
    const sx = lampX + 26; // lamp shade, as drawn in fg
    const sy = deskY - 66;
    const sill = win.y + win.h + 15;
    const candle = { x: Math.round(W * 0.66) + 38, y: Math.round(H * 0.44) };
    const lampCone = [
      [sx - 4, sy + 18],
      [sx + 20, sy + 18],
      [sx + 62, deskY + 1],
      [sx - 50, deskY + 1],
    ];
    // the moon is high on the right of the glass, so its light lands down-left, on the cat
    const catX = narrow ? win.x + Math.round(win.w * 0.4) : Math.round(W * 0.49);
    const moonBeam = [
      [win.x + win.w * 0.42, sill],
      [win.x + win.w * 0.94, sill],
      [catX + 50, deskY],
      [catX - 75, deskY],
    ];
    const lights = [
      { rect: [win.x, win.y, win.w, win.h], color: '#ffffff' },
      { x: win.x + win.w / 2, y: win.y + win.h * 0.6, r: win.w * 0.75, ry: win.h * 1.1, color: T.glass },
      { poly: moonBeam, from: [win.x + win.w * 0.68, sill], to: [catX - 12, deskY + 20], color: T.beam },
      { x: catX - 10, y: deskY - 6, r: 80, ry: 22, color: T.beamPool },
      { x: win.x + win.w / 2, y: win.y - 14, r: win.w / 2 + 60, ry: 20, color: T.above },
      { x: sx + 8, y: sy + 20, r: 250, ry: 200, color: '#b07a48' },
      { x: sx + 8, y: sy + 18, r: 80, color: '#ffc27a' },
      { poly: lampCone, from: [sx + 8, sy + 18], to: [sx + 8, deskY + 40], color: '#ffd9a0' },
      { x: sx + 6, y: deskY + 3, r: 110, ry: 18, color: '#ffe0b0' },
    ];
    if (T.fill) lights.push({ x: win.x + win.w / 2, y: win.y + win.h, r: W * 0.8, ry: H * 0.7, color: T.fill });
    if (!narrow) lights.push({ x: candle.x + 3, y: candle.y - 15, r: 55, color: '#a8683a' });
    const lightmap = makeLightmap(T.ambient, lights);

    // ---- foreground: a pothos hanging close to the viewer, top right, lit from the lamp below
    let plant = null;
    if (!narrow) {
      plant = document.createElement('canvas');
      plant.width = 90;
      plant.height = 190;
      drawInto(plant, () => {
        const P = { rope: '#3a2e34', pot: '#22192a', potHi: '#3e2c34', rim: '#5a3c34', dark: '#0c1a13', mid: '#14301f', hi: '#1f452e', warm: '#8a6038' };
        const cx = 45;
        const potY = 70;
        stroke(cx, 0, cx - 13, potY, P.rope);
        stroke(cx, 0, cx + 13, potY, P.rope);
        stroke(cx, 0, cx, potY, P.rope);
        for (let k = 0; k < 16; k++) {
          const w = 30 - Math.round(k * 0.5);
          px(cx - w / 2, potY + k, w, 1, k < 3 ? P.rim : P.pot);
          px(cx - w / 2, potY + k, 3, 1, P.potHi);
        }
        // vines spilling over the rim, heart-shaped leaves alternating sides
        const vines = [
          [-12, 50, -0.15],
          [-4, 85, 0.05],
          [6, 40, 0.15],
          [13, 68, 0.25],
        ];
        for (const [vx, len, lean] of vines) {
          let x = cx + vx;
          for (let y = potY + 2; y < potY + len; y++) {
            x += lean * 0.35 + Math.sin(y / 9) * 0.25;
            px(x, y, 1, 1, P.dark);
            if ((y - potY) % 11 === 0) {
              const side = (y / 11) % 2 ? -1 : 1;
              const lx = x + side * 4;
              shadeEllipse(lx, y + 1, 3.5, 2.6, (nx, ny) => {
                const l = -nx * 0.6 + ny * 0.7; // lit from below-left, where the lamp is
                return l > 0.55 ? P.warm : l > 0.1 ? P.hi : l > -0.4 ? P.mid : P.dark;
              });
            }
          }
        }
        for (const [lx, ly] of [[-14, 4], [-6, 1], [4, 2], [12, 3], [17, 6], [-18, 8]]) {
          shadeEllipse(cx + lx, potY + ly, 5, 3.5, (nx, ny) => (ny > 0.3 ? P.hi : nx < -0.3 ? P.mid : P.dark));
        }
      });
    }

    return {
      T,
      narrow,
      win,
      deskY,
      lampX,
      moon,
      bg,
      cityFar,
      cityMid,
      fg,
      near,
      horizon,
      candle,
      lightmap,
      plant,
      plantAt: { x: W - 64, y: -24 },
      catX,
      // the desk front is closest to the viewer and furthest from the lamp: sink it into shadow
      deskShade: layer(() => {
        for (let y = deskY + 14; y < H; y++) {
          const f = Math.min(1, (y - deskY - 14) / (H - deskY - 14));
          for (let x = 0; x < W; x++) if (dith(x, y, 0.15 + f * 0.6)) px(x, y, 1, 1, `rgba(8, 5, 16, ${T.shade ?? 0.55})`);
        }
      }),
      moonShaft: makeShaft(moonBeam, [win.x + win.w * 0.68, sill], [catX - 12, deskY], T.shaft, 0.55),
      lampShaft: makeShaft(lampCone, [sx + 8, sy + 18], [sx + 8, deskY + 10], 'rgba(255, 214, 150, 0.16)', 0.7),
      moonMotes: makeMotes(r, moonBeam, 22),
      lampMotes: makeMotes(r, lampCone, 16),
      flash: 0,
      splashes: [],
      lampShade: { x: sx + 8, y: sy + 18 },
      cat: catMind(),
      ev: { wait: 12 * 5, last: null },
      rain: { level: 0.85, target: 0.85, hold: 0 },
      car: null, // headlights sweeping the wall from the street below
      plane: null, // blinking lights crossing the sky
      moth: null, // drawn to the lamp for a while
      gust: 0, // a draught bending the candle flame
      clouds: Array.from({ length: 3 }, () => ({ x: win.x + r() * win.w, y: win.y + 8 + r() * 30, w: 30 + r() * 40, v: 0.08 + r() * 0.08 })),
      glow: makeGlow(lampX + 34, deskY - 40, 230, 170, 'rgba(255, 179, 92, 0.075)', 4),
      pool: makeGlow(lampX + 30, deskY + 2, 120, 14, 'rgba(255, 220, 150, 0.12)', 3),
      rainFar: Array.from({ length: Math.round(win.w * 0.7) }, () => ({ x: win.x + r() * win.w, y: win.y + r() * win.h, v: 4 + r() * 2, len: 3 + Math.floor(r() * 3) })),
      rainNear: Array.from({ length: Math.round(win.w * 0.25) }, () => ({ x: win.x + r() * win.w, y: win.y + r() * win.h, v: 8 + r() * 3, len: 7 + Math.floor(r() * 5) })),
      drops: Array.from({ length: Math.round(win.w / 9) }, () => ({ x: win.x + 3 + Math.floor(r() * (win.w - 6)), y: win.y + Math.floor(r() * win.h), slide: r() < 0.35, size: r() < 0.3 ? 2 : 1, trail: 0 })),
    };
  },
  update(s) {
    const { win } = s;
    for (const d of s.rainFar) {
      d.y += d.v;
      d.x -= d.v * 0.18;
      if (d.y > win.y + win.h) {
        d.y = win.y - d.len;
        d.x = win.x + Math.random() * (win.w + 30);
      }
    }
    for (const d of s.rainNear) {
      d.y += d.v;
      d.x -= d.v * 0.2;
      if (d.y > win.y + win.h) {
        if (Math.random() < 0.6) s.splashes.push({ x: Math.round(d.x), life: 4 });
        d.y = win.y - d.len;
        d.x = win.x + Math.random() * (win.w + 30);
      }
    }
    s.splashes = s.splashes.filter((p) => --p.life > 0);
    for (const d of s.drops) {
      if (d.slide && Math.random() < 0.35) {
        d.y += 1 + (Math.random() < 0.3 ? 1 : 0);
        d.trail = Math.min(10, d.trail + 1);
      }
      if (d.y > win.y + win.h) {
        d.y = win.y;
        d.trail = 0;
        d.x = win.x + 3 + Math.floor(Math.random() * (win.w - 6));
      }
    }
    for (const c of s.clouds) {
      c.x += c.v;
      if (c.x > win.x + win.w + 10) c.x = win.x - c.w - 10;
    }
    updateMotes(s.moonMotes);
    updateMotes(s.lampMotes);
    if (s.flash > 0) s.flash = Math.max(0, s.flash - 0.16);
    else if (Math.random() < 1 / 500) strike(s);
    if (s.flash > 0.45 && s.flash < 0.6) s.flash = 0.95;

    stepCat(s.cat); // the cat works through whatever it is doing, a pose at a time

    // the rain comes and goes: it wanders between a drizzle and steady rain, with the odd downpour
    const rain = s.rain;
    if (--rain.hold <= 0) {
      rain.target = 0.55 + Math.random() * 0.45;
      rain.hold = 12 * (20 + Math.random() * 30);
    }
    rain.level += (rain.target - rain.level) * 0.004;

    if (--s.ev.wait <= 0) {
      const pick = EVENTS.filter((e) => e !== s.ev.last);
      const e = pick[Math.floor(Math.random() * pick.length)];
      start(s, e);
      s.ev.last = e;
      s.ev.wait = 12 * (20 + Math.random() * 40);
    }
    if (s.car && ++s.car.f > s.car.dur) s.car = null;
    if (s.plane && (s.plane.x += s.plane.v) < s.win.x - 10) s.plane = null;
    if (s.moth && ++s.moth.f > s.moth.dur) s.moth = null;
    if (s.gust > 0) s.gust--;
  },
  hot(s, x, y) {
    return onCat(s.catX, s.deskY - 12, x, y);
  },
  // levels for the ambience: the rain sound follows the rain on the glass
  sound: (s) => ({ rain: s.rain.level }),
  poke(s, x, y) {
    if (this.hot(s, x, y)) {
      petCat(s.cat, s.catX, s.deskY - 12);
      return;
    }
    const { win } = s;
    if (x >= win.x && x < win.x + win.w && y >= win.y && y < win.y + win.h && s.flash === 0) strike(s); // a hidden one: tap the glass for thunder
  },
  draw(s, t) {
    const { win, deskY, horizon } = s;
    ctxRef.drawImage(s.bg, 0, 0);
    ctxRef.save();
    ctxRef.beginPath();
    ctxRef.rect(win.x, win.y, win.w, win.h);
    ctxRef.clip();
    // looking through glass: the farther a layer is, the more it slides as the view moves
    const { x: vx, y: vy } = look(t);
    ctxRef.drawImage(s.cityFar, Math.round(vx * 4), Math.round(vy * 2));
    ctxRef.drawImage(s.cityMid, Math.round(vx * 2.5), Math.round(vy * 1));
    // night clouds drifting across the moon
    for (const c of s.clouds) {
      for (let k = 0; k < c.w; k++) {
        const h = Math.round(3 + Math.sin((k / c.w) * Math.PI) * 4);
        px(c.x + k, c.y - h / 2, 1, h, s.T.cloud);
      }
    }
    if (s.plane) {
      const pl = s.plane;
      const x = Math.round(pl.x + vx * 4);
      const y = Math.round(pl.y + vy * 2);
      // a steady white light, a red one that blinks with a little halo, and a strobe now and then
      px(x - 1, y, 6, 1, 'rgba(40, 46, 90, 0.9)');
      px(x + 4, y, 1, 1, '#e8ecff');
      if (t % 1100 < 260) {
        px(x - 1, y - 1, 3, 3, 'rgba(255, 74, 74, 0.3)');
        px(x, y, 1, 1, '#ff5a5a');
      }
      if ((t + 550) % 2200 < 80) px(x + 1, y - 1, 1, 1, '#ffffff');
    }
    if (s.flash > 0) {
      ctxRef.fillStyle = `rgba(190, 200, 255, ${s.flash * 0.4})`;
      ctxRef.fillRect(win.x, win.y, win.w, win.h);
    }
    // near buildings with lit windows, some with blinds, the odd one switching
    const tick = Math.floor(t / 2500);
    ctxRef.save();
    ctxRef.translate(Math.round(vx * 1.2), 0);
    s.near.forEach((b, bi) => {
      const N = s.T.near;
      px(b.x, b.top, b.w, horizon - b.top, N[0]);
      px(b.x + b.w - 2, b.top, 2, horizon - b.top, N[1]);
      px(b.x, b.top, b.w, 1, N[2]);
      if (b.roof < 0.25) {
        px(b.x + 4, b.top - 7, 8, 7, N[0]);
        px(b.x + 4, b.top - 7, 8, 1, N[2]);
      } else if (b.roof < 0.5) {
        px(b.x + Math.floor(b.w / 2), b.top - 10, 1, 10, N[0]);
        if (Math.floor(t / 700 + bi) % 2) px(b.x + Math.floor(b.w / 2), b.top - 11, 1, 1, '#ff4a4a');
      }
      b.windows.forEach((w, wi) => {
        const on = w.on !== ((bi * 31 + wi * 17 + tick) % 89 === 0);
        if (!on) {
          px(w.x, w.y, 3, 3, N[3]);
          return;
        }
        const c = w.warm ? '#ffd27a' : '#bfe0ff';
        px(w.x, w.y, 3, 3, c);
        px(w.x, w.y + 2, 3, 1, w.warm ? '#d9a24e' : '#8fb4dd');
        if (w.blind) px(w.x, w.y, 3, 1, w.warm ? '#b9843e' : '#6f8fbf');
      });
    });
    ctxRef.restore();
    // how hard it is raining decides how many of the drops show
    const lvl = s.rain.level;
    const farN = Math.round(s.rainFar.length * Math.min(1, lvl));
    const nearN = Math.round(s.rainNear.length * Math.min(1, lvl * 0.9));
    ctxRef.fillStyle = s.T.rain[0];
    for (let i = 0; i < farN; i++) ctxRef.fillRect(Math.round(s.rainFar[i].x), Math.round(s.rainFar[i].y), 1, s.rainFar[i].len);
    ctxRef.fillStyle = s.T.rain[1];
    for (let i = 0; i < nearN; i++) ctxRef.fillRect(Math.round(s.rainNear[i].x), Math.round(s.rainNear[i].y), 1, s.rainNear[i].len);
    if (lvl > 1) {
      // a downpour: a second sheet of rain, and the city behind it greys out
      ctxRef.fillStyle = `rgba(170, 185, 240, ${0.7 * (lvl - 1) * 2})`;
      for (const d of s.rainNear) ctxRef.fillRect(Math.round(d.x + 9) , Math.round(d.y + 17), 1, d.len + 2);
      ctxRef.fillStyle = `rgba(60, 70, 120, ${0.25 * (lvl - 1) * 2})`;
      ctxRef.fillRect(win.x, win.y, win.w, win.h);
    }
    drawWeather(t);
    ctxRef.restore();
    // drops on the glass, with a wet trail behind the sliding ones
    for (const d of s.drops) {
      if (d.trail) px(d.x, d.y - d.trail, 1, d.trail, 'rgba(200, 215, 255, 0.12)');
      px(d.x, d.y, d.size + 1, d.size + 1, 'rgba(200, 215, 255, 0.35)');
      px(d.x, d.y, 1, 1, 'rgba(255, 255, 255, 0.75)');
    }
    ctxRef.drawImage(s.fg, 0, 0);
    ctxRef.fillStyle = 'rgba(200, 215, 255, 0.7)';
    for (const p of s.splashes) {
      const k = 5 - p.life;
      ctxRef.fillRect(p.x - k, win.y + win.h + 6 - p.life, 1, 1);
      ctxRef.fillRect(p.x + k, win.y + win.h + 6 - p.life, 1, 1);
    }
    // fairy-light wire (the bulbs glow, so they are drawn after the light pass)
    const x0 = win.x - 30;
    const x1 = win.x + win.w + 30;
    const sagAt = (x) => win.y - 15 + Math.round(Math.sin((((x - x0) % 54) / 54) * Math.PI) * 6);
    for (let x = x0; x < x1; x += 9) px(x, sagAt(x), 9, 1, '#241a36');
    // mug of coffee with curling steam
    const mx = s.narrow ? win.x + 20 : Math.round(W * 0.62);
    const my = deskY - 13;
    px(mx + 2, deskY - 1, 16, 2, 'rgba(0,0,0,0.3)');
    shadeEllipse(mx + 7, my + 1, 7, 2, () => '#d8d0e6');
    px(mx, my + 1, 15, 12, '#e9e2f2');
    px(mx + 10, my + 1, 4, 12, '#c9c0da');
    px(mx, my + 1, 2, 12, '#ffffff');
    shadeEllipse(mx + 7, my + 1, 6, 1.5, () => '#5a2f24');
    for (let k = 0; k < 8; k++) px(mx + 15 + Math.round(Math.sin((k / 8) * Math.PI) * 4), my + 3 + k, 2, 1, '#c9c0da');
    px(mx + 3, my + 6, 8, 2, '#e05a6b');
    for (let k = 0; k < 3; k++) {
      const phase = t / 420 + k * 2.1;
      for (let j = 0; j < 9; j++) {
        const yy = my - 3 - j * 2 - ((t / 90 + k * 7) % 4);
        const xx = mx + 4 + k * 3 + Math.round(Math.sin(phase + j * 0.6) * 2);
        const a = 0.45 * (1 - j / 9);
        px(xx, yy, 1, 2, `rgba(240, 235, 250, ${a})`);
      }
    }
    hdCat(s.catX, deskY - 12, t, undefined, s.cat.pose);

    // ---- light pass: everything above is plain art; now the room goes dark except where lit
    applyLight(s.lightmap);
    if (s.flash > 0) {
      ctxRef.fillStyle = `rgba(150, 165, 255, ${s.flash * 0.16})`;
      ctxRef.fillRect(0, 0, W, H);
    }

    if (s.car) headlights(s);
    ctxRef.drawImage(s.deskShade, 0, 0);

    // light you can see in the air, with dust drifting through it
    ctxRef.drawImage(s.moonShaft, 0, 0);
    ctxRef.drawImage(s.lampShaft, 0, 0);
    drawMotes(s.moonMotes, t, s.T.mote);
    drawMotes(s.lampMotes, t, 'rgba(255, 232, 185, 0.75)');
    ctxRef.drawImage(s.pool, 0, 0);
    ctxRef.drawImage(s.glow, 0, 0);
    if (beat.kick > 0.02) {
      // swelling with the kick while Lofi Room radio plays
      ctxRef.globalAlpha = beat.kick * 0.35;
      ctxRef.drawImage(s.glow, 0, 0);
      ctxRef.globalAlpha = 1;
    }
    drawCatHearts(s.cat);

    // things that give off light stay bright
    const colors = ['#ffd27a', '#ff8fb1', '#8fd3ff', '#b6f28a', '#ffb35c'];
    for (let x = x0, i = 0; x <= x1; x += 9, i++) {
      const y = sagAt(x);
      const on = Math.sin(t / 650 + i * 1.9) > -0.35;
      const c = colors[i % colors.length];
      if (on) {
        const k = s.T.glow ?? 1;
        px(x - 3, y - 1, 9, 8, `rgba(255, 225, 170, ${0.06 * k})`);
        px(x - 1, y + 1, 5, 4, `rgba(255, 225, 170, ${0.12 * k})`);
      }
      px(x + 1, y + 1, 2, 3, on ? c : '#3a2e4c');
      if (on) px(x + 1, y + 1, 1, 1, '#ffffff');
    }
    if (!s.narrow) {
      const { x: cx, y: cy } = s.candle;
      px(cx, cy - 10, 6, 10, '#d9c8ae');
      px(cx, cy - 10, 2, 10, '#f3e4c8');
      px(cx + 2, cy - 12, 1, 2, '#3a2a20');
      const fl = Math.random() < 0.3 ? 1 : 0;
      // a draught: the flame leans over, shrinks, and the glow dips, then it rights itself
      const g = s.gust > 0 ? Math.sin((s.gust / 24) * Math.PI) : 0;
      const lean = Math.round(g * 2);
      const short = Math.round(g * 2);
      const k = s.T.glow ?? 1;
      px(cx - 4, cy - 22, 14, 13, `rgba(255, 190, 110, ${0.07 * k * (1 - g * 0.6)})`);
      px(cx - 1, cy - 19, 8, 8, `rgba(255, 190, 110, ${0.1 * k * (1 - g * 0.6)})`);
      px(cx + 1 + fl + lean, cy - 17 + short, 2, 5 - short, '#ffb347');
      px(cx + 2 + lean, cy - 15 - fl + short, 1, Math.max(1, 3 - short), '#fff1c9');
    }
    // lamp bulb rim
    px(s.lampX + 21, s.deskY - 50, 26, 2, '#fff1c9');
    if (s.moth) moth(s, t);

    // ---- foreground: near the viewer, so it moves against the room and sways a little
    if (s.plant) {
      const sway = Math.round(Math.sin(t / 2600) * 1.2);
      ctxRef.drawImage(s.plant, s.plantAt.x - Math.round(vx * 7) + sway, s.plantAt.y - Math.round(vy * 4));
    }
  },
};

/** Headlights from the street below: the window's shape, thrown up the wall, sliding across it. */
function headlights(s) {
  const { car, win, deskY } = s;
  const f = car.f / car.dur;
  const a = Math.sin(f * Math.PI); // fade in and out
  const span = W + win.w * 1.2;
  const cx = car.dir > 0 ? -win.w * 0.6 + f * span : W + win.w * 0.6 - f * span;
  const half = Math.round(win.w * 0.28);
  const skew = 50 * car.dir;
  const bar = Math.round(cx); // the shadow of the window's middle bar
  poly(
    [[cx - half - skew, 0], [cx + half - skew, 0], [cx + half + skew, deskY], [cx - half + skew, deskY]],
    (x, y) => {
      if (x >= win.x && x < win.x + win.w && y >= win.y && y < win.y + win.h) return null; // not on the glass
      const along = (y / deskY) * 2 - 1;
      if (Math.abs(x - (bar + skew * along)) < 2) return null;
      const up = 1 - y / deskY; // brighter up the wall
      return dith(x, y, a * (0.18 + up * 0.3)) ? 'rgba(255, 238, 205, 0.2)' : null;
    },
  );
}

/** A moth that finds the lamp, circles it for a while, and wanders off. */
function moth(s, t) {
  const m = s.moth;
  const { x: lx, y: ly } = s.lampShade;
  const arrive = Math.max(0, 1 - m.f / 30);
  const leave = Math.max(0, (m.f - (m.dur - 30)) / 30);
  const far = 60 * (arrive + leave);
  const a = m.f * 0.32 + m.seed;
  const x = lx + Math.cos(a) * (20 + far) + Math.sin(m.f * 0.9 + m.seed) * 2 - leave * 40;
  const y = ly - 8 + Math.sin(a * 1.4) * (9 + far * 0.4) + Math.cos(m.f * 1.3) * 1.5 - (arrive + leave) * 30;
  // its shadow, thrown big and soft onto the wall above the lamp
  const sx = lx + (x - lx) * 2.6;
  const sy = ly - 40 + (y - ly) * 2.2;
  const flap = Math.floor(t / 70) % 2;
  if (sy > 0) {
    px(Math.round(sx) - (flap ? 5 : 2), Math.round(sy) - 2, flap ? 11 : 5, 4, 'rgba(20, 10, 20, 0.16)');
    px(Math.round(sx) - 1, Math.round(sy) - 3, 3, 6, 'rgba(20, 10, 20, 0.12)');
  }
  const X = Math.round(x);
  const Y = Math.round(y);
  // dusty wings with a dark body, so it shows against the dark wall and the bright shade alike
  if (flap) {
    px(X - 2, Y - 1, 2, 2, '#d8c8a4');
    px(X + 1, Y - 1, 2, 2, '#d8c8a4');
  } else {
    px(X - 1, Y, 1, 2, '#bca884');
    px(X + 1, Y, 1, 2, '#bca884');
  }
  px(X, Y - 1, 1, 3, '#3a2c22'); // body
}

export default rainyRoom;
