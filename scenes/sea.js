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
  makeStars,
  drawStars,
  makeCloud,
  makeLightmap,
  applyLight,
  makeRays,
  makeMist,
  tod,
  sfx,
} from './kit.js';

// ------------------------------------------------------------------ scene: seaside sunset

// The same beach at four times of day. Dusk is the original sunset. Dawn is pastel, with the sun
// just up over the sea on the left; by day the sun is high and small, the sea turquoise and the
// palm green; at night the moon lays a silver path on the water and the lighthouse does the work.
const TIMES = {
  dusk: {
    sky: ['#1b1340', '#2a1a4f', '#47235c', '#7a3163', '#b84a62', '#e0654f', '#f48a52', '#fbb561', '#ffd98a'],
    sun: { x: 0.62, size: 0.1, rise: 0.3, glow: 'rgba(255, 225, 160, 0.09)', c: ['#fffbe0', '#ffe9a6', '#ffc978'], bars: ['#f48a52', '#ee7a50'] },
    island: ['#4a2350', '#7a3d68', '#3a1a44'],
    head: ['#3f1f4a', '#6f3862', '#351a40'],
    lantern: '#2a1638',
    sea: ['#c06a78', '#8a5088', '#5f3e84', '#43306f', '#31265c', '#353070', '#454284'],
    clouds: ['#5a3070', '#8a4078', '#c85a7a', '#f08a6a', '#ffb878'],
    stars: true,
    waves: ['#e09a8e', '#9a74b4', '#7a66a8', 'rgba(20, 14, 50, 0.3)'],
    glitter: ['#fff0b8', '#ffd08a', '#f7a26a'], glitterSkip: 0.3,
    foam: ['#e9def2', '#4a4686', '#fff8ec', '#cfc4e6'],
    ambient: '#9a7a96',
    lights: (sx, hz) => [
      { x: sx, y: hz, r: W * 0.7, ry: H * 0.75, color: '#ffffff' },
      { x: sx, y: hz + 10, r: W * 0.35, ry: H * 0.3, color: '#ffd0a0' },
    ],
    vignette: 0.32,
    rays: 'rgba(255, 214, 160, 0.16)',
    haze: 'rgba(255, 196, 160, 0.30)',
    beam: 1,
    birds: '#3a1d3f',
    palm: ['#1a0e2a', '#2c1840', '#4a2a4a', '#8a4658', '#22143a', '#3b2452', '#3a1d2a', '#4a2536'],
    grass: ['#24122e', '#3a1d3a'],
  },
  dawn: {
    sky: ['#3a3a78', '#4a4688', '#64579a', '#8a68a6', '#b67aa8', '#de90a4', '#f2a8a0', '#fac2a4', '#ffd8b4'],
    sun: { x: 0.3, size: 0.075, rise: 0.75, glow: 'rgba(255, 220, 200, 0.10)', c: ['#fffaf0', '#ffe6c8', '#ffc8a0'], bars: ['#f2a8a0', '#e8969a'] },
    island: ['#6a5288', '#9a7aa6', '#5a4478'],
    head: ['#5a4880', '#8a72a0', '#4e3e72'],
    lantern: '#3a2e58',
    sea: ['#e8b4b4', '#b494b8', '#8a7cac', '#6a6498', '#56548a', '#5c6092', '#6c729c'],
    clouds: ['#7a6a9a', '#a886a8', '#d8a0b0', '#f4bcb0', '#ffd8c0'],
    stars: false,
    waves: ['#f6c8c0', '#b8a0cc', '#9a8cbc', 'rgba(40, 30, 80, 0.25)'],
    glitter: ['#fff8e8', '#ffe0c8', '#f6bca8'], glitterSkip: 0.35,
    foam: ['#f2eaf6', '#6a6aa0', '#fffaf4', '#dcd4ee'],
    ambient: '#b8a8c0',
    lights: (sx, hz) => [
      { x: sx, y: hz, r: W * 0.75, ry: H * 0.8, color: '#ffffff' },
      { x: sx, y: hz + 10, r: W * 0.35, ry: H * 0.3, color: '#ffd8c8' },
    ],
    vignette: 0.25,
    rays: 'rgba(255, 226, 210, 0.14)',
    haze: 'rgba(255, 220, 220, 0.30)',
    beam: 0.5,
    birds: '#4a3a64',
    palm: ['#2a2240', '#3a2e54', '#5a4a6a', '#8a6a80', '#2e2448', '#463a62', '#3a2e44', '#4a3a54'],
    grass: ['#30284a', '#46385e'],
  },
  day: {
    sky: ['#3f7fcc', '#4a8ad2', '#5896d8', '#66a2dc', '#76aee0', '#86b8e4', '#98c4e8', '#aacfea', '#bcd8ec'],
    sun: { x: 0.66, size: 0.055, y: 0.13, glow: 'rgba(255, 255, 235, 0.12)', c: ['#ffffff', '#fffef0', '#fff6c8'] },
    island: ['#4a7a64', '#6a9a74', '#3e6a54'],
    head: ['#5a7a5a', '#8aa870', '#4a6a4c'],
    lantern: '#3a4048',
    sea: ['#9ed4e0', '#6cc0d4', '#44a8c8', '#2f92bc', '#2a82b0', '#38a0c0', '#5ab8c8'],
    clouds: ['#c4d4e8', '#d8e2f0', '#eaf0f8', '#f6f9fc', '#ffffff'],
    stars: false,
    waves: ['#e8f8fc', '#9ed8e8', '#7cc4dc', 'rgba(20, 60, 100, 0.22)'],
    glitter: ['#ffffff', '#f0fcff', '#d4f2fa'], glitterSkip: 0.5,
    foam: ['#f2fbfc', '#4aaec4', '#ffffff', '#cdeef4'],
    ambient: '#f4f2ec',
    lights: () => [{ rect: [0, 0, W, H], color: '#ffffff' }],
    vignette: 0.14,
    rays: null,
    haze: 'rgba(230, 245, 255, 0.30)',
    beam: 0,
    birds: '#4a5060',
    palm: ['#5a4030', '#7a5a3e', '#9a7a52', '#c09a68', '#2f7a3c', '#4f9a4c', '#6a4a2a', '#8a6a3a'],
    grass: ['#6a9a48', '#8ab05a'],
  },
  night: {
    sky: ['#04061a', '#070a22', '#0b0f2c', '#0f1536', '#131a40', '#182048', '#1d2650', '#232c58', '#29325e'],
    moon: { x: 0.7, y: 0.17, size: 0.045 },
    island: ['#0e1230', '#1a2044', '#0a0c26'],
    head: ['#0e1230', '#1e2650', '#0a0c26'],
    lantern: '#0a0c20',
    sea: ['#283466', '#1e2856', '#18204a', '#141a40', '#11173a', '#141c42', '#1a2450'],
    clouds: ['#0c1030', '#141a40', '#1e2650', '#2a3462', '#3a4472'],
    stars: true,
    waves: ['#5a6aa0', '#34407a', '#2a3468', 'rgba(0, 0, 20, 0.35)'],
    glitter: ['#f4f6ff', '#c8d2f0', '#8a98c8'], glitterSkip: 0.55,
    foam: ['#a8b4dc', '#1e2656', '#d8e0f8', '#7884b4'],
    ambient: '#5a6090',
    lights: (sx, hz) => [
      { x: sx, y: H * 0.17, r: W * 0.5, ry: H * 0.6, color: '#8a90c0' },
      { x: sx, y: hz + 30, r: W * 0.18, ry: H * 0.35, color: '#7078a8' },
    ],
    vignette: 0.38,
    rays: null,
    haze: 'rgba(150, 170, 220, 0.18)',
    beam: 1.5,
    birds: null,
    palm: ['#05050f', '#0a0a1c', '#141a30', '#2a3456', '#080a18', '#141a30', '#0a0a18', '#141828'],
    grass: ['#060814', '#10142a'],
  },
};

