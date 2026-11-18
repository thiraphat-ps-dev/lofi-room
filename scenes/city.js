import {
  W,
  H,
  ctxRef,
  look,
  rng,
  px,
  disc,
  BAYER,
  bands,
  makeGlow,
  layer,
  shadeEllipse,
  dith,
  hash,
  stroke,
  makeStars,
  drawStars,
  makeLightmap,
  applyLight,
  makeMist,
} from './kit.js';
import { drawRoofCat } from './animals.js';

// ------------------------------------------------------------------ scene: neon city

const noteSprite = ['..n..', '..nn.', '..n.n', '..n..', '.nn..', 'nnn..', '.n...'];

function drawGlyph(g, x, y, color) {
  ctxRef.fillStyle = color;
  for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (g[j] & (1 << i)) ctxRef.fillRect(x + i, y + j, 1, 1);
}

const neon = {
  id: 'city',
  name: 'เมืองนีออน',
  en: 'Neon city',
  accent: '#ff5fd2',
  init() {
    const r = rng(41);
    const narrow = W < 420;
    const water = Math.round(H * 0.64);
    const track = water - 16; // deck of the elevated line
    const ledge = Math.round(H * 0.87); // the rooftop we are sitting on
    const sun = { x: Math.round(W * 0.68), y: Math.round(H * 0.3), r: Math.round(H * 0.12) };
    const SIGN = ['#ff5fd2', '#4ff0ff', '#ffd23f', '#9dff6a', '#ff7a5c', '#b48aff'];
    const pick = (list) => list[Math.floor(r() * list.length)];
    // made-up signage: symmetric 5x5 glyphs
    const glyph = () => {
      const rows = [];
      for (let j = 0; j < 5; j++) {
        let bits = 0;
        for (let i = 0; i < 3; i++) if (r() < 0.6) bits |= (1 << i) | (1 << (4 - i));
        rows.push(bits);
      }
      return rows;
    };
    const row = (minH, maxH, wMin, wMax) => {
      const out = [];
      let x = -6;
      while (x < W) {
        const w = wMin + Math.floor(r() * (wMax - wMin));
        out.push({ x, w, top: water - Math.round(H * (minH + r() * (maxH - minH))), kind: r(), seed: Math.floor(r() * 1000) });
        x += w + (r() < 0.25 ? 2 : 0);
      }
      return out;
    };
    const back = row(0.2, 0.46, 12, 30);
    const mid = row(0.14, 0.36, 18, 40);
    const front = row(0.1, 0.3, 26, 56);
    const signs = [];
    const tvs = [];
    const beacons = [];
    let eq = null;

    const sky = layer(() => {
      bands(0, 0, W, water, ['#0b0520', '#170a36', '#2c1152', '#521c70', '#8a2d7d', '#c2457e', '#f0708a']);
      ctxRef.drawImage(makeGlow(sun.x, sun.y, sun.r * 2.5, sun.r * 2.5, 'rgba(255, 120, 200, 0.07)', 4), 0, 0);
      // retro sun: yellow into pink, sliced by widening gaps
      shadeEllipse(sun.x, sun.y, sun.r, sun.r, (nx, ny, x, y) => {
        const v = (ny + 1) / 2;
        if (v > 0.5) {
          const low = (v - 0.5) * 2;
          if ((low * 5) % 1 < 0.16 + low * 0.42) return null;
        }
        if (v < 0.35) return dith(x, y, v / 0.35) ? '#ffd27a' : '#fff0a8';
        if (v < 0.7) return dith(x, y, (v - 0.35) / 0.35) ? '#ff8fa0' : '#ffd27a';
        return dith(x, y, (v - 0.7) / 0.3) ? '#ff5fd2' : '#ff8fa0';
      });
    });

    const city = layer(() => {
      for (const b of back) {
        px(b.x, b.top, b.w, water - b.top, '#2b1654');
        px(b.x, b.top, 1, water - b.top, '#3a2068');
        if (b.kind < 0.3) {
          px(b.x + (b.w >> 1), b.top - 14, 1, 14, '#2b1654');
          px(b.x + (b.w >> 1) - 2, b.top - 4, 5, 4, '#2b1654');
        } else if (b.kind < 0.5) px(b.x + 3, b.top - 5, b.w - 6, 5, '#2b1654');
        for (let y = b.top + 4; y < water; y += 5) for (let x = b.x + 2; x < b.x + b.w - 2; x += 4) if (r() < 0.16) px(x, y, 1, 2, '#6a48b0');
      }
      const midLit = ['#8a62d0', '#d070c8', '#5a9ae0', '#f0a0d8'];
      for (const b of mid) {
        px(b.x, b.top, b.w, water - b.top, '#1d0f40');
        px(b.x, b.top, 1, water - b.top, '#2c1858');
        px(b.x + b.w - 2, b.top, 2, water - b.top, '#160a32');
        if (b.kind < 0.35) {
          px(b.x + 4, b.top - 6, b.w - 8, 6, '#1d0f40');
          px(b.x + 8, b.top - 11, b.w - 16, 5, '#1d0f40');
        }
        for (let y = b.top + 4; y < water - 2; y += 5) for (let x = b.x + 3; x < b.x + b.w - 4; x += 5) if (r() < 0.26) px(x, y, 2, 2, pick(midLit));
      }
      const lit = ['#ff9fe4', '#8ff6ff', '#ffd98a', '#c6a4ff'];
      for (const b of front) {
        const tall = water - b.top;
        px(b.x, b.top, b.w, tall, '#120824');
        px(b.x, b.top, 2, tall, '#22124a');
        px(b.x, b.top, b.w, 1, '#3a2068');
        px(b.x + b.w - 3, b.top, 3, tall, '#0c051a');
        const own = lit[b.seed % lit.length];
        for (let y = b.top + 6; y < track - 6; y += 8) {
          px(b.x + 2, y + 5, b.w - 5, 1, '#1b0d36');
          for (let x = b.x + 5; x < b.x + b.w - 7; x += 6) {
            if (r() < 0.36) {
              px(x, y, 3, 4, r() < 0.75 ? own : pick(lit));
              px(x, y + 3, 3, 1, 'rgba(0, 0, 0, 0.25)');
              if (r() < 0.3) px(x, y, 3, 2, 'rgba(0, 0, 0, 0.3)');
              if (r() < 0.08) tvs.push({ x, y });
            } else px(x, y, 3, 4, '#1a0c34');
          }
        }
        // on the roof: a water tank, an antenna with a beacon, or vents and maybe a billboard
        if (b.kind < 0.3) {
          const tx = b.x + 5;
          px(tx, b.top - 10, 10, 8, '#1c0e38');
          px(tx, b.top - 10, 10, 1, '#3a2068');
          px(tx + 1, b.top - 12, 8, 2, '#120824');
          px(tx + 1, b.top - 2, 1, 2, '#120824');
          px(tx + 8, b.top - 2, 1, 2, '#120824');
        } else if (b.kind < 0.6) {
          const ax = b.x + Math.floor(b.w * 0.6);
          px(ax, b.top - 18, 1, 18, '#120824');
          px(ax - 2, b.top - 12, 5, 1, '#120824');
          px(ax - 1, b.top - 8, 3, 1, '#120824');
          beacons.push({ x: ax, y: b.top - 19, p: r() * 6 });
        } else {
          px(b.x + 4, b.top - 4, 7, 4, '#1c0e38');
          px(b.x + 4, b.top - 4, 7, 1, '#3a2068');
          if (b.w > 34 && r() < 0.85) {
            const w = Math.min(b.w - 16, 44);
            const count = Math.floor((w - 3) / 7);
            px(b.x + 16, b.top - 4, 1, 4, '#120824');
            px(b.x + 13 + w, b.top - 4, 1, 4, '#120824');
            signs.push({ kind: 'h', x: b.x + 13, y: b.top - 16, w: count * 7 + 3, c: pick(SIGN), p: r() * 10, glyphs: Array.from({ length: count }, glyph) });
          }
        }
        const fit = Math.min(6, Math.floor((tall - 34) / 7));
        if (fit >= 2 && r() < 0.55)
          signs.push({ kind: 'v', x: b.x + b.w - 13, y: b.top + 7, c: pick(SIGN), p: r() * 10, glyphs: Array.from({ length: fit }, glyph) });
      }
      // a big screen showing an equaliser, on a wide building near the middle
      const host = front.find((b) => b.x > W * 0.3 && b.w > 38 && water - b.top > 60) || front.find((b) => b.w > 38 && water - b.top > 60);
      if (host) {
        for (let i = signs.length - 1; i >= 0; i--) if (signs[i].kind === 'v' && signs[i].x > host.x && signs[i].x < host.x + host.w) signs.splice(i, 1);
        eq = { x: host.x + 6, y: host.top + 8, w: Math.min(host.w - 13, 38), h: 24 };
        px(eq.x - 2, eq.y - 2, eq.w + 4, eq.h + 4, '#2c1858');
        px(eq.x - 1, eq.y - 1, eq.w + 2, eq.h + 2, '#07030f');
      }
      // the elevated line: deck, railing lamps and piers standing in the water
      for (let x = 10; x < W; x += 46) {
        px(x, track + 4, 4, water - track, '#1d1036');
        px(x, track + 4, 1, water - track, '#2c1858');
        px(x - 3, track + 4, 10, 2, '#241446');
      }
      px(0, track, W, 3, '#34205e');
      px(0, track, W, 1, '#5a3a9a');
      px(0, track + 3, W, 1, '#1a0e34');
      for (let x = 4, i = 0; x < W; x += 23, i++) {
        px(x, track - 3, 1, 3, '#34205e');
        if (i % 2) px(x, track - 4, 1, 1, '#ffd98a');
      }
    });

    // mirror the skyline into the water once; the draw loop ripples it row by row
    const rh = H - water;
    const refl = document.createElement('canvas');
    refl.width = W;
    refl.height = rh;
    const rc = refl.getContext('2d');
    rc.fillStyle = '#0b0618';
    rc.fillRect(0, 0, W, rh);
    rc.save();
    rc.translate(0, rh);
    rc.scale(1, -1);
    rc.drawImage(sky, 0, water - rh, W, rh, 0, 0, W, rh);
    rc.drawImage(city, 0, water - rh, W, rh, 0, 0, W, rh);
    rc.restore();
    for (let y = 0; y < rh; y++) {
      rc.fillStyle = `rgba(11, 6, 24, ${0.42 + (y / rh) * 0.45})`;
      rc.fillRect(0, y, W, 1);
    }

    const catX = Math.round(W * (narrow ? 0.5 : 0.57));
    const boom = narrow ? null : { x: Math.round(W * 0.66), y: ledge - 15 };
    const fg = layer(() => {
      // parapet wall
      px(0, ledge, W, H - ledge, '#0d0719');
      px(0, ledge, W, 2, '#4a2a7a');
      px(0, ledge + 2, W, 1, '#1d1036');
      for (let y = ledge + 9, i = 0; y < H; y += 7, i++) {
        px(0, y, W, 1, '#170c2c');
        for (let x = i % 2 ? 0 : 9; x < W; x += 18) px(x, y - 6, 1, 6, '#170c2c');
      }
      // the cat, watching the city (its tail is drawn at run time)
      drawRoofCat(catX, ledge);
      // a can beside it
      px(catX - 20, ledge - 7, 5, 7, '#2a1d45');
      px(catX - 20, ledge - 7, 5, 1, '#8a7cb0');
      px(catX - 20, ledge - 4, 5, 1, '#ff5fd2');
      if (!narrow) {
        // plants in pots
        const pot = (x) => {
          px(x - 5, ledge - 9, 11, 9, '#1c1232');
          px(x - 6, ledge - 10, 13, 2, '#34205e');
          px(x + 4, ledge - 8, 2, 8, '#120a22');
        };
        const p1 = Math.round(W * 0.46);
        pot(p1);
        for (const [lx, ly] of [[-6, -4], [6, -5], [-8, -10], [8, -11], [-3, -12], [4, -14], [0, -18], [-5, -17], [6, -19]])
          shadeEllipse(p1 + lx, ledge - 10 + ly, 4.5, 2.6, (nx, ny) => (Math.abs(ny) < 0.2 ? '#0d2a26' : nx - ny > 0.5 ? '#2f7a6a' : '#16433c'));
        const p2 = p1 + 20;
        pot(p2);
        for (const [bx, bh] of [[-4, 14], [-2, 20], [0, 25], [2, 18], [4, 12]]) {
          for (let k = 0; k < bh; k++) px(p2 + bx + Math.round((k / bh) * (bx / 2)), ledge - 10 - k, k > bh - 3 ? 1 : 2, 1, k % 5 === 0 ? '#2f7a6a' : '#16433c');
        }
        // boombox
        const { x: bx, y: by } = boom;
        px(bx, by, 30, 15, '#1c1232');
        px(bx, by, 30, 1, '#4a2a7a');
        px(bx + 28, by, 2, 15, '#120a22');
        px(bx + 6, by - 4, 18, 1, '#34205e');
        px(bx + 6, by - 4, 1, 4, '#34205e');
        px(bx + 23, by - 4, 1, 4, '#34205e');
        stroke(bx + 27, by, bx + 34, by - 14, '#34205e');
        for (const sx of [bx + 6, bx + 23]) {
          disc(sx, by + 8, 4, '#07030f');
          disc(sx, by + 8, 2, '#34205e');
          px(sx, by + 8, 1, 1, '#8a7cb0');
        }
        px(bx + 11, by + 3, 8, 6, '#07030f');
      }
    });

    return {
      narrow,
      water,
      track,
      ledge,
      rh,
      sky,
      city,
      refl,
      fg,
      signs,
      tvs,
      beacons,
      eq,
      catX,
      boom,
      stars: makeStars(r, W * 0.2, H * 0.4, ['#f3d9ff', '#c9a8ff', '#ffffff']),
      train: { x: -400, next: 50 },
      blimp: { x: W * 0.12, y: Math.round(H * 0.17) },
      beams: [
        { x: W * 0.22, a: -1.9, v: 0.006 },
        { x: W * 0.5, a: -1.2, v: -0.005 },
        { x: W * 0.86, a: -1.6, v: 0.004 },
      ],
      haze: Array.from({ length: 6 }, () => ({ x: r() * W, y: H * 0.14 + r() * H * 0.3, w: 50 + r() * 90, v: 0.08 + r() * 0.1 })),
      cars: Array.from({ length: narrow ? 3 : 7 }, (_, i) => ({ x: r() * W, y: Math.round(H * (0.33 + (i % 3) * 0.055)), v: (i % 2 ? -1 : 1) * (1.2 + r() * 1.4) })),
      notes: [],
      // each sign washes the wall around it in its own colour
      signGlow: layer(() => {
        for (const sg of signs) {
          const w = sg.kind === 'v' ? 9 : sg.w;
          const h = sg.kind === 'v' ? sg.glyphs.length * 7 + 3 : 11;
          ctxRef.drawImage(makeGlow(sg.x + w / 2, sg.y + h / 2, w / 2 + 16, h / 2 + 14, sg.c + '1e', 3), 0, 0);
        }
        if (eq) ctxRef.drawImage(makeGlow(eq.x + eq.w / 2, eq.y + eq.h / 2, eq.w / 2 + 18, eq.h / 2 + 16, '#4ff0ff1a', 3), 0, 0);
      }),
      // pink haze rising off the water, hiding the feet of the skyline
      fog: makeMist(water - 80, water - 30, water - 17, 'rgba(240, 120, 175, 0.24)', 0.7, W + 24),
      lightmap: makeLightmap('#ffffff', [], { vignette: 0.45 }),
      // string lights over the rooftop, right above us
      festoon: (() => {
        const x0 = Math.round(W * (narrow ? 0.05 : 0.22));
        const x1 = W + 12;
        const sag = H * 0.13;
        const wire = [];
        for (let x = x0; x <= x1; x++) {
          const f = (x - x0) / (x1 - x0);
          wire.push([x, Math.round(-6 + f * (H * 0.05 + 6) + Math.sin(f * Math.PI) * sag)]);
        }
        return { wire, bulbs: wire.filter((_, i) => i % 19 === 9) };
      })(),
    };
  },
  update(s) {
    for (const h of s.haze) {
      h.x += h.v;
      if (h.x > W) h.x = -h.w;
    }
    s.blimp.x += 0.18;
    if (s.blimp.x > W + 50) s.blimp.x = -60;
    for (const b of s.beams) {
      b.a += b.v;
      if (b.a < -2.3 || b.a > -0.8) b.v *= -1;
    }
    for (const c of s.cars) {
      c.x += c.v;
      if (c.x > W + 10) c.x = -10;
      if (c.x < -10) c.x = W + 10;
    }
    const tr = s.train;
    if (tr.x > -400) {
      tr.x += 6;
      if (tr.x > W + 20) {
        tr.x = -400;
        tr.next = 110 + Math.floor(Math.random() * 150);
      }
    } else if (--tr.next <= 0) tr.x = -260;
    if (s.boom && Math.random() < 0.07) s.notes.push({ x: s.boom.x + 8 + Math.random() * 14, y: s.boom.y - 6, life: 0, c: Math.random() < 0.5 ? '#ff8fe0' : '#7ff6ff', p: Math.random() * 6 });
    for (const n of s.notes) {
      n.y -= 0.7;
      n.life++;
    }
    s.notes = s.notes.filter((n) => n.life < 46);
  },
  draw(s, t) {
    const { water, track, ledge } = s;
    ctxRef.drawImage(s.sky, 0, 0);
    drawStars(s.stars, t);
    // searchlights sweeping the haze
    ctxRef.fillStyle = 'rgba(220, 200, 255, 0.08)';
    for (const b of s.beams) {
      for (let d = 0; d < H * 0.85; d += 1) {
        const x = Math.round(b.x + Math.cos(b.a) * d);
        const y = Math.round(water - H * 0.1 + Math.sin(b.a) * d);
        if (BAYER[y & 3][x & 3] < 9) {
          const w = 1 + d * 0.08;
          ctxRef.fillRect(Math.round(x - w / 2), y, Math.round(w), 1);
        }
      }
    }
    for (const h of s.haze) {
      const x = Math.round(h.x);
      const y = Math.round(h.y);
      const w = Math.round(h.w);
      px(x, y, w, 1, 'rgba(255, 140, 220, 0.14)');
      px(x + 8, y + 1, w - 20, 1, 'rgba(255, 140, 220, 0.1)');
      px(x + 14, y - 1, w - 36, 1, 'rgba(255, 170, 230, 0.1)');
    }
    // traffic in the sky lanes
    for (const c of s.cars) {
      const dir = Math.sign(c.v);
      px(c.x - dir * 5, c.y, 5, 1, 'rgba(255, 255, 255, 0.14)');
      px(c.x, c.y, 3, 1, dir > 0 ? '#fff3c0' : '#ff5a6a');
    }
    // blimp with a scrolling light strip
    const bx = Math.round(s.blimp.x);
    const by = s.blimp.y;
    px(bx - 31, by - 7, 7, 5, '#2c1d50');
    px(bx - 31, by + 3, 7, 5, '#2c1d50');
    shadeEllipse(bx, by, 26, 8, (nx, ny) => (ny < -0.45 ? '#5a4690' : ny > 0.5 ? '#241640' : '#3a2a66'));
    px(bx - 6, by + 8, 12, 3, '#1c1232');
    for (let k = 0; k < 3; k++) px(bx - 4 + k * 4, by + 9, 2, 1, '#ffe7a1');
    const strip = Math.floor(t / 2400) % 2 ? '#4ff0ff' : '#ff5fd2';
    for (let k = 0; k < 15; k++) px(bx - 15 + k * 2, by - 1, 1, 3, (k + Math.floor(t / 160)) % 5 < 3 ? strip : '#2a1d45');
    if (Math.floor(t / 700) % 2) px(bx + 26, by, 1, 1, '#ff3b3b');

    // ---- the city and the water, a little behind the rooftop: they drift with the view
    const { x: vx, y: vy } = look(t);
    ctxRef.save();
    ctxRef.translate(Math.round(vx * 2), 0);
    ctxRef.drawImage(s.city, 0, 0);
    ctxRef.drawImage(s.signGlow, 0, 0);
    for (const tv of s.tvs) px(tv.x, tv.y, 3, 3, Math.floor(t / 170 + tv.x) % 3 ? '#6fa8ff' : '#d5e8ff');
    for (const b of s.beacons) if (Math.sin(t / 450 + b.p) > 0.2) {
      px(b.x - 1, b.y - 1, 3, 3, 'rgba(255, 60, 60, 0.3)');
      px(b.x, b.y, 1, 1, '#ff4a4a');
    }
    // neon signs: mostly steady, with the odd flicker
    for (const sg of s.signs) {
      const on = Math.sin(t / 500 + sg.p) > -0.8 && Math.floor(t / 80 + sg.p * 7) % 47 !== 0;
      const c = on ? sg.c : '#3a2050';
      const vertical = sg.kind === 'v';
      const w = vertical ? 9 : sg.w;
      const h = vertical ? sg.glyphs.length * 7 + 3 : 11;
      if (on) px(sg.x - 2, sg.y - 2, w + 4, h + 4, sg.c + '22');
      px(sg.x, sg.y, w, h, '#0b0618');
      px(sg.x, sg.y, w, 1, c);
      px(sg.x, sg.y + h - 1, w, 1, c);
      px(sg.x, sg.y, 1, h, c);
      px(sg.x + w - 1, sg.y, 1, h, c);
      sg.glyphs.forEach((g, i) => drawGlyph(g, sg.x + 2 + (vertical ? 0 : i * 7), sg.y + 3 + (vertical ? i * 7 : 0), on ? '#ffffff' : c));
      if (on) sg.glyphs.forEach((g, i) => drawGlyph(g, sg.x + 2 + (vertical ? 0 : i * 7), sg.y + 3 + (vertical ? i * 7 : 0), sg.c + 'aa'));
    }
    // the big screen: equaliser bars, cyan below and pink on top
    if (s.eq) {
      const e = s.eq;
      const n = Math.floor(e.w / 5);
      for (let i = 0; i < n; i++) {
        const level = Math.abs(Math.sin(t / 230 + i * 1.3) * Math.sin(t / 370 + i * 0.7));
        const bh = Math.round((0.2 + 0.8 * level) * (e.h - 3));
        const x = e.x + 1 + i * 5;
        px(x, e.y + e.h - 1 - bh, 4, bh, '#4ff0ff');
        if (bh > e.h * 0.55) px(x, e.y + e.h - 1 - bh, 4, Math.round(bh - e.h * 0.55), '#ff5fd2');
        px(x, e.y + e.h - 3 - bh, 4, 1, '#ffffff');
      }
    }
    // the night train
    const tr = s.train;
    if (tr.x > -400) {
      const x0 = Math.round(tr.x);
      for (let c = 0; c < 4; c++) {
        const cx = x0 + c * 60;
        px(cx, track - 13, 58, 11, '#d8d2ef');
        px(cx, track - 13, 58, 2, '#f4f0ff');
        px(cx, track - 6, 58, 1, '#ff5fd2');
        px(cx, track - 5, 58, 3, '#7a6fa8');
        for (let k = 4; k < 52; k += 8) {
          px(cx + k, track - 11, 6, 4, '#ffe7a1');
          if ((k + c) % 3 === 0) px(cx + k + 2, track - 10, 2, 3, '#5a4a6a');
        }
        px(cx + 4, track - 2, 6, 2, '#1d1036');
        px(cx + 46, track - 2, 6, 2, '#1d1036');
      }
      px(x0 + 238, track - 9, 2, 3, '#ffffff');
      for (let k = 0; k < 34; k++) if (dith(k, 0, 0.9 * (1 - k / 34))) px(x0 + 240 + k, track - 9 - k / 12, 1, 3 + k / 5, 'rgba(255, 250, 215, 0.22)');
    }

    ctxRef.drawImage(s.fog, Math.round(-12 + Math.sin(t / 6000) * 10), 0);

    // water: the mirrored skyline, wobbling a little more with depth
    px(-8, water, W + 16, s.rh, '#0b0618');
    for (let y = 0; y < s.rh; y += 2) {
      const off = Math.round(Math.sin(y / 5 + t / 520) * (1 + y / 40));
      ctxRef.drawImage(s.refl, 0, y, W, 2, off, water + y, W, 2);
    }
    const tick = Math.floor(t / 170);
    for (const sg of s.signs) {
      const w = sg.kind === 'v' ? 9 : sg.w;
      for (let y = water + 3; y < Math.min(ledge, water + 70); y += 2) {
        if ((y + tick + sg.x) % 5 === 0) continue;
        px(sg.x + ((y + tick) % 3) - 1, y, w, 1, sg.c + '2e');
      }
    }
    if (s.eq)
      for (let y = 2 * water - s.eq.y - s.eq.h; y < Math.min(ledge, 2 * water - s.eq.y); y += 2)
        if ((y + tick) % 4) px(s.eq.x + ((y + tick) % 3) - 1, y, s.eq.w, 1, (y + tick) % 3 ? '#4ff0ff30' : '#ff5fd230');
    if (tr.x > -400)
      for (let y = water + 2; y < water + 26; y += 3) px(Math.round(tr.x) + ((y + tick) % 4), y, 240, 1, 'rgba(255, 231, 161, 0.13)');
    px(-8, water, W + 16, 1, '#3a2160');
    ctxRef.fillStyle = 'rgba(255, 190, 240, 0.2)';
    for (let i = 0; i < W / 9; i++) {
      const a = hash(i * 7.31 + Math.floor(t / 400 + i * 0.3));
      ctxRef.fillRect(Math.round(hash(i * 3.7) * W), Math.round(water + 4 + a * (ledge - water - 6)), 3 + Math.floor(a * 6), 1);
    }

    ctxRef.restore();

    // ---- the rooftop we sit on, nearest of all
    ctxRef.save();
    ctxRef.translate(-Math.round(vx * 5), -Math.round(vy * 2));
    px(-12, ledge, W + 24, H - ledge, '#0d0719'); // spare wall beyond both edges for the slide
    ctxRef.drawImage(s.fg, 0, 0);
    // the cat's tail sweeps along the ledge
    const swing = Math.sin(t / 700);
    for (let k = 0; k < 18; k++) {
      const lift = k > 9 ? (k - 9) * (0.55 + swing * 0.45) : 0;
      px(s.catX + 6 + k, ledge - 3 - lift, 2, 3, '#2b1a4a');
      px(s.catX + 6 + k, ledge - 4 - lift, 2, 1, '#d868e0');
    }
    if (s.boom) {
      const { x, y } = s.boom;
      for (let i = 0; i < 4; i++) {
        const level = Math.abs(Math.sin(t / 210 + i * 1.7));
        px(x + 12 + i * 2, y + 8 - Math.round(level * 4), 1, 1 + Math.round(level * 4), i % 2 ? '#4ff0ff' : '#ff5fd2');
      }
      if (Math.floor(t / 500) % 2) px(x + 2, y + 2, 1, 1, '#ff3b3b');
      for (const n of s.notes) {
        if (n.life > 36 && n.life % 2) continue;
        const nx = Math.round(n.x + Math.sin(n.life / 6 + n.p) * 3);
        ctxRef.fillStyle = n.c;
        for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (noteSprite[j][i] === 'n') ctxRef.fillRect(nx + i, Math.round(n.y) + j, 1, 1);
      }
    }
    ctxRef.restore();

    applyLight(s.lightmap);
    ctxRef.save();
    ctxRef.translate(-Math.round(vx * 9), -Math.round(vy * 4));
    for (const [x, y] of s.festoon.wire) px(x, y, 1, 1, '#1a0e2c');
    s.festoon.bulbs.forEach(([x, y], i) => {
      const swing = Math.round(Math.sin(t / 1300 + i) * 0.6);
      const bright = Math.sin(t / 900 + i * 2.1) > -0.6;
      px(x + swing, y + 1, 1, 2, '#1a0e2c');
      if (bright) {
        px(x - 3 + swing, y + 1, 7, 8, 'rgba(255, 210, 140, 0.07)');
        px(x - 1 + swing, y + 2, 3, 5, 'rgba(255, 210, 140, 0.16)');
      }
      px(x + swing - 1, y + 3, 3, 3, bright ? '#ffd98a' : '#8a6a4a');
      if (bright) px(x + swing, y + 3, 1, 1, '#fffbe8');
    });
    ctxRef.restore();
  },
};

export default neon;
