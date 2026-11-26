import {
  W,
  H,
  ctxRef,
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
  haloRing,
  makeStars,
  drawStars,
  makeLightmap,
  applyLight,
  makeMist,
  hash,
  tod,
  sfx,
  phaseMoon,
  beat,
} from './kit.js';
import { hdCat, catMind, stepCat, stirCat, petCat, onCat, drawCatHearts } from './animals.js';

// Little things that happen now and then (one every 20 to 60 seconds, never the same twice running):
// the temple bell rings, a long-tail boat goes down the river, bats cross the moon, a group on the
// far bank lets a dozen lanterns go at once, the cat on the steps wakes up.
const EVENTS = ['bell', 'boat', 'bats', 'wish', 'cat', 'bell', 'wish', 'boat'];

function start(s, e) {
  if (e === 'bell') ring(s);
  else if (e === 'boat' && !s.boat) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    s.boat = { x: dir > 0 ? -40 : W + 40, dir, y: s.riverTop + Math.round((s.bankTop - s.riverTop) * (0.35 + Math.random() * 0.3)) };
    sfx('boat');
  } else if (e === 'bats' && !s.bats.length && s.T.stars) {
    for (let i = 0; i < 5; i++) s.bats.push({ x: -10 - i * 9 - Math.random() * 8, y: s.moon.y + 14 + (Math.random() - 0.5) * 20, p: Math.random() * 7 });
  } else if (e === 'wish' && s.T.lanterns) for (let i = 0; i < 12; i++) release(s, s.templeX + (Math.random() - 0.5) * s.bodyW, s.roofTop - Math.random() * 6, false, -i * 5);
  else if (e === 'cat') stirCat(s.cat, Math.random() < 0.5 ? 'look' : 'yawn');
}

function ring(s) {
  s.ringing = 12 * 4;
  sfx('bell');
}

/** A sky lantern let go at (x, y): from the far bank (small) or from our own steps (near and big). */
function release(s, x, y, near, delay = 0) {
  if (s.lanterns.length > 70) return;
  s.lanterns.push({ x, y, near, vy: -(near ? 0.35 + Math.random() * 0.15 : 0.14 + Math.random() * 0.14), vx: (Math.random() - 0.5) * 0.06, p: Math.random() * 7, f: delay });
}

/** A krathong set on the water at x (or upstream, off the edge). */
function float(s, x) {
  const lane = s.riverTop + 8 + Math.random() * (s.bankTop - s.riverTop - 16);
  s.krathongs.push({ x: x ?? -14, y: lane, v: 0.06 + Math.random() * 0.06, p: Math.random() * 7, pink: Math.random() < 0.5 });
}

const onRiver = (s, x, y) => y > s.riverTop + 4 && y < s.bankTop - 2;
const onSteps = (s, x, y) => y >= s.bankTop;
const catAt = (s) => [s.catX, s.bankTop + 16];

// ------------------------------------------------------------------ scene: riverside temple