const crabPal = { r: '#e2553f', d: '#b53d2e', k: '#2a1420' };
const crabFrames = [
  sprite(['.r.......r.', 'rr.......rr', '.r.rrrrr.r.', '..rrkrkrr..', '.rrrrrrrrr.', 'r.rdddddr.r', '.r.r...r.r.'], crabPal),
  sprite(['rr.......rr', '.r.......r.', '.r.rrrrr.r.', '..rrkrkrr..', '.rrrrrrrrr.', '.rrdddddrr.', 'r..r...r..r'], crabPal),
];
// claws up: startled
const crabUp = sprite(['rr.......rr', 'rr.......rr', '.r.rrrrr.r.', '..rrkrkrr..', '.rrrrrrrrr.', '.rrdddddrr.', 'r..r...r..r'], crabPal);
// a gull standing on the umbrella, facing left. w white · g grey wing · k wing tip and eye · y beak · l legs
// prettier-ignore
const gullSit = sprite(['.ww......', 'ykw......', '.ww......', '.wwwwggg.', '..wwwwggk', '...l.l...', '...l.l...'], { w: '#f4efe8', g: '#a6a0b4', k: '#2a1a2a', y: '#f2b23e', l: '#e09a5a' });
// the same gull with its head down, preening
// prettier-ignore
const gullPreen = sprite(['.........', '.........', '.ww......', 'ykwwwggg.', '..wwwwggk', '...l.l...', '...l.l...'], { w: '#f4efe8', g: '#a6a0b4', k: '#2a1a2a', y: '#f2b23e', l: '#e09a5a' });

// Little things that happen now and then (one every 20 to 60 seconds, never the same twice running):
// a pod of dolphins leaping across, a gull landing on the umbrella, a big wave running up the sand
// (the crab runs for it), fish jumping, a gust off the sea, the crab digging in and peeking out.
const EVENTS = ['dolphins', 'gull', 'surge', 'fish', 'breeze', 'crab', 'dolphins', 'fish'];
const AIR = 18; // frames a dolphin is out of the water on each leap
const UNDER = 11;

function start(s, e) {
  const { horizon, shore } = s;
  if (e === 'dolphins' && !s.dolphins.length) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const base = Math.round(horizon + (shore - horizon) * (0.3 + Math.random() * 0.15));
    const x0 = dir > 0 ? -20 - Math.random() * W * 0.1 : W + 20 + Math.random() * W * 0.1;
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) s.dolphins.push({ x: x0 - dir * i * 14, base: base + i * 3, dir, f: -i * 8 - UNDER, leaps: 4 + Math.floor(Math.random() * 3) });
  } else if (e === 'gull' && !s.gull) s.gull = { phase: 'in', f: 0, sx: W + 12, sy: H * (0.18 + Math.random() * 0.1), x: W + 12, y: 0 };
  else if (e === 'surge' && !s.surge) {
    s.surge = { f: 0, dur: 12 * 7 };
    scare(s, s.crab.x < W * 0.58 ? 1 : -1);
  } else if (e === 'fish') {
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) jump(s, W * (0.1 + Math.random() * 0.8), horizon + 6 + Math.random() * (shore - horizon - 22), -i * 9);
  } else if (e === 'breeze' && !s.breeze) {
    s.breeze = { f: 0, dur: 12 * 6 };
    sfx('gust');
  }
  else if (e === 'crab' && !s.crab.run && !s.crab.hide) s.crab.hide = 12 * 6;
}

/** A fish jumps out of the sea at (x, y), after a delay of `wait` frames. */
function jump(s, x, y, wait = 0) {
  s.fish.push({ x, y, dir: Math.random() < 0.5 ? 1 : -1, f: wait });
}

/** The crab scuttles off in dir, claws up, then digs in for a while. */
function scare(s, dir) {
  const c = s.crab;
  if (c.hide) return;
  c.dir = dir;
  c.run = 12 * 2;
  c.pause = 0;
}

function splash(s, x, y, n = 6) {
  for (let i = 0; i < n; i++) s.drops.push({ x, y, vx: (Math.random() - 0.5) * 1.6, vy: -0.8 - Math.random() * 1.4, life: 8 + Math.floor(Math.random() * 6) });
  s.rings.push({ x, y, life: 14 });
}

