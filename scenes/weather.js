// Weather shared by every scene: clear, rain, storm, fog or snow, coming and going on its own
// ('auto') or held by the viewer. The engine steps it with the scene and draws it over the scene.
//
// A scene opts in with a `sky` description:
//   native  the weather the scene already paints itself ('rain' in the room, 'snow' at the cabin,
//           'clear' elsewhere). While that is the weather, nothing here draws, so the scene looks
//           exactly as it always has.
//   kinds   the weather that can happen there (always includes native).
//   area(s) optional: the rectangles [x, y, w, h] where the outside shows (a window). Without it
//           the whole picture is outside.
//   inline  true if the scene calls drawWeather() itself, at the right depth (behind a window
//           frame or the people in front of it), instead of the engine drawing over everything.
//   react(s, w)  optional, every step: steer the scene's own rain, shower or wind from the weather
//           `w` ({ kind, level, wind }). Return the kinds it paints itself, so they are not drawn twice.
//   strike(s)    optional: the scene's own lightning, used for storms instead of the shared one.
//   onStrike(s)  optional: after any lightning, for the scene to jump at it.
//   ground(s)    optional: the open ground [x, y, w, h] that cloud shadows drift over on a clear day.
//   open(s)      optional: the rectangle of open sky [x, y, w, h] (no roofs or towers in it), for
//           shooting stars at night and a rainbow after the rain. Defaults to the top fifth.

import { W, H, ctxRef, tod, dith, px, makeMist, makeRays, sfx, rng } from './kit.js';

export const KINDS = ['clear', 'rain', 'storm', 'fog', 'snow'];
const RAINY = { rain: 1, storm: 1 };

const STEP_S = 1 / 12;
const EASE = 0.012; // about 8 s to come in or clear

// colours by time of day: rain streaks (far, near), snow, fog, the grey of an overcast sky
const PAL = {
  night: { rain: ['rgba(140, 160, 225, 0.45)', 'rgba(175, 190, 240, 0.7)'], snow: '#d4dcf0', fog: '#454e6c', veil: '#20243a', bolt: '#e8ecff' },
  dawn: { rain: ['rgba(205, 180, 210, 0.45)', 'rgba(235, 215, 235, 0.7)'], snow: '#f2e6f0', fog: '#b9a6c0', veil: '#5a5068', bolt: '#fff4fa' },
  day: { rain: ['rgba(200, 210, 230, 0.5)', 'rgba(230, 236, 248, 0.75)'], snow: '#ffffff', fog: '#d6dce6', veil: '#7a8496', bolt: '#ffffff' },
  dusk: { rain: ['rgba(200, 160, 200, 0.45)', 'rgba(235, 200, 225, 0.7)'], snow: '#eadcf0', fog: '#9a86a6', veil: '#4a3e5a', bolt: '#fff0f8' },
};

export const weather = {
  mode: 'auto', // 'auto' or one of KINDS
  kind: 'clear', // what is falling now
  next: null, // what comes once the current weather has cleared
  level: 0, // 0..1, how much of `kind` shows
  wind: 0, // -1..1, slant of the rain and drift of the snow
  hold: 0, // steps until auto picks again
  flash: 0,
  bolt: null,
  boltWait: 0,
  meteor: null, // a shooting star crossing the open sky
  meteorWait: 12 * 20,
  after: 0, // steps left of the clearing after rain: a rainbow by day
};

// weather keeps its own dice, so it never shifts the random numbers a scene draws with
const rand = rng(20261126);

let scene = null;
let fx = null; // layers and particles for this scene at this size and time of day

/** The weather this scene can have, native first. */
export const kindsFor = (sc) => (sc?.sky ? [sc.sky.native, ...sc.sky.kinds.filter((k) => k !== sc.sky.native)] : ['clear']);
const nativeOf = (sc) => sc?.sky?.native || 'clear';
const areaOf = (sc, s) => sc?.sky?.area?.(s) || [[0, 0, W, H]];

