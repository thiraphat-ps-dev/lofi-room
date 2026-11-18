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
  hdPine,
  makeLightmap,
  applyLight,
  makeMist,
} from './kit.js';
import { hdCat, FOX, drawOwl, owlEyes } from './animals.js';

// ------------------------------------------------------------------ scene: forest campfire

const camp = {
  id: 'camp',
  name: 'แคมป์ไฟในป่า',
  en: 'Forest campfire',
  accent: '#c6f27a',
  init() {
    const r = rng(59);
    const narrow = W < 420;
    const ground = Math.round(H * 0.66);
    const fireX = Math.round(W * (narrow ? 0.64 : 0.58));
    const fireY = ground + Math.round((H - ground) * 0.2);
    const tentX = Math.round(W * (narrow ? 0.3 : 0.44));
    const tentBase = ground + 9;
    const moon = { x: Math.round(W * 0.3), y: Math.round(H * 0.15) };
    const trunkW = narrow ? 12 : 26;
    const branchY = Math.round(H * 0.42);
    const owl = { x: W - trunkW - (narrow ? 22 : 40), y: branchY - 3 };
    const lgx = fireX + 30; // log bench
    const lgy = fireY - 12;

    const sky = layer(() => {
      bands(0, 0, W, ground, ['#03060e', '#060c1a', '#0a1426', '#101e34', '#182a44']);
      // the Milky Way: a soft diagonal band crowded with faint stars
      const mw = (x) => H * 0.02 + (x - W * 0.25) * 0.55;
      for (let y = 0; y < ground; y++)
        for (let x = 0; x < W; x++) {
          const d = Math.abs(y - mw(x)) / (H * 0.1);
          if (d < 1 && dith(x, y, (1 - d) * 0.42)) px(x, y, 1, 1, d < 0.3 ? '#22294e' : '#141f38');
        }
      for (let i = 0; i < W * 0.9; i++) {
        const x = r() * W;
        const y = mw(x) + (r() + r() - 1) * H * 0.08;
        if (y > 0 && y < ground) px(x, y, 1, 1, r() < 0.2 ? '#ffffff' : r() < 0.5 ? '#9fb0e0' : '#6a7ab0');
      }
      haloRing(moon.x, moon.y, 11, 32, 'rgba(240, 235, 205, 0.1)');
      shadeEllipse(moon.x, moon.y, 11, 11, (nx, ny) => (nx - ny > 0.9 ? '#fffbe6' : nx - ny < -0.8 ? '#d9d3b8' : '#f4f0dc'));
      disc(moon.x - 4, moon.y - 3, 2, '#dcd6bb');
      disc(moon.x + 3, moon.y + 4, 2, '#dcd6bb');
      px(moon.x + 4, moon.y - 5, 2, 2, '#dcd6bb');
      px(moon.x - 5, moon.y + 4, 2, 1, '#dcd6bb');
    });

    const far = layer(() => {
      // hills, then two ranks of pines
      for (let x = 0; x < W; x++) {
        const top = Math.round(H * 0.5 - (1 - Math.abs(Math.sin(x / 83 + 2))) * H * 0.1 - Math.sin(x / 29) * 4);
        px(x, top, 1, ground - top, '#0b1524');
        px(x, top, 1, 1, '#16263e');
      }
      for (let x = 0; x < W; x += 7 + Math.floor(r() * 7)) hdPine(x, ground + 1, 30 + Math.floor(r() * 26), ['#08131b', '#0b1a24', '#10242f'], null);
      for (let x = -4; x < W; x += 14 + Math.floor(r() * 14)) hdPine(x, ground + 3 + Math.floor(r() * 5), 60 + Math.floor(r() * 44), ['#050c11', '#081219', '#0d1c25'], null);
    });

    const land = layer(() => {
      // clearing: grass, a worn patch round the fire, a few mushrooms
      bands(0, ground, W, H - ground, ['#1b2a1e', '#16231a', '#111b15', '#0c140f', '#080e0b']);
      shadeEllipse(fireX, fireY + 3, 50, 12, (nx, ny, x, y) => (dith(x, y, 0.95 - (nx * nx + ny * ny) * 0.7) ? '#2a2018' : null));
      for (let i = 0; i < W * 0.9; i++) {
        const x = Math.round(r() * W);
        const y = ground + 2 + Math.round(r() * (H - ground - 4));
        const d = Math.hypot(x - fireX, (y - fireY) * 2);
        if (d < 40) continue;
        const c = d < 110 ? '#5e5a30' : '#2a4230';
        px(x, y, 1, 3, c);
        px(x + 1, y + 1, 1, 2, d < 110 ? '#46482a' : '#213626');
        px(x - 1, y + 1, 1, 2, d < 110 ? '#46482a' : '#213626');
      }
      for (let i = 0; i < Math.round(W / 70); i++) {
        const x = Math.round(r() * W);
        const y = ground + 20 + Math.round(r() * (H - ground - 26));
        px(x + 2, y + 2, 1, 3, '#e8dcc8');
        px(x, y, 5, 2, '#b8453a');
        px(x + 1, y - 1, 3, 1, '#b8453a');
        px(x + 1, y, 1, 1, '#f3e6d6');
        px(x + 3, y + 1, 1, 1, '#f3e6d6');
      }

      // tent: the front faces us, the side runs back to the left
      const T = { lit: '#f09a55', base: '#cf7a3f', shade: '#9a5428', dark: '#6e3a1e' };
      const top = tentBase - 52;
      poly([[tentX, top], [tentX - 52, top + 10], [tentX - 80, tentBase - 6], [tentX - 30, tentBase]], (x, y) => (dith(x, y, 0.35) ? T.shade : T.dark));
      poly([[tentX, top], [tentX - 30, tentBase], [tentX, tentBase]], T.base);
      poly([[tentX, top], [tentX, tentBase], [tentX + 30, tentBase]], (x, y) => (dith(x, y, 0.25 + (x - tentX) / 50) ? T.lit : T.base));
      poly([[tentX, top + 14], [tentX - 13, tentBase], [tentX + 13, tentBase]], '#1a0f0a');
      poly([[tentX, top + 28], [tentX - 8, tentBase], [tentX + 8, tentBase]], (x, y) => (dith(x, y, 0.5) ? '#6a3516' : '#3a1e0e'));
      stroke(tentX, top, tentX - 30, tentBase, T.shade);
      stroke(tentX, top, tentX + 30, tentBase, '#ffb878');
      stroke(tentX, top, tentX - 52, top + 10, T.base);
      stroke(tentX, top + 14, tentX - 13, tentBase, T.shade);
      stroke(tentX, top + 14, tentX + 13, tentBase, T.lit);
      px(tentX, top - 4, 1, 5, '#8a6a4a');
      stroke(tentX + 1, top + 2, tentX + 47, tentBase + 6, 'rgba(210, 200, 170, 0.45)');
      px(tentX + 46, tentBase + 4, 2, 4, '#8a6a4a');
      stroke(tentX - 52, top + 10, tentX - 92, tentBase - 2, 'rgba(210, 200, 170, 0.3)');

      if (!narrow) {
        // backpack with a bedroll
        const bx = tentX + 36;
        const by = tentBase + 3;
        px(bx - 1, by, 16, 2, 'rgba(0, 0, 0, 0.35)');
        px(bx, by - 16, 12, 16, '#3f6a4a');
        px(bx + 1, by - 18, 10, 2, '#3f6a4a');
        px(bx + 2, by - 8, 8, 6, '#2f5238');
        px(bx + 2, by - 8, 8, 1, '#24402c');
        px(bx + 2, by - 16, 1, 8, '#2a2018');
        px(bx + 11, by - 16, 1, 16, '#7aa862');
        px(bx - 1, by - 22, 14, 4, '#b8453a');
        px(bx - 1, by - 22, 14, 1, '#d9604f');
        px(bx + 3, by - 22, 1, 4, '#2a2018');
        px(bx + 9, by - 22, 1, 4, '#2a2018');

        // log bench with a mug, and a guitar leaning on it
        px(lgx - 2, lgy + 9, 46, 2, 'rgba(0, 0, 0, 0.35)');
        px(lgx, lgy, 42, 9, '#5a3a28');
        px(lgx, lgy, 42, 2, '#7a5238');
        px(lgx, lgy + 7, 42, 2, '#3a241a');
        for (let k = 0; k < 5; k++) px(lgx + 6 + k * 7, lgy + 3 + (k % 2), 3, 1, '#452b1e');
        px(lgx + 3, lgy + 1, 12, 1, '#b0703f');
        shadeEllipse(lgx, lgy + 4, 3, 4.5, (nx, ny) => (nx * nx + ny * ny < 0.25 ? '#c9976a' : '#e6b98c'));
        px(lgx + 12, lgy - 6, 5, 6, '#d8d2c6');
        px(lgx + 17, lgy - 5, 2, 3, '#d8d2c6');
        px(lgx + 12, lgy - 6, 5, 1, '#3a241a');
        px(lgx + 12, lgy - 5, 1, 5, '#fff3e0');
        const gx = lgx + 36;
        const gy = lgy + 9;
        const wood = (nx) => (nx < -0.45 ? '#e6a660' : nx > 0.5 ? '#8a5226' : '#b5763a');
        stroke(gx + 3, gy - 18, gx + 10, gy - 42, '#3a2418', 2);
        px(gx + 9, gy - 47, 4, 6, '#2a1810');
        px(gx + 8, gy - 46, 1, 1, '#d8d2c6');
        px(gx + 13, gy - 44, 1, 1, '#d8d2c6');
        shadeEllipse(gx, gy - 6, 6.5, 6.5, wood);
        shadeEllipse(gx + 2, gy - 15, 4.5, 4.5, wood);
        disc(gx + 1, gy - 10, 2, '#2a1810');
        stroke(gx + 1, gy - 4, gx + 10, gy - 41, 'rgba(240, 230, 200, 0.45)');
        px(gx - 2, gy - 4, 6, 1, '#2a1810');
        // marshmallow on a stick
        stroke(lgx + 5, lgy - 1, fireX + 10, fireY - 21, '#6b4b3a');
        px(fireX + 8, fireY - 24, 4, 4, '#fff3e0');
        px(fireX + 8, fireY - 21, 4, 1, '#d9a86a');
      }

      // fire: stones at the back, crossed logs (flames and the front stones come later)
      for (let k = 0; k <= 6; k++) {
        const a = Math.PI + (k / 6) * Math.PI;
        shadeEllipse(fireX + Math.cos(a) * 16, fireY - 1 + Math.sin(a) * 5, 3.5, 2.6, (nx, ny) => (ny > 0 ? '#b07a4c' : '#55505c'));
      }
      stroke(fireX - 11, fireY, fireX + 8, fireY - 7, '#4a2f25', 3);
      stroke(fireX + 9, fireY, fireX - 8, fireY - 7, '#5a3a28', 3);
      px(fireX - 4, fireY - 3, 9, 3, '#3a2018');
      px(fireX - 3, fireY - 2, 3, 1, '#ff8a3a');
      px(fireX + 2, fireY - 3, 2, 1, '#ffb347');
    });

    const front = layer(() => {
      for (let k = 0; k <= 6; k++) {
        const a = (k / 6) * Math.PI;
        shadeEllipse(fireX + Math.cos(a) * 17, fireY + Math.sin(a) * 5, 4, 3, (nx, ny) => (ny < -0.35 ? '#d9965a' : ny < 0.2 ? '#4a4652' : '#2c2a33'));
      }
      // kettle keeping warm by the stones
      const kx = fireX + 27;
      const ky = fireY + 8;
      px(kx - 5, ky + 1, 12, 1, 'rgba(0, 0, 0, 0.4)');
      shadeEllipse(kx, ky - 4, 5.5, 4.5, (nx, ny) => (nx < -0.4 ? '#d98a4a' : ny < -0.5 ? '#8a8f9a' : '#4a4e58'));
      px(kx - 2, ky - 10, 5, 2, '#4a4e58');
      px(kx, ky - 11, 1, 1, '#8a8f9a');
      stroke(kx + 5, ky - 5, kx + 9, ky - 8, '#4a4e58', 2);
    });

    // the frame: trees right in front of us, which slide against the view
    const frame = layer(() => {
      // big dark pines framing the left
      for (const [fx, base, h] of [[-0.02, 0.96, 0.62], [0.09, 1.04, 0.5]]) hdPine(Math.round(W * fx), Math.round(H * base), Math.round(H * h), ['#03070a', '#05090d', '#0b1216'], null);
      // an old trunk on the right, lit on the side that faces the fire, with a branch for the owl
      const tx = W - trunkW;
      px(tx, 0, trunkW, H, '#06090c');
      for (let y = 0; y < H; y++) {
        const warmth = Math.max(0, 1 - Math.abs(y - ground) / (H * 0.5));
        if (dith(tx, y, warmth * 0.9)) px(tx, y, 1, 1, '#4a2e18');
        if (dith(tx + 1, y, warmth * 0.5)) px(tx + 1, y, 2, 1, '#2a1a10');
        if (y % 9 === 0) px(tx + 4 + ((y * 7) % (trunkW - 6)), y, 1, 5, '#0d1318');
      }
      const reach = narrow ? 34 : 70;
      for (let k = 0; k < reach; k++) {
        const f = k / reach;
        const th = Math.max(2, Math.round(6 - f * 4));
        const y = branchY - Math.round(Math.sin(f * 1.6) * 6);
        px(tx - k, y, 1, th, '#06090c');
        px(tx - k, y + th - 1, 1, 1, '#3a2414');
      }
      stroke(tx - reach + 12, branchY - 5, tx - reach - 4, branchY - 16, '#06090c', 2);
      for (const [lx, ly] of [[-reach - 6, -19], [-reach + 2, -22], [-reach - 10, -13], [-reach + 22, -10], [-reach + 30, -12]])
        shadeEllipse(tx + lx, branchY + ly, 4, 2.2, (nx, ny) => (ny > 0.3 ? '#2a3a1c' : '#0b1410'));
      // the owl (its eyes are drawn at run time)
      drawOwl(owl.x, owl.y);
    });

    return {
      narrow,
      ground,
      fireX,
      fireY,
      tentX,
      tentBase,
      owl,
      mug: { x: lgx + 14, y: lgy - 8 },
      sky,
      land,
      front,
      stars: makeStars(r, W * 0.4, ground * 0.9, ['#cfd8ff', '#ffe7b0', '#9fb0e0']),
      glowA: makeGlow(fireX, fireY - 8, Math.min(W * 0.6, 200), 120, 'rgba(255, 140, 50, 0.07)', 4),
      glowB: makeGlow(fireX, fireY - 6, 95, 62, 'rgba(255, 180, 90, 0.08)', 4),
      tentGlow: makeGlow(tentX, tentBase - 6, 26, 16, 'rgba(255, 200, 120, 0.1)', 3),
      far,
      frame,
      mist: makeMist(ground - 34, ground - 8, ground + 4, 'rgba(120, 140, 175, 0.26)', 0.7, W + 60),
      // the forest goes dark; the fire pushes a warm circle back into it
      lightmap: makeLightmap(
        '#3e4668',
        [
          { poly: [[0, 0], [W, 0], [W, ground * 0.75], [0, ground * 0.75]], from: [0, 0], to: [0, ground * 0.75], color: '#9a9a9a' },
          { x: moon.x, y: moon.y, r: 220, color: '#2a3048' },
          { x: fireX, y: fireY - 12, r: Math.max(260, W * 0.4), ry: 175, color: '#e09050' },
          { x: fireX, y: fireY - 8, r: 90, ry: 60, color: '#ffd8a8' },
          { x: tentX, y: tentBase - 10, r: 34, color: '#a06a38' },
        ],
        { vignette: 0.3 },
      ),
      sparks: [],
      smoke: [],
      shooting: null,
      flies: Array.from({ length: Math.round(W / 22) }, () => ({ x: r() * W, y: ground - 40 + r() * 90, a: r() * 6, p: r() * 6, big: r() < 0.3 })),
    };
  },
  update(s) {
    if (Math.random() < 0.6) s.sparks.push({ x: s.fireX + (Math.random() - 0.5) * 10, y: s.fireY - 14, vx: (Math.random() - 0.5) * 0.9, vy: 1 + Math.random() * 1.2, life: 0, max: 18 + Math.random() * 26 });
    for (const p of s.sparks) {
      p.y -= p.vy;
      p.x += p.vx + Math.sin(p.life / 4) * 0.4;
      p.life++;
    }
    s.sparks = s.sparks.filter((p) => p.life < p.max);
    if (Math.random() < 0.18) s.smoke.push({ x: s.fireX + (Math.random() - 0.5) * 6, y: s.fireY - 34, life: 0 });
    for (const p of s.smoke) {
      p.y -= 1.1;
      p.x += 0.3 + Math.sin(p.life / 10) * 0.3;
      p.life++;
    }
    s.smoke = s.smoke.filter((p) => p.life < 60);
    for (const f of s.flies) {
      f.a += (Math.random() - 0.5) * 0.6;
      f.x += Math.cos(f.a) * 0.7;
      f.y += Math.sin(f.a) * 0.45;
      f.p += 0.12;
      if (f.x < 0) f.x = W;
      if (f.x > W) f.x = 0;
      f.y = Math.max(s.ground - 70, Math.min(s.ground + 60, f.y));
    }
    if (s.shooting) {
      s.shooting.x += 7;
      s.shooting.y += 2.6;
      if (++s.shooting.life > 20) s.shooting = null;
    } else if (Math.random() < 1 / 380) s.shooting = { x: Math.random() * W * 0.6, y: 10 + Math.random() * H * 0.15, life: 0 };
  },
  draw(s, t) {
    const fx = s.fireX;
    const fy = s.fireY - 3;
    ctxRef.drawImage(s.sky, 0, 0);
    drawStars(s.stars, t);
    if (s.shooting) {
      const { x, y } = s.shooting;
      for (let k = 0; k < 14; k++) px(x - k * 2.6, y - k, k < 3 ? 2 : 1, 1, `rgba(255, 255, 255, ${1 - k / 14})`);
    }
    ctxRef.drawImage(s.far, 0, 0);
    ctxRef.drawImage(s.mist, Math.round(-30 + Math.sin(t / 8000) * 24), 0);
    ctxRef.drawImage(s.land, 0, 0);
    for (const p of s.smoke) disc(Math.round(p.x), Math.round(p.y), 2 + Math.floor(p.life / 12), `rgba(150, 150, 165, ${0.13 * (1 - p.life / 60)})`);
    ctxRef.drawImage(s.front, 0, 0);
    hdCat(fx - 52, s.fireY + 3, t, FOX);

    // ---- light pass: dark woods, a warm circle round the fire that breathes with the flames
    applyLight(s.lightmap);

    // lantern inside the tent
    const lamp = Math.sin(t / 170) > 0.9;
    px(s.tentX - 1, s.tentBase - 10, 3, 5, lamp ? '#ffc25e' : '#ffe08a');
    px(s.tentX, s.tentBase - 12, 1, 2, '#3a241a');
    ctxRef.drawImage(s.tentGlow, 0, 0);

    // flames: nested tongues that lean and breathe
    const flick = 0.85 + 0.15 * Math.sin(t / 97) * Math.sin(t / 61);
    const flame = (cx, h, w0, color, ph) => {
      ctxRef.fillStyle = color;
      for (let j = 0; j < h; j++) {
        const f = j / h;
        const w = w0 * Math.pow(1 - f, 0.75) * (1 + 0.22 * Math.sin(t / 110 + j * 0.55 + ph));
        if (w < 0.4) continue;
        const off = Math.sin(t / 190 + j * 0.3 + ph) * f * 4;
        ctxRef.fillRect(Math.round(cx + off - w), fy - j, Math.max(1, Math.round(w * 2)), 1);
      }
    };
    flame(fx - 6, 17 * flick, 5, '#c93a26', 1.7);
    flame(fx + 7, 15 * flick, 4.5, '#c93a26', 4.1);
    flame(fx, 32 * flick, 9.5, '#e2552f', 0);
    flame(fx, 24 * flick, 7, '#f5913a', 0.6);
    flame(fx, 16 * flick, 4.5, '#ffd27a', 1.1);
    flame(fx, 8 * flick, 2.2, '#fff6d8', 1.4);
    for (const p of s.sparks) {
      const f = p.life / p.max;
      px(p.x, p.y, 1, 1, f < 0.4 ? '#ffe9a8' : f < 0.75 ? '#ffb04a' : '#d9552a');
    }
    if (!s.narrow) {
      // steam off the mug
      for (let j = 0; j < 6; j++) px(s.mug.x + Math.round(Math.sin(t / 400 + j * 0.7) * 1.5), s.mug.y - j * 2 - ((t / 110) % 2), 1, 2, `rgba(240, 235, 250, ${0.4 * (1 - j / 6)})`);
    }

    ctxRef.globalAlpha = 0.72 + 0.28 * flick * (0.8 + Math.random() * 0.2);
    ctxRef.drawImage(s.glowA, 0, 0);
    ctxRef.globalAlpha = 1;
    ctxRef.drawImage(s.glowB, 0, 0);

    for (const f of s.flies) {
      if (Math.sin(f.p) < 0.1) continue;
      const x = Math.round(f.x);
      const y = Math.round(f.y);
      ctxRef.fillStyle = 'rgba(200, 255, 120, 0.22)';
      ctxRef.fillRect(x - 1, y, 3, 1);
      ctxRef.fillRect(x, y - 1, 1, 3);
      if (f.big) ctxRef.fillRect(x - 2, y - 2, 5, 5);
      ctxRef.fillStyle = '#e8ff9a';
      ctxRef.fillRect(x, y, 1, 1);
    }

    // ---- foreground: the framing trees and the owl, nearest of all
    const { x: vx, y: vy } = look(t);
    const ox = -Math.round(vx * 6);
    const oy = -Math.round(vy * 3);
    ctxRef.drawImage(s.frame, ox, oy);
    px(W - 2 + ox, oy, 12, H, '#06090c'); // more trunk beyond the right edge for the slide
    owlEyes(s.owl.x + ox, s.owl.y + oy, t);
  },
};

export default camp;
