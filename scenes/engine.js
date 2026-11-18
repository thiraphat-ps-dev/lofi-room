// Full-screen pixel scenes. Each scene draws into a low-resolution canvas (about 360 px tall)
// that CSS scales up with crisp pixels, so the art fills any screen shape.
//
// This module owns the canvas and the animation loop. Each scene lives in its own module and
// draws with the helpers in kit.js; app.js picks one through window.LofiScenes.

import { W, H, setSize, setCtx, view } from './kit.js';
import rainyRoom from './room.js';
import seaside from './sea.js';
import cabin from './snow.js';
import neon from './city.js';
import camp from './camp.js';
import market from './market.js';
import cafe from './cafe.js';

const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const STEP = 1000 / 12; // pixel art reads best at a low, steady frame rate
const TARGET_H = 360;

const SCENES = [rainyRoom, seaside, cabin, neon, camp, market, cafe];
let current = null;
let state = null;

let scale = 1;

function resize() {
  scale = Math.max(1, Math.round(innerHeight / TARGET_H));
  setSize(Math.ceil(innerWidth / scale), Math.ceil(innerHeight / scale));
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = W * scale + 'px';
  canvas.style.height = H * scale + 'px';
  ctx.imageSmoothingEnabled = false;
  if (current) state = current.init();
  paint(performance.now());
}

function paint(t) {
  if (!current || !state) return;
  setCtx(ctx);
  current.draw(state, t);
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
    while (acc >= STEP) {
      view.x += (view.tx - view.x) * 0.08;
      view.y += (view.ty - view.y) * 0.08;
      current.update(state);
      acc -= STEP;
    }
    paint(now);
  }
  requestAnimationFrame(frame);
}

addEventListener('resize', resize);
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
window.LofiScenes = { list: SCENES.map(({ id, name, en }) => ({ id, name, en })), set, peek: () => ({ scene: current, state }) };
resize();
if (!still) requestAnimationFrame(frame);