// A temple on the far bank of a river. Night is the original: the ordination hall lit from inside,
// the white chedi under floodlights, lanterns going up all evening and krathongs drifting past. Dusk
// has the roofs blazing in the last sun and the first lanterns; dawn is misty and pink, the lamps
// out; by day the gold catches the sun on a blue river.
const TIMES = {
  night: {
    sky: ['#050918', '#0a1230', '#141c44', '#202658', '#2c2a60'],
    stars: 1, moon: true, lanterns: true, krathongs: true, lit: 1,
    hills: '#0e1430', trees: ['#081016', '#0c1820'], wall: ['#b4b0c8', '#8a88a4', '#6e6c88'],
    roof: ['#8a3a26', '#6a2a1c'], band: '#1d4a3c', gold: ['#d8b050', '#a88030'], chedi: ['#d8d6e8', '#a8a6c0', '#7e7c9a'],
    water: ['#0c1638', '#0a1230', '#080e26'], bank: ['#3a3440', '#2e2834', '#221e28'],
    ambient: '#454a78', top: '#8a8a9a', vignette: 0.3, mist: 'rgba(120, 130, 175, 0.2)',
  },
  dusk: {
    sky: ['#1c1c48', '#45386e', '#9a4e7a', '#dc7658', '#f4a65e'],
    stars: 0.3, sun: { y: 0.55, r: 14, color: '#ffb066', halo: 'rgba(255, 160, 90, 0.16)' }, lanterns: true, krathongs: true, lit: 0.85,
    hills: '#3a2a4c', trees: ['#1a1424', '#241a2e'], wall: ['#e8d0c8', '#c0a4a4', '#987c84'],
    roof: ['#c0542e', '#94381e'], band: '#2a5a44', gold: ['#f2c850', '#c08a30'], chedi: ['#f4dcd4', '#d0b0b4', '#a88894'],
    water: ['#5a3a66', '#3a2a54', '#241c40'], bank: ['#4a3a40', '#3a2e34', '#2a2228'],
    ambient: '#a08494', top: '#6a5a5a', vignette: 0.25, mist: 'rgba(240, 170, 140, 0.2)',
  },
  dawn: {
    sky: ['#2a3058', '#585a82', '#9c869c', '#dcaa9a', '#f4d0b2'],
    stars: 0, sun: { y: 0.6, r: 11, color: '#ffe0c0', halo: 'rgba(255, 210, 180, 0.14)' }, lanterns: false, krathongs: false, lit: 0.2,
    hills: '#5a5a7a', trees: ['#2e3040', '#383a4c'], wall: ['#ece2dc', '#cabcbc', '#a898a0'],
    roof: ['#c45e38', '#9e4628'], band: '#2e6250', gold: ['#ecc458', '#c09038'], chedi: ['#f6ece8', '#d8c8cc', '#b0a0aa'],
    water: ['#7a7896', '#64627e', '#4e4c68'], bank: ['#5a5058', '#4a424a', '#3a343c'],
    ambient: '#c8bcc8', top: '#4a4a4a', vignette: 0.18, mist: 'rgba(235, 215, 225, 0.42)',
  },
  day: {
    sky: ['#3a84d6', '#5698de', '#76aee6', '#98c4ec', '#bedaf0'],
    stars: 0, sun: { y: 0.1, r: 10, color: '#fffbe6', halo: 'rgba(255, 250, 220, 0.18)' }, lanterns: false, krathongs: false, lit: 0,
    hills: '#6a90a8', trees: ['#2c5a34', '#3a6e40'], wall: ['#f6f2ea', '#dcd6cc', '#bab2a6'],
    roof: ['#dc6a3c', '#b04e2c'], band: '#2a7a56', gold: ['#f8d050', '#d0a030'], chedi: ['#fbfaf6', '#e2ded6', '#c2bcb2'],
    water: ['#3c80b4', '#3070a2', '#28608e'], bank: ['#8a7a6a', '#76685a', '#62564a'],
    ambient: '#ffffff', top: '#000000', vignette: 0.1, mist: 'rgba(255, 255, 255, 0.1)',
  },
};

// ---- the buildings, drawn plainly (the light map darkens them afterwards)

