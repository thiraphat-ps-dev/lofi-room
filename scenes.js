// Full-screen pixel scenes. Each scene draws into a low-resolution canvas (about 180 px tall)
// that CSS scales up with crisp pixels, so the art fills any screen shape.
(() => {
  'use strict';

  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STEP = 1000 / 12; // pixel art reads best at a low, steady frame rate
  const TARGET_H = 180;

  let W = 0;
  let H = 0;
  let current = null;
  let state = null;

  // ------------------------------------------------------------------ helpers
  // Every helper draws to `ctxRef`: the screen, or an offscreen layer while one is being built.
  let ctxRef = ctx;

  function rng(seed) {
    let s = seed % 2147483647 || 1;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  }

  function px(x, y, w, h, color) {
    ctxRef.fillStyle = color;
    ctxRef.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function disc(cx, cy, r, color) {
    ctxRef.fillStyle = color;
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      ctxRef.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
    }
  }

  function sprite(rows, palette) {
    return { rows, palette, w: rows[0].length, h: rows.length };
  }

  function blit(s, x, y) {
    for (let j = 0; j < s.h; j++) {
      for (let i = 0; i < s.w; i++) {
        const ch = s.rows[j][i];
        if (ch === '.') continue;
        ctxRef.fillStyle = s.palette[ch];
        ctxRef.fillRect(Math.round(x) + i, Math.round(y) + j, 1, 1);
      }
    }
  }

  const BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];

  /** Horizontal bands of colour, blended into each other with an ordered dither. */
  function bands(x0, y0, w, h, colors) {
    const n = colors.length;
    for (let y = 0; y < h; y++) {
      const f = (y / h) * (n - 1);
      const i = Math.min(n - 2, Math.floor(f));
      const t = f - i;
      for (let x = 0; x < w; x++) {
        ctxRef.fillStyle = t * 16 > BAYER[(y0 + y) & 3][(x0 + x) & 3] ? colors[i + 1] : colors[i];
        ctxRef.fillRect(x0 + x, y0 + y, 1, 1);
      }
    }
  }

  /** Pre-rendered dithered light pool: stacked translucent pixels that fade with distance. */
  function makeGlow(cx, cy, rx, ry, color, layers = 3) {
    const g = document.createElement('canvas');
    g.width = W;
    g.height = H;
    const c = g.getContext('2d');
    c.fillStyle = color;
    for (let y = Math.max(0, Math.floor(cy - ry)); y < Math.min(H, cy + ry); y++) {
      for (let x = Math.max(0, Math.floor(cx - rx)); x < Math.min(W, cx + rx); x++) {
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
        if (d >= 1) continue;
        const level = (1 - d) * layers;
        for (let k = 0; k < layers; k++) {
          const t = level - k;
          if (t <= 0) break;
          if (t >= 1 || t * 16 > BAYER[y & 3][x & 3]) c.fillRect(x, y, 1, 1);
        }
      }
    }
    return g;
  }

  /** Draw the static part of a scene once into an offscreen layer. */
  function layer(draw) {
    const g = document.createElement('canvas');
    g.width = W;
    g.height = H;
    const saved = ctxRef;
    ctxRef = g.getContext('2d');
    draw();
    ctxRef = saved;
    return g;
  }

  // ------------------------------------------------------------------ shared sprites

  const catPal = { o: '#e39a52', d: '#b96c2f', w: '#f5e2c4', e: '#4a2c1c', p: '#f29a9a' };
  const cat = sprite(
    [
      '.............o..o...',
      '............oooooo..',
      '.....dddd...oeooeo..',
      '...ddooooddoooppooo.',
      '..doooooooooooooooo.',
      '.dooodoooodoooooooo.',
      '.ooooooooooooooooo..',
      '..wwwwwooooooowwww..',
    ],
    catPal,
  );
  const catTails = [
    sprite(['..oo', '.o..', 'o...', 'o...'], catPal),
    sprite(['....', '.oo.', 'o..o', 'o...'], catPal),
  ];
  const mug = sprite(
    ['.wwwww..', '.wrrrw..', '.wrrrwww', '.wrrrw.w', '.wrrrwww', '.wwwww..', '..www...'],
    { w: '#e9e2f2', r: '#5a2f24' },
  );
  const plant = sprite(
    ['...g..g...', '..gGg.gg..', '.gGGggGg..', 'gg.gGGg.g.', '...gGg....', '..ppppp...', '..pPPPp...', '..pPPPp...', '...ppp....'],
    { g: '#4f9d5b', G: '#6fc27a', p: '#b5643e', P: '#cf7a4f' },
  );
  const books = sprite(['bbbbbbbbbb', 'BBBBBBBBBB', 'rrrrrrrrr.', 'RRRRRRRRR.', 'tttttttttt'], {
    b: '#4a6fb3',
    B: '#3a5891',
    r: '#b0495c',
    R: '#8c3849',
    t: '#d9b46a',
  });

  function sleepyCat(x, y, t) {
    blit(catTails[Math.floor(t / 900) % 5 === 0 ? 1 : 0], x - 3, y + 4);
    blit(cat, x, y);
    if (Math.floor(t / 1600) % 2) px(x + 3, y + 3, 6, 1, catPal.d);
    const zt = (t / 1200) % 3;
    if (zt < 2) {
      const zx = x + 18 + Math.floor(zt * 2);
      const zy = y - 4 - Math.floor(zt * 4);
      ctxRef.fillStyle = 'rgba(244, 233, 216, 0.75)';
      ctxRef.fillRect(zx, zy, 3, 1);
      ctxRef.fillRect(zx + 1, zy + 1, 1, 1);
      ctxRef.fillRect(zx, zy + 2, 3, 1);
    }
  }

  function steam(x, y, t) {
    const s = Math.floor(t / 300) % 4;
    ctxRef.fillStyle = 'rgba(233, 226, 242, 0.55)';
    ctxRef.fillRect(x + (s % 2), y - s, 1, 2);
    ctxRef.fillRect(x + 2 - (s % 2), y - 3 - s, 1, 2);
    ctxRef.fillRect(x + 1, y - 6 - ((s + 2) % 4), 1, 2);
  }

  // ------------------------------------------------------------------ scene: rainy room

  const rainyRoom = {
    id: 'room',
    name: 'ห้องฝนตก',
    accent: '#ffb35c',
    init() {
      const r = rng(7);
      const win = {
        x: W < 200 ? 6 : Math.round(W * 0.07),
        y: Math.round(H * 0.1),
        w: W < 200 ? W - 12 : Math.min(Math.round(W * 0.56), 300),
        h: Math.round(H * 0.4),
      };
      const deskY = Math.round(H * 0.62);
      const lampX = W < 200 ? W - 24 : Math.round(W * 0.82);
      const buildings = [];
      let x = win.x - 2;
      while (x < win.x + win.w) {
        const w = 8 + Math.floor(r() * 14);
        const top = win.y + Math.round(win.h * 0.3) + Math.floor(r() * win.h * 0.45);
        const windows = [];
        for (let wy = top + 3; wy < win.y + win.h - 2; wy += 4)
          for (let wx = x + 2; wx < x + w - 2; wx += 3) if (r() < 0.35) windows.push({ x: wx, y: wy, on: r() < 0.8 });
        buildings.push({ x, w, top, color: ['#10152f', '#151b3a', '#1a2045'][Math.floor(r() * 3)], windows });
        x += w + (r() < 0.3 ? 2 : 0);
      }
      const bg = layer(() => {
        px(0, 0, W, H, '#2b2142');
        for (let i = 4; i < W; i += 8) px(i, 0, 1, H, '#30254a');
        bands(win.x, win.y, win.w, win.h, ['#0c1130', '#121a3f', '#1b2350', '#262a5c']);
        disc(win.x + win.w * 0.8, win.y + 12, 5, '#f3e7c4');
      });
      return {
        win,
        deskY,
        lampX,
        bg,
        buildings,
        glow: makeGlow(lampX + 12, deskY - 20, 110, 90, 'rgba(255, 179, 92, 0.10)'),
        rain: Array.from({ length: Math.round(win.w * 0.6) }, () => ({
          x: win.x + r() * win.w,
          y: win.y + r() * win.h,
          v: 3 + Math.floor(r() * 3),
        })),
        drops: Array.from({ length: Math.round(win.w / 7) }, () => ({
          x: win.x + 2 + Math.floor(r() * (win.w - 4)),
          y: win.y + Math.floor(r() * win.h),
          slide: r() < 0.4,
        })),
      };
    },
    update(s) {
      const { win } = s;
      for (const d of s.rain) {
        d.y += d.v;
        d.x -= 1;
        if (d.y > win.y + win.h) {
          d.y = win.y - 3;
          d.x = win.x + Math.random() * (win.w + 20);
        }
      }
      for (const d of s.drops) {
        if (d.slide && Math.random() < 0.3) d.y += 1;
        if (d.y > win.y + win.h) {
          d.y = win.y;
          d.x = win.x + 2 + Math.floor(Math.random() * (win.w - 4));
        }
      }
    },
    draw(s, t) {
      const { win, deskY, lampX } = s;
      ctxRef.drawImage(s.bg, 0, 0);
      ctxRef.save();
      ctxRef.beginPath();
      ctxRef.rect(win.x, win.y, win.w, win.h);
      ctxRef.clip();
      const tick = Math.floor(t / 2500);
      s.buildings.forEach((b, bi) => {
        px(b.x, b.top, b.w, win.y + win.h - b.top, b.color);
        b.windows.forEach((w, wi) => {
          const on = w.on !== ((bi * 31 + wi * 17 + tick) % 97 === 0);
          if (on) px(w.x, w.y, 1, 2, (wi + bi) % 3 ? '#ffd27a' : '#c99a4e');
        });
      });
      ctxRef.fillStyle = '#7b8ccf';
      for (const d of s.rain) ctxRef.fillRect(Math.round(d.x), Math.round(d.y), 1, 3);
      ctxRef.restore();
      ctxRef.fillStyle = '#b9c6f2';
      for (const d of s.drops) {
        ctxRef.fillRect(d.x, d.y, 1, 1);
        if (d.slide) ctxRef.fillRect(d.x, d.y - 1, 1, 1);
      }
      // frame
      const f = '#5b4672';
      px(win.x - 4, win.y - 4, win.w + 8, 4, f);
      px(win.x - 4, win.y + win.h, win.w + 8, 4, f);
      px(win.x - 4, win.y, 4, win.h, f);
      px(win.x + win.w, win.y, 4, win.h, f);
      px(win.x + Math.floor(win.w / 2) - 1, win.y, 3, win.h, f);
      px(win.x, win.y + Math.floor(win.h / 2) - 1, win.w, 2, f);
      px(win.x - 4, win.y - 4, win.w + 8, 1, '#7a6194');
      px(win.x - 8, win.y + win.h + 4, win.w + 16, 3, '#6d5585');
      // desk
      px(0, deskY, W, 3, '#94664c');
      px(0, deskY + 3, W, 4, '#7a523d');
      px(0, deskY + 7, W, H - deskY - 7, '#563728');
      px(0, deskY + 7, W, 1, '#3d271d');
      for (let x = 12; x < W; x += 56) px(x, deskY + 14, 30, 1, '#3d271d');
      // lamp
      px(lampX - 8, deskY - 2, 18, 2, '#3b3150');
      px(lampX, deskY - 26, 2, 24, '#4b4064');
      px(lampX + 1, deskY - 27, 14, 2, '#4b4064');
      px(lampX + 10, deskY - 30, 14, 6, '#e7a24c');
      px(lampX + 9, deskY - 24, 16, 1, '#c27b2c');
      px(lampX + 14, deskY - 23, 6, 2, '#fff1c9');
      // props
      const mx = W < 200 ? win.x + 12 : Math.round(W * 0.64);
      blit(mug, mx, deskY - 7);
      steam(mx + 3, deskY - 10, t);
      if (W >= 200) {
        blit(books, lampX - 46, deskY - 5);
        blit(plant, lampX - 30, deskY - 9);
      }
      sleepyCat(W < 200 ? win.x + Math.round(win.w * 0.45) : Math.round(W * 0.5), deskY - cat.h + 1, t);
      ctxRef.drawImage(s.glow, 0, 0);
    },
  };

  // ------------------------------------------------------------------ scene: seaside sunset

  const seaside = {
    id: 'sea',
    name: 'ทะเลยามเย็น',
    accent: '#ff9e6b',
    init() {
      const r = rng(11);
      const horizon = Math.round(H * 0.56);
      const shore = Math.round(H * 0.8);
      const sunX = Math.round(W * 0.64);
      const bg = layer(() => {
        bands(0, 0, W, horizon, ['#2a1a4f', '#53285f', '#9c3c62', '#e0654f', '#f7a45c', '#ffd383']);
        // retro sun with stripes cut through its lower half
        disc(sunX, horizon - 2, 22, '#ffe7a1');
        for (let k = 0; k < 6; k++) px(sunX - 24, horizon - 12 + k * 3, 48, 1 + (k > 2 ? 1 : 0), k % 2 ? '#f7a45c' : '#ffb871');
        bands(0, horizon, W, shore - horizon, ['#5a3a7a', '#3c2c66', '#2a2153']);
        bands(0, shore, W, H - shore, ['#e3b07a', '#d39a63', '#b97f50']);
      });
      return {
        horizon,
        shore,
        sunX,
        bg,
        clouds: Array.from({ length: Math.max(3, Math.round(W / 70)) }, () => ({
          x: r() * W,
          y: 8 + r() * horizon * 0.5,
          w: 14 + Math.floor(r() * 26),
          v: 0.05 + r() * 0.12,
        })),
        birds: Array.from({ length: 3 }, (_, i) => ({ x: r() * W, y: 18 + i * 9 + r() * 10, v: 0.25 + r() * 0.2 })),
        waves: Array.from({ length: Math.round(W / 6) }, () => ({
          x: r() * W,
          y: horizon + 2 + r() * (shore - horizon - 4),
          len: 3 + Math.floor(r() * 7),
        })),
        palmX: W < 200 ? 10 : Math.round(W * 0.12),
      };
    },
    update(s) {
      for (const c of s.clouds) {
        c.x += c.v;
        if (c.x > W + 30) c.x = -c.w - 10;
      }
      for (const b of s.birds) {
        b.x += b.v;
        if (b.x > W + 10) {
          b.x = -10;
          b.y = 14 + Math.random() * s.horizon * 0.4;
        }
      }
      for (const w of s.waves) {
        w.x -= 0.4;
        if (w.x < -10) w.x = W + Math.random() * 10;
      }
    },
    draw(s, t) {
      const { horizon, shore, sunX } = s;
      ctxRef.drawImage(s.bg, 0, 0);
      for (const c of s.clouds) {
        px(c.x, c.y, c.w, 2, '#c8587a');
        px(c.x + 3, c.y - 2, c.w - 8, 2, '#d96a85');
        px(c.x + 6, c.y + 2, c.w - 4, 1, '#a9466c');
      }
      // sun glitter on the water
      const tick = Math.floor(t / 200);
      for (let y = horizon + 2; y < shore - 2; y += 2) {
        const spread = 4 + ((y - horizon) / (shore - horizon)) * 22;
        const off = ((y * 7 + tick * 3) % 9) - 4;
        px(sunX - spread / 2 + off, y, Math.max(2, spread * (0.4 + ((y + tick) % 3) * 0.2)), 1, '#ffcf8a');
      }
      ctxRef.fillStyle = '#7a5aa0';
      for (const w of s.waves) ctxRef.fillRect(Math.round(w.x), Math.round(w.y), w.len, 1);
      // foam on the shore, breathing in and out
      const reach = Math.round(2 + 2 * Math.sin(t / 900));
      for (let x = 0; x < W; x++) {
        const y = shore + Math.round(Math.sin(x / 9 + t / 1200) * 1.5);
        px(x, y - 1, 1, reach, '#f6efe4');
      }
      // birds
      const flap = Math.floor(t / 250) % 2;
      for (const b of s.birds) {
        px(b.x - 2, b.y - flap, 2, 1, '#3a1d3f');
        px(b.x, b.y, 1, 1, '#3a1d3f');
        px(b.x + 1, b.y - flap, 2, 1, '#3a1d3f');
      }
      // palm tree silhouette, fronds swaying
      const pxx = s.palmX;
      const sway = Math.round(Math.sin(t / 700) * 1.5);
      for (let k = 0; k < Math.round(H * 0.55); k++) {
        const bend = Math.round(Math.pow(k / (H * 0.55), 2) * 10);
        px(pxx + bend, H - 6 - k, 3, 1, '#24123a');
      }
      const topX = pxx + 10;
      const topY = Math.round(H - 6 - H * 0.55);
      [
        [-1, -0.35],
        [1, -0.25],
        [-1, 0.25],
        [1, 0.35],
        [0.2, -0.9],
      ].forEach(([dir, lift], i) => {
        for (let k = 0; k < 18; k++) {
          const x = topX + dir * k + (i % 2 ? sway : -sway) * (k / 18);
          const y = topY + lift * k + (k * k) / 40;
          px(x, y, 2, 1, '#24123a');
          if (k % 3 === 0) px(x, y + 1, 1, 2, '#24123a');
        }
      });
    },
  };

  // ------------------------------------------------------------------ scene: snowy cabin

  const cabin = {
    id: 'snow',
    name: 'กระท่อมหิมะ',
    accent: '#9fe3ff',
    init() {
      const r = rng(23);
      const ground = Math.round(H * 0.72);
      const cabinX = W < 200 ? Math.round(W * 0.35) : Math.round(W * 0.58);
      const cabinY = ground - 26;
      const stars = Array.from({ length: Math.round(W * 0.25) }, () => ({ x: r() * W, y: r() * H * 0.5, p: r() * 6 }));
      const ridge = [];
      for (let x = 0; x < W; x++) ridge.push(Math.round(H * 0.45 + Math.sin(x / 23) * 8 + Math.sin(x / 9 + 2) * 3 + Math.sin(x / 47) * 10));
      const trees = [];
      for (let i = 0; i < Math.round(W / 14); i++) {
        const x = Math.round(r() * W);
        if (Math.abs(x - cabinX - 18) < 30) continue;
        trees.push({ x, base: ground + Math.round(r() * 6), h: 18 + Math.floor(r() * 22) });
      }
      trees.sort((a, b) => a.base - b.base);
      const bg = layer(() => {
        bands(0, 0, W, ground, ['#070b1f', '#0d1636', '#15244a', '#1f3358']);
        disc(Math.round(W * 0.36), 20, 7, '#eef3ff');
        disc(Math.round(W * 0.36) + 3, 18, 6, '#0d1636');
        // mountains with snow caps
        for (let x = 0; x < W; x++) {
          px(x, ridge[x], 1, ground - ridge[x], '#2b3f66');
          px(x, ridge[x], 1, 3, '#c9d8f0');
        }
        bands(0, ground, W, H - ground, ['#d9e6f7', '#b9cbe6', '#9fb4d6']);
        // trees behind and in front
        for (const tr of trees) {
          for (let k = 0; k < tr.h; k++) {
            const half = Math.floor(((k % 7) + 1) * 0.5 + (k / tr.h) * 5);
            px(tr.x - half, tr.base - tr.h + k, half * 2 + 1, 1, k % 7 === 0 ? '#e6eefb' : '#16324a');
          }
          px(tr.x - 1, tr.base, 2, 3, '#3b2a20');
        }
        // cabin
        px(cabinX, cabinY, 38, 26, '#6b4431');
        for (let y = cabinY + 3; y < cabinY + 26; y += 4) px(cabinX, y, 38, 1, '#57372a');
        for (let k = 0; k < 14; k++) px(cabinX - 4 + k, cabinY - k, 46 - k * 2, 1, k < 3 ? '#e9f1fb' : '#4a2f25');
        for (let k = 0; k < 14; k++) px(cabinX - 4 + k, cabinY - k - 1, 46 - k * 2, 1, '#e9f1fb');
        px(cabinX + 28, cabinY - 18, 5, 10, '#5a5560');
        px(cabinX + 5, cabinY + 8, 8, 7, '#ffcf6e');
        px(cabinX + 8, cabinY + 8, 1, 7, '#6b4431');
        px(cabinX + 5, cabinY + 11, 8, 1, '#6b4431');
        px(cabinX + 18, cabinY + 10, 7, 16, '#3c271e');
        px(cabinX + 28, cabinY + 8, 6, 6, '#ffcf6e');
      });
      return {
        ground,
        cabinX,
        cabinY,
        stars,
        bg,
        glow: makeGlow(cabinX + 18, cabinY + 14, 60, 30, 'rgba(255, 200, 110, 0.12)'),
        snow: Array.from({ length: Math.round(W * 0.8) }, () => ({ x: r() * W, y: r() * H, v: 0.4 + r() * 0.8, p: r() * 6 })),
        smoke: [],
      };
    },
    update(s) {
      for (const f of s.snow) {
        f.y += f.v;
        f.p += 0.1;
        if (f.y > H) {
          f.y = -2;
          f.x = Math.random() * W;
        }
      }
      if (Math.random() < 0.25) s.smoke.push({ x: s.cabinX + 30, y: s.cabinY - 19, life: 0 });
      for (const p of s.smoke) {
        p.y -= 0.6;
        p.x += 0.35;
        p.life++;
      }
      s.smoke = s.smoke.filter((p) => p.life < 40);
    },
    draw(s, t) {
      ctxRef.drawImage(s.bg, 0, 0);
      // stars twinkle
      for (const st of s.stars) if (Math.sin(t / 700 + st.p) > -0.3) px(st.x, st.y, 1, 1, '#dfe8ff');
      // aurora ribbon
      for (let x = 0; x < W; x++) {
        const y = Math.round(H * 0.18 + Math.sin(x / 31 + t / 3000) * 9 + Math.sin(x / 13 + t / 1700) * 3);
        const h = 6 + Math.round(Math.sin(x / 17 + t / 2200) * 3);
        for (let k = 0; k < h; k++) {
          if ((k + x) % 3 === 0 || BAYER[(y + k) & 3][x & 3] > 8 + k * 1.2) continue;
          px(x, y + k, 1, 1, k < 2 ? 'rgba(160, 255, 200, 0.55)' : 'rgba(90, 210, 170, 0.28)');
        }
      }
      for (const p of s.smoke) {
        const a = 0.5 * (1 - p.life / 40);
        ctxRef.fillStyle = `rgba(200, 205, 220, ${a})`;
        ctxRef.fillRect(Math.round(p.x), Math.round(p.y), p.life > 20 ? 2 : 1, p.life > 20 ? 2 : 1);
      }
      ctxRef.drawImage(s.glow, 0, 0);
      ctxRef.fillStyle = '#ffffff';
      for (const f of s.snow) ctxRef.fillRect(Math.round(f.x + Math.sin(f.p) * 1.5), Math.round(f.y), 1, 1);
    },
  };

  // ------------------------------------------------------------------ scene: neon city

  const neon = {
    id: 'city',
    name: 'เมืองนีออน',
    accent: '#ff5fd2',
    init() {
      const r = rng(41);
      const trackY = Math.round(H * 0.7);
      const skyline = (minH, maxH, color, litColors, density) => {
        const out = [];
        let x = -4;
        while (x < W) {
          const w = 10 + Math.floor(r() * 18);
          const h = minH + Math.floor(r() * (maxH - minH));
          const lit = [];
          for (let y = trackY - h + 3; y < trackY; y += 3)
            for (let xx = x + 2; xx < x + w - 1; xx += 3) if (r() < density) lit.push({ x: xx, y, c: litColors[Math.floor(r() * litColors.length)] });
          out.push({ x, w, top: trackY - h, color, lit, sign: r() < 0.25 ? { c: r() < 0.5 ? '#ff5fd2' : '#4ff0ff', phase: r() * 10 } : null });
          x += w + 1;
        }
        return out;
      };
      const back = skyline(30, 80, '#2a1550', ['#5a3a9a'], 0.15);
      const front = skyline(16, 55, '#160b2c', ['#ff8fe0', '#7ff6ff', '#ffd27a'], 0.22);
      const bg = layer(() => {
        bands(0, 0, W, trackY, ['#0e0620', '#241047', '#4a1a6b', '#8a2d7d', '#c2457e']);
        disc(Math.round(W * 0.7), Math.round(H * 0.3), 18, '#ffd1ea');
        for (let k = 0; k < 5; k++) px(Math.round(W * 0.7) - 19, Math.round(H * 0.3) + 4 + k * 3, 38, 1, '#c2457e');
        for (let i = 0; i < W * 0.15; i++) px(r() * W, r() * H * 0.4, 1, 1, '#f3d9ff');
        for (const b of back) {
          px(b.x, b.top, b.w, trackY - b.top, b.color);
          for (const l of b.lit) px(l.x, l.y, 1, 1, l.c);
        }
        px(0, trackY, W, H - trackY, '#0b0618');
      });
      return {
        trackY,
        bg,
        front,
        train: { x: -400, next: 60 },
        haze: Array.from({ length: 5 }, () => ({ x: r() * W, y: H * 0.15 + r() * H * 0.3, w: 30 + r() * 60, v: 0.08 + r() * 0.1 })),
      };
    },
    update(s) {
      for (const h of s.haze) {
        h.x += h.v;
        if (h.x > W) h.x = -h.w;
      }
      const tr = s.train;
      if (tr.x > -400) {
        tr.x += 4;
        if (tr.x > W + 10) {
          tr.x = -400;
          tr.next = 120 + Math.floor(Math.random() * 160);
        }
      } else if (--tr.next <= 0) tr.x = -160;
    },
    draw(s, t) {
      const { trackY } = s;
      ctxRef.drawImage(s.bg, 0, 0);
      ctxRef.fillStyle = 'rgba(255, 140, 220, 0.12)';
      for (const h of s.haze) ctxRef.fillRect(Math.round(h.x), Math.round(h.y), Math.round(h.w), 2);
      // front skyline with blinking signs
      for (const b of s.front) {
        px(b.x, b.top, b.w, trackY - b.top, b.color);
        for (const l of b.lit) px(l.x, l.y, 1, 1, l.c);
        if (b.sign) {
          const on = Math.sin(t / 400 + b.sign.phase) > -0.6 || Math.floor(t / 90) % 7 === 0;
          if (on) {
            const sx = b.x + 2;
            const sy = b.top + 4;
            const sw = Math.max(4, b.w - 4);
            px(sx, sy, sw, 1, b.sign.c);
            px(sx, sy + 5, sw, 1, b.sign.c);
            px(sx, sy, 1, 6, b.sign.c);
            px(sx + sw - 1, sy, 1, 6, b.sign.c);
            for (let k = 2; k < sw - 2; k += 2) px(sx + k, sy + 2, 1, 2, b.sign.c);
          }
        }
        // rooftop antenna light
        if (b.w > 20 && Math.floor(t / 600) % 2) px(b.x + 3, b.top - 4, 1, 1, '#ff3b3b');
        if (b.w > 20) px(b.x + 3, b.top - 3, 1, 3, '#160b2c');
      }
      // elevated track and the night train
      px(0, trackY - 2, W, 2, '#3a2160');
      for (let x = 6; x < W; x += 24) px(x, trackY, 2, H - trackY, '#1d1036');
      const tr = s.train;
      if (tr.x > -400) {
        for (let c = 0; c < 4; c++) {
          const cx = tr.x + c * 40;
          px(cx, trackY - 12, 37, 10, '#d8d2ef');
          px(cx, trackY - 4, 37, 2, '#7a6fa8');
          for (let k = 3; k < 34; k += 6) px(cx + k, trackY - 10, 4, 3, '#ffe7a1');
        }
      }
      // city glow at the bottom
      ctxRef.fillStyle = 'rgba(255, 95, 210, 0.06)';
      for (let y = trackY; y < H; y += 2) ctxRef.fillRect(0, y, W, 1);
    },
  };

  const SCENES = [rainyRoom, seaside, cabin, neon];

  // ------------------------------------------------------------------ engine

  function resize() {
    const scale = Math.max(2, Math.round(innerHeight / TARGET_H));
    W = Math.ceil(innerWidth / scale);
    H = Math.ceil(innerHeight / scale);
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
    ctxRef = ctx;
    current.draw(state, t);
  }

  function set(id) {
    current = SCENES.find((s) => s.id === id) || SCENES[0];
    state = current.init();
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
        current.update(state);
        acc -= STEP;
      }
      paint(now);
    }
    requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  window.LofiScenes = { list: SCENES.map(({ id, name }) => ({ id, name })), set };
  resize();
  if (!still) requestAnimationFrame(frame);
})();