/** A dolphin heading in dir, its head at (x, y) and travelling at angle a; nothing below the waterline wy is drawn. */
function drawDolphin(x, y, a, dir, wy) {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const nx = dir > 0 ? -sa : sa; // towards the belly
  const ny = dir > 0 ? ca : -ca;
  const dot = (k, side, c) => {
    const X = Math.round(x - ca * k + nx * side);
    const Y = Math.round(y - sa * k + ny * side);
    if (Y < wy) px(X, Y, 1, 1, c);
  };
  for (let k = 0; k < 18; k++) {
    dot(k, 0, '#4a3a6e');
    if (k > 1 && k < 15) dot(k, 1, '#8a74a8');
    if (k > 4 && k < 12) dot(k, 2, '#c4aac8'); // the pale belly
    if (k > 1 && k < 16) dot(k, -1, '#2e1f4c');
    if (k > 3 && k < 13) dot(k, -2, k > 5 && k < 10 ? '#f0a07a' : '#2e1f4c'); // the back, catching the sunset
  }
  dot(7, -3, '#2e1f4c'); // the dorsal fin
  dot(8, -3, '#2e1f4c');
  dot(9, -3, '#2e1f4c');
  dot(9, -4, '#2e1f4c');
  dot(10, -5, '#2e1f4c');
  for (const side of [-3, -2, -1, 1, 2, 3]) dot(18, side, '#2e1f4c'); // the flukes
  dot(19, -3, '#2e1f4c');
  dot(19, 3, '#2e1f4c');
  dot(0, 0, '#2e1f4c');
  dot(-1, 0, '#2e1f4c'); // the beak
}

/** A gull in flight at (x, y), wings in one of four beats. */
function drawGullFlying(x, y, beat) {
  const X = Math.round(x);
  const Y = Math.round(y);
  px(X - 3, Y, 7, 2, '#f4efe8');
  px(X - 5, Y - 1, 3, 2, '#f4efe8');
  px(X - 6, Y, 1, 1, '#f2b23e');
  px(X - 4, Y - 1, 1, 1, '#2a1a2a');
  const lift = [-0.7, -0.2, 0.35, -0.2][beat];
  for (let k = 1; k <= 7; k++) {
    const dy = Math.round(k * lift);
    const c = k > 5 ? '#2a1a2a' : '#d8d4de';
    px(X - 1 - Math.round(k * 0.4), Y + dy, 2, 1, c);
    px(X + 1 + Math.round(k * 0.4), Y + dy, 2, 1, c);
  }
}

const starfish = sprite(['...o...', '...o...', 'ooooooo', '.ooooo.', '..ooo..', '.oo.oo.', '.o...o.'], { o: '#f08a5a' });

const onCrab = (s, x, y) => !s.crab.hide && x >= s.crab.x - 2 && x < s.crab.x + 13 && y >= s.crabY - 3 && y < s.crabY + 9;
const onGull = (s, x, y) => s.gull?.phase === 'sit' && x >= s.perch.x - 2 && x < s.perch.x + 11 && y >= s.perch.y - 2 && y < s.perch.y + 8;