/** The ordination hall seen from the side: white walls, three tiers of roof, gold finials. */
function hall(T, cx, base, bodyW, bodyH, openings) {
  const x0 = Math.round(cx - bodyW / 2);
  const top = base - bodyH;
  // platform and steps
  px(x0 - 10, base - 4, bodyW + 20, 4, T.wall[2]);
  px(x0 - 6, base - 7, bodyW + 12, 3, T.wall[1]);
  // walls with pillars
  px(x0, top, bodyW, bodyH - 7, T.wall[0]);
  const cols = Math.max(5, Math.round(bodyW / 22));
  for (let i = 0; i <= cols; i++) {
    const x = Math.round(x0 + (i / cols) * (bodyW - 4));
    px(x, top, 4, bodyH - 7, T.wall[1]);
    px(x, top, 1, bodyH - 7, T.wall[0]);
    px(x - 1, top + 2, 6, 2, T.gold[1]); // lotus capital
  }
  // the openings, gold-framed with pointed tops; their glow is added after the light pass
  for (const o of openings) {
    px(o.x - 1, o.y - 2, o.w + 2, o.h + 2, T.gold[0]);
    px(o.x, o.y, o.w, o.h, '#2a1a14');
    for (let k = 0; k < 4; k++) px(o.x + Math.round(o.w / 2) - k, o.y - 3 - (3 - k), k * 2 + 1, 1, T.gold[0]);
  }
  // three tiers of roof, each narrower, with a green band at the eaves and gold along the ridge
  let yb = top + 2;
  let half = bodyW / 2 + 16;
  const tierH = Math.round(bodyH * 0.55);
  for (let i = 0; i < 3; i++) {
    const inset = tierH * 0.9;
    const yt = yb - tierH;
    poly(
      [
        [cx - half, yb],
        [cx + half, yb],
        [cx + half - inset, yt],
        [cx - half + inset, yt],
      ],
      (x, y) => ((y - yt) % 3 === 0 ? T.roof[1] : dith(x, y, 0.2) ? T.roof[1] : T.roof[0]),
    );
    px(Math.round(cx - half), yb - 2, Math.round(half * 2), 2, T.band);
    px(Math.round(cx - half + inset), yt, Math.round((half - inset) * 2), 1, T.gold[0]);
    // the gable ends: gold trim down each slope, a naga tail curling up at the eave
    stroke(cx - half + inset, yt, cx - half, yb - 2, T.gold[0]);
    stroke(cx + half - inset, yt, cx + half, yb - 2, T.gold[0]);
    px(Math.round(cx - half) - 2, yb - 5, 2, 3, T.gold[0]);
    px(Math.round(cx + half), yb - 5, 2, 3, T.gold[0]);
    // the chofa, the slender finial hooking up from each end of the ridge
    for (const [sx, dir] of [
      [cx - half + inset, -1],
      [cx + half - inset, 1],
    ]) {
      const fx = Math.round(sx);
      px(fx, yt - 6, 1, 6, T.gold[0]);
      px(fx + dir, yt - 8, 1, 3, T.gold[0]);
      px(fx + dir * 2, yt - 9, 1, 2, T.gold[0]);
    }
    yb = yt + Math.round(tierH * 0.35);
    half -= bodyW * 0.14;
  }
  return yb - tierH * 0.35; // the top of the highest ridge
}

/** A white bell-shaped chedi with gold rings and spire. */
function chedi(T, cx, base, size) {
  const step = (w, h, y) => px(Math.round(cx - w / 2), y, Math.round(w), h, T.chedi[1]);
  let y = base;
  for (let i = 0; i < 3; i++) {
    const w = size * (1.5 - i * 0.18);
    y -= Math.round(size * 0.12);
    step(w, Math.round(size * 0.12), y);
    px(Math.round(cx - w / 2), y, Math.round(w), 1, T.chedi[0]);
  }
  // the bell, lit from the left
  const br = size * 0.55;
  const by = y;
  shadeEllipse(cx, by, br, br * 1.1, (nx, ny) => (ny > 0 ? null : nx < -0.2 ? T.chedi[0] : nx < 0.45 ? T.chedi[1] : T.chedi[2]));
  y = Math.round(by - br * 1.1);
  px(Math.round(cx - size * 0.16), y - 4, Math.round(size * 0.32), 4, T.chedi[1]); // the box above the bell
  y -= 4;
  // gold rings, then the spire
  for (let i = 0; i < 7; i++) {
    const w = size * 0.26 * (1 - i / 9);
    px(Math.round(cx - w / 2), y - 3, Math.max(1, Math.round(w)), 2, i % 2 ? T.gold[1] : T.gold[0]);
    y -= 3;
  }
  const spire = Math.round(size * 0.9);
  for (let k = 0; k < spire; k++) px(Math.round(cx) - (k < spire * 0.3 ? 1 : 0), y - k, k < spire * 0.3 ? 2 : 1, 1, T.gold[0]);
  disc(cx, y - spire, 1.5, T.gold[0]);
  return y - spire;
}

