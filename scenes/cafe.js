import {
  W,
  H,
  ctxRef,
  look,
  rng,
  px,
  disc,
  bands,
  layer,
  shadeEllipse,
  dith,
  hash,
  poly,
  stroke,
  makeCloud,
  makeLightmap,
  applyLight,
  makeShaft,
  makeMotes,
  updateMotes,
  drawMotes,
  pixelText,
  makeSign,
  glowSprite,
  SHIRT,
  makePeep,
  drawPeep,
  tod,
  sfx,
  lightLayer,
} from './kit.js';
import { hdCat, catMind, stepCat, stirCat, petCat, onCat, drawCatHearts } from './animals.js';

// Little things that happen now and then (one every 20 to 60 seconds, never the same twice running):
// a cloud dims the sun, the pigeons take off, a tuk-tuk goes by, a breeze shakes leaves down,
// the listener stretches, the barista looks up and waves, the cat wakes on the sill.
const EVENTS = ['cloud', 'pigeons', 'tuktuk', 'breeze', 'stretch', 'wave', 'cat', 'cloud', 'tuktuk', 'cat'];

// ------------------------------------------------------------------ scene: morning café
//
// The one daytime scene. We sit inside a small café looking out of its big front window at a
// quiet street in early sun. Low sun from the upper left pours through the panes and lays
// bright patches, cut by the window bars, across the floor, with dust turning in the beams.

// The same café at four times of day. Day is the original morning. At dawn the light is cooler
// and pinker and the sun patches faint. At dusk the low sun comes from the other side (upper
// right), orange, and the patches lean the other way. At night the street is dark outside with
// lit windows across the road, the floor has no sun on it, and the lamps light the room.
const TIMES = {
  day: {
    sky: ['#8ec2e6', '#a8d0ea', '#c4dcea', '#e2e2dc', '#f6dcbc'],
    sun: 'left', wash: ['#fff8e6', '#fdeccc'],
    clouds: ['#ffffff', '#f6f4f0', '#e6e8ee', '#d4dae4'],
    ambient: '#c4b2a0', outside: '#ffffff', glass: '#5a5040',
    patchLight: '#ffffff', patch: 'rgba(255, 236, 190, 0.42)', table: 'rgba(255, 236, 190, 0.35)',
    shaft: 'rgba(255, 238, 200, 0.10)', mote: [255, 246, 220],
    lamp: '#6a5034', lampR: 90, counter: null,
    sparkle: true, winLit: 0, stars: false,
  },
  dawn: {
    sky: ['#7e92c6', '#a2a8cc', '#c8b4c6', '#e8bcb0', '#f6cca8'],
    sun: 'left', wash: ['#fff0e6', '#f8d6cc'],
    clouds: ['#f8eef0', '#eedcdc', '#d8ccd6', '#c0b8cc'],
    ambient: '#a89aa0', outside: '#e0d4dc', glass: '#4a4048',
    patchLight: '#c8b4b4', patch: 'rgba(255, 214, 200, 0.26)', table: 'rgba(255, 214, 200, 0.22)',
    shaft: 'rgba(255, 222, 214, 0.07)', mote: [255, 232, 225],
    lamp: '#7a5838', lampR: 100, counter: null,
    sparkle: false, winLit: 0.15, stars: false,
  },
  dusk: {
    sky: ['#56609e', '#8c6c9a', '#cc7a7a', '#ee9a62', '#f8c272'],
    sun: 'right', wash: ['#fff0c0', '#fac888'],
    clouds: ['#ffd0a8', '#f2a888', '#c88088', '#8a6a8a'],
    ambient: '#7a5a52', outside: '#f0b08a', glass: '#6a3a28',
    patchLight: '#ff9a50', patch: 'rgba(255, 140, 70, 0.42)', table: 'rgba(255, 140, 70, 0.36)',
    shaft: 'rgba(255, 160, 90, 0.14)', mote: [255, 200, 150],
    lamp: '#b07a40', lampR: 120, counter: '#6a4628',
    sparkle: false, winLit: 0.45, stars: false,
    tint: '#e89a78', // the street goes gold and rosy in the last of the sun
    streetLamp: true,
    vignette: 0.3,
    nearLight: '#d8b8a0', // our table, nearest of all, catches less of the low sun
  },
  night: {
    sky: ['#0a0e2a', '#10163a', '#182048', '#202a54', '#2a325c'],
    sun: null,
    clouds: ['#3a4064', '#343a5a', '#2e3452', '#282e4a'],
    ambient: '#30243a', outside: '#000000', glass: '#10122a',
    lamp: '#c07a3e', lampR: 125, counter: '#62421e',
    vignette: 0.45,
    nearLight: '#8a6a5c', // our table sits in the lamplight's edge
    sparkle: false, winLit: 0.55, stars: true,
    tint: '#2a3060', // the street across the road sinks into the night (only what's outside the glass)
    streetLamp: true,
  },
};

/** A light map of one flat colour, to dim a whole layer at once. */
function flat(color) {
  const g = document.createElement('canvas');
  g.width = W;
  g.height = H;
  const c = g.getContext('2d');
  c.fillStyle = color;
  c.fillRect(0, 0, W, H);
  return g;
}

// Inside the café the scale is about 100 px to a metre (the sill is ~90 px off the floor), so the
// people in here are drawn large, from the waist up: whatever is below is behind furniture.

/** Someone on the window bench seen from behind, headphones on, looking out at the street. */
function drawListener(p, x, seatY, t, stretch = 0) {
  const nod = Math.floor(t / 430) % 2; // nodding along, one pixel
  const top = seatY - 46;
  // sweater: rounded shoulders, backlit by the window in front of them, so the edges glow
  for (let k = 0; k < 46; k++) {
    const half = k < 7 ? Math.round(13 + Math.sqrt(k * 9)) : Math.round(21 - (k - 7) * 0.08);
    for (let i = -half; i <= half; i++) {
      const edge = half - Math.abs(i);
      const c = edge < 2 ? p.rim : i < -half * 0.45 ? p.shirtHi : i > half * 0.5 ? p.shirtLo : dith(x + i, top + k, 0.25) ? p.shirtHi : p.shirt;
      px(x + i, top + k, 1, 1, c);
    }
    if (k > 10 && k % 6 === 0) px(x - half + 4, top + k, half * 2 - 8, 1, p.shirtLo); // knit rows
  }
  // neck, then the back of the head
  const hy = top - 12 + nod;
  if (stretch > 0.1) {
    // a big stretch: both arms up past the head, hands meeting above it
    const reach = Math.round(stretch * 30);
    for (const side of [-1, 1]) {
      const hx = x + side * Math.round(14 - stretch * 6);
      const hand = top - 6 - reach;
      stroke(x + side * 17, top + 6, hx, hand + 4, p.shirtLo, 6);
      stroke(x + side * 19, top + 6, hx + side * 2, hand + 4, p.rim, 1);
      px(hx - 2, hand, 5, 5, p.skinLo);
    }
  }
  px(x - 4, top - 4, 8, 6, p.skinLo);
  shadeEllipse(x, hy, 11, 13, (nx, ny) => (nx * nx + ny * ny > 0.8 && ny < 0.4 ? p.rim : nx < -0.3 && ny < 0 ? p.hairHi : p.hair));
  if (p.bun) shadeEllipse(x + 1, hy - 13, 5, 4, (nx, ny) => (ny < -0.3 ? p.rim : p.hair));
  else px(x - 7, hy + 10, 14, 4, p.hair); // hair down to the collar
  px(x - 12, hy + 1, 2, 5, p.skinLo); // ears
  px(x + 10, hy + 1, 2, 5, p.skinLo);
  // headphones: a band over the top, cups over the ears
  for (let a = 0; a <= 20; a++) {
    const ang = Math.PI + (a / 20) * Math.PI;
    px(x + Math.round(Math.cos(ang) * 12) - 1, hy - 1 + Math.round(Math.sin(ang) * 14), 2, 2, '#2a2630');
  }
  shadeEllipse(x - 12, hy + 3, 3.5, 5, (nx) => (nx < 0 ? '#4a4650' : '#2a2630'));
  shadeEllipse(x + 12, hy + 3, 3.5, 5, (nx) => (nx < 0 ? '#4a4650' : '#2a2630'));
  px(x - 13, hy + 1, 1, 3, '#7ed6b0');
}

