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

import { W, H, ctxRef, tod, dith, px, makeMist, sfx, rng } from './kit.js';

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
  }

  // drops and flakes, only when we draw them
  if (w.kind in RAINY && !painted.includes(w.kind)) stepRain(w);
  if (w.kind === 'snow' && !painted.includes('snow')) stepSnow(w);
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