const seaside = {
  id: 'sea',
  name: 'ทะเลยามเย็น',
  en: 'Seaside sunset',
  accent: '#ff9e6b',
  sky: { native: 'clear', kinds: ['clear', 'rain', 'storm', 'fog'] },
  init() {
    const r = rng(11);
    const T = TIMES[tod] || TIMES.dusk;
    const narrow = W < 420;
    const horizon = Math.round(H * 0.5);
    const shore = Math.round(H * 0.7);
    const sand = H - shore;
    // the sun (or by night the moon): where it hangs, and the light path it lays on the sea
    const orb = T.sun || T.moon;
    const sunX = Math.round(W * orb.x);
    const sunR = Math.round(H * orb.size);
    const sunY = orb.y ? Math.round(H * orb.y) : horizon - Math.round(sunR * orb.rise);
    const ux = Math.round(W * (narrow ? 0.5 : 0.52)); // umbrella pole
    const uy = shore + Math.round(sand * 0.42); // where the props stand
    const headW = Math.round(W * 0.22);
    const headH = (k) => Math.max(0, Math.round(Math.pow(k / headW, 0.7) * 20 + Math.sin(k / 5) * 1.5 + Math.sin(k / 13) * 2));
    const lightK = headW - Math.round(headW * 0.42);
    const lightX = W - headW + lightK;
    const lightTop = horizon - headH(lightK) - 26;
    const castle = { x: Math.round(W * 0.67), y: shore + Math.round(sand * 0.3) };
    const shade = 'rgba(110, 60, 50, 0.24)';

    const bg = layer(() => {
      bands(0, 0, W, horizon, T.sky);
      if (T.sun) {
        const S = T.sun;
        ctxRef.drawImage(makeGlow(sunX, sunY, sunR * 3.4, sunR * 2.6, S.glow, 4), 0, 0);
        shadeEllipse(sunX, sunY, sunR, sunR, (nx, ny, x, y) => {
          if (y >= horizon) return null; // dawn: still coming up out of the sea
          const v = (ny + 1) / 2;
          if (v < 0.4) return dith(x, y, v / 0.4) ? S.c[1] : S.c[0];
          return dith(x, y, (v - 0.4) / 0.6) ? S.c[2] : S.c[1];
        });
        if (S.bars) {
          // thin cloud bars across the sun
          px(sunX - sunR - 8, sunY + Math.round(sunR * 0.1), Math.round(sunR * 1.5), 2, S.bars[0]);
          px(sunX - 6, sunY + Math.round(sunR * 0.42), Math.round(sunR * 1.6), 2, S.bars[1]);
        }
      } else {
        // a full moon with a faint halo
        ctxRef.drawImage(makeGlow(sunX, sunY, sunR * 4, sunR * 4, 'rgba(200, 215, 255, 0.07)', 4), 0, 0);
        shadeEllipse(sunX, sunY, sunR, sunR, (nx, ny) => (nx - ny > 0.9 ? '#fffaf0' : nx - ny < -0.8 ? '#c8c4b0' : '#eeead8'));
        disc(sunX - 4, sunY - 2, 3, '#d8d4c0');
        disc(sunX + 3, sunY + 4, 2, '#d8d4c0');
        px(sunX + 5, sunY - 5, 2, 2, '#d8d4c0');
      }

      // far island with palms
      const miniPalm = (x, base, h, c) => {
        for (let k = 0; k < h; k++) px(x + Math.round((k / h) ** 2 * 3), base - k, 1, 1, c);
        const tx = x + 3;
        const ty = base - h;
        for (const d of [-1, 1])
          for (let k = 0; k < 7; k++) {
            px(tx + d * k, ty + Math.round((k * k) / 10), 1, 1, c);
            px(tx + d * k, ty - 2 + Math.round((k * k) / 6), 1, 1, c);
          }
        px(tx, ty - 3, 1, 3, c);
      };
      const ix = Math.round(W * 0.2);
      const iw = Math.max(20, Math.round(W * 0.08));
      for (let k = -iw; k <= iw; k++) {
        const h = Math.round(8 * Math.cos((k / iw) * (Math.PI / 2)));
        px(ix + k, horizon - h, 1, h, T.island[0]);
        if (h > 1) px(ix + k, horizon - h, 1, 1, T.island[1]);
      }
      miniPalm(ix - 12, horizon - 6, 13, T.island[2]);
      miniPalm(ix - 1, horizon - 7, 18, T.island[2]);
      miniPalm(ix + 10, horizon - 5, 11, T.island[2]);

      // headland with a lighthouse
      for (let k = 0; k < headW; k++) {
        const h = headH(k);
        px(W - headW + k, horizon - h, 1, h, T.head[0]);
        px(W - headW + k, horizon - h, 1, 1, T.head[1]);
        if (k % 7 === 3 && h > 6) px(W - headW + k, horizon - h + 3, 2, 2, T.head[2]);
      }
      for (let j = 0; j < 26; j++) {
        const w = 5 + Math.floor(j / 10);
        const x0 = lightX - Math.floor(w / 2);
        px(x0, lightTop + j, w, 1, Math.floor(j / 6) % 2 ? '#b8485a' : '#ecd6d4');
        px(x0 + w - 2, lightTop + j, 2, 1, 'rgba(40, 10, 50, 0.3)');
      }
      px(lightX - 4, lightTop - 1, 8, 1, T.lantern);
      px(lightX - 3, lightTop - 6, 6, 5, T.lantern);
      px(lightX - 4, lightTop - 8, 8, 2, T.lantern);
      px(lightX - 1, lightTop - 11, 2, 3, T.lantern);

      // sea
      bands(0, horizon, W, shore - horizon, T.sea);

      // sand: wet where the waves reach, then dry and rippled
      bands(0, shore - 3, W, sand + 3, ['#ecbf8a', '#e2b07a', '#d6a06a', '#c68f5b', '#b47d4e']);
      px(0, shore - 3, W, 11, '#b98a66');
      for (let x = 0; x < W; x++) for (let k = 0; k < 5; k++) if (dith(x, shore + 8 + k, 1 - k / 5)) px(x, shore + 8 + k, 1, 1, '#b98a66');
      for (let i = 0; i < W * 1.2; i++) {
        const y = shore + 14 + r() * (sand - 14);
        px(r() * W, y, r() < 0.3 ? 2 : 1, 1, r() < 0.5 ? '#f6d9ac' : '#a8743f');
      }
      for (let i = 0; i < W / 12; i++) {
        const x0 = r() * W;
        const y0 = shore + 18 + r() * (sand - 22);
        const len = 8 + r() * 16;
        for (let k = 0; k < len; k++) px(x0 + k, y0 + Math.round(Math.sin((k / len) * Math.PI) * 1.5), 1, 1, '#c08a55');
      }
      for (let i = 0; i < Math.round(W / 36); i++) {
        const sx = Math.round(r() * W);
        const sy = Math.round(shore + 18 + r() * (sand - 24));
        px(sx, sy, 3, 2, '#fbe9d2');
        px(sx + 1, sy - 1, 1, 1, '#fbe9d2');
        px(sx, sy + 1, 3, 1, '#d8b9a0');
      }
      blit(starfish, Math.round(W * 0.6), shore + Math.round(sand * 0.72));
      // footprints from the umbrella down to the water
      for (let k = 0; k < 9; k++) {
        const fx = ux - 34 - k * 9;
        const fy = uy - 2 - Math.round(k * ((uy - shore - 14) / 9));
        px(fx + (k % 2 ? 0 : 3), fy + (k % 2 ? 2 : 0), 3, 2, '#b58250');
      }

    });

    // everything standing on the sand goes in its own layer, drawn over the surf
    const props = layer(() => {
      if (!narrow) {
        // towel with flip-flops
        const tx = ux - 78;
        const ty = uy + 4;
        for (let j = 0; j < 9; j++) for (let s2 = 0; s2 < 9; s2++) px(tx + s2 * 4 + (9 - j), ty + j, 4, 1, s2 % 2 ? '#f7f1e6' : '#f08aa6');
        px(tx + 9, ty + 9, 36, 1, shade);
        px(tx + 50, ty + 5, 5, 2, '#3c7fd0');
        px(tx + 53, ty + 9, 5, 2, '#3c7fd0');
        // surfboard stuck in the sand
        const bx = ux + 78;
        px(bx - 6, uy + 3, 16, 2, shade);
        shadeEllipse(bx, uy - 20, 5, 24, (nx) => (Math.abs(nx) < 0.18 ? '#f2c14e' : nx > 0.4 ? '#2f8f9d' : '#45b6c4'));
        // sandcastle (its flag flutters at run time)
        const S = { a: '#e8bf88', b: '#cf9f66', c: '#a8773f' };
        const { x: sx, y: sy } = castle;
        px(sx - 16, sy, 36, 2, shade);
        px(sx - 14, sy - 8, 28, 8, S.a);
        px(sx + 6, sy - 8, 8, 8, S.b);
        for (let k = -14; k < 14; k += 4) px(sx + k, sy - 10, 2, 2, S.a);
        for (const ox of [-17, 10]) {
          px(sx + ox, sy - 16, 7, 16, S.a);
          px(sx + ox + 5, sy - 16, 2, 16, S.b);
          px(sx + ox - 1, sy - 18, 3, 2, S.a);
          px(sx + ox + 5, sy - 18, 3, 2, S.a);
          px(sx + ox + 2, sy - 12, 2, 3, S.c);
        }
        px(sx - 4, sy - 22, 9, 14, S.a);
        px(sx + 3, sy - 22, 2, 14, S.b);
        px(sx - 5, sy - 24, 3, 2, S.a);
        px(sx - 1, sy - 24, 3, 2, S.a);
        px(sx + 3, sy - 24, 3, 2, S.a);
        px(sx - 2, sy - 6, 4, 6, S.c);
        px(sx, sy - 32, 1, 8, '#6b4431');
      }

      // cooler
      const kx = ux - 32;
      const ky = uy - 9;
      px(kx + 1, ky + 11, 19, 2, shade);
      px(kx, ky, 18, 11, '#3c7fd0');
      px(kx, ky, 18, 4, '#f5efe2');
      px(kx, ky + 4, 18, 1, '#2a5fa3');
      px(kx + 14, ky + 4, 4, 7, '#2f69b3');
      px(kx + 5, ky - 3, 8, 1, '#d8d2c6');
      px(kx + 5, ky - 3, 1, 3, '#d8d2c6');
      px(kx + 12, ky - 3, 1, 3, '#d8d2c6');

      // umbrella: striped dome with a scalloped edge, and its shadow
      shadeEllipse(ux - 12, uy + 3, 32, 5, (nx, ny, x, y) => (dith(x, y, 0.8) ? shade : null));
      px(ux, uy - 54, 2, 56, '#f3ead9');
      px(ux + 1, uy - 54, 1, 56, '#cdbfa8');
      const cr = 34;
      const dome = 18;
      const cty = uy - 64;
      const red = (j, half) => Math.floor(((j / (half + 0.5)) * 0.5 + 0.5) * 6) % 2 === 0;
      for (let k = 0; k < dome; k++) {
        const half = Math.round(cr * Math.sqrt(1 - (1 - (k + 1) / dome) ** 2));
        for (let j = -half; j <= half; j++) {
          const dark = k > dome - 4 || j < -half * 0.55;
          px(ux + j, cty + k, 1, 1, red(j, half) ? (dark ? '#c2423c' : '#ee5f4f') : dark ? '#d9cbb6' : '#f8f0e0');
        }
      }
      for (let j = -cr; j <= cr; j++) if (Math.floor((j + cr) / 3) % 2 === 0) px(ux + j, cty + dome, 1, 2, red(j, cr) ? '#c2423c' : '#d9cbb6');
      px(ux, cty - 3, 2, 3, '#f3ead9');

      // deck chair
      const cx0 = ux + 12;
      px(cx0 - 1, uy + 2, 32, 2, shade);
      stroke(cx0 + 2, uy - 4, cx0 + 8, uy + 2, '#8a5a3a');
      stroke(cx0 + 8, uy - 4, cx0 + 2, uy + 2, '#8a5a3a');
      stroke(cx0 + 16, uy - 6, cx0 + 24, uy + 2, '#8a5a3a');
      stroke(cx0 + 25, uy - 8, cx0 + 18, uy + 2, '#8a5a3a');
      for (let k = 0; k < 22; k++) px(cx0 + k, uy - 6 - Math.round(k * 0.15), 1, 3, Math.floor(k / 3) % 2 ? '#f7f1e6' : '#3fa3b5');
      for (let k = 0; k < 17; k++) px(cx0 + 21 + Math.round(k * 0.45), uy - 10 - k, 3, 1, Math.floor(k / 3) % 2 ? '#f7f1e6' : '#3fa3b5');

      // beach ball
      px(ux + 46, uy + 12, 10, 2, shade);
      shadeEllipse(ux + 50, uy + 7, 5, 5, (nx, ny) => {
        const seg = Math.floor(((Math.atan2(ny + 0.3, nx - 0.2) + Math.PI) / (Math.PI * 2)) * 6) % 6;
        return ['#f8f0e0', '#ee5f4f', '#f8f0e0', '#3fa3b5', '#f8f0e0', '#f2c14e'][seg];
      });
    });

    const cloudPal = T.clouds;
    const stars = makeStars(r, W * 0.16, horizon * 0.5, ['#f7e7ff', '#d9c2ff']); // always made, so the rest of the scene is the same
    return {
      T,
      narrow,
      horizon,
      shore,
      sand,
      sunX,
      sunR,
      bg,
      props,
      castle,
      light: { x: lightX, y: lightTop - 5 },
      stars: T.stars ? stars : [],
      clouds: Array.from({ length: Math.max(4, Math.round(W / 110)) }, () => {
        const w = 40 + Math.floor(r() * 70);
        const h = 8 + Math.floor(r() * 9);
        return { x: r() * W, y: Math.round(H * 0.08 + r() * horizon * 0.52), w, v: 0.03 + r() * 0.07, img: makeCloud(r, w, h, cloudPal) };
      }),
      birds: Array.from({ length: narrow ? 3 : 5 }, (_, i) => ({ x: r() * W, y: H * 0.18 + i * 7 + r() * 16, v: 0.4 + r() * 0.3, p: r() * 4 })),
      waves: Array.from({ length: Math.round(W / 5) }, () => {
        const f = r();
        return {
          x: r() * W,
          y: horizon + 3 + f * (shore - horizon - 18),
          len: Math.round(3 + f * 12),
          v: 0.15 + f * 0.5,
          c: f < 0.3 ? T.waves[0] : f < 0.65 ? T.waves[1] : T.waves[2],
        };
      }),
      boat: { x: W * 0.36 },
      crab: { x: W * 0.56, dir: 1, pause: 0, run: 0, hide: 0 },
      ux,
      perch: { x: ux - 3, y: uy - 67 - gullSit.h }, // the finial on top of the umbrella
      ev: { wait: 12 * 5, last: null },
      dolphins: [],
      fish: [],
      drops: [],
      rings: [],
      gull: null,
      surge: null,
      wet: null,
      reach: Math.round(sand * 0.2),
      breeze: null,
      specks: [],
      crabY: shore + Math.round(sand * 0.84),
      palmX: narrow ? -8 : Math.round(W * 0.03),
      palmH: Math.round(H * 0.6),
      // the sun is behind everything: whatever is far from it, or close to us, falls into dusk
      lightmap: makeLightmap(T.ambient, T.lights(sunX, horizon), { vignette: T.vignette }),
      rays: T.rays && makeRays(sunX, horizon - 2, Math.max(W * 0.55, 220), T.rays, { count: 11, strength: 0.55, maxY: horizon - 1, seed: 2 }),
      haze: makeMist(horizon - 16, horizon - 1, horizon + 8, T.haze, 0.65),
      // dune grass close to the viewer, bottom right
      grass: Array.from({ length: narrow ? 10 : 22 }, () => ({ x: W - 70 + r() * 90, h: 18 + r() * 34, lean: 0.2 + r() * 0.5, p: r() * 6 })),
    };
  },
  update(s) {
    for (const c of s.clouds) {
      c.x += c.v;
      if (c.x > W + 10) c.x = -c.w - 10;
    }
    for (const b of s.birds) {
      b.x += b.v;
      if (b.x > W + 10) {
        b.x = -10;
        b.y = H * 0.14 + Math.random() * s.horizon * 0.4;
      }
    }
    for (const w of s.waves) {
      w.x -= w.v;
      if (w.x < -16) w.x = W + Math.random() * 10;
    }
    s.boat.x += 0.07;
    if (s.boat.x > W + 30) s.boat.x = -30;
    const c = s.crab;
    if (c.hide > 0) c.hide--;
    else if (c.run > 0) {
      c.x += c.dir * 2.2;
      if (c.x < W * 0.42 || c.x > W * 0.74) c.dir *= -1;
      if (--c.run === 0) c.hide = 12 * 4;
    } else if (c.pause > 0) c.pause--;
    else {
      c.x += c.dir * 0.8;
      if (Math.random() < 0.02) c.pause = 20 + Math.random() * 30;
      if (c.x < W * 0.44 || c.x > W * 0.72) c.dir *= -1;
    }

    // dolphins: a run of leaps, splashing in and out
    for (const d of s.dolphins) {
      d.f++;
      d.x += d.dir * 2.2;
      const k = ((d.f % (AIR + UNDER)) + AIR + UNDER) % (AIR + UNDER);
      if (d.f >= 0 && (k === 0 || k === AIR)) {
        if (k === 0 && d.leaps-- <= 0) d.done = true;
        else {
          splash(s, d.x, d.base, k === 0 ? 5 : 8);
          if (k === AIR && d === s.dolphins[0]) sfx('splash'); // one splash sound for the pod
        }
      }
    }
    s.dolphins = s.dolphins.filter((d) => !d.done && d.x > -60 && d.x < W + 60);
    s.fish = s.fish.filter((f) => {
      if (++f.f === 0) {
        splash(s, f.x, f.y, 3);
        sfx('splash');
      }
      if (f.f > 0) f.x += f.dir * 0.9;
      if (f.f === 12) splash(s, f.x, f.y, 4);
      return f.f < 12;
    });
    s.drops = s.drops.filter((p) => {
      p.vy += 0.18;
      p.x += p.vx;
      p.y += p.vy;
      return --p.life > 0;
    });
    s.rings = s.rings.filter((g) => --g.life > 0);

    // the gull glides in, stands about on the umbrella, preens, and goes
    const g = s.gull;
    if (g) {
      g.f++;
      if (g.phase === 'in') {
        const u = Math.min(1, g.f / (12 * 4));
        g.x = g.sx + (s.perch.x + 4 - g.sx) * (1 - (1 - u) ** 2);
        g.y = g.sy + (s.perch.y + 3 - g.sy) * u * u;
        if (u >= 1) {
          Object.assign(g, { phase: 'sit', f: 0, stay: 12 * (12 + Math.random() * 10) });
          sfx('gull');
        }
      } else if (g.phase === 'sit') {
        if (g.f > g.stay) Object.assign(g, { phase: 'out', f: 0 });
      } else {
        g.x -= 1.7;
        g.y -= 0.5 + g.f * 0.015;
        if (g.x < -12 || g.y < -12) s.gull = null;
      }
    }

    // a big wave: it runs up the sand fast, slides back slowly, and leaves the sand wet
    if (s.surge) {
      const sg = s.surge;
      const up = sg.dur * 0.3;
      sg.a = sg.f < up ? Math.sin((Math.PI / 2) * (sg.f / up)) : Math.cos((Math.PI / 2) * ((sg.f - up) / (sg.dur - up)));
      if (sg.f === Math.round(up)) s.wet = { a: 1 };
      if (++sg.f > sg.dur) s.surge = null;
    }
    if (s.wet && (s.wet.a -= 0.003) <= 0) s.wet = null;

    // a gust off the sea: everything leans, sand blows along the beach
    if (s.breeze) {
      const b = s.breeze;
      b.s = Math.sin(Math.PI * (b.f / b.dur));
      if (Math.random() < b.s * 0.8) s.specks.push({ x: -4, y: s.shore + 12 + Math.random() * (s.sand - 14), v: 3 + Math.random() * 3 });
      if (++b.f > b.dur) s.breeze = null;
    }
    s.specks = s.specks.filter((p) => (p.x += p.v) < W + 4);

    if (--s.ev.wait <= 0) {
      const pick = EVENTS.filter((e) => e !== s.ev.last);
      const e = pick[Math.floor(Math.random() * pick.length)];
      start(s, e);
      s.ev.last = e;
      s.ev.wait = 12 * (20 + Math.random() * 40);
    }
  },
  // levels for the ambience: a big wave is heard as it runs up the sand
  sound: (s) => ({ surge: s.surge ? 1 : 0 }),
  hot(s, x, y) {
    return onCrab(s, x, y) || onGull(s, x, y);
  },
  poke(s, x, y) {
    if (onCrab(s, x, y)) {
      scare(s, x < s.crab.x + 5 ? 1 : -1);
      sfx('boing');
    } else if (onGull(s, x, y)) {
      Object.assign(s.gull, { phase: 'out', f: 0 });
      sfx('gull');
      sfx('wings');
    }
    else if (y > s.horizon + 3 && y < s.shore - 12) jump(s, x, y); // a hidden one: tap the sea
  },
  draw(s, t) {
    const { horizon, shore, sunX, sunR } = s;
    const { x: vx, y: vy } = look(t);
    ctxRef.drawImage(s.bg, 0, 0);
    for (const c of s.clouds) ctxRef.drawImage(c.img, Math.round(c.x), c.y);

    // sailboat, bobbing, with a broken reflection
    const tick = Math.floor(t / 180);
    const bx = Math.round(s.boat.x);
    const by = horizon + 7 + Math.round(Math.sin(t / 900));
    px(bx, by - 26, 1, 22, '#3a1d3f');
    poly([[bx + 2, by - 25], [bx + 2, by - 6], [bx + 14, by - 6]], '#fff1dc');
    poly([[bx - 1, by - 21], [bx - 1, by - 6], [bx - 9, by - 6]], '#f3cdb0');
    px(bx + 1, by - 28, 4, 2, '#e8574a');
    px(bx - 10, by - 4, 22, 2, '#f1e4d4');
    px(bx - 9, by - 3, 20, 1, '#c8485a');
    px(bx - 8, by - 2, 18, 2, '#5a2a4a');
    for (let k = 0; k < 8; k++) if ((k + tick) % 3) px(bx - 6 + ((k + tick) % 2), by + 1 + k, 12 - k, 1, 'rgba(60, 30, 70, 0.35)');

    // sun glitter: short dashes that widen toward the shore
    const depth = shore - horizon;
    for (let y = horizon + 1; y < shore - 5; y++) {
      const f = (y - horizon) / depth;
      const spread = sunR * (0.9 + f * 2.4);
      const step = Math.floor(t / 260 + y * 0.37);
      ctxRef.fillStyle = f < 0.25 ? s.T.glitter[0] : f < 0.6 ? s.T.glitter[1] : s.T.glitter[2];
      for (let i = 0; i < 2 + Math.floor(f * 3); i++) {
        const a = hash(y * 12.9898 + i * 78.233 + step * 4.1);
        if (a < s.T.glitterSkip) continue;
        const off = (hash(y * 3.17 + i * 9.1 + step) - 0.5) * spread;
        ctxRef.fillRect(Math.round(sunX + off), y, Math.round(2 + f * 7 * a), 1);
      }
    }
    for (const w of s.waves) {
      const x = Math.round(w.x);
      const y = Math.round(w.y);
      px(x, y, w.len, 1, w.c);
      px(x + 1, y + 1, w.len - 1, 1, s.T.waves[3]);
    }
    for (const d of s.dolphins) {
      if (d.f < 0) continue;
      const k = d.f % (AIR + UNDER);
      if (k >= AIR) continue;
      const u = k / AIR;
      const y = d.base - Math.sin(Math.PI * u) * 20;
      const a = Math.atan2(-Math.cos(Math.PI * u) * 20 * (Math.PI / AIR), d.dir * 2.2);
      drawDolphin(d.x, y, a, d.dir, d.base + 1);
    }
    for (const f of s.fish) {
      if (f.f < 0) continue;
      const u = f.f / 12;
      const y = f.y - Math.sin(Math.PI * u) * 7;
      const tilt = Math.round(Math.cos(Math.PI * u));
      px(f.x, y, 1, 1, '#fff4d0');
      px(f.x - f.dir, y + tilt, 1, 1, '#ffd08a');
      px(f.x - 2 * f.dir, y + 2 * tilt, 1, 1, '#c88a6a');
    }
    for (const g of s.rings) {
      const r = Math.round((14 - g.life) * 0.6) + 1;
      const c = `rgba(240, 225, 245, ${(g.life / 14) * 0.6})`;
      px(g.x - r, g.y, 2, 1, c);
      px(g.x + r - 1, g.y, 2, 1, c);
      px(g.x - r + 2, g.y - 1, Math.max(1, r * 2 - 4), 1, c);
    }
    for (const p of s.drops) px(p.x, p.y, 1, 1, '#f4e8f4');
    // a breaker rolling in, then the foam edge washing up the sand
    const F = s.T.foam;
    ctxRef.fillStyle = F[0];
    for (let x = 0; x < W; x++) {
      const v = Math.sin(x / 31 - t / 2100);
      if (v > 0.2) ctxRef.fillRect(x, shore - 11 + Math.round(Math.sin(x / 13 + t / 900)), 1, v > 0.7 ? 2 : 1);
    }
    const fleck = Math.floor(t / 300);
    if (s.wet) px(0, shore + 4, W, s.reach, `rgba(120, 70, 80, ${s.wet.a * 0.2})`);
    const run = s.surge ? Math.round(s.surge.a * s.reach) : 0;
    for (let x = 0; x < W; x++) {
      const e = run + Math.round(shore + 2 + Math.sin(x / 21 + t / 1400) * 1.5 + Math.sin(t / 1100 + x / 140) * 3.5);
      px(x, shore - 3, 1, e - shore + 3, F[1]);
      px(x, e, 1, 2, F[2]);
      if ((x + fleck) % 3 === 0) px(x, e - 2, 1, 1, F[3]);
    }

    ctxRef.drawImage(s.props, 0, 0);
    const b = s.breeze ? s.breeze.s : 0;
    if (!s.narrow) {
      const fl = Math.floor(t / (b > 0.3 ? 80 : 200)) % 2;
      px(s.castle.x + 1, s.castle.y - 32 + fl, 3, 3, '#e8574a');
      px(s.castle.x + 4, s.castle.y - 31 - fl, 2, 2, '#e8574a');
    }
    const cr = s.crab;
    if (cr.hide > 0) {
      // dug in: a mound of sand, and now and then two eyes on stalks
      const cx = Math.round(cr.x);
      px(cx, s.crabY + 7, 11, 1, 'rgba(110, 60, 50, 0.35)');
      px(cx + 1, s.crabY + 5, 9, 2, '#a8743f');
      px(cx + 2, s.crabY + 4, 7, 1, '#ecc08a');
      px(cx + 4, s.crabY + 5, 3, 1, '#7a4a2a'); // the hole it went down
      if (cr.hide < 12 * 4 - 6 && Math.sin(t / 700 + cr.x) > -0.7) {
        px(cx + 4, s.crabY + 2, 1, 3, '#e2553f');
        px(cx + 6, s.crabY + 2, 1, 3, '#e2553f');
        px(cx + 4, s.crabY + 1, 1, 1, '#2a1420');
        px(cx + 6, s.crabY + 1, 1, 1, '#2a1420');
      }
    } else {
      const moving = cr.pause <= 0;
      px(cr.x + 1, s.crabY + 7, 9, 1, 'rgba(110, 60, 50, 0.3)');
      blit(cr.run > 0 ? (Math.floor(t / 80) % 2 ? crabUp : crabFrames[1]) : crabFrames[moving ? Math.floor(t / 160) % 2 : 0], cr.x, s.crabY);
    }
    for (const p of s.specks) px(p.x, p.y, 3, 1, 'rgba(250, 225, 180, 0.55)');
    const g = s.gull;
    if (g) {
      if (g.phase === 'sit') blit(Math.floor(g.f / 12) % 9 === 4 ? gullPreen : gullSit, s.perch.x, s.perch.y);
      else drawGullFlying(g.x, g.y, g.phase === 'in' && g.f > 12 * 3 ? 1 : Math.floor(g.f / 2) % 4);
    }

    // ---- light pass, then what glows or sits against the light
    applyLight(s.lightmap);
    drawStars(s.stars, t);
    if (s.rays) {
      ctxRef.globalAlpha = 0.8 + 0.2 * Math.sin(t / 3000);
      ctxRef.drawImage(s.rays, 0, 0);
      ctxRef.globalAlpha = 1;
    }
    ctxRef.drawImage(s.haze, 0, 0);
    // lighthouse: the beam sweeps across and flashes as it turns our way
    // (it's off by day; at night the beam reaches further)
    const L = s.light;
    const beam = s.T.beam;
    const flash = beam > 0 && Math.sin(t / 1900) > 0.88;
    if (beam > 0) px(L.x - 2, L.y, 4, 3, flash ? '#ffffff' : '#ffe9a0');
    if (flash) px(L.x - 5, L.y - 3, 10, 9, 'rgba(255, 240, 180, 0.28)');
    const reach = Math.round(Math.cos(t / 1900) * 80 * beam);
    ctxRef.fillStyle = beam > 1 ? 'rgba(255, 240, 180, 0.26)' : 'rgba(255, 240, 180, 0.2)';
    for (let k = 4; k < Math.abs(reach); k++) {
      if (!dith(k, 0, 0.75 * (1 - k / (90 * Math.max(1, beam))))) continue;
      const half = 1 + Math.floor(k / 14);
      ctxRef.fillRect(L.x + Math.sign(reach) * k, L.y + 1 - half, 1, half * 2 + 1);
    }

    // birds heading home (none at night)
    ctxRef.fillStyle = s.T.birds;
    for (const b of s.T.birds ? s.birds : []) {
      const f = Math.floor(t / 200 + b.p) % 4;
      const d1 = f === 0 ? -1 : f === 2 ? 1 : 0;
      const d2 = f === 0 ? -2 : f === 2 ? 2 : 0;
      const x = Math.round(b.x);
      const y = Math.round(b.y);
      ctxRef.fillRect(x, y, 2, 1);
      ctxRef.fillRect(x - 2, y + d1, 2, 1);
      ctxRef.fillRect(x + 2, y + d1, 2, 1);
      ctxRef.fillRect(x - 4, y + d2, 2, 1);
      ctxRef.fillRect(x + 4, y + d2, 2, 1);
    }

    // ---- foreground, close to the viewer: it slides against the view and sways
    ctxRef.save();
    ctxRef.translate(-Math.round(vx * 7), -Math.round(vy * 3));
    // palm: a ringed trunk leaning in from the left, fronds swaying in the breeze
    const th = s.palmH;
    const P = s.T.palm;
    for (let k = -4; k < th; k++) {
      const f = Math.max(0, k / th);
      const x = s.palmX + Math.round(f * f * 34);
      const w = 7 - Math.round(f * 3);
      px(x, H - k, w, 1, k % 6 === 0 ? P[0] : P[1]);
      px(x + w - 2, H - k, 2, 1, k % 6 === 0 ? P[2] : P[3]);
    }
    const topX = s.palmX + 36;
    const topY = H - th;
    const sway = Math.sin(t / 900) * (3 + 7 * b) + b * 4;
    const fronds = [[-2.95, 44], [-2.45, 50], [-1.95, 42], [-1.3, 44], [-0.7, 52], [-0.2, 48], [0.3, 40], [2.75, 36]];
    fronds.forEach(([a, len], i) => {
      for (let k = 0; k < len; k++) {
        const f = k / len;
        const x = Math.round(topX + Math.cos(a) * k + sway * f * (i % 2 ? 1 : 0.6));
        const y = Math.round(topY + Math.sin(a) * k + k * k * 0.011);
        px(x, y, 2, 2, P[4]);
        if (k % 2 === 0) px(x, y + 1, 1, Math.round(2 + Math.sin(f * Math.PI) * 9), k % 4 ? P[4] : P[5]);
      }
    });
    disc(topX - 2, topY + 3, 2, P[6]);
    disc(topX + 3, topY + 4, 2, P[7]);
    for (const g of s.grass) {
      const sway = Math.sin(t / 1100 + g.p) * (2 + 4 * b) + b * 5;
      for (let k = -4; k < g.h; k++) {
        const f = Math.max(0, k / g.h);
        px(g.x - f * f * g.h * g.lean + sway * f * f, H - k, f > 0.8 ? 1 : 2, 1, k % 7 ? s.T.grass[0] : s.T.grass[1]);
      }
    }
    ctxRef.restore();
  },
};

export default seaside;