/** The barista behind the counter, facing us, eyes down on the work; the counter hides the rest. */
function drawBarista(p, x, counterTop, t, wave = false) {
  const busy = Math.floor(t / 600) % 4; // hands moving at the counter
  const sh = counterTop - 44; // shoulders
  for (let k = 0; k < 48; k++) {
    const half = k < 6 ? Math.round(12 + Math.sqrt(k * 10)) : 19;
    px(x - half, sh + k, half * 2 + 1, 1, k < 1 ? '#ffffff' : '#f2ede4');
    px(x + half - 3, sh + k, 3, 1, '#d8d0c4');
  }
  // apron: a bib with straps over the shoulders
  px(x - 9, sh + 12, 19, 36, p.apron);
  px(x - 9, sh + 12, 19, 1, '#4a6a56');
  stroke(x - 8, sh + 12, x - 12, sh, p.apron, 2);
  stroke(x + 8, sh + 12, x + 12, sh, p.apron, 2);
  px(x - 3, sh + 20, 6, 4, '#4a6a56'); // pocket
  // arms down to the counter, hands busy
  px(x - 21, sh + 6, 5, 32, '#e8e2d8');
  px(x + 17, sh + 6, 5, 32, '#e8e2d8');
  px(x - 23 + (busy % 2), counterTop - 9 - (busy > 1 ? 2 : 0), 6, 4, p.skin);
  if (!wave) px(x + 17 - (busy % 2), counterTop - 8, 6, 4, p.skin);
  // neck, head, hair and a cap
  const hy = sh - 13;
  px(x - 3, sh - 4, 7, 5, p.skinLo);
  shadeEllipse(x, hy, 10, 12, (nx) => (nx > 0.55 ? p.skinLo : p.skin));
  shadeEllipse(x, hy - 6, 11, 7, (nx, ny) => (ny < 0.3 ? p.hair : null));
  px(x - 11, hy - 4, 3, 10, p.hair);
  px(x + 9, hy - 4, 3, 10, p.hair);
  px(x - 11, hy - 11, 22, 4, p.apron);
  px(x - 13, hy - 8, 10, 2, p.apron); // cap brim, tipped to one side
  if (wave) {
    // looks up and waves to us across the room
    const wob = Math.floor(t / 160) % 2 ? 2 : 0;
    // sleeve rolled to the elbow, then a bare forearm up to an open hand, outlined so it reads against the wall
    const ex = x + 25;
    const ey = hy + 8;
    stroke(x + 18, sh + 4, ex, ey, '#b8b0a4', 6);
    stroke(x + 18, sh + 4, ex, ey, '#f2ede4', 4);
    stroke(ex, ey, ex + 1 + wob, hy - 6, '#8a5a40', 5);
    stroke(ex, ey, ex + 1 + wob, hy - 6, p.skin, 3);
    px(ex - 2 + wob, hy - 14, 7, 8, '#8a5a40');
    px(ex - 1 + wob, hy - 13, 5, 6, p.skin);
    for (let f = 0; f < 3; f++) px(ex - 1 + wob + f * 2, hy - 16, 1, 3, p.skin); // fingers
    px(ex + 4 + wob, hy - 11, 2, 1, p.skin); // thumb
    px(x - 6, hy + 1, 2, 2, '#2a1a14');
    px(x + 4, hy + 1, 2, 2, '#2a1a14');
    px(x - 3, hy + 6, 6, 2, '#a85a4a');
    px(x - 7, hy + 4, 2, 1, '#e8a090');
    px(x + 5, hy + 4, 2, 1, '#e8a090');
    return;
  }
  // eyes on the cup, a small smile
  px(x - 6, hy + 2, 3, 1, '#2a1a14');
  px(x + 3, hy + 2, 3, 1, '#2a1a14');
  px(x - 7, hy + 4, 2, 1, '#e8a090');
  px(x + 5, hy + 4, 2, 1, '#e8a090');
  px(x - 2, hy + 7, 4, 1, '#a85a4a');
}

/** A bicycle with its rider, wheels at y, front toward `dir`. */
function drawBike(b, x, y, t) {
  x = Math.round(x);
  const dir = b.dir;
  const wheel = (cx) => {
    for (let a = 0; a < 24; a++) px(cx + Math.cos((a / 24) * Math.PI * 2) * 5, y - 5 + Math.sin((a / 24) * Math.PI * 2) * 5, 1, 1, '#2a2630');
    const s = t / 120;
    px(cx + Math.round(Math.cos(s) * 3), y - 5 + Math.round(Math.sin(s) * 3), 1, 1, '#8a8690');
  };
  const back = x;
  const fr = x + 16 * dir;
  wheel(back);
  wheel(fr);
  const seat = [x + 5 * dir, y - 13];
  const crank = [x + 7 * dir, y - 5];
  stroke(back, y - 5, crank[0], crank[1], b.frame);
  stroke(crank[0], crank[1], seat[0], seat[1], b.frame);
  stroke(seat[0], seat[1] + 2, fr - 2 * dir, y - 13, b.frame);
  stroke(fr - 2 * dir, y - 15, fr, y - 5, b.frame);
  px(fr - 3 * dir - (dir < 0 ? 2 : 0), y - 16, 3, 1, '#2a2630');
  px(seat[0] - 1, seat[1] - 1, 4, 1, '#2a2630');
  if (b.basket) px(fr - (dir > 0 ? 0 : 5), y - 17, 6, 4, '#c8a060');
  // the rider: legs turning the pedals, body leaning to the bars
  const a = t / 200;
  for (const ph of [0, Math.PI]) {
    const fx = crank[0] + Math.round(Math.cos(a + ph) * 3);
    const fy = crank[1] + Math.round(Math.sin(a + ph) * 3);
    stroke(seat[0], seat[1] - 1, Math.round((seat[0] + fx) / 2 + 2 * dir), Math.round((seat[1] + fy) / 2), b.p.pants);
    stroke(Math.round((seat[0] + fx) / 2 + 2 * dir), Math.round((seat[1] + fy) / 2), fx, fy, b.p.pants);
  }
  const sx = seat[0] + 1 * dir;
  for (let k = 0; k < 11; k++) px(sx + Math.round((k / 11) * 4 * dir) - 2, seat[1] - 2 - k, 5, 1, b.p.shirt);
  px(sx + 5 * dir - 2, seat[1] - 7, 4, 2, b.p.skin); // arm to the bars
  const hx = sx + 4 * dir - 3;
  const hy = seat[1] - 19;
  px(hx, hy, 6, 6, b.p.skin);
  px(hx, hy, 6, 2, b.p.hair);
  px(dir > 0 ? hx : hx + 4, hy, 2, 4, b.p.hair);
}

/** A tuk-tuk, wheels at y, nose toward `dir`: blue body, a canopy with a fringe, a driver up front. */
function drawTuk(k, x, y, t) {
  const dir = k.dir;
  const X = Math.round(x);
  // dx is measured from the back, toward the nose, so one drawing works both ways
  const P = (dx, dy, w, h, c) => px(dir > 0 ? X + dx : X - dx - w + 1, y + dy, w, h, c);
  P(0, -9, 24, 5, '#2f7fc0'); // body
  P(0, -9, 24, 1, '#5aa0e0');
  P(17, -14, 7, 6, '#2f7fc0'); // the nose and windscreen frame
  P(19, -13, 4, 3, 'rgba(200, 230, 255, 0.7)');
  P(-1, -22, 22, 3, '#24324a'); // canopy
  P(-1, -19, 22, 1, Math.floor(t / 200) % 2 ? '#f0c040' : '#e0a030'); // fringe, swinging
  P(0, -19, 1, 10, '#1a2030'); // posts
  P(15, -19, 1, 6, '#1a2030');
  P(1, -18, 13, 9, 'rgba(20, 24, 40, 0.55)'); // the shaded back seat
  P(5, -16, 4, 4, k.p.skin); // a passenger
  P(5, -16, 4, 1, k.p.hair);
  P(5, -12, 5, 3, k.p.shirt);
  P(15, -17, 3, 3, '#c88e66'); // the driver
  P(15, -17, 3, 1, '#2a1e18');
  for (const wx of [3, 20]) {
    P(wx - 2, -4, 5, 4, '#1a1820');
    P(wx, -3, 1, 1, Math.floor(t / 90) % 2 ? '#8a8690' : '#5a5660');
  }
  if (Math.floor(t / 120) % 3 === 0) P(-3, -5, 2, 2, 'rgba(200, 200, 210, 0.5)'); // exhaust
}

