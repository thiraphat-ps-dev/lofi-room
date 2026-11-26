// Full-screen pixel scenes. Each scene draws into a low-resolution canvas (about 360 px tall)
// that CSS scales up with crisp pixels, so the art fills any screen shape.
//
// This module owns the canvas and the animation loop. Each scene lives in its own module and
// draws with the helpers in kit.js; app.js picks one through window.LofiScenes.

import { W, H, setSize, setCtx, view, tod, setTod, phaseAt, PHASES } from './kit.js';
import rainyRoom from './room.js';
import seaside from './sea.js';
import cabin from './snow.js';
import neon from './city.js';
import camp from './camp.js';
import market from './market.js';
import cafe from './cafe.js';
import { weather, buildWeather, stepWeather, drawWeather, setWeatherMode, kindsFor, weatherSound, skyRects } from './weather.js';
import { startJourney, stepJourney, drawJourney } from './journey.js';
import { buildFestival, stepFestival, drawFestivalFront, holdFestival, festivalNow, toMidnight } from './festival.js';

const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const STEP = 1000 / 12; // pixel art reads best at a low, steady frame rate
const TARGET_H = 360;

const SCENES = [rainyRoom, seaside, cabin, neon, camp, market, cafe];
let current = null;
let state = null;

let scale = 1;

// Time of day: 'auto' follows the viewer's clock, or one of PHASES holds it there. When it
// changes, the scene is rebuilt and the old picture fades out over the new one.
let timeMode = 'auto';
const fade = document.createElement('canvas');
let fadeLeft = 0;
let fadeLen = 30;
const FADE = 30; // frames, about 2.5 s
const hourNow = () => {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
};
const wantedPhase = () => (timeMode === 'auto' ? phaseAt(hourNow()) : timeMode);
function syncPhase(crossfade) {
  const p = wantedPhase();
  if (p === tod && state) return;
  if (crossfade && current && state && !still) {
    fade.width = W;
    fade.height = H;
    fade.getContext('2d').drawImage(canvas, 0, 0);
    fadeLeft = fadeLen = FADE;
  }
  setTod(p);
  dispatchEvent(new CustomEvent('lofi:phase', { detail: { phase: p } }));
  if (current) {
    state = current.init();
    buildWeather(current, state);
    buildFestival(skyRects());
    paint(performance.now());
  }
}

function resize() {
  scale = Math.max(1, Math.round(innerHeight / TARGET_H));
  setSize(Math.ceil(innerWidth / scale), Math.ceil(innerHeight / scale));
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = W * scale + 'px';
  canvas.style.height = H * scale + 'px';
  ctx.imageSmoothingEnabled = false;
  if (current) {
    state = current.init();
    buildWeather(current, state);
    buildFestival(skyRects());
  }
  paint(performance.now());
}

// A ride between two scenes (journey.js), drawn instead of a scene while it lasts.
let journey = null;

function paint(t) {
  if (!current || !state) return;
  setCtx(ctx);
  if (journey) {
    drawJourney(journey, t);
    overlayFade();
    return;
  }
  current.draw(state, t);
  if (!current.sky?.inline) drawWeather(t); // an indoor scene draws it behind its window frame
  drawFestivalFront(t);
  overlayFade();
}
function overlayFade() {
  if (fadeLeft > 0) {
    ctx.save();
    ctx.globalAlpha = fadeLeft / fadeLen;
    ctx.drawImage(fade, 0, 0);
    ctx.restore();
  }
}
/** Hold what is on screen now, to fade out over whatever comes next. */
function holdFrame(frames) {
  fade.width = W;
  fade.height = H;
  fade.getContext('2d').drawImage(canvas, 0, 0);
  fadeLeft = fadeLen = frames;
}

/**
 * Travel to a scene: a short ride by train (or boat, to or from the sea), then the place fades in.
 * Without motion, or to the scene already showing, it is just set(). Asking for the same place
 * again mid-ride gets there at once.
 */
function go(id) {
  const to = SCENES.find((s) => s.id === id) || SCENES[0];
  if (journey && journey.to === to) {
    arrive();
    return to;
  }
  if (still || !current || (to === current && !journey)) return set(id);
  if (journey) journey.to = to;
  else {
    holdFrame(10);
    journey = startJourney(current, to);
  }
  document.documentElement.style.setProperty('--accent', to.accent);
  return to;
}
function arrive() {
  const to = journey.to;
  holdFrame(FADE);
  journey = null;
  const keep = fadeLeft;
  set(to.id);
  fadeLeft = fadeLen = keep;
}

