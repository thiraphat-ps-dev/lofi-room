// Getting from one scene to the next: a few seconds looking out of a train window as the country
// slides past (hills, telegraph poles, the lights of villages after dark), or from the deck of a
// boat when the sea is at either end. Drawn at the time of day it is, then it fades into the place.
//
// The engine runs it in place of a scene; clicking the same place again skips the ride.

import { W, H, ctxRef, tod, px, disc, bands, hash, rng, layer, makeStars, drawStars, pixelText, sfx } from './kit.js';

const DUR = 12 * 3.4; // frames

const PAL = {
  night: { sky: ['#070b1e', '#141c40', '#26295a'], far: '#1c2142', mid: '#12182c', near: '#0a0d18', ground: '#0e1220', sea: ['#0e1638', '#08102a'], wall: '#2a2030', trim: '#4a3a40', lamp: 'rgba(255, 190, 120, 0.10)', lights: true },
  dawn: { sky: ['#2e3466', '#b07a9e', '#f4bea0'], far: '#6a5a86', mid: '#4a3e64', near: '#2a2238', ground: '#3a2e40', sea: ['#7a6a98', '#3e3a6a'], wall: '#4a3a44', trim: '#6a5250', lamp: 'rgba(255, 200, 150, 0.06)', lights: true },
  day: { sky: ['#4c9ae8', '#8cc4f4', '#d6ecfb'], far: '#86a8c8', mid: '#5f8e5a', near: '#3d6438', ground: '#4c7a3e', sea: ['#3c8ac8', '#2a6aa8'], wall: '#7a6658', trim: '#a08470', lamp: 'rgba(0, 0, 0, 0)', lights: false },
  dusk: { sky: ['#241e4c', '#a84c78', '#f4985a'], far: '#5e3c6c', mid: '#3a2846', near: '#1e1628', ground: '#2a1e30', sea: ['#6a3c6a', '#2e2050'], wall: '#3e2c38', trim: '#5e4448', lamp: 'rgba(255, 180, 120, 0.08)', lights: true },
};

/** Begin a ride from scene `from` to scene `to` (scene objects). */
export function startJourney(from, to) {
  const mode = from.id === 'sea' || to.id === 'sea' ? 'boat' : 'train';
  const P = PAL[tod] || PAL.night;
  const r = rng(7 + to.id.length * 13);
  const j = { mode, to, f: 0, dur: DUR, P, seed: r() * 1000 };
  j.sky = layer(() => {
    bands(0, 0, W, H, P.sky);
    if (tod === 'night') drawStars(makeStars(r, W * 0.2, H * 0.5, ['#e8ecff', '#b8c4ff']), 0);
  });
  if (mode === 'boat') j.sea = layer(() => bands(0, Math.round(H * 0.5) - 4, W, Math.round(H * 0.5) + 8, P.sea));
  sfx(mode === 'boat' ? 'horn' : 'train');
  return j;
}

/** The ride has started, so a click on the same place again skips it. */
export const ending = (j) => j.f >= j.dur;

export function stepJourney(j) {
  j.f++;
}

// rolling ground: a height in pixels at x, from a few slow waves
const ridge = (x, seed, a, b) => Math.sin(x / a + seed) * 0.6 + Math.sin(x / b + seed * 2.3) * 0.4;

export function drawJourney(j, t) {
  const c = ctxRef;
  if (j.mode === 'boat') drawBoat(j, t);
  else drawTrain(j, t);
  // where we're going, in small letters at the bottom
  const en = document.documentElement.lang === 'en';
  const name = (en && j.to.en) || j.to.name;
  const a = Math.min(1, j.f / 8, (j.dur - j.f) / 6);
  if (a > 0) {
    c.globalAlpha = a;
    pixelText(c, '→ ' + name, W / 2, Math.round(H * 0.06), 11, '#fff4e0', 'center'); // above the window, clear of the panels
    c.globalAlpha = 1;
  }
}