/** A pigeon on the pavement, pecking now and then; or, when startled, flying. */
function drawPigeon(g, t) {
  if (g.mode !== 'ground') {
    const x = Math.round(g.x);
    const y = Math.round(g.y);
    const flap = Math.floor(t / 70 + g.p) % 2;
    px(x - 2, y - 2, 5, 2, '#8a8e9e');
    px(x + (g.dir > 0 ? 2 : -3), y - 3, 2, 2, '#6a7290');
    if (flap) px(x - 2, y - 5, 4, 3, '#a8acba');
    else px(x - 2, y, 4, 2, '#6a6e7e');
    return;
  }
  const peck = Math.floor(t / 300 + g.p) % 7 === 0;
  const x = Math.round(g.x);
  const y = Math.round(g.y);
  const d = g.dir;
  px(x - 2, y - 3, 5, 3, '#8a8e9e');
  px(x - 2 * d - (d < 0 ? 1 : 0), y - 3, 2, 1, '#6a6e7e');
  px(x + (d > 0 ? 2 : -3), peck ? y - 1 : y - 5, 2, 2, '#6a7290');
  px(x + (d > 0 ? 3 : -3), peck ? y : y - 4, 1, 1, '#2a2630');
  px(x, y, 1, 1, '#d87a6a');
}

function start(s, e) {
  const { win } = s;
  if (e === 'cloud') {
    s.shade.target = 1;
    s.shade.hold = 12 * (6 + Math.random() * 6);
  } else if (e === 'pigeons') scatter(s);
  else if (e === 'tuktuk' && !s.tuk) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    s.tuk = { x: dir > 0 ? s.ox0 - 30 : s.ox1 + 30, dir, p: makePeep(Math.random) };
    sfx('engine', { dur: (s.ox1 - s.ox0 + 70) / 1.5 / 12, pitch: 60, dir });
  } else if (e === 'breeze') {
    sfx('gust', { vol: 0.5, muffled: true }); // heard through the glass
    for (let i = 0; i < 7; i++) {
      const l = s.leaves[Math.floor(Math.random() * s.leaves.length)];
      if (l) s.falling.push({ x: l.x + (Math.random() - 0.5) * l.r, y: l.y, life: -Math.floor(Math.random() * 30), p: Math.random() * 6, c: Math.random() < 0.5 ? '#d8c060' : '#a8d070' });
    }
  } else if (e === 'stretch') s.stretch = 40;
  else if (e === 'wave' && s.baristaX) {
    s.wave = 30;
    sfx('clink');
  }
  else if (e === 'cat') stirCat(s.cat, Math.random() < 0.5 ? 'look' : 'yawn');
  void win;
}

/** Startle the pigeons: they take off one after another, and drift back in a while. */
function scatter(s) {
  if (s.pigeons.some((g) => g.mode === 'ground')) sfx('wings');
  for (const g of s.pigeons) {
    if (g.mode !== 'ground') continue;
    g.mode = 'up';
    g.wait = Math.floor(Math.random() * 8);
    g.vx = g.dir * (0.7 + Math.random() * 0.6);
    g.vy = -(1 + Math.random() * 0.5);
  }
}

function flyPigeon(s, g) {
  const ground = s.nearWalk - 1;
  if (g.mode === 'up') {
    if (g.wait > 0) return void g.wait--;
    g.x += g.vx;
    g.y += g.vy;
    if (g.y < s.win.y - 12) {
      g.mode = 'away';
      g.wait = 12 * (6 + Math.random() * 12);
    }
  } else if (g.mode === 'away') {
    if (--g.wait > 0) return;
    g.mode = 'down';
    g.dir = Math.random() < 0.5 ? 1 : -1;
    g.x = s.win.x + 20 + Math.random() * (s.win.w - 40) - g.dir * 30;
    g.y = s.win.y - 10;
  } else if (g.mode === 'down') {
    g.x += g.dir * 0.5;
    g.y += 0.9;
    if (g.y >= ground) {
      g.y = ground;
      g.mode = 'ground';
      g.x = Math.max(s.win.x + 6, Math.min(s.win.x + s.win.w - 6, g.x));
    }
  }
}

function onBarista(s, x, y) {
  if (!s.baristaX) return false;
  const sh = s.counterTop - 44;
  return Math.abs(x - s.baristaX) < 20 && y > sh - 28 && y < s.counterTop;
}

function onPigeon(s, x, y) {
  return s.pigeons.some((g) => g.mode === 'ground' && Math.abs(x - g.x) < 7 && y > g.y - 9 && y < g.y + 4);
}