function set(id) {
  current = SCENES.find((s) => s.id === id) || SCENES[0];
  resize(); // rebuilds the scene's layers at the current size
  document.documentElement.style.setProperty('--accent', current.accent);
  paint(performance.now());
  return current;
}

let acc = 0;
let last = performance.now();
function frame(now) {
  acc += Math.min(250, now - last);
  last = now;
  if (acc >= STEP && current) {
    while (acc >= STEP && journey) {
      stepJourney(journey);
      if (fadeLeft > 0) fadeLeft--;
      acc -= STEP;
      if (journey.f >= journey.dur) arrive();
    }
    while (acc >= STEP) {
      view.x += (view.tx - view.x) * 0.08;
      view.y += (view.ty - view.y) * 0.08;
      current.update(state);
      stepWeather(state);
      stepFestival();
      if (fadeLeft > 0) fadeLeft--;
      acc -= STEP;
    }
    paint(now);
  }
  requestAnimationFrame(frame);
}

addEventListener('resize', resize);
// the clock moves on: check now and then (and on coming back to the tab) whether the phase has
setInterval(() => syncPhase(true), 30000);
document.addEventListener('visibilitychange', () => !document.hidden && syncPhase(false));
// signs are drawn with the page font, so redraw once it has loaded
document.fonts?.ready.then(() => current && resize());
addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return; // a finger on a phone would jolt the scene
  view.tx = (e.clientX / innerWidth) * 2 - 1;
  view.ty = (e.clientY / innerHeight) * 2 - 1;
});
// A scene can answer the pointer: hot(state, x, y) says whether something there can be poked
// (the cursor turns into a hand), poke(state, x, y) is a click or tap on it. Clicks on the
// panels never get here: the HUD only takes the pointer over its panels.
const at = (e) => [Math.floor(e.clientX / scale), Math.floor(e.clientY / scale)];
canvas.addEventListener('pointerdown', (e) => {
  if (current?.poke && state) current.poke(state, ...at(e));
});
canvas.addEventListener('pointermove', (e) => {
  canvas.style.cursor = current?.hot && state && current.hot(state, ...at(e)) ? 'pointer' : '';
});
// peek() is for poking at a scene from the console: LofiScenes.peek().state.car = { f: 0, dur: 40, dir: 1 }
// time(mode) sets 'auto' or a fixed phase; phase() is the one showing now.
function time(mode) {
  timeMode = mode === 'auto' || PHASES.includes(mode) ? mode : 'auto';
  syncPhase(true);
  return tod;
}
// weather(mode) holds 'auto' or a kind; weatherNow() is what is showing and what could be.
function weatherNow() {
  return { mode: weather.mode, kind: weather.next || weather.kind, kinds: kindsFor(current) };
}
function setWeather(mode) {
  setWeatherMode(mode);
  if (still && current) {
    // no animation: jump straight to it
    buildWeather(current, state, true);
    paint(performance.now());
  }
  dispatchEvent(new CustomEvent('lofi:weather', { detail: weatherNow() }));
  return weatherNow();
}
window.LofiScenes = {
  list: SCENES.map(({ id, name, en, accent }) => ({ id, name, en, accent })),
  set,
  go,
  time,
  phase: () => tod,
  phases: PHASES,
  weather: setWeather,
  // festival(id) shows one on any day ('newyear', 'christmas', 'loykrathong', 'cny', 'songkran'), festival(null) goes back to the calendar
  festival: (id) => {
    const f = holdFestival(id);
    dispatchEvent(new CustomEvent('lofi:festival', { detail: { id: f } }));
    return f;
  },
  festivalNow,
  toMidnight,
  weatherNow,
  weatherSound,
  peek: () => ({ scene: current, state, weather }),
};
// ?festival=newyear (or christmas, loykrathong, cny, songkran) shows one on any day
const preview = new URLSearchParams(location.search).get('festival');
if (preview) holdFestival(preview);
setTod(wantedPhase());
resize();
if (!still) requestAnimationFrame(frame);