function drawTrain(j, t) {
  const c = ctxRef;
  const { P } = j;
  const wx = Math.round(W * 0.12);
  const wy = Math.round(H * 0.14);
  const ww = W - wx * 2;
  const wh = Math.round(H * 0.5);
  const run = j.f * 8 + j.seed; // how far we've come, in pixels of the nearest layer
  const rock = Math.round(Math.sin(j.f / 2.2) * 0.6); // the carriage sways on the rails

  // ---- outside the window
  c.save();
  c.beginPath();
  c.rect(wx, wy, ww, wh);
  c.clip();
  c.drawImage(j.sky, 0, 0);
  const base = wy + wh + rock;
  const layerAt = (speed, top, amp, a, b, col, lights) => {
    for (let x = wx; x < wx + ww; x++) {
      const k = x + run * speed;
      const h = Math.round(top + ridge(k, j.seed, a, b) * amp);
      c.fillStyle = col;
      c.fillRect(x, base - h, 1, h);
      // a village light here and there on the hills after dark
      if (lights && P.lights && hash(Math.floor(k / 3) * 7.3) > 0.985) px(x, base - h + 3 + Math.floor(hash(k) * Math.max(1, h - 6)), 1, 1, '#ffd27a');
    }
  };
  layerAt(0.08, wh * 0.42, wh * 0.12, 53, 21, P.far, false);
  layerAt(0.25, wh * 0.28, wh * 0.08, 31, 13, P.mid, true);
  layerAt(0.6, wh * 0.12, wh * 0.03, 17, 7, P.near, false);
  px(wx, base - Math.round(wh * 0.08), ww, Math.round(wh * 0.08) + 2, P.ground);
  // telegraph poles flicking past, the wires dipping between them
  const gap = 110;
  const off = (run * 1.6) % gap;
  for (let x = wx - off; x < wx + ww + gap; x += gap) {
    const px0 = Math.round(x);
    px(px0, wy + 10 + rock, 3, wh, P.near);
    px(px0 - 4, wy + 14 + rock, 11, 2, P.near);
    for (let k = 0; k < gap; k++) {
      const sag = Math.round(Math.sin((k / gap) * Math.PI) * 6);
      px(px0 + 3 + k, wy + 15 + sag + rock, 1, 1, P.near);
    }
  }
  c.restore();

  // ---- the carriage: wall, the window's frame and sill, a cup on the little table
  c.fillStyle = P.wall;
  c.fillRect(0, 0, W, wy);
  c.fillRect(0, wy + wh, W, H - wy - wh);
  c.fillRect(0, wy, wx, wh);
  c.fillRect(wx + ww, wy, W - wx - ww, wh);
  c.fillStyle = P.trim;
  c.fillRect(wx - 5, wy - 5, ww + 10, 5);
  c.fillRect(wx - 5, wy + wh, ww + 10, 7);
  c.fillRect(wx - 5, wy, 5, wh);
  c.fillRect(wx + ww, wy, 5, wh);
  px(wx - 5, wy + wh, ww + 10, 1, 'rgba(255, 255, 255, 0.15)');
  px(wx + Math.round(ww / 2) - 2, wy, 4, wh, P.trim); // the middle bar of the window
  // table and a paper cup that trembles with the rails
  const tx = Math.round(W * 0.62);
  const ty = wy + wh + 7;
  px(tx - 40, ty, 80, 4, '#3a2a24');
  px(tx - 2, ty + 4, 4, 30, '#2a1e1a');
  const jig = j.f % 6 < 1 ? -1 : 0;
  px(tx + 14, ty - 8 + jig, 7, 8, '#ece4d6');
  px(tx + 14, ty - 6 + jig, 7, 2, '#c8463c');
  for (let k = 0; k < 3; k++) px(tx + 16 + Math.round(Math.sin(t / 300 + k) * 1.5), ty - 12 - k * 3 + jig, 1, 2, 'rgba(240, 235, 250, 0.35)');
  // a seat back at each side
  px(0, H - 70, Math.round(W * 0.16), 70, '#3a2228');
  px(W - Math.round(W * 0.16), H - 70, Math.round(W * 0.16), 70, '#3a2228');
  px(0, H - 70, Math.round(W * 0.16), 3, '#5a3a40');
  px(W - Math.round(W * 0.16), H - 70, Math.round(W * 0.16), 3, '#5a3a40');
  // the carriage lamp's warmth after dark
  c.fillStyle = P.lamp;
  c.fillRect(0, 0, W, H);
}

function drawBoat(j, t) {
  const c = ctxRef;
  const { P } = j;
  const bob = Math.round(Math.sin(j.f / 4.5) * 3);
  const hz = Math.round(H * 0.5) + bob;
  const run = j.f * 3 + j.seed;
  c.drawImage(j.sky, 0, bob);
  // the sun or moon low over the water, and its light broken up on the waves
  const orb = { night: ['#eeead8', 9], dawn: ['#ffd8b0', 12], day: ['#fff6d8', 10], dusk: ['#ffb070', 14] }[tod] || ['#eeead8', 9];
  const ox = Math.round(W * 0.68);
  const oy = hz - (tod === 'day' ? 70 : 26);
  c.fillStyle = orb[0];
  c.globalAlpha = 0.12;
  c.beginPath();
  c.arc(ox, oy, orb[1] * 2.6, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;
  disc(ox, oy, orb[1], orb[0]);
  // a far shore drifting by
  c.fillStyle = P.far;
  for (let x = 0; x < W; x++) {
    const k = x + run * 0.15;
    const h = Math.max(0, Math.round(6 + ridge(k, j.seed, 41, 15) * 7));
    c.fillRect(x, hz - h, 1, h);
  }
  c.drawImage(j.sea, 0, bob);
  // the light on the water, streaming back past us
  for (let i = 0; i < W / 3; i++) {
    const x = Math.round((hash(i * 3.7) * W * 1.5 - run * (1 + hash(i) * 2)) % (W * 1.5));
    const y = hz + 2 + Math.floor(hash(i * 9.1) ** 2 * (H - hz));
    if (x < 0 || x >= W) continue;
    const near = (y - hz) / (H - hz);
    px(x, y, 2 + Math.round(near * 6), 1, `rgba(255, 255, 255, ${0.12 + near * 0.25})`);
  }
  for (let y = hz + 2; y < Math.round(H * 0.8) - 22; y += 3) {
    const w = Math.round(orb[1] * (0.6 + ((y - hz) / H) * 3) * (0.5 + hash(y * 3.1 + Math.floor(t / 180)) * 0.8));
    px(ox - Math.round(w / 2) + Math.round(Math.sin(t / 240 + y) * 2), y, w, 1, orb[0] + '88');
  }
  // the bow wave folding away, then the rail and deck in front
  const deck = Math.round(H * 0.8);
  for (let k = 0; k < 40; k++) {
    const x = Math.round(W * 0.2 + k * 9 + Math.sin(t / 200 + k) * 2);
    px(x, deck - 6 - (k % 3), 6, 1, 'rgba(255, 255, 255, 0.45)');
  }
  px(0, deck, W, H - deck, '#5a3c2a');
  for (let y = deck + 4; y < H; y += 6) px(0, y, W, 1, '#4a2e20');
  px(0, deck - 22, W, 3, '#d8d2c4');
  px(0, deck - 12, W, 2, '#d8d2c4');
  for (let x = 12; x < W; x += 46) px(x, deck - 22, 3, 22, '#c8c0b0');
  c.fillStyle = P.lamp;
  c.fillRect(0, 0, W, H);
}