function wanted() {
  const kinds = kindsFor(scene);
  if (weather.mode !== 'auto') return kinds.includes(weather.mode) ? weather.mode : nativeOf(scene);
  return null;
}

/** Auto weather: mostly the scene's own, now and then something else for a few minutes. */
function pickAuto() {
  const kinds = kindsFor(scene);
  const bag = [kinds[0], kinds[0], kinds[0], ...kinds.slice(1)];
  return bag[Math.floor(rand() * bag.length)];
}

/** Called by the engine when the scene changes or is rebuilt (new size, new time of day). */
export function buildWeather(sc, s, fresh) {
  const changed = sc !== scene;
  scene = sc;
  if (changed || fresh) {
    // a new scene starts in its own weather (or the held one), already settled in
    weather.kind = wanted() || nativeOf(sc);
    weather.next = null;
    weather.level = 1;
    weather.hold = 12 * 60 * (2 + rand() * 3);
    weather.flash = 0;
    weather.bolt = null;
    weather.boltWait = 12 * 4;
    weather.wind = 0.2;
  }
  if (changed) dispatchEvent(new CustomEvent('lofi:weather', { detail: { kind: weather.kind, mode: weather.mode } }));
  const P = PAL[tod] || PAL.night;
  const area = areaOf(sc, s);
  const r = rng(7);
  const box = bounds(area);
  // drops and flakes live inside the outside area's bounding box
  const n = Math.round((box.w * box.h) / 360);
  fx = {
    P,
    area,
    box,
    far: Array.from({ length: n }, () => ({ x: box.x + r() * box.w, y: box.y + r() * box.h, v: 5 + r() * 2, len: 3 + Math.floor(r() * 3) })),
    near: Array.from({ length: Math.round(n * 0.3) }, () => ({ x: box.x + r() * box.w, y: box.y + r() * box.h, v: 9 + r() * 3, len: 7 + Math.floor(r() * 5) })),
    flakes: Array.from({ length: Math.round(n * 0.8) }, () => ({ x: box.x + r() * box.w, y: box.y + r() * box.h, v: 0.4 + r() * 0.8, p: r() * 7, big: r() < 0.2 })),
    splash: [],
    // fog: two dithered banks wider than the screen, sliding past each other
    // a low bank lying on the ground, and a thinner one higher up; the sky above stays clear
    fogA: makeMist(box.y + box.h * 0.4, box.y + box.h * 0.72, box.y + box.h + 4, P.fog, 0.5, W + 160),
    fogB: makeMist(box.y, box.y + box.h * 0.5, box.y + box.h * 0.8, P.fog, 0.28, W + 160),
    veil: makeVeil(box, P.veil),
    open: sc.sky?.open?.(s) || (sc.sky?.area ? [box.x, box.y, box.w, Math.round(box.h * 0.4)] : [0, 0, W, Math.round(H * 0.2)]),
    bow: null,
    rays: null,
    // cloud shadows: a few soft dark patches, made once, slid across the ground
    ground: sc.sky?.ground?.(s) || null,
    shadows: null,
  };
}