const temple = {
  id: 'temple',
  name: 'วัดริมน้ำยามค่ำ',
  en: 'Riverside temple',
  accent: '#ffb84a',
  sky: {
    native: 'clear',
    kinds: ['clear', 'rain', 'storm', 'fog'],
    open: (s) => [0, 0, W, Math.max(30, Math.round(s.spireTop - 6))],
    // no lanterns go up in the rain, and the krathong candles gutter out
    react(s, w) {
      s.wet = w.kind === 'rain' || w.kind === 'storm' ? w.level : 0;
      return [];
    },
  },
  init() {
    const r = rng(83);
    const T = TIMES[tod] || TIMES.night;
    const narrow = W < 420;
    const riverTop = Math.round(H * 0.64);
    const bankTop = Math.round(H * 0.84);
    const templeX = Math.round(W * (narrow ? 0.42 : 0.4));
    const bodyW = Math.round(Math.min(W * (narrow ? 0.56 : 0.34), 230));
    const bodyH = Math.round(H * 0.12);
    const hallBase = riverTop - 7;
    const chediX = Math.round(W * (narrow ? 0.86 : 0.72));
    const chediSize = Math.round(H * 0.075);
    const moon = { x: Math.round(W * (narrow ? 0.2 : 0.84)), y: Math.round(H * 0.12) };
    // the hall's doors and windows
    const nOpen = narrow ? 3 : 5;
    const openings = Array.from({ length: nOpen }, (_, i) => {
      const w = i === Math.floor(nOpen / 2) ? 9 : 6;
      const h = i === Math.floor(nOpen / 2) ? Math.round(bodyH * 0.55) : Math.round(bodyH * 0.4);
      return { x: Math.round(templeX - bodyW / 2 + ((i + 0.5) / nOpen) * bodyW - w / 2), y: hallBase - 7 - h - 2, w, h };
    });
    let roofTop = 0;
    let spireTop = 0;

    const sky = layer(() => {
      bands(0, 0, W, riverTop, T.sky);
      if (T.sun) {
        const sy = Math.round(H * T.sun.y);
        haloRing(moon.x, sy, T.sun.r, T.sun.r * 4, T.sun.halo);
        haloRing(moon.x, sy, T.sun.r, T.sun.r * 2, T.sun.halo);
        disc(moon.x, sy, T.sun.r, T.sun.color);
      } else {
        haloRing(moon.x, moon.y, 10, 30, 'rgba(240, 235, 205, 0.1)');
        shadeEllipse(moon.x, moon.y, 10, 10, (nx, ny) => (nx - ny > 0.9 ? '#fffbe6' : nx - ny < -0.8 ? '#d9d3b8' : '#f4f0dc'));
        disc(moon.x - 3, moon.y - 2, 2, '#dcd6bb');
        disc(moon.x + 3, moon.y + 3, 1.5, '#dcd6bb');
        phaseMoon(moon.x, moon.y, 10);
      }
    });

    // everything on the far bank, drawn plainly; it is also what the river reflects
    const far = layer(() => {
      // low hills far off, then the trees of the temple grounds
      for (let x = 0; x < W; x++) {
        const h = Math.round(H * 0.06 + Math.sin(x / 61 + 1) * 6 + Math.sin(x / 23) * 3);
        px(x, riverTop - 10 - h, 1, h + 4, T.hills);
      }
      for (let i = 0; i < W / 14; i++) {
        const x = r() * W;
        const rr = 8 + r() * 10;
        disc(x, riverTop - 14 - r() * 10, rr, r() < 0.5 ? T.trees[0] : T.trees[1]);
      }
      // coconut palms on the right
      for (const [x, h] of [
        [W * 0.88, 52],
        [W * 0.95, 40],
        [W * 0.6, 44],
      ]) {
        const bx = Math.round(x);
        for (let k = 0; k < h; k++) px(bx + Math.round((k / h) ** 2 * 4), riverTop - 8 - k, 2, 1, T.trees[0]);
        const tx = bx + 4;
        const ty = riverTop - 8 - h;
        for (let a = 0; a < 7; a++) {
          const ang = (a / 7) * Math.PI * 2;
          for (let k = 0; k < 12; k++) px(tx + Math.round(Math.cos(ang) * k), ty + Math.round(Math.sin(ang) * k * 0.5 + (k * k) / 30), 1, 1, T.trees[0]);
        }
      }
      // the chedi behind, then the hall in front of it
      spireTop = chedi(T, chediX, hallBase, chediSize);
      roofTop = hall(T, templeX, hallBase, bodyW, bodyH, openings);
      // a big bodhi tree on the left
      const bx = Math.round(W * (narrow ? 0.06 : 0.1));
      px(bx - 3, riverTop - 72, 7, 66, T.trees[0]);
      stroke(bx, riverTop - 60, bx - 16, riverTop - 74, T.trees[0], 2);
      stroke(bx, riverTop - 56, bx + 18, riverTop - 72, T.trees[0], 2);
      for (let i = 0; i < 26; i++) disc(bx + (r() - 0.5) * 60, riverTop - 62 - r() * 34, 9 + r() * 9, i % 3 ? T.trees[0] : T.trees[1]);
      // the river wall (kamphaeng kaew) with its posts
      px(0, riverTop - 6, W, 6, T.wall[1]);
      px(0, riverTop - 6, W, 1, T.wall[0]);
      for (let x = 4; x < W; x += 16) px(x, riverTop - 10, 3, 5, T.wall[0]);
    });

    const water = layer(() => bands(0, riverTop, W, bankTop - riverTop, T.water));

    // the steps down to the water on our side, with oil lamps along the edge
    const lamps = [];
    const bank = layer(() => {
      bands(0, bankTop, W, H - bankTop, T.bank);
      px(0, bankTop, W, 2, T.wall[2]);
      for (let y = bankTop + 9; y < H; y += 9) px(0, y, W, 1, T.bank[2]);
      for (let x = 10; x < W; x += narrow ? 30 : 38) {
        const lx = x + Math.round(r() * 8);
        lamps.push({ x: lx, y: bankTop + 3, p: r() * 7 });
        px(lx - 2, bankTop + 3, 5, 2, '#8a5a3a'); // a clay lamp
      }
      // a pot of lotus at the right, krathongs waiting on a tray at the left
      const potX = Math.round(W * 0.82);
      px(potX - 8, H - 22, 16, 12, '#7a4a32');
      px(potX - 9, H - 23, 18, 2, '#9a6a48');
      for (let k = 0; k < 4; k++) disc(potX - 6 + k * 4, H - 26 - (k % 2) * 3, 3, '#2e6a3a');
      disc(potX + 1, H - 34, 2, '#f2a0b8');
      px(potX + 1, H - 32, 1, 6, '#2e6a3a');
      const trayX = Math.round(W * 0.12);
      px(trayX - 14, H - 14, 28, 3, '#5a3a2a');
      for (let k = 0; k < 2; k++) {
        const kx = trayX - 7 + k * 14;
        shadeEllipse(kx, H - 16, 6, 2, () => '#3e7a3a');
        for (let p = -2; p <= 2; p++) px(kx + p * 2, H - 20 + Math.abs(p), 1, 3 - Math.abs(p) + 1, k ? '#f6c4d4' : '#f4f0e6');
      }
    });

    const catX = Math.round(W * (narrow ? 0.66 : 0.58));
    const lights = [
      { poly: [[0, 0], [W, 0], [W, riverTop * 0.8], [0, riverTop * 0.8]], from: [0, 0], to: [0, riverTop * 0.8], color: T.top },
      { x: moon.x, y: moon.y, r: 70, color: T.sun ? '#000000' : '#8a8a96' },
      ...openings.map((o) => ({ x: o.x + o.w / 2, y: o.y + o.h / 2, r: 70 * T.lit, ry: 40 * T.lit, color: '#a0703a' })),
      { x: chediX, y: hallBase - chediSize, r: 90 * T.lit, ry: 110 * T.lit, color: '#5a5070' }, // floodlit
      ...lamps.map((l) => ({ x: l.x, y: l.y, r: 40 * T.lit, ry: 24 * T.lit, color: '#7a5030' })),
    ].filter((l) => !l.r || l.r > 1);

    return {
      T,
      narrow,
      riverTop,
      bankTop,
      templeX,
      bodyW,
      roofTop,
      spireTop,
      chediX,
      moon,
      openings,
      lamps,
      catX,
      sky,
      far,
      water,
      bank,
      stars: makeStars(r, W * 0.4, riverTop * 0.6, ['#cfd8ff', '#ffe7b0', '#9fb0e0']),
      glow: makeGlow(templeX, hallBase - bodyH * 0.4, bodyW * 0.75, bodyH * 1.2, 'rgba(255, 170, 80, 0.06)', 4),
      chediGlow: makeGlow(chediX, hallBase - chediSize * 1.2, chediSize * 1.6, chediSize * 2.4, 'rgba(255, 230, 190, 0.05)', 3),
      mist: makeMist(riverTop - 30, riverTop - 4, riverTop + 10, T.mist, 0.7, W + 60),
      lightmap: makeLightmap(T.ambient, lights, { vignette: T.vignette }),
      lanterns: [],
      krathongs: [],
      bats: [],
      boat: null,
      ringing: 0,
      wet: 0,
      cat: catMind(),
      ev: { wait: 12 * 6, last: null },
      lanternWait: 0,
      krathongWait: 12 * 2,
      seeded: false,
    };
  },
  update(s) {
    const T = s.T;
    // lanterns go up from behind the hall all evening (fewer in the rain)
    if (T.lanterns && !s.seeded) {
      s.seeded = true;
      for (let i = 0; i < 34; i++) release(s, s.templeX + (Math.random() - 0.5) * W * 0.8, s.roofTop - 10 - Math.random() * (s.roofTop - 20), false, 30);
      for (let i = 0; i < 3; i++) float(s, Math.random() * W);
    }
    if (T.lanterns && s.wet < 0.3 && --s.lanternWait <= 0) {
      s.lanternWait = 12 * (0.6 + Math.random() * 2);
      release(s, s.templeX + (Math.random() - 0.5) * s.bodyW * 1.4, s.roofTop - Math.random() * 4, false);
    }
    for (const l of s.lanterns) {
      l.f++;
      if (l.f < 0) continue;
      l.y += l.vy;
      l.x += l.vx + Math.sin(l.f / 40 + l.p) * 0.05;
    }
    s.lanterns = s.lanterns.filter((l) => l.y > -8);
    // krathongs drift downstream, left to right
    if (T.krathongs && --s.krathongWait <= 0) {
      s.krathongWait = 12 * (8 + Math.random() * 14);
      float(s);
    }
    for (const k of s.krathongs) k.x += k.v;
    s.krathongs = s.krathongs.filter((k) => k.x < W + 16);
    if (s.boat) {
      s.boat.x += 1.6 * s.boat.dir;
      if (s.boat.x < -60 || s.boat.x > W + 60) s.boat = null;
    }
    for (const b of s.bats) {
      b.x += 2.2;
      b.y += Math.sin(b.x / 9 + b.p) * 0.8;
    }
    s.bats = s.bats.filter((b) => b.x < W + 10);
    if (s.ringing > 0) s.ringing--;
    stepCat(s.cat);
    if (--s.ev.wait <= 0) {
      const pick = EVENTS.filter((e) => e !== s.ev.last);
      const e = pick[Math.floor(Math.random() * pick.length)];
      start(s, e);
      s.ev.last = e;
      s.ev.wait = 12 * (20 + Math.random() * 40);
    }
  },
  sound: (s) => ({ bell: s.ringing > 0 ? 1 : 0 }),
  hot(s, x, y) {
    return onCat(...catAt(s), x, y) || onRiver(s, x, y) || onSteps(s, x, y);
  },
  poke(s, x, y) {
    if (onCat(...catAt(s), x, y)) petCat(s.cat, ...catAt(s));
    else if (onRiver(s, x, y)) float(s, x - 6); // set a krathong on the water just here
    else if (onSteps(s, x, y)) {
      release(s, x, s.bankTop - 4, true); // let a lantern go from our own steps
      sfx('whoosh');
    }
  },
  draw(s, t) {
    const T = s.T;
    const { riverTop, bankTop } = s;
    const { x: vx } = look(t);
    ctxRef.drawImage(s.sky, 0, 0);
    if (T.stars === 1) drawStars(s.stars, t);
    else if (T.stars) {
      ctxRef.globalAlpha = T.stars;
      drawStars(s.stars, t);
      ctxRef.globalAlpha = 1;
    }
    for (const b of s.bats) {
      const up = Math.floor(t / 90 + b.p) % 2;
      px(Math.round(b.x) - 2, Math.round(b.y) - up, 2, 1, '#0a0a14');
      px(Math.round(b.x), Math.round(b.y), 1, 1, '#0a0a14');
      px(Math.round(b.x) + 1, Math.round(b.y) - up, 2, 1, '#0a0a14');
    }
    ctxRef.drawImage(s.far, 0, 0);
    ctxRef.drawImage(s.mist, Math.round(-30 + Math.sin(t / 9000) * 24), 0);

    // the river, and the far bank upside down in it, broken up by the ripples
    ctxRef.drawImage(s.water, 0, 0);
    ctxRef.globalAlpha = 0.3;
    const depth = bankTop - riverTop;
    for (let k = 0; k < depth; k++) {
      const sy = riverTop - 1 - Math.round(k * 1.4);
      if (sy < 0) break;
      const off = Math.round(Math.sin(t / 600 + k * 0.7) * (1 + k * 0.06));
      ctxRef.drawImage(s.far, 0, sy, W, 1, off, riverTop + k, W, 1);
    }
    ctxRef.globalAlpha = 1;
    // ripples catching the sky
    for (let i = 0; i < W / 7; i++) {
      const x = Math.round((hash(i * 4.3) * W + t / (40 + hash(i) * 40)) % W);
      const y = riverTop + 2 + Math.floor(hash(i * 7.7) * (depth - 3));
      px(x, y, 3 + Math.round(hash(i * 2.1) * 5), 1, 'rgba(200, 210, 255, 0.12)');
    }
    // a long-tail boat with its lamp
    if (s.boat) {
      const { x, y, dir } = s.boat;
      const bx = Math.round(x);
      poly(
        [
          [bx - 26, y - 3],
          [bx + 26, y - 3],
          [bx + 26 + dir * 4, y - 6],
          [bx + 18, y],
          [bx - 20, y],
        ],
        '#3a2418',
      );
      px(bx - 24, y - 4, 48, 1, '#8a5a32');
      px(bx - dir * 20, y - 9, 2, 6, '#1a1210'); // the boatman
      px(bx - dir * 20 - 1, y - 11, 4, 2, '#1a1210');
      stroke(bx - dir * 26, y - 4, bx - dir * 38, y + 2, '#2a1a12');
      px(bx + dir * 22, y - 8, 2, 2, '#ffe6a0');
    }

    ctxRef.drawImage(s.bank, 0, 0);
    hdCat(s.catX, bankTop + 16, t, undefined, s.cat.pose);

    // ---- light pass: a dark river night, the hall lit from inside, lamps along our steps
    applyLight(s.lightmap);

    const lit = T.lit;
    const flick = (p) => 0.75 + 0.25 * Math.sin(t / 120 + p * 5) * Math.sin(t / 77 + p);
    if (lit > 0) {
      ctxRef.globalAlpha = lit * (1 + 0.5 * beat.kick);
      ctxRef.drawImage(s.glow, 0, 0);
      ctxRef.drawImage(s.chediGlow, 0, 0);
      ctxRef.globalAlpha = 1;
      // the hall's openings, warm inside, and their light trembling on the water
      for (const o of s.openings) {
        px(o.x, o.y, o.w, o.h, `rgba(255, 200, 110, ${0.85 * lit})`);
        px(o.x + 1, o.y + o.h - 3, o.w - 2, 2, `rgba(255, 240, 190, ${0.9 * lit})`); // candles on the altar
        for (let k = 0; k < 12; k++) {
          const ry = riverTop + 2 + k * 2;
          const w = Math.max(1, o.w - Math.floor(k / 3));
          const off = Math.round(Math.sin(t / 300 + k + o.x) * 2);
          px(o.x + Math.round((o.w - w) / 2) + off, ry, w, 1, `rgba(255, 190, 100, ${0.35 * lit * (1 - k / 12)})`);
        }
      }
      // oil lamps along our steps
      for (const l of s.lamps) {
        const f = flick(l.p);
        px(l.x - 2, l.y - 3, 5, 4, `rgba(255, 150, 60, ${0.2 * lit * f})`);
        px(l.x, l.y - 2, 1, 2, '#ffd27a');
        px(l.x, l.y - 3, 1, 1, '#fff4d0');
      }
    }

    // krathongs: a banana-leaf boat, folded petals, a candle, a glow on the water round it
    for (const k of s.krathongs) {
      const x = Math.round(k.x);
      const y = Math.round(k.y + Math.sin(t / 700 + k.p) * 0.6);
      const burning = s.wet < 0.5;
      if (burning) {
        const f = flick(k.p);
        ctxRef.fillStyle = `rgba(255, 170, 80, ${0.16 * f})`;
        ctxRef.fillRect(x - 6, y - 3, 13, 5);
        for (let j = 1; j < 7; j++) px(x - 1 + Math.round(Math.sin(t / 250 + j) * 1), y + 1 + j, 3, 1, `rgba(255, 180, 90, ${0.25 * (1 - j / 7) * f})`); // its light on the water
      }
      shadeEllipse(x, y, 5, 1.6, () => '#2e6a34');
      for (let p = -2; p <= 2; p++) px(x + p * 2 - 1, y - 3 + Math.abs(p), 2, 3 - Math.abs(p), k.pink ? '#f4b8cc' : '#f2eee4');
      px(x, y - 6, 1, 3, '#f4eedc');
      if (burning) px(x, y - 8, 1, 2, Math.sin(t / 90 + k.p) > 0 ? '#ffe08a' : '#ffb040');
    }

    // sky lanterns: far ones a warm dot, near ones from our steps big and glowing
    for (const l of s.lanterns) {
      if (l.f < 0) continue;
      const x = Math.round(l.x);
      const y = Math.round(l.y);
      const fade = Math.min(1, l.f / 20);
      const f = flick(l.p);
      const size = l.near ? Math.max(2, Math.round(5 * Math.min(1, (y + 40) / (s.bankTop + 40)) + 1)) : y < s.roofTop * 0.35 ? 1 : y < s.roofTop * 0.75 ? 2 : 3;
      ctxRef.globalAlpha = fade;
      if (size === 1) px(x, y, 1, 1, '#ffc36a');
      else {
        px(x - size, y - size, size * 3, size * 3 + 1, `rgba(255, 140, 50, ${0.13 * f})`);
        px(x - 1, y - 1, size + 2, size + 3, `rgba(255, 170, 80, ${0.22 * f})`);
        px(x, y, size, size + 1, '#ffae4a');
        px(x, y, size, 1, '#ffe2a8');
        px(x + Math.floor(size / 2), y + size, 1, 1, '#fff4d0');
      }
      // its reflection, if it is low enough to show in the river
      const ry = riverTop + (riverTop - y) * 0.5;
      if (ry < bankTop - 1 && ry > riverTop) {
        ctxRef.globalAlpha = fade * 0.35;
        px(x, Math.round(ry), size > 1 ? 2 : 1, 1, '#ffb050');
      }
      ctxRef.globalAlpha = 1;
    }

    // the bell ringing: a soft ring of light over the hall's roof
    if (s.ringing > 0) {
      const k = 1 - s.ringing / 48;
      ctxRef.globalAlpha = (1 - k) * 0.25;
      haloRing(s.templeX, s.roofTop, 6 + k * 40, 8 + k * 42, '#fff0c0');
      ctxRef.globalAlpha = 1;
    }

    // a branch of the bodhi tree hanging into the top corner, nearest of all
    const ox = -Math.round(vx * 5);
    const dark = T.lit > 0.5; // after dark it is a silhouette against the sky
    stroke(ox - 4, 2, ox + W * 0.02 + 110, 14, dark ? '#05080c' : '#3a2a1e', 2);
    for (let i = 0; i < 9; i++) {
      const lx = ox + W * 0.02 + i * 13;
      const ly = 6 + Math.sin(i * 1.7) * 5 + i * 1.5;
      const sway = Math.round(Math.sin(t / 1300 + i) * 1);
      disc(lx + sway, ly, 6 - i * 0.35, dark ? '#05080c' : T.trees[0]);
      if (!dark) disc(lx + sway - 2, ly - 2, 2.5 - i * 0.15, T.trees[1]);
    }
    drawCatHearts(s.cat);
  },
};

export default temple;