const cafe = {
  id: 'cafe',
  name: 'คาเฟ่ยามเช้า',
  en: 'Morning café',
  accent: '#7ed6b0',
  init() {
    const r = rng(97);
    const T = TIMES[tod] || TIMES.day;
    const narrow = W < 420;
    // Inside, things keep their real size in pixels (about 70 px to a metre) and stand on the
    // floor; the window takes whatever height is left above the sill. A short screen crops the
    // top of the window, a tall one shows more wall above it.
    const floorY = H - 56;
    const sill = floorY - 64; // top of the inner sill, about 0.9 m up
    const winTop = Math.max(Math.round(H * 0.06), sill - 210);
    const win = {
      x: narrow ? 10 : Math.round(W * 0.06),
      y: winTop,
      w: narrow ? W - 20 : Math.round(W * 0.5),
      h: sill - winTop,
    };
    const panes = 3;
    const paneW = win.w / panes;
    // the street outside, as seen through the glass
    const skyline = win.y + Math.round(win.h * 0.5); // where the far roofs meet the sky, roughly
    const farWalk = win.y + Math.round(win.h * 0.74); // the far pavement, where people walk
    const road = win.y + Math.round(win.h * 0.84);
    const nearWalk = win.y + Math.round(win.h * 0.97); // the pavement right outside, pigeons
    const ox0 = win.x - 24;
    const ox1 = win.x + win.w + 24;
    const counterX = Math.round(W * 0.6);
    const counterTop = floorY - 66; // about 0.95 m

    // ---- outside: sky
    const sky = layer(() => {
      bands(win.x, win.y, win.w, skyline - win.y + 20, T.sky);
      // the sun is just above the top corner of the window (left in the morning, right at dusk): a wash of light there
      if (T.sun === 'left')
        for (let y = win.y; y < skyline; y++)
          for (let x = win.x; x < win.x + win.w * 0.6; x++) {
            const d = Math.hypot((x - win.x) / (win.w * 0.55), (y - win.y) / (win.h * 0.55));
            if (d < 1 && dith(x, y, (1 - d) * (1 - d) * 0.9)) px(x, y, 1, 1, d < 0.35 ? T.wash[0] : T.wash[1]);
          }
      else if (T.sun === 'right')
        for (let y = win.y; y < skyline + 20; y++)
          for (let x = win.x + win.w * 0.3; x < win.x + win.w; x++) {
            const d = Math.hypot((win.x + win.w - x) / (win.w * 0.6), (y - win.y - win.h * 0.3) / (win.h * 0.45));
            if (d < 1 && dith(x, y, (1 - d) * (1 - d) * 0.9)) px(x, y, 1, 1, d < 0.3 ? T.wash[0] : T.wash[1]);
          }
      if (T.stars)
        for (let i = 0; i < win.w * 0.12; i++) {
          const x = Math.floor(win.x + hash(i * 12.9 + 1) * win.w);
          const y = Math.floor(win.y + hash(i * 7.7 + 3) ** 2 * (skyline - win.y));
          px(x, y, 1, 1, hash(i * 3.3) < 0.3 ? '#ffe6c8' : '#cfd4ff');
        }
    });

    // ---- outside: the row of shophouses across the street, morning sun on their faces
    const FACADES = [
      ['#f2dcc0', '#d8bc9c'],
      ['#c8e0d0', '#a6c4b2'],
      ['#f4c8b8', '#d6a898'],
      ['#f6e4a8', '#d8c488'],
      ['#d4d4ec', '#b4b4cc'],
    ];
    const SHOPS = [
      ['ร้านดอกไม้', '#f2ede2', '#c83a6a', 'flowers'],
      ['เบเกอรี่', '#6a3a2a', '#f6e2c0', 'bread'],
      ['ร้านหนังสือ', '#2a5a4a', '#f6f0e0', 'books'],
      ['ร้านผ้า', '#c8502a', '#ffffff', 'cloth'],
    ];
    const litWins = []; // upper windows lit after dark, drawn over the light pass
    const shopFronts = []; // shop interiors across the road, lit in the light map after dark
    const street = layer(() => {
      let x = ox0;
      let k = 0;
      while (x < ox1) {
        const w = 58 + Math.floor(r() * 30);
        const top = skyline - 20 - Math.floor(r() * 46);
        const [wall, wallS] = FACADES[Math.floor(r() * FACADES.length)];
        px(x, top, w, farWalk - top, wall);
        px(x + w - 3, top, 3, farWalk - top, wallS); // the side away from the sun
        px(x - 1, top - 3, w + 2, 3, wallS);
        // upper floors: shuttered windows, flower boxes
        for (let y = top + 8; y < farWalk - 34; y += 22) {
          for (let i = 0; i < 2; i++) {
            const wx = x + 8 + i * Math.floor((w - 16) / 2);
            const ww = Math.floor((w - 16) / 2) - 8;
            px(wx, y, ww, 12, '#3a4a5a');
            if (hash(wx * 1.31 + y * 0.77) < T.winLit) litWins.push({ x: wx, y: y + 2, w: ww, h: 8 });
            px(wx, y, ww, 2, 'rgba(255, 255, 255, 0.35)'); // sky caught in the glass
            px(wx + 1, y + 3, Math.round(ww / 2) - 1, 1, 'rgba(255, 255, 255, 0.25)');
            px(wx - 3, y, 3, 12, '#5a8a6a');
            px(wx + ww, y, 3, 12, '#5a8a6a');
            if (r() < 0.6) {
              px(wx - 1, y + 12, ww + 2, 3, '#8a5a3a');
              for (let f = 0; f < ww; f += 3) px(wx + f, y + 10, 2, 2, ['#e85a7a', '#f2c14e', '#ffffff', '#c86ad8'][Math.floor(r() * 4)]);
            }
            px(wx, y + 14, ww, 2, 'rgba(60, 40, 40, 0.18)'); // shadow under the sill
          }
        }
        // ground floor: a shop with a striped awning and its sign
        const [text, bg, fg, kind] = SHOPS[k++ % SHOPS.length];
        const awnY = farWalk - 28;
        const stripe = ['#c83a3a', '#2a6ab8', '#3a8a5a', '#d88a2a'][k % 4];
        for (let i = 0; i < w - 4; i++) {
          const c = Math.floor(i / 4) % 2 ? '#f6f0e6' : stripe;
          px(x + 2 + i, awnY, 1, 7, c);
          px(x + 2 + i, awnY + 7, 1, 1 + (Math.floor(i / 4) % 2), c);
        }
        px(x + 2, awnY + 9, w - 4, 6, 'rgba(40, 30, 40, 0.28)'); // the awning's shadow
        const sign = makeSign(text, bg, fg, 7, 2);
        ctxRef.drawImage(sign, Math.round(x + (w - sign.width) / 2), awnY - sign.height - 1);
        px(x + 5, awnY + 9, w - 10, farWalk - awnY - 9, '#4a3a3a');
        px(x + 6, awnY + 10, w - 12, farWalk - awnY - 11, '#7a6656');
        shopFronts.push([x + 6, awnY + 10, w - 12, farWalk - awnY - 11]);
        px(x + 6, awnY + 10, w - 12, 3, 'rgba(40, 30, 40, 0.35)');
        px(x + Math.round(w / 2) - 1, awnY + 10, 2, farWalk - awnY - 10, '#4a3a3a');
        // what's out on the pavement in front of the shop
        if (kind === 'flowers')
          for (let i = 0; i < 4; i++) {
            const bx = x + 6 + i * 9;
            px(bx, farWalk - 7, 7, 7, '#8a8e96');
            for (let f = 0; f < 6; f++) px(bx + (f % 3) * 2, farWalk - 11 - Math.floor(f / 3) * 2, 2, 2, ['#e85a7a', '#f2c14e', '#ffffff', '#f28a4a'][(i + f) % 4]);
          }
        if (kind === 'bread') {
          px(x + 8, farWalk - 14, 12, 14, '#3a2a2a'); // A-board
          px(x + 9, farWalk - 13, 10, 9, '#2a3a32');
          px(x + 10, farWalk - 11, 7, 1, '#f6f0e0');
          px(x + 10, farWalk - 8, 5, 1, '#f6f0e0');
        }
        if (kind === 'books')
          for (let i = 0; i < 8; i++) px(x + 7 + i * 3, farWalk - 9 + (i % 2), 2, 9 - (i % 2), SHIRT[i % SHIRT.length]);
        x += w;
        px(x - 1, top, 1, farWalk - top, 'rgba(0, 0, 0, 0.15)');
      }
      // pavement, kerb, road, the pavement on our side
      px(ox0, farWalk, ox1 - ox0, road - farWalk, '#c8c0b4');
      for (let x2 = ox0; x2 < ox1; x2 += 9) px(x2, farWalk, 1, road - farWalk, '#b0a89c');
      px(ox0, road - 2, ox1 - ox0, 2, '#8a847c');
      px(ox0, road, ox1 - ox0, nearWalk - road - 6, '#6a6a72');
      for (let x2 = ox0; x2 < ox1; x2 += 18) px(x2, road + Math.round((nearWalk - road - 6) / 2), 9, 1, '#f2f0e6');
      px(ox0, nearWalk - 6, ox1 - ox0, 2, '#9a948c');
      px(ox0, nearWalk - 4, ox1 - ox0, win.y + win.h - nearWalk + 4, '#d4ccc0');
    });

    // ---- outside: a street tree close to the café, its crown over the top right of the glass
    const treeX = win.x + Math.round(win.w * (narrow ? 0.8 : 0.84));
    const leaves = [];
    const tree = layer(() => {
      px(treeX - 3, win.y + 30, 7, win.y + win.h - win.y - 30, '#6a5a4a');
      px(treeX - 3, win.y + 30, 2, win.y + win.h - win.y - 30, '#8a7a66');
      px(treeX + 3, win.y + 30, 1, win.y + win.h - win.y - 30, '#4a3e34');
      const blobs = 26;
      for (let i = 0; i < blobs; i++) {
        const bx = treeX - 50 + r() * 90;
        const by = win.y - 14 + r() * 70;
        const rr = 9 + r() * 12;
        shadeEllipse(bx, by, rr, rr * 0.8, (nx, ny, x, y) => {
          const l = -nx * 0.6 - ny * 0.7; // lit from the upper left
          if (l > 0.5) return dith(x, y, 0.6) ? '#a8d870' : '#88c058';
          if (l > -0.1) return dith(x, y, 0.5) ? '#6aa848' : '#5a9440';
          return dith(x, y, 0.5) ? '#3e7434' : '#2e5a2a';
        });
        leaves.push({ x: bx, y: by, r: rr });
      }
    });

    // clouds drifting high up
    const cloudPal = T.clouds;
    const clouds = Array.from({ length: 3 }, () => {
      const w = 40 + Math.floor(r() * 40);
      const h = 9 + Math.floor(r() * 6);
      return { x: win.x + r() * win.w, y: win.y + 6 + r() * 34, w, v: 0.03 + r() * 0.04, img: makeCloud(r, w, h, cloudPal) };
    });

    // ---- inside: wall, window frame, sill, shelves, chalkboard, floor, chairs
    const back = layer(() => {
      // plaster wall, a little warmer near the floor; wood panelling below the window
      bands(0, 0, W, floorY, ['#e8dcc8', '#e4d6c0', '#dccbb2']);
      for (let i = 0; i < W * 0.5; i++) px(r() * W, r() * (floorY - 50), 1, 1, r() < 0.5 ? '#efe5d4' : '#d8c8b0');
      const wain = floorY - 52;
      px(0, wain, W, floorY - wain, '#7a5236');
      px(0, wain, W, 3, '#9a6a48');
      for (let x = 10; x < W; x += 34) {
        px(x, wain + 8, 26, floorY - wain - 14, '#6e4830');
        px(x, wain + 8, 26, 1, '#5a3a26');
        px(x, wain + floorY - wain - 7, 26, 1, '#8a5e40');
      }
      // floor: warm wooden boards, running away from us
      bands(0, floorY, W, H - floorY, ['#a8744a', '#9a6a42', '#8a5e3a']);
      for (let y = floorY + 4, g = 4; y < H; y += g, g += 1) px(0, y, W, 1, '#7a5232');
      for (let i = 0; i < W / 30; i++) {
        const x = r() * W;
        const y = floorY + 2 + r() * (H - floorY);
        px(x, y, 1, 3, '#6a4428');
      }
      px(0, floorY, W, 2, '#5a3a24');
      ctxRef.clearRect(win.x, win.y, win.w, win.h); // the glass: the street shows through here

      // the window frame: dark green painted wood, a transom with the café's name
      const F = { base: '#2f4a3a', hi: '#4a6a56', lo: '#1e3226' };
      const bar = (x, y, w, h) => {
        px(x, y, w, h, F.base);
        px(x, y, w, 1, F.hi);
        px(x, y, 1, h, F.hi);
        px(x, y + h - 1, w, 1, F.lo);
        px(x + w - 1, y, 1, h, F.lo);
      };
      bar(win.x - 8, win.y - 8, win.w + 16, 8);
      bar(win.x - 8, win.y, 8, win.h);
      bar(win.x + win.w, win.y, 8, win.h);
      for (let i = 1; i < panes; i++) bar(Math.round(win.x + i * paneW) - 2, win.y, 5, win.h);
      bar(win.x, win.y + 22, win.w, 4); // transom bar
      // the inner sill: a deep wooden shelf, with plants and a few books
      px(win.x - 14, sill, win.w + 28, 6, '#a8744a');
      px(win.x - 14, sill, win.w + 28, 1, '#c8946a');
      px(win.x - 14, sill + 6, win.w + 28, 3, '#6a4428');
      if (!narrow) {
        const pot = (x, c) => {
          px(x, sill - 8, 10, 8, c);
          px(x, sill - 8, 10, 2, 'rgba(255, 255, 255, 0.25)');
        };
        pot(win.x + 8, '#c8784a');
        for (const [lx, ly, h] of [[2, -14, 6], [5, -18, 10], [8, -13, 5]]) {
          px(win.x + 8 + lx, sill - 8 + ly + 8 - h, 2, h, '#5a9a5a');
          px(win.x + 8 + lx, sill - 8 + ly + 8 - h, 1, h, '#7ac07a');
        }
        pot(win.x + win.w - 22, '#e8e2d6');
        for (let i = 0; i < 7; i++) shadeEllipse(win.x + win.w - 17 + (i % 3) * 3 - 3, sill - 10 - Math.floor(i / 3) * 3, 3, 2, (nx, ny) => (ny < 0 ? '#8ac86a' : '#5a9a4a'));
        for (let i = 0; i < 3; i++) {
          const c = ['#c8584a', '#4a7ab0', '#e8c06a'][i];
          px(win.x + win.w - 52, sill - 4 - i * 4, 22 - i * 2, 4, c);
          px(win.x + win.w - 52, sill - 4 - i * 4, 22 - i * 2, 1, 'rgba(255, 255, 255, 0.3)');
        }
      }
      // the bench seat under the window, and a chair
      px(win.x - 6, floorY - 32, win.w + 12, 6, '#5a7a6a');
      px(win.x - 6, floorY - 32, win.w + 12, 1, '#7a9a8a');
      px(win.x - 6, floorY - 27, win.w + 12, 1, '#3e5a4a');
      px(win.x - 4, floorY - 26, win.w + 8, 26, '#6e4830');
      for (let x = win.x + 4; x < win.x + win.w - 10; x += 30) px(x, floorY - 21, 22, 16, '#5e3e2a');

      if (!narrow) {
        // ---- the counter wall: a chalkboard menu just above the machines, shelves above that
        // (only as many as the screen has room for)
        const sx0 = counterX + 6;
        const sx1 = W - 6;
        const board = { x: sx0 + 6, w: sx1 - sx0 - 12, h: 64 };
        board.y = counterTop - 64 - board.h;
        px(board.x - 4, board.y - 4, board.w + 8, board.h + 8, '#8a5a3a');
        px(board.x - 4, board.y - 4, board.w + 8, 1, '#aa7a54');
        px(board.x, board.y, board.w, board.h, '#26302c');
        for (let i = 0; i < 40; i++) px(board.x + r() * board.w, board.y + r() * board.h, 2, 1, 'rgba(255, 255, 255, 0.05)');
        const chalk = '#ece8dc';
        pixelText(ctxRef, 'เมนูเช้านี้', board.x + board.w / 2, board.y + 9, 9, '#f2c86a', 'center');
        const items = [
          ['ลาเต้', '65'],
          ['อเมริกาโน่', '55'],
          ['ชาเขียวนม', '60'],
          ['ครัวซองต์', '45'],
        ];
        items.forEach(([name, price], i) => {
          const y = board.y + 22 + i * 11;
          pixelText(ctxRef, name, board.x + 8, y, 8, chalk);
          pixelText(ctxRef, price, board.x + board.w - 20, y, 8, chalk);
          for (let x = board.x + 60; x < board.x + board.w - 24; x += 3) px(x, y + 2, 1, 1, 'rgba(236, 232, 220, 0.35)');
        });
        // a little chalk cup with steam
        px(board.x + board.w - 22, board.y + 6, 7, 6, chalk);
        px(board.x + board.w - 15, board.y + 7, 2, 3, chalk);
        // shelves
        const shelves = [[board.y - 10, 'jars'], [board.y - 40, 'cups']].filter(([sy]) => sy > 16);
        for (const [sy, kind] of shelves) {
          px(sx0, sy, sx1 - sx0, 3, '#8a5a3a');
          px(sx0, sy, sx1 - sx0, 1, '#aa7a54');
          px(sx0 + 6, sy + 3, 2, 6, '#6a4428');
          px(sx1 - 8, sy + 3, 2, 6, '#6a4428');
          for (let x = sx0 + 4; x < sx1 - 8; x += kind === 'cups' ? 9 : 13) {
            if (kind === 'cups') {
              const c = ['#f4efe4', '#e8d8c0', '#7ab0a0', '#f4efe4'][Math.floor(r() * 4)];
              px(x, sy - 6, 7, 6, c);
              px(x + 7, sy - 5, 2, 3, c);
              px(x, sy - 6, 7, 1, 'rgba(0, 0, 0, 0.15)');
            } else {
              px(x, sy - 12, 10, 12, 'rgba(220, 235, 240, 0.55)');
              px(x, sy - 13, 10, 2, '#5a4a3a');
              px(x + 1, sy - 9, 8, 8, ['#4a2e1e', '#6a4028', '#3a2416'][Math.floor(r() * 3)]); // beans
              px(x + 1, sy - 11, 1, 10, 'rgba(255, 255, 255, 0.4)');
            }
          }
        }
        // a trailing pothos down the side of the board
        for (let i = 0; i < 3; i++) {
          let vx = sx1 - 4 + i * 2;
          for (let y = board.y - 4; y < board.y + 30 + i * 10; y++) {
            vx += Math.sin(y / 5 + i) * 0.3;
            px(vx, y, 1, 1, '#3e7434');
            if (y % 5 === 0) shadeEllipse(vx + (y % 10 ? 2 : -2), y, 2.5, 2, (nx, ny) => (ny < 0 ? '#7ac060' : '#4a8a3a'));
          }
        }
      }
    });

    // ---- the front plane: the bistro table, and the counter with its machines and pastries
    const tableX = win.x + Math.round(win.w * (narrow ? 0.62 : 0.4));
    const tableY = floorY - 52; // tabletop, about 0.75 m
    const steamSpots = [];
    let pastry = null;
    const front = layer(() => {
      // bistro table: marble top on an iron leg; someone's cup and book, and a café chair
      shadeEllipse(tableX, tableY, 26, 5, (nx, ny, x, y) => (ny < -0.2 ? '#f4f0ea' : dith(x, y, 0.3) ? '#d8d2ca' : '#e6e0d8'));
      px(tableX - 26, tableY + 3, 52, 3, '#a8a29a');
      px(tableX - 2, tableY + 6, 4, floorY - tableY - 8, '#2a2630');
      px(tableX - 12, floorY - 3, 25, 3, '#2a2630');
      px(tableX + 6, tableY - 9, 9, 8, '#f4efe4');
      px(tableX + 6, tableY - 9, 2, 8, '#ffffff');
      px(tableX + 15, tableY - 7, 3, 4, '#f4efe4');
      shadeEllipse(tableX + 10, tableY - 1, 8, 2, () => '#e8e2d6');
      px(tableX - 18, tableY - 4, 18, 3, '#c8584a');
      px(tableX - 18, tableY - 4, 18, 1, '#e87a6a');
      px(tableX - 16, tableY - 7, 14, 3, '#4a7ab0');
      steamSpots.push({ x: tableX + 10, y: tableY - 11 });
      const cx = tableX + 38;
      for (let k = 0; k < 34; k++) px(cx + Math.round(Math.sin((k / 34) * Math.PI) * 3), floorY - 31 - k, 3, 1, '#4a2e1e');
      px(cx - 16, floorY - 31, 22, 3, '#5a3a26');
      px(cx - 15, floorY - 28, 3, 28, '#4a2e1e');
      px(cx + 2, floorY - 28, 3, 28, '#4a2e1e');
      px(cx - 13, floorY - 12, 16, 2, '#4a2e1e');

      if (narrow) return;
      // the counter: marble top, panelled wood front
      const x0 = counterX;
      px(x0, counterTop, W - x0 + 4, floorY - counterTop, '#6a4630');
      for (let x = x0 + 8; x < W; x += 30) {
        px(x, counterTop + 14, 22, floorY - counterTop - 24, '#5e3e2a');
        px(x, counterTop + 14, 22, 1, '#4a2e1e');
        px(x, floorY - 11, 22, 1, '#8a5e40');
      }
      px(x0 - 4, counterTop - 6, W - x0 + 10, 7, '#ece6dc');
      px(x0 - 4, counterTop - 6, W - x0 + 10, 1, '#ffffff');
      px(x0 - 4, counterTop + 1, W - x0 + 10, 2, '#b8b0a4');
      const my = counterTop - 6; // things on the counter stand here
      // espresso machine: chrome body, red band, gauges, two group heads, cups warming on top
      const mx = x0 + 12;
      const mw = 56;
      px(mx, my - 44, mw, 44, '#c8ccd4');
      px(mx, my - 44, mw, 2, '#eef0f4');
      px(mx, my - 44, 4, 44, '#e2e6ee');
      px(mx + mw - 4, my - 44, 4, 44, '#8a909a');
      px(mx + 6, my - 36, mw - 12, 5, '#c83a3a');
      px(mx + 6, my - 36, mw - 12, 1, '#e86a5a');
      for (const gx of [mx + 19, mx + 38]) {
        disc(gx, my - 27, 3, '#f4efe4');
        px(gx, my - 28, 1, 2, '#2a2630');
        px(gx - 5, my - 22, 11, 6, '#5a5e66');
        px(gx - 5, my - 22, 11, 1, '#8a8e96');
        px(gx - 16, my - 17, 13, 3, '#1a1820'); // portafilter handle
        px(gx - 4, my - 11, 9, 9, '#f4efe4'); // cup under the spout
        px(gx - 4, my - 11, 2, 9, '#ffffff');
      }
      px(mx + 4, my - 3, mw - 8, 3, '#3a3e46'); // drip tray
      for (let i = 0; i < 4; i++) px(mx + 5 + i * 12, my - 51, 10, 7, i % 2 ? '#f4efe4' : '#e8d8c0');
      stroke(mx + mw + 2, my - 34, mx + mw + 6, my - 10, '#a8acb4', 2); // steam wand
      steamSpots.push({ x: mx + mw + 6, y: my - 12, wand: true });
      // grinder: a dark body under a hopper of beans
      const gx = mx + mw + 12;
      px(gx, my - 32, 18, 32, '#2a2630');
      px(gx, my - 32, 3, 32, '#4a4650');
      px(gx + 3, my - 52, 12, 20, 'rgba(210, 228, 236, 0.6)');
      px(gx + 4, my - 44, 10, 12, '#4a2e1e');
      for (let i = 0; i < 6; i++) px(gx + 5 + (i % 3) * 3, my - 44 + Math.floor(i / 3) * 4, 2, 1, '#6a4028');
      px(gx + 2, my - 54, 14, 3, '#2a2630');
      px(gx + 6, my - 14, 6, 8, '#1a1820');
      // pastry case: two glass shelves of croissants and cakes (the barista stands behind it)
      const px0 = gx + 22;
      const pw = Math.min(104, W - px0 - 6);
      if (pw > 40) {
        pastry = { x: px0, w: pw };
        px(px0, my - 48, pw, 48, 'rgba(220, 236, 240, 0.4)');
        px(px0, my - 48, pw, 2, '#ffffff');
        px(px0, my - 24, pw, 2, 'rgba(255, 255, 255, 0.7)');
        px(px0, my - 48, 2, 48, '#ffffff');
        px(px0 + pw - 2, my - 48, 2, 48, '#b8c0c4');
        for (let i = 0; i + 18 < pw; i += 20) {
          const cx2 = px0 + 5 + i;
          for (let k = 0; k < 16; k++) {
            const h = Math.round(Math.sin((k / 16) * Math.PI) * 6) + 1;
            px(cx2 + k, my - 26 - h, 1, h, Math.floor(k / 3) % 2 ? '#c8803a' : '#e8a858');
            px(cx2 + k, my - 26 - h, 1, 1, '#f6c878');
          }
          poly([[cx2, my - 2], [cx2 + 15, my - 2], [cx2 + 15, my - 12]], (i / 20) % 2 ? '#f2e2c8' : '#6a3a2a');
          px(cx2, my - 2, 15, 1, '#c8a878');
          px(cx2 + 12, my - 14, 3, 3, '#e8384a');
        }
      }
      const sign = makeSign('ร้านเปิดแล้ว', '#f6f0e0', '#2f4a3a', 8, 4);
      ctxRef.drawImage(sign, x0 + 6, counterTop + 18);
    });

    // ---- light: daylight from the window, sun patches on the floor, the lamp over the table
    // the sun is high to the upper left, so each pane throws a bright patch down and to the right
    const patches = [];
    const shafts = [];
    for (let i = 0; i < panes; i++) {
      const x0 = Math.round(win.x + i * paneW + 4);
      const x1 = Math.round(win.x + (i + 1) * paneW - 4);
      const near = 1.35; // closer to us, the patch is wider
      const c = (x0 + x1) / 2;
      const flip = T.sun === 'right' ? -1 : 1; // at dusk the sun is on the other side
      const s1 = 24 * flip;
      const s2 = 90 * flip;
      const patch = [
        [x0 + s1, floorY + 3],
        [x1 + s1, floorY + 3],
        [c + (x1 - c) * near + s2, H + 2],
        [c + (x0 - c) * near + s2, H + 2],
      ];
      patches.push(patch);
      shafts.push([
        [x0 + 6 * flip, sill + 9],
        [x1 + 6 * flip, sill + 9],
        [c + (x1 - c) * near + s2, H + 2],
        [c + (x0 - c) * near + s2, H + 2],
      ]);
    }
    // a pendant lamp over the marble table, hanging in front of the window
    const lamps = [{ x: tableX, y: Math.max(win.y + 30, tableY - 46) }];
    const lights = [
      { rect: [win.x, win.y, win.w, win.h], color: T.outside },
      { x: win.x + win.w / 2, y: win.y + win.h * 0.7, r: win.w * 0.8, ry: win.h * 1.1, color: T.glass },
      ...(T.sun ? patches.map((p) => ({ poly: p, from: [p[0][0], floorY], to: [p[3][0], H + 20], color: T.patchLight })) : []),
      ...lamps.map((l) => ({ x: l.x, y: l.y + 30, r: T.lampR, ry: Math.round(T.lampR * 0.78), color: T.lamp })),
    ];
    if (T.winLit) {
      // the shops across the road still lit inside, glowing through the glass
      for (const [x, y, w, h] of shopFronts) {
        // only what shows through the glass (the street runs on past the window frame)
        const x0 = Math.max(x, win.x);
        const x1 = Math.min(x + w, win.x + win.w);
        if (x1 > x0) lights.push({ rect: [x0, y, x1 - x0, h], color: '#806040' });
      }
    }
    if (T.counter && !narrow) {
      // lights over the counter come on as the day goes
      const cx = Math.round((counterX + W) / 2);
      lights.push({ x: cx, y: counterTop - 50, r: 170, ry: 90, color: T.counter });
      lights.push({ x: cx, y: counterTop - 6, r: 90, ry: 20, color: T.counter });
    }
    const lightmap = makeLightmap(T.ambient, lights, { vignette: T.vignette ?? 0.22 });
    const sunPatch = layer(() => {
      if (T.sun)
        for (const p of patches)
          poly(p, (x, y) => {
            // bright on the boards, cut by the window bars, softening toward us
            const f = (y - floorY) / (H - floorY);
            return dith(x, y, 0.46 - f * 0.22) ? T.patch : null;
          });
    });

    // ---- foreground: our own table by the window, a latte and a croissant in the sun
    const near = layer(() => {
      if (narrow) return;
      const tx = Math.round(W * 0.84);
      const ty = H - 18;
      px(tx - 90, ty, 200, 30, '#8a5a38');
      px(tx - 90, ty, 200, 2, '#b07a50');
      for (let x = tx - 86; x < W + 10; x += 23) px(x, ty + 4, 14, 1, '#7a4e30');
      // the sun reaches the table too
      if (T.sun) poly([[tx - 70, ty + 2], [tx + 10, ty + 2], [tx + 30, H], [tx - 50, H]], (x, y) => (dith(x, y, 0.4) ? T.table : null));
      // latte on a saucer, a heart in the foam
      const cx = tx - 30;
      const cy = ty - 4;
      shadeEllipse(cx, cy + 4, 16, 4, (nx, ny) => (ny < 0 ? '#f8f4ec' : '#d8d0c4'));
      px(cx - 10, cy - 12, 20, 14, '#f4efe4');
      px(cx - 10, cy - 12, 3, 14, '#ffffff');
      px(cx + 7, cy - 12, 3, 14, '#d8d0c4');
      for (let k = 0; k < 8; k++) px(cx + 10 + Math.round(Math.sin((k / 8) * Math.PI) * 5), cy - 10 + k, 2, 1, '#e8e2d6');
      shadeEllipse(cx, cy - 12, 10, 3, () => '#c08a5a');
      shadeEllipse(cx, cy - 12, 8, 2.2, (nx, ny) => (ny < -0.2 ? '#d8a878' : '#c89868'));
      px(cx - 3, cy - 13, 2, 1, '#f6ecdc');
      px(cx + 1, cy - 13, 2, 1, '#f6ecdc');
      px(cx - 2, cy - 12, 4, 1, '#f6ecdc');
      px(cx - 1, cy - 11, 2, 1, '#f6ecdc');
      // croissant on a small plate
      const kx = tx + 18;
      shadeEllipse(kx, ty - 2, 20, 4, (nx, ny) => (ny < 0 ? '#f8f4ec' : '#d8d0c4'));
      for (let k = 0; k < 26; k++) {
        const f = k / 26;
        const h = Math.round(Math.sin(f * Math.PI) * 9) + 2;
        const seg = Math.floor(k / 4) % 2;
        px(kx - 13 + k, ty - 4 - h, 1, h, seg ? '#c8803a' : '#e8a858');
        px(kx - 13 + k, ty - 4 - h, 1, 1, '#f6c878');
      }
      // a corner of an open book
      poly([[tx + 44, ty - 2], [tx + 90, ty - 6], [tx + 96, ty + 4], [tx + 46, ty + 6]], '#f6f0e4');
      for (let i = 0; i < 4; i++) px(tx + 52, ty - 1 + i * 2, 30, 1, '#b8b0a0');
    });

    const listener = { ...makePeep(r), shirt: '#c8784a', shirtHi: '#e0946a', shirtLo: '#a05a36', rim: '#f6d6a8', skinLo: '#c88e66', hairHi: '#4a3428', bun: r() < 0.5 };
    listener.hair = '#2a1e18';
    const barista = { ...makePeep(r), apron: '#2f4a3a', skinLo: '#c88e66' };
    // the upper windows lit across the road, unless the street tree is in front of them
    const crown = { x0: treeX - 62, x1: treeX + 52, y1: win.y + 70 };
    const lit = litWins.filter((w) => !(w.x + w.w > crown.x0 && w.x < crown.x1 && w.y < crown.y1) && !(w.x < treeX + 6 && w.x + w.w > treeX - 5));
    return {
      T,
      lit,
      fronts: shopFronts,
      narrow,
      win,
      floorY,
      sill,
      farWalk,
      road,
      nearWalk,
      sky,
      street,
      tree,
      leaves,
      clouds,
      back,
      front,
      sunPatch,
      lightmap,
      near: T.nearLight ? lightLayer(near, flat(T.nearLight)) : near,
      lamps,
      lampGlow: glowSprite(14, 'rgba(255, 214, 160, 0.28)'),
      shafts: T.sun ? shafts.map((p) => makeShaft(p, [p[0][0], p[0][1]], [p[3][0], H], T.shaft, 0.35)) : [],
      motes: makeMotes(r, shafts[1], 26),
      steamSpots,
      steam: [],
      listener,
      listenerX: win.x + Math.round(win.w * (narrow ? 0.28 : 0.2)),
      barista,
      baristaX: pastry ? pastry.x + Math.round(pastry.w / 2) : null, // behind the glass of the pastry case
      counterTop,
      catAt: { x: win.x + Math.round(win.w * (narrow ? 0.5 : 0.62)), y: sill - 12 },
      cat: catMind(),
      ev: { wait: 12 * 5, last: null },
      shade: { now: 0, target: 0, hold: 0 }, // a cloud over the sun
      tuk: null,
      falling: [], // leaves coming down off the street tree
      stretch: 0,
      wave: 0,
      walkers: Array.from({ length: narrow ? 2 : 4 }, (_, i) => ({ ...makePeep(r), h: 20 + Math.floor(r() * 4), x: ox0 + r() * (ox1 - ox0), dir: i % 2 ? 1 : -1, v: 0.18 + r() * 0.12 })),
      bike: { x: -999, dir: 1, wait: 60, p: makePeep(r), frame: '#c83a3a', basket: true },
      pigeons: Array.from({ length: narrow ? 2 : 4 }, () => ({ x: win.x + 20 + r() * (win.w - 40), y: nearWalk - 1, dir: r() < 0.5 ? 1 : -1, p: r() * 7, hop: 0, mode: 'ground' })),
      ox0,
      ox1,
      fan: { x: Math.round(W * (narrow ? 0.5 : 0.42)), y: 6, a: 0 },
      wandPuff: 0,
    };
  },
  update(s) {
    for (const c of s.clouds) {
      c.x += c.v;
      if (c.x > s.win.x + s.win.w + 10) c.x = s.win.x - c.w - 10;
    }
    for (const w of s.walkers) {
      w.x += w.v * w.dir;
      if (w.x > s.ox1 + 10) w.x = s.ox0 - 10;
      if (w.x < s.ox0 - 10) w.x = s.ox1 + 10;
    }
    const b = s.bike;
    if (b.x > -999) {
      b.x += 1.1 * b.dir;
      if (b.x > s.ox1 + 30 || b.x < s.ox0 - 30) {
        b.x = -999;
        b.wait = 160 + Math.floor(Math.random() * 300);
      }
    } else if (--b.wait <= 0) {
      b.dir = Math.random() < 0.5 ? 1 : -1;
      b.x = b.dir > 0 ? s.ox0 - 20 : s.ox1 + 20;
    }
    for (const g of s.pigeons) {
      if (g.mode !== 'ground') {
        flyPigeon(s, g);
        continue;
      }
      if (g.hop > 0) {
        g.x += g.dir * 0.8;
        g.hop--;
      } else if (Math.random() < 0.01) {
        g.hop = 6;
        if (Math.random() < 0.3) g.dir *= -1;
      }
      g.x = Math.max(s.win.x + 6, Math.min(s.win.x + s.win.w - 6, g.x));
    }
    s.fan.a += 0.09;
    updateMotes(s.motes);
    for (const sp of s.steamSpots) {
      if (sp.wand) {
        if (s.wandPuff > 0 || Math.random() < 0.004) {
          // the barista steams milk now and then: a burst from the wand
          if (s.wandPuff <= 0) {
            s.wandPuff = 40;
            sfx('steam');
          }
          s.steam.push({ x: sp.x + (Math.random() - 0.5) * 4, y: sp.y, life: 0, max: 30, big: true });
        }
      } else if (Math.random() < 0.15) s.steam.push({ x: sp.x + (Math.random() - 0.5) * 3, y: sp.y, life: 0, max: 26 });
    }
    if (s.wandPuff > 0) s.wandPuff--;
    if (!s.narrow && Math.random() < 0.25) s.steam.push({ x: Math.round(W * 0.84) - 30 + (Math.random() - 0.5) * 10, y: H - 36, life: 0, max: 44, near: true });
    for (const p of s.steam) {
      p.y -= p.big ? 0.9 : 0.5;
      p.x += Math.sin(p.life / 6 + p.x) * 0.3;
      p.life++;
    }
    s.steam = s.steam.filter((p) => p.life < p.max);

    stepCat(s.cat);
    const sh = s.shade;
    if (sh.hold > 0 && --sh.hold === 0) sh.target = 0;
    sh.now += (sh.target - sh.now) * 0.05;
    if (s.tuk) {
      s.tuk.x += 1.5 * s.tuk.dir;
      if (s.tuk.x > s.ox1 + 40 || s.tuk.x < s.ox0 - 40) s.tuk = null;
    }
    for (const l of s.falling) {
      if (l.y < s.nearWalk - 1) {
        l.y += 0.4;
        l.x += Math.sin(l.life / 7 + l.p) * 0.5 - 0.1;
      }
      l.life++;
    }
    s.falling = s.falling.filter((l) => l.life < 12 * 14);
    if (s.stretch > 0) s.stretch--;
    if (s.wave > 0) s.wave--;
    if (--s.ev.wait <= 0) {
      const pick = EVENTS.filter((e) => e !== s.ev.last);
      const e = pick[Math.floor(Math.random() * pick.length)];
      start(s, e);
      s.ev.last = e;
      s.ev.wait = 12 * (20 + Math.random() * 40);
    }
  },
  sound: () => ({}),
  hot(s, x, y) {
    return onCat(s.catAt.x, s.catAt.y, x, y) || onBarista(s, x, y) || onPigeon(s, x, y);
  },
  poke(s, x, y) {
    if (onCat(s.catAt.x, s.catAt.y, x, y)) petCat(s.cat, s.catAt.x, s.catAt.y);
    else if (onBarista(s, x, y)) {
      if (!s.wave) sfx('clink');
      s.wave = 30;
    }
    else if (onPigeon(s, x, y)) scatter(s);
  },
  draw(s, t) {
    const { x: vx, y: vy } = look(t);
    const { win } = s;

    // ---- outside, through the glass: the farther a layer, the more it slides
    ctxRef.save();
    ctxRef.beginPath();
    ctxRef.rect(win.x, win.y, win.w, win.h);
    ctxRef.clip();
    ctxRef.drawImage(s.sky, 0, 0);
    for (const c of s.clouds) ctxRef.drawImage(c.img, Math.round(c.x + vx * 5), c.y);
    ctxRef.save();
    ctxRef.translate(Math.round(vx * 3), Math.round(vy * 1));
    ctxRef.drawImage(s.street, 0, 0);
    for (const w of s.walkers) drawPeep(w, w.x, s.farWalk + 4, w.dir, t, true);
    if (s.bike.x > -999) drawBike(s.bike, s.bike.x, s.road + 8, t);
    if (s.tuk) drawTuk(s.tuk, s.tuk.x, s.road + 8, t);
    ctxRef.restore();
    ctxRef.save();
    ctxRef.translate(Math.round(vx * 1.5), 0);
    for (const g of s.pigeons) drawPigeon(g, t);
    ctxRef.drawImage(s.tree, 0, 0);
    for (const l of s.falling) {
      if (l.life < 0) continue;
      const fade = l.life > 12 * 11 ? 1 - (l.life - 12 * 11) / 36 : 1;
      if (fade <= 0) continue;
      const turn = Math.floor(l.life / 5 + l.p) % 2 && l.y < s.nearWalk - 1;
      ctxRef.globalAlpha = fade;
      px(Math.round(l.x), Math.round(l.y), turn ? 1 : 2, turn ? 2 : 1, l.c);
      ctxRef.globalAlpha = 1;
    }
    // leaves catching the sun as the breeze turns them
    const tick = Math.floor(t / 260);
    if (s.T.sparkle) for (const l of s.leaves) {
      for (let i = 0; i < 3; i++) {
        const a = hash(l.x * 3.1 + i * 7.7 + tick);
        if (a < 0.55) continue;
        const x = Math.round(l.x + (hash(l.y + i + tick * 1.3) - 0.5) * l.r * 1.4);
        const y = Math.round(l.y + (hash(l.x + i * 2 + tick * 0.7) - 0.5) * l.r);
        px(x, y, 2, 1, a > 0.85 ? '#d8f0a0' : '#b8e080');
      }
    }
    ctxRef.restore();
    if (s.T.tint) {
      // night outside: everything beyond the glass goes dark, then the street lamp's pool on the far pavement
      ctxRef.globalCompositeOperation = 'multiply';
      ctxRef.fillStyle = s.T.tint;
      ctxRef.fillRect(win.x, win.y, win.w, win.h);
      ctxRef.globalCompositeOperation = 'source-over';
      ctxRef.save();
      ctxRef.translate(Math.round(vx * 3), Math.round(vy * 1));
      // the shops across the road, still lit inside
      for (const [x, y, w, h] of s.fronts) {
        px(x, y + 3, w, h - 3, 'rgba(255, 196, 120, 0.42)');
        px(x, y + 3, w, 1, 'rgba(255, 226, 170, 0.6)');
      }
      if (s.T.streetLamp) {
        const lx = win.x + Math.round(win.w * 0.36);
        const top = s.farWalk - 46;
        px(lx, top, 2, s.farWalk - top + 2, '#1a1c2a');
        px(lx - 6, top, 8, 2, '#1a1c2a');
        px(lx - 10, top - 1, 10, 7, 'rgba(255, 220, 160, 0.25)');
        px(lx - 7, top + 2, 4, 2, '#fff2c8');
        for (let y = top + 4; y < s.road + 2; y++) {
          const k = (y - top - 4) / (s.road + 2 - top - 4);
          const half = Math.round(4 + k * 26);
          for (let x = -half; x <= half; x++) {
            const d = Math.abs(x) / half;
            const a = y < s.farWalk - 2 ? 0.2 * (1 - d) : 0.7 * (1 - d * d);
            if (dith(lx - 5 + x, y, a)) px(lx - 5 + x, y, 1, 1, y < s.farWalk - 2 ? 'rgba(255, 220, 160, 0.4)' : 'rgba(255, 214, 150, 0.6)');
          }
        }
      }
      ctxRef.restore();
    }
    ctxRef.restore();

    // ---- inside
    ctxRef.drawImage(s.back, 0, 0);
    hdCat(s.catAt.x, s.catAt.y, t, undefined, s.cat.pose);
    drawListener(s.listener, s.listenerX, s.floorY - 32, t, s.stretch > 0 ? Math.sin((s.stretch / 40) * Math.PI) : 0);
    if (s.baristaX) drawBarista(s.barista, s.baristaX, s.counterTop, t, s.wave > 0);
    ctxRef.drawImage(s.front, 0, 0);
    for (const p of s.steam) if (!p.near) px(p.x, p.y, p.big ? 2 : 1, 2, `rgba(255, 255, 255, ${(p.big ? 0.55 : 0.45) * (1 - p.life / p.max)})`);
    // the ceiling fan, turning slowly overhead
    const f = s.fan;
    for (let i = 0; i < 4; i++) {
      const a = f.a + (i * Math.PI) / 2;
      for (let k = 6; k < 46; k++) {
        const x = Math.round(f.x + Math.cos(a) * k);
        const y = Math.round(f.y + 4 + Math.sin(a) * k * 0.18);
        px(x, y, 1, k > 10 ? 3 : 2, k > 10 ? '#6a4630' : '#3a3036');
      }
    }
    px(f.x - 1, 0, 3, f.y, '#3a3036');
    disc(f.x, f.y + 4, 4, '#3a3036');
    px(f.x - 2, f.y + 2, 2, 1, '#8a8090');

    // ---- light pass, then the sun on the floor, the beams and their dust
    applyLight(s.lightmap);
    // a cloud over the sun takes most of the patches and beams away for a while
    const dim = s.shade.now;
    if (dim > 0.01) {
      ctxRef.fillStyle = `rgba(40, 50, 80, ${0.12 * dim})`;
      ctxRef.fillRect(0, 0, W, H);
    }
    ctxRef.globalAlpha = 1 - 0.75 * dim;
    ctxRef.drawImage(s.sunPatch, 0, 0);
    ctxRef.globalAlpha = (0.85 + 0.15 * Math.sin(t / 4000)) * (1 - 0.85 * dim);
    for (const sh of s.shafts) ctxRef.drawImage(sh, 0, 0);
    ctxRef.globalAlpha = 1;
    if (s.T.sun && dim < 0.6) drawMotes(s.motes, t, `rgba(${s.T.mote.join(', ')}, ${0.75 * (1 - dim)})`);
    if (s.lit.length) {
      // lit windows across the road, between the bars of our own window
      ctxRef.save();
      ctxRef.beginPath();
      ctxRef.rect(win.x, win.y, win.w, win.h);
      ctxRef.clip();
      ctxRef.translate(Math.round(vx * 3), Math.round(vy * 1));
      for (const w of s.lit) {
        px(w.x, w.y, w.w, w.h, '#f2c27a');
        px(w.x, w.y + w.h - 2, w.w, 2, '#c8904a');
        px(w.x + 1, w.y + 1, Math.round(w.w / 2) - 1, 1, '#ffe2a8');
      }
      ctxRef.restore();
    }
    for (const l of s.lamps) {
      stroke(l.x, 0, l.x, l.y - 12, 'rgba(42, 38, 48, 0.55)'); // a thin cord: it reads as a hairline against the glass
      poly([[l.x - 4, l.y - 12], [l.x + 4, l.y - 12], [l.x + 13, l.y], [l.x - 13, l.y]], '#2f4a3a');
      poly([[l.x - 4, l.y - 12], [l.x - 1, l.y - 12], [l.x - 8, l.y], [l.x - 13, l.y]], '#4a6a56');
      px(l.x - 13, l.y - 1, 26, 1, '#1e3226');
      ctxRef.drawImage(s.lampGlow, l.x - 14, l.y - 8);
      px(l.x - 4, l.y, 8, 2, '#fff2d0');
    }

    drawCatHearts(s.cat);

    // ---- foreground: our table, nearest of all
    ctxRef.save();
    ctxRef.translate(-Math.round(vx * 7), -Math.round(vy * 3));
    ctxRef.drawImage(s.near, 0, 0);
    for (const p of s.steam) if (p.near) px(p.x, p.y, 2, 2, `rgba(255, 255, 255, ${0.4 * (1 - p.life / p.max)})`);
    ctxRef.restore();
  },
};

export default cafe;