function bounds(area) {
  const x0 = Math.min(...area.map((a) => a[0]));
  const y0 = Math.min(...area.map((a) => a[1]));
  const x1 = Math.max(...area.map((a) => a[0] + a[2]));
  const y1 = Math.max(...area.map((a) => a[1] + a[3]));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** A dithered grey veil, heaviest at the top: the sky clouding over. */
function makeVeil(box, color) {
  const g = document.createElement('canvas');
  g.width = W;
  g.height = H;
  const c = g.getContext('2d');
  c.fillStyle = color;
  for (let y = box.y; y < box.y + box.h; y++) {
    // thick up in the sky, gone by two thirds of the way down, so the ground keeps its colour
    const f = (y - box.y) / box.h;
    const t = Math.max(0, 0.45 * (1 - f / 0.66));
    if (!t) continue;
    for (let x = box.x; x < box.x + box.w; x++) if (dith(x, y, t)) c.fillRect(x, y, 1, 1);
  }
  return g;
}

/** Step the weather (12 times a second, with the scene). */
export function stepWeather(s) {
  if (!scene || !fx) return;
  const w = weather;
  // where the weather is heading: a held kind, or auto's choice when its time is up
  const hold = wanted();
  if (hold && hold !== w.kind && w.next !== hold) w.next = hold;
  if (hold && hold === w.kind) w.next = null; // changed our mind mid-change: come back
  if (!hold && --w.hold <= 0) {
    const k = pickAuto();
    if (k !== w.kind) w.next = k;
    w.hold = 12 * 60 * (k === nativeOf(scene) ? 3 + rand() * 5 : 2 + rand() * 3);
  }
  if (w.next) {
    w.level = Math.max(0, w.level - EASE);
    if (w.level === 0) {
      // rain giving way to a clear day: the sun comes out with a rainbow for a minute or so
      if (w.kind in RAINY && w.next === 'clear' && tod !== 'night') w.after = 12 * 75;
      w.kind = w.next;
      w.next = null;
      dispatchEvent(new CustomEvent('lofi:weather', { detail: { kind: w.kind, mode: w.mode } }));
    }
  } else w.level = Math.min(1, w.level + EASE);
  w.wind += ((w.kind === 'storm' ? 0.7 : 0.2) + Math.sin(performance.now() / 7000) * 0.15 - w.wind) * 0.02;

  const painted = scene.sky?.react?.(s, w) || [];
  fx.painted = painted;

  // lightning in a storm: a bolt and a flash, the thunder a moment behind
  if (w.flash > 0) {
    w.flash = Math.max(0, w.flash - 0.16);
    if (w.flash > 0.45 && w.flash < 0.6) w.flash = 0.95; // the second flicker
  }
  if (w.bolt && --w.bolt.life <= 0) w.bolt = null;
  if (w.kind === 'storm' && w.level > 0.6 && --w.boltWait <= 0) {
    w.boltWait = 12 * (5 + rand() * 13);
    if (scene.sky?.strike) scene.sky.strike(s);
    else strike();
    scene.sky?.onStrike?.(s);
  }

  // drops and flakes, only when we draw them
  if (w.kind in RAINY && !painted.includes(w.kind)) stepRain(w);
  if (w.kind === 'snow' && !painted.includes('snow')) stepSnow(w);
  if (w.after > 0) w.after--;
  stepMeteor(w);
}

function strike() {
  const { box } = fx;
  const pts = [];
  let x = box.x + box.w * (0.15 + rand() * 0.7);
  let y = box.y;
  const end = box.y + box.h * (0.3 + rand() * 0.25);
  while (y < end) {
    pts.push([Math.round(x), Math.round(y)]);
    x += (rand() - 0.5) * 8;
    y += 2 + rand() * 4;
  }
  weather.bolt = { pts, life: 3 };
  weather.flash = 1;
  const near = rand();
  setTimeout(() => sfx('thunder', { near }), (1 - near) * 1800);
}

function stepRain(w) {
  const { box } = fx;
  const slant = w.wind * 0.35;
  for (const set of [fx.far, fx.near])
    for (const d of set) {
      d.y += d.v;
      d.x += d.v * slant;
      if (d.y > box.y + box.h) {
        if (set === fx.near && rand() < 0.25) fx.splash.push({ x: d.x, y: box.y + box.h - 1 - rand() * box.h * 0.25, life: 3 });
        d.y = box.y - d.len;
        d.x = box.x + rand() * box.w;
      }
      if (d.x > box.x + box.w) d.x -= box.w;
      if (d.x < box.x) d.x += box.w;
    }
  fx.splash = fx.splash.filter((p) => --p.life > 0);
}

function stepSnow(w) {
  const { box } = fx;
  for (const f of fx.flakes) {
    f.y += f.v * (f.big ? 1.4 : 1);
    f.x += Math.sin(f.p + f.y / 14) * 0.3 + w.wind * 0.8;
    if (f.y > box.y + box.h) {
      f.y = box.y - 2;
      f.x = box.x + rand() * box.w;
    }
    if (f.x > box.x + box.w) f.x -= box.w;
    if (f.x < box.x) f.x += box.w;
  }
}

// Nights of the big meteor showers (month 0-11, first and last day): a shooting star every few
// seconds instead of every half a minute or so.
const SHOWERS = [
  [0, 2, 4], // Quadrantids
  [7, 11, 13], // Perseids
  [10, 16, 18], // Leonids
  [11, 13, 15], // Geminids
];
export const showerTonight = (d = new Date()) => SHOWERS.some(([m, a, b]) => d.getMonth() === m && d.getDate() >= a && d.getDate() <= b);

function stepMeteor(w) {
  const m = w.meteor;
  if (m) {
    m.x += m.vx;
    m.y += m.vy;
    if (++m.f > m.life) w.meteor = null;
    return;
  }
  // only on a clear night (snow at the cabin still has stars between the flakes)
  const clearSky = w.kind === 'clear' || (w.kind === 'snow' && nativeOf(scene) === 'snow');
  if (tod !== 'night' || !clearSky || --w.meteorWait > 0) return;
  const many = showerTonight();
  w.meteorWait = 12 * (many ? 2 + rand() * 6 : 25 + rand() * 45);
  const [ox, oy, ow, oh] = fx.open;
  const dir = rand() < 0.5 ? 1 : -1;
  const v = 5 + rand() * 4;
  w.meteor = {
    x: ox + ow * (dir > 0 ? 0.05 + rand() * 0.5 : 0.45 + rand() * 0.5),
    y: oy + oh * rand() * 0.4,
    vx: v * dir,
    vy: v * (0.35 + rand() * 0.25),
    f: 0,
    life: 6 + Math.floor(rand() * 5),
    len: 8 + Math.floor(rand() * 8),
  };
}

/** A soft dithered patch of cloud shadow, `w` by `h`. */
function makeShadow(w, h, seed) {
  const g = document.createElement('canvas');
  g.width = w;
  g.height = h;
  const c = g.getContext('2d');
  c.fillStyle = 'rgba(30, 40, 80, 0.5)';
  const r = rng(seed);
  const lumps = Array.from({ length: 4 }, () => [w * (0.2 + r() * 0.6), h * (0.3 + r() * 0.4), w * (0.25 + r() * 0.2), h * (0.35 + r() * 0.2)]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (const [cx, cy, rx, ry] of lumps) v = Math.max(v, 1 - Math.hypot((x - cx) / rx, (y - cy) / ry));
      if (v > 0 && dith(x, y, Math.min(1, v * 2) * 0.5)) c.fillRect(x, y, 1, 1);
    }
  return g;
}

/** A rainbow arc as its own layer: seven dithered bands, fading toward the ends. */
function makeBow([ox, oy, ow, oh]) {
  const g = document.createElement('canvas');
  g.width = W;
  g.height = H;
  const c = g.getContext('2d');
  const cols = ['#ff6b6b', '#ffa94d', '#ffe066', '#8ce99a', '#74c0fc', '#748ffc', '#b197fc'];
  const cx = ox + ow * 0.3; // on the left: the suns are on the right, and a rainbow faces away from the sun
  const R = Math.max(ow * 0.28, 60);
  const cy = oy + oh + R * 0.55; // its feet are below the open sky, out of sight
  const band = Math.max(1, Math.round(R / 40));
  for (let y = oy; y < oy + oh; y++)
    for (let x = ox; x < ox + ow; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const k = Math.floor((R - d) / band);
      if (k < 0 || k >= cols.length) continue;
      // strongest at the top of the arc, thinning where it meets the edges of the sky
      const top = 1 - Math.min(1, Math.abs(x - cx) / R);
      const low = Math.max(0, (y - oy - oh * 0.55) / (oh * 0.45)); // and melting into the haze below
      if (dith(x, y, (0.25 + top * 0.45) * (1 - low))) {
        c.fillStyle = cols[k];
        c.fillRect(x, y, 1, 1);
      }
    }
  return g;
}

/** Draw the weather over what the scene has painted so far. */
export function drawWeather(t) {
  if (!scene || !fx) return;
  const w = weather;
  const c = ctxRef;
  const native = nativeOf(scene);
  const show = w.kind === native ? 0 : w.level; // the scene paints its own weather
  const painted = fx.painted || [];
  const { P } = fx;

  c.save();
  c.beginPath();
  for (const a of fx.area) c.rect(...a);
  c.clip();

  // the sky clouds over for rain, storms and fog (a clear scene going grey)
  const grey = w.kind === 'storm' ? 1 : w.kind === 'rain' ? 0.75 : w.kind === 'fog' ? 0.6 : w.kind === 'snow' ? 0.5 : 0;
  if (grey && native === 'clear') {
    c.globalAlpha = grey * show;
    c.drawImage(fx.veil, 0, 0);
    c.globalAlpha = 1;
  }

  if (show > 0 && w.kind in RAINY && !painted.includes(w.kind)) {
    const heavy = w.kind === 'storm' ? 1 : 0.7;
    const nf = Math.round(fx.far.length * show * heavy);
    const nn = Math.round(fx.near.length * show * heavy);
    const dx = w.wind * 0.35;
    c.fillStyle = P.rain[0];
    for (let i = 0; i < nf; i++) streak(fx.far[i], dx);
    c.fillStyle = P.rain[1];
    for (let i = 0; i < nn; i++) streak(fx.near[i], dx);
    for (const p of fx.splash) {
      px(Math.round(p.x) - 1, Math.round(p.y), 1, 1, P.rain[1]);
      px(Math.round(p.x) + 1, Math.round(p.y), 1, 1, P.rain[1]);
      if (p.life > 1) px(Math.round(p.x), Math.round(p.y) - 1, 1, 1, P.rain[1]);
    }
  }

  if (show > 0 && w.kind === 'snow' && !painted.includes('snow')) {
    const n = Math.round(fx.flakes.length * show);
    for (let i = 0; i < n; i++) {
      const f = fx.flakes[i];
      px(Math.round(f.x), Math.round(f.y), f.big ? 2 : 1, f.big ? 2 : 1, P.snow);
    }
  }

  if (w.kind === 'fog' && w.level > 0) {
    // fog shows in every scene, even one that is foggy anyway: it only thickens
    const drift = (t / 260) % 160;
    c.globalAlpha = w.level;
    c.drawImage(fx.fogB, -Math.round(drift), 0);
    c.drawImage(fx.fogA, -Math.round(160 - drift), 0);
    c.globalAlpha = 1;
  }

  if (w.bolt) {
    c.fillStyle = P.bolt;
    let prev = null;
    for (const [x, y] of w.bolt.pts) {
      if (prev) for (let yy = prev[1]; yy <= y; yy++) c.fillRect(Math.round(prev[0] + ((x - prev[0]) * (yy - prev[1])) / Math.max(1, y - prev[1])), yy, 1, 1);
      prev = [x, y];
    }
  }
  c.restore();

  // a clear day: cloud shadows wander over the ground
  const sunny = tod === 'day' && (w.kind === 'clear' ? w.level : w.next === 'clear' ? 0 : 0);
  if (fx.ground && sunny > 0) {
    const [gx, gy, gw, gh] = fx.ground;
    if (!fx.shadows) fx.shadows = [0, 1, 2].map((i) => ({ img: makeShadow(Math.round(gw * 0.45), Math.round(gh * 0.5), 3 + i), off: i / 3, y: gy + Math.round(gh * (0.05 + i * 0.22)) }));
    c.save();
    c.beginPath();
    c.rect(gx, gy, gw, gh);
    c.clip();
    c.globalAlpha = sunny * 0.6;
    for (const sh of fx.shadows) {
      const span = gw + sh.img.width * 2;
      const x = gx - sh.img.width + ((t / 90 + sh.off * span) % span);
      c.drawImage(sh.img, Math.round(x), sh.y);
    }
    c.restore();
  }

  // the open sky: a shooting star by night, a rainbow after the rain by day
  if (w.meteor || w.after > 0) {
    c.save();
    c.beginPath();
    c.rect(...fx.open);
    c.clip();
    if (w.after > 0) {
      if (!fx.bow) fx.bow = makeBow(fx.open);
      const total = 12 * 75;
      const env = Math.min(1, (total - w.after) / 120, w.after / 180); // in over 10 s, out over 15 s
      c.globalAlpha = 0.55 * env;
      c.drawImage(fx.bow, 0, 0);
      c.globalAlpha = 1;
      // and the sun breaking through: rays fanning down from above the top corner
      if (!fx.rays) fx.rays = makeRays(fx.box.x + fx.box.w * 0.82, fx.box.y - 10, Math.max(fx.box.w, fx.box.h) * 0.9, 'rgba(255, 246, 214, 0.5)', { count: 7, strength: 0.6, maxY: fx.box.y + fx.box.h, seed: 4 });
    }
    const m = w.meteor;
    if (m) {
      const fade = m.f > m.life - 3 ? (m.life - m.f) / 3 : 1;
      const n = Math.hypot(m.vx, m.vy);
      for (let k = m.len; k >= 0; k--) {
        const a = (1 - k / m.len) * fade;
        c.fillStyle = `rgba(235, 240, 255, ${a.toFixed(2)})`;
        c.fillRect(Math.round(m.x - (m.vx / n) * k), Math.round(m.y - (m.vy / n) * k), 1, 1);
      }
      c.fillStyle = `rgba(255, 255, 255, ${fade})`;
      c.fillRect(Math.round(m.x) - 1, Math.round(m.y), 2, 1);
    }
    c.restore();
  }

  if (w.after > 0 && fx.rays) {
    const total = 12 * 75;
    const env = Math.min(1, (total - w.after) / 120, w.after / 180);
    c.save();
    c.beginPath();
    for (const ar of fx.area) c.rect(...ar);
    c.clip();
    c.globalAlpha = 0.7 * env;
    c.drawImage(fx.rays, 0, 0);
    c.restore();
  }

  // the flash lights the whole picture, inside and out
  if (w.flash > 0) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(120, 130, 170, ${w.flash * 0.35})`;
    c.fillRect(0, 0, W, H);
    c.restore();
  }
}

function streak(d, dx) {
  const x = Math.round(d.x);
  const y = Math.round(d.y);
  if (Math.abs(dx) < 0.15) ctxRef.fillRect(x, y, 1, d.len);
  else for (let k = 0; k < d.len; k++) ctxRef.fillRect(Math.round(x - dx * (d.len - k)), y + k, 1, 1);
}

/** Levels for the ambience: rain and wind this scene does not already make itself. */
export function weatherSound() {
  const w = weather;
  const native = nativeOf(scene);
  const painted = fx?.painted || [];
  const own = w.kind === native || painted.includes(w.kind);
  const lv = w.level;
  return {
    rain: !own && w.kind in RAINY ? lv * (w.kind === 'storm' ? 1.3 : 0.9) : 0,
    wind: !own && (w.kind === 'storm' || w.kind === 'snow') ? lv * (w.kind === 'storm' ? 0.9 : 0.4) : 0,
    indoor: !!scene?.sky?.area,
  };
}

/** The viewer's choice: 'auto' or one of KINDS. */
export function setWeatherMode(m) {
  weather.mode = m === 'auto' || KINDS.includes(m) ? m : 'auto';
  if (weather.mode === 'auto') weather.hold = 12 * 60 * (2 + rand() * 3);
  return weather.mode;
}
