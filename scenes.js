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
  const notebook = sprite(
    ['wwwwwwkwwwwwww', 'wlllllkwllllww', 'wwwwwwkwwwwwww', 'wllllwkwlllllw', 'wwwwwwkwwwwwww', 'ssssssssssssss'],
    { w: '#efe6d6', l: '#b9b2c9', k: '#a99a86', s: '#3d271d' },
  );
  const pencil = sprite(['yyyyyyyyp', 'YYYYYYYYk'], { y: '#f2c14e', Y: '#d39a2c', p: '#f2b5a0', k: '#3a2a20' });
  const headphones = sprite(['..kkkkk..', '.k.....k.', 'k.......k', 'rr.....rr', 'rr.....rr'], {
    k: '#3b3150',
    r: '#e05a6b',
  });
  const crab = sprite(['r.....r', '.r...r.', 'rrrrrrr', '.rrrrr.', 'r.r.r.r'], { r: '#e2553f' });
  const snowman = sprite(
    ['..kkk..', '..kkk..', '.kkkkk.', '..www..', '.wwbww.', '..wow..', '.rrrrr.', 'wwwwwww', 'www.www', 'wwwwwww', '.wwwww.'],
    { k: '#22202c', w: '#f4f8ff', b: '#22202c', o: '#f08a3c', r: '#c94a4a' },
  );

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

  /** A pine: stacked rows that widen downward, with a notch every few rows. */
  function pine(x, base, h, dark, light, snow) {
    for (let k = 0; k < h; k++) {
      const half = Math.floor(((k % 6) + 1) * 0.45 + (k / h) * (h * 0.22));
      const tier = k % 6 === 0;
      px(x - half, base - h + k, half * 2 + 1, 1, tier && snow ? snow : k % 6 < 2 && light ? light : dark);
    }
    px(x - 1, base, 2, 2, '#2a1c16');
  }

  // ------------------------------------------------------------------ scene: rainy room

  const rainyRoom = {
    id: 'room',
    name: 'ห้องฝนตก',
    accent: '#ffb35c',
    init() {
      const r = rng(7);
      const narrow = W < 220;
      const win = {
        x: narrow ? 8 : Math.round(W * 0.19),
        y: Math.round(H * 0.13),
        w: narrow ? W - 16 : Math.min(Math.round(W * 0.42), 300),
        h: Math.round(H * 0.36),
      };
      const deskY = Math.round(H * 0.62);
      const lampX = narrow ? W - 24 : Math.round(W * 0.84);
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
        // wallpaper: a quiet diamond of dots
        for (let y = 2; y < deskY; y += 6) for (let x = (y / 6) % 2 ? 0 : 3; x < W; x += 6) px(x, y, 1, 1, '#352a52');
        bands(win.x, win.y, win.w, win.h, ['#0c1130', '#121a3f', '#1b2350', '#262a5c']);
        disc(win.x + win.w * 0.8, win.y + 11, 5, '#f3e7c4');
        px(win.x + win.w * 0.8 - 2, win.y + 9, 2, 2, '#d9cca6');
        if (!narrow) {
          // framed print and a little shelf on the right wall
          const fx = Math.round(W * 0.66);
          const fy = Math.round(H * 0.12);
          px(fx - 2, fy - 2, 34, 24, '#5b4672');
          bands(fx, fy, 30, 20, ['#f7a45c', '#e0654f', '#9c3c62']);
          for (let k = 0; k < 30; k++) px(fx + k, fy + 12 + Math.round(Math.abs(Math.sin(k / 5)) * 4), 1, 8, '#3a2150');
          disc(fx + 21, fy + 9, 3, '#ffe7a1');
          const sy = Math.round(H * 0.42);
          px(fx - 6, sy, 46, 2, '#94664c');
          px(fx - 6, sy + 2, 46, 1, '#563728');
          px(fx - 2, sy + 3, 2, 4, '#563728');
          px(fx + 34, sy + 3, 2, 4, '#563728');
          const spines = ['#4a6fb3', '#b0495c', '#d9b46a', '#5f9a6e', '#8a62b8'];
          spines.forEach((c, i) => px(fx - 3 + i * 3, sy - 9 + (i % 2), 2, 9 - (i % 2), c));
          blit(plant, fx + 22, sy - 9);
        }
      });

      const fg = layer(() => {
        // window frame, mullions, sill
        const f = '#5b4672';
        px(win.x - 4, win.y - 4, win.w + 8, 4, f);
        px(win.x - 4, win.y + win.h, win.w + 8, 4, f);
        px(win.x - 4, win.y, 4, win.h, f);
        px(win.x + win.w, win.y, 4, win.h, f);
        px(win.x + Math.floor(win.w / 2) - 1, win.y, 3, win.h, f);
        px(win.x, win.y + Math.floor(win.h / 2) - 1, win.w, 2, f);
        px(win.x - 4, win.y - 4, win.w + 8, 1, '#7a6194');
        px(win.x - 8, win.y + win.h + 4, win.w + 16, 3, '#6d5585');
        px(win.x - 8, win.y + win.h + 4, win.w + 16, 1, '#8a72a3');
        // glass reflections
        for (let k = 0; k < 10; k++) px(win.x + 6 + k, win.y + 16 - k, 1, 1, 'rgba(255,255,255,0.10)');
        for (let k = 0; k < 6; k++) px(win.x + 12 + k, win.y + 16 - k, 1, 1, 'rgba(255,255,255,0.07)');
        // curtains on a rod
        px(win.x - 18, win.y - 10, win.w + 36, 2, '#3b2c55');
        px(win.x - 20, win.y - 11, 3, 4, '#c9a46a');
        px(win.x + win.w + 17, win.y - 11, 3, 4, '#c9a46a');
        const curtain = (cx, dir) => {
          const tall = win.h + 16;
          for (let y = 0; y < tall; y++) {
            // gathered at a tie-back two thirds down, then flaring out again
            const tie = Math.abs(y - tall * 0.62) / (tall * 0.62);
            const width = Math.round(8 + tie * 8);
            for (let k = 0; k < width; k++) {
              const fold = (k + (y >> 3)) % 4;
              const col = fold === 0 ? '#6a3450' : fold === 1 ? '#93506f' : '#7b3f5e';
              px(dir > 0 ? cx + k : cx - k, win.y - 8 + y, 1, 1, col);
            }
          }
          px(dir > 0 ? cx : cx - 9, win.y - 8 + Math.round(tall * 0.62), 10, 2, '#c9a46a');
        };
        curtain(win.x - 14, 1);
        curtain(win.x + win.w + 13, -1);
        // desk with drawers
        px(0, deskY, W, 3, '#94664c');
        px(0, deskY + 3, W, 4, '#7a523d');
        px(0, deskY + 7, W, H - deskY - 7, '#563728');
        px(0, deskY + 7, W, 1, '#3d271d');
        for (let x = 12; x < W; x += 56) {
          px(x, deskY + 14, 30, 1, '#3d271d');
          px(x + 13, deskY + 18, 4, 2, '#c9a46a');
        }
        // lamp
        px(lampX - 8, deskY - 2, 18, 2, '#3b3150');
        px(lampX, deskY - 26, 2, 24, '#4b4064');
        px(lampX + 1, deskY - 27, 14, 2, '#4b4064');
        px(lampX + 10, deskY - 30, 14, 6, '#e7a24c');
        px(lampX + 9, deskY - 24, 16, 1, '#c27b2c');
        px(lampX + 14, deskY - 23, 6, 2, '#fff1c9');
        if (!narrow) {
          blit(books, lampX - 46, deskY - 5);
          blit(plant, lampX - 30, deskY - 9);
          blit(notebook, Math.round(W * 0.38), deskY - 6);
          blit(pencil, Math.round(W * 0.38) + 15, deskY - 2);
          blit(headphones, Math.round(W * 0.69), deskY - 5);
        }
      });

      return {
        narrow,
        win,
        deskY,
        lampX,
        bg,
        fg,
        buildings,
        flash: 0,
        splashes: [],
        glow: makeGlow(lampX + 16, deskY - 20, 120, 95, 'rgba(255, 179, 92, 0.10)'),
        rain: Array.from({ length: Math.round(win.w * 0.6) }, () => ({ x: win.x + r() * win.w, y: win.y + r() * win.h, v: 3 + Math.floor(r() * 3) })),
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
          if (Math.random() < 0.3) s.splashes.push({ x: Math.round(d.x), life: 3 });
          d.y = win.y - 3;
          d.x = win.x + Math.random() * (win.w + 20);
        }
      }
      s.splashes = s.splashes.filter((p) => --p.life > 0);
      for (const d of s.drops) {
        if (d.slide && Math.random() < 0.3) d.y += 1;
        if (d.y > win.y + win.h) {
          d.y = win.y;
          d.x = win.x + 2 + Math.floor(Math.random() * (win.w - 4));
        }
      }
      // lightning: rare double flash
      if (s.flash > 0) s.flash = Math.max(0, s.flash - 0.18);
      else if (Math.random() < 1 / 500) s.flash = 1;
      if (s.flash > 0.45 && s.flash < 0.6) s.flash = 0.95;
    },
    draw(s, t) {
      const { win, deskY } = s;
      ctxRef.drawImage(s.bg, 0, 0);
      ctxRef.save();
      ctxRef.beginPath();
      ctxRef.rect(win.x, win.y, win.w, win.h);
      ctxRef.clip();
      if (s.flash > 0) {
        ctxRef.fillStyle = `rgba(190, 200, 255, ${s.flash * 0.45})`;
        ctxRef.fillRect(win.x, win.y, win.w, win.h);
      }
      const tick = Math.floor(t / 2500);
      s.buildings.forEach((b, bi) => {
        px(b.x, b.top, b.w, win.y + win.h - b.top, b.color);
        b.windows.forEach((w, wi) => {
          if (w.on !== ((bi * 31 + wi * 17 + tick) % 97 === 0)) px(w.x, w.y, 1, 2, (wi + bi) % 3 ? '#ffd27a' : '#c99a4e');
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
      ctxRef.drawImage(s.fg, 0, 0);
      ctxRef.fillStyle = '#b9c6f2';
      for (const p of s.splashes) {
        ctxRef.fillRect(p.x - (4 - p.life), win.y + win.h + 3 - p.life, 1, 1);
        ctxRef.fillRect(p.x + (4 - p.life), win.y + win.h + 3 - p.life, 1, 1);
      }
      // fairy lights hanging along the rod
      const colors = ['#ffd27a', '#ff8fb1', '#8fd3ff', '#b6f28a'];
      const x0 = win.x - 16;
      const x1 = win.x + win.w + 16;
      for (let x = x0, i = 0; x <= x1; x += 6, i++) {
        const sag = Math.round(Math.sin(((x - x0) % 30) / 30 * Math.PI) * 3);
        const y = win.y - 7 + sag;
        if (x < x1) px(x, y, 6, 1, '#2a1f3d');
        const on = Math.sin(t / 600 + i * 1.7) > -0.3;
        px(x, y + 1, 2, 2, on ? colors[i % 4] : '#4a3b5e');
        if (on) px(x - 1, y + 1, 4, 3, 'rgba(255, 220, 160, 0.08)');
      }
      const mx = s.narrow ? win.x + 12 : Math.round(W * 0.62);
      blit(mug, mx, deskY - 7);
      steam(mx + 3, deskY - 10, t);
      sleepyCat(s.narrow ? win.x + Math.round(win.w * 0.4) : Math.round(W * 0.5), deskY - cat.h + 1, t);
      ctxRef.drawImage(s.glow, 0, 0);
      if (s.flash > 0) {
        ctxRef.fillStyle = `rgba(170, 180, 255, ${s.flash * 0.06})`;
        ctxRef.fillRect(0, 0, W, H);
      }
    },
  };

  // ------------------------------------------------------------------ scene: seaside sunset

  const seaside = {
    id: 'sea',
    name: 'ทะเลยามเย็น',
    accent: '#ff9e6b',
    init() {
      const r = rng(11);
      const horizon = Math.round(H * 0.5);
      const shore = Math.round(H * 0.7);
      const sunX = Math.round(W * 0.64);
      const stars = Array.from({ length: Math.round(W * 0.12) }, () => ({ x: r() * W, y: r() * horizon * 0.28, p: r() * 6 }));
      const bg = layer(() => {
        bands(0, 0, W, horizon, ['#1d1442', '#2a1a4f', '#53285f', '#9c3c62', '#e0654f', '#f7a45c', '#ffd383']);
        disc(sunX, horizon - 2, 22, '#ffe7a1');
        for (let k = 0; k < 6; k++) px(sunX - 24, horizon - 12 + k * 3, 48, 1 + (k > 2 ? 1 : 0), k % 2 ? '#f7a45c' : '#ffb871');
        // a far island with two tiny palms
        const ix = Math.round(W * 0.28);
        for (let k = -26; k <= 26; k++) {
          const h = Math.round(5 * Math.cos((k / 26) * (Math.PI / 2)));
          px(ix + k, horizon - h, 1, h, '#4a2350');
        }
        px(ix - 6, horizon - 11, 1, 7, '#4a2350');
        px(ix - 9, horizon - 12, 7, 1, '#4a2350');
        px(ix + 4, horizon - 10, 1, 6, '#4a2350');
        px(ix + 1, horizon - 11, 7, 1, '#4a2350');
        bands(0, horizon, W, shore - horizon, ['#5a3a7a', '#3c2c66', '#2a2153']);
        bands(0, shore, W, H - shore, ['#e3b07a', '#d39a63', '#b97f50']);
        // shells and pebbles in the sand
        for (let i = 0; i < W * 0.2; i++) px(r() * W, shore + 4 + r() * (H - shore - 4), 1, 1, r() < 0.5 ? '#f3d4a8' : '#a8703f');
        // beach umbrella, chair and a cooler in the open middle of the screen
        const ux = Math.round(W * 0.47);
        const uy = shore + 8;
        px(ux, uy - 28, 1, 30, '#f0e6d8');
        for (let k = 0; k < 12; k++) {
          const half = Math.round((k / 12) * 18);
          for (let j = -half; j <= half; j++) px(ux + j, uy - 34 + k, 1, 1, Math.floor((j + 40) / 6) % 2 ? '#e8574a' : '#f5ecdc');
        }
        px(ux + 6, uy - 4, 14, 2, '#2f8f9d');
        px(ux + 18, uy - 10, 2, 8, '#2f8f9d');
        px(ux + 7, uy - 2, 1, 4, '#8a5a3a');
        px(ux + 18, uy - 2, 1, 4, '#8a5a3a');
        px(ux - 16, uy - 5, 9, 6, '#3c7fd0');
        px(ux - 16, uy - 5, 9, 2, '#f5ecdc');
      });
      return {
        horizon,
        shore,
        sunX,
        bg,
        stars,
        clouds: Array.from({ length: Math.max(3, Math.round(W / 70)) }, () => ({ x: r() * W, y: 10 + r() * horizon * 0.5, w: 14 + Math.floor(r() * 26), v: 0.05 + r() * 0.12 })),
        birds: Array.from({ length: 3 }, (_, i) => ({ x: r() * W, y: 18 + i * 9 + r() * 10, v: 0.25 + r() * 0.2 })),
        waves: Array.from({ length: Math.round(W / 6) }, () => ({ x: r() * W, y: horizon + 2 + r() * (shore - horizon - 4), len: 3 + Math.floor(r() * 7) })),
        boat: { x: W * 0.3 },
        crab: { x: W * 0.5, dir: 1, pause: 0 },
        palmX: W < 200 ? 10 : Math.round(W * 0.06),
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
      s.boat.x += 0.04;
      if (s.boat.x > W + 12) s.boat.x = -12;
      const c = s.crab;
      if (c.pause > 0) c.pause--;
      else {
        c.x += c.dir * 0.5;
        if (Math.random() < 0.02) c.pause = 20 + Math.random() * 30;
        if (c.x < W * 0.44 || c.x > W * 0.74) c.dir *= -1;
      }
    },
    draw(s, t) {
      const { horizon, shore, sunX } = s;
      ctxRef.drawImage(s.bg, 0, 0);
      for (const st of s.stars) if (Math.sin(t / 800 + st.p) > 0) px(st.x, st.y, 1, 1, '#f7e7ff');
      for (const c of s.clouds) {
        px(c.x, c.y, c.w, 2, '#c8587a');
        px(c.x + 3, c.y - 2, c.w - 8, 2, '#d96a85');
        px(c.x + 6, c.y + 2, c.w - 4, 1, '#a9466c');
      }
      // sailboat on the horizon
      const bx = Math.round(s.boat.x);
      px(bx, horizon - 1, 9, 2, '#3a1d3f');
      for (let k = 0; k < 7; k++) px(bx + 4, horizon - 2 - k, Math.max(1, 4 - Math.floor(k / 2)), 1, '#f2d7c4');
      // glitter on the water
      const tick = Math.floor(t / 200);
      for (let y = horizon + 2; y < shore - 2; y += 2) {
        const spread = 4 + ((y - horizon) / (shore - horizon)) * 22;
        const off = ((y * 7 + tick * 3) % 9) - 4;
        px(sunX - spread / 2 + off, y, Math.max(2, spread * (0.4 + ((y + tick) % 3) * 0.2)), 1, '#ffcf8a');
      }
      ctxRef.fillStyle = '#7a5aa0';
      for (const w of s.waves) ctxRef.fillRect(Math.round(w.x), Math.round(w.y), w.len, 1);
      const reach = Math.round(2 + 2 * Math.sin(t / 900));
      for (let x = 0; x < W; x++) {
        const y = shore + Math.round(Math.sin(x / 9 + t / 1200) * 1.5);
        px(x, y - 1, 1, reach, '#f6efe4');
      }
      blit(crab, s.crab.x, shore + 14 + (s.crab.pause ? 0 : Math.floor(t / 150) % 2));
      const flap = Math.floor(t / 250) % 2;
      for (const b of s.birds) {
        px(b.x - 2, b.y - flap, 2, 1, '#3a1d3f');
        px(b.x, b.y, 1, 1, '#3a1d3f');
        px(b.x + 1, b.y - flap, 2, 1, '#3a1d3f');
      }
      // palm tree silhouette, fronds swaying
      const pxx = s.palmX;
      const sway = Math.round(Math.sin(t / 700) * 1.5);
      const trunk = Math.round(H * 0.58);
      for (let k = 0; k < trunk; k++) {
        const bend = Math.round(Math.pow(k / trunk, 2) * 12);
        px(pxx + bend, H - 6 - k, 3, 1, k % 5 === 0 ? '#3a1d4f' : '#24123a');
      }
      const topX = pxx + 12;
      const topY = H - 6 - trunk;
      [[-1, -0.35], [1, -0.25], [-1, 0.25], [1, 0.35], [0.2, -0.9], [-0.4, 0.8]].forEach(([dir, lift], i) => {
        for (let k = 0; k < 20; k++) {
          const x = topX + dir * k + (i % 2 ? sway : -sway) * (k / 20);
          const y = topY + lift * k + (k * k) / 40;
          px(x, y, 2, 1, '#24123a');
          if (k % 3 === 0) px(x, y + 1, 1, 2, '#24123a');
        }
      });
      px(topX - 2, topY - 1, 4, 3, '#3a1d2a');
    },
  };

  // ------------------------------------------------------------------ scene: snowy cabin

  const cabin = {
    id: 'snow',
    name: 'กระท่อมหิมะ',
    accent: '#9fe3ff',
    init() {
      const r = rng(23);
      const ground = Math.round(H * 0.66);
      const cabinX = W < 200 ? Math.round(W * 0.35) : Math.round(W * 0.56);
      const cabinY = ground - 26;
      const ridge = (base, amp, f1, f2, phase) => {
        const out = [];
        for (let x = 0; x < W; x++) out.push(Math.round(base + Math.sin(x / f1 + phase) * amp + Math.sin(x / f2 + phase * 2) * amp * 0.4));
        return out;
      };
      const far = ridge(H * 0.4, 9, 29, 11, 1);
      const near = ridge(H * 0.5, 6, 21, 8, 3);
      const bg = layer(() => {
        bands(0, 0, W, ground, ['#070b1f', '#0d1636', '#15244a', '#1f3358']);
        disc(Math.round(W * 0.36), 20, 7, '#eef3ff');
        disc(Math.round(W * 0.36) + 3, 18, 6, '#0d1636');
        for (let x = 0; x < W; x++) {
          px(x, far[x], 1, ground - far[x], '#2a3d63');
          px(x, far[x], 1, 2, '#b9c9e6');
          px(x, near[x], 1, ground - near[x], '#22355a');
          px(x, near[x], 1, 2, '#d5e1f5');
        }
        // far tree line
        for (let x = 2; x < W; x += 4 + Math.floor(r() * 4)) pine(x, ground, 6 + Math.floor(r() * 6), '#2b4a6b', null, '#9fb6d6');
        bands(0, ground, W, H - ground, ['#dfeaf8', '#bfd0ea', '#a3b8da']);
        // path of footprints to the door
        for (let y = cabinY + 28, k = 0; y < H; y += 3, k++) px(cabinX + 20 + (k % 2 ? 2 : -1) + Math.round((y - cabinY) * 0.12), y, 2, 1, '#9fb2d3');
        // fence
        for (let x = cabinX - 40; x < cabinX + 90; x += 6) px(x, ground + 2, 1, 6, '#6b4b3a');
        px(cabinX - 40, ground + 4, 130, 1, '#6b4b3a');
        // near trees, skipping the cabin
        for (let i = 0; i < Math.round(W / 16); i++) {
          const x = Math.round(r() * W);
          if (Math.abs(x - cabinX - 18) < 34) continue;
          pine(x, ground + 4 + Math.round(r() * 8), 18 + Math.floor(r() * 24), '#16324a', '#1f4560', '#e6eefb');
        }
        // cabin
        px(cabinX, cabinY, 38, 26, '#6b4431');
        for (let y = cabinY + 3; y < cabinY + 26; y += 4) px(cabinX, y, 38, 1, '#57372a');
        for (let k = 0; k < 14; k++) px(cabinX - 4 + k, cabinY - k, 46 - k * 2, 1, '#4a2f25');
        for (let k = 0; k < 14; k++) px(cabinX - 4 + k, cabinY - k - 1, 46 - k * 2, 1, k < 12 ? '#e9f1fb' : '#ffffff');
        px(cabinX - 5, cabinY, 48, 2, '#e9f1fb');
        px(cabinX + 28, cabinY - 18, 5, 10, '#5a5560');
        px(cabinX + 28, cabinY - 19, 5, 2, '#e9f1fb');
        px(cabinX + 18, cabinY + 10, 7, 16, '#3c271e');
        px(cabinX + 23, cabinY + 18, 1, 1, '#c9a46a');
        // firewood stack
        for (let row = 0; row < 3; row++) for (let k = 0; k < 4 - row; k++) disc(cabinX - 8 + k * 3 + row * 1.5, cabinY + 23 - row * 3, 1, '#8a5a3a');
        // lamp post
        px(cabinX + 60, cabinY - 2, 1, 30, '#2a2c3a');
        px(cabinX + 58, cabinY - 6, 5, 4, '#2a2c3a');
        px(cabinX + 59, cabinY - 5, 3, 2, '#ffe08a');
        blit(snowman, cabinX - 26, ground - 5);
      });
      return {
        ground,
        cabinX,
        cabinY,
        bg,
        stars: Array.from({ length: Math.round(W * 0.25) }, () => ({ x: r() * W, y: r() * H * 0.4, p: r() * 6 })),
        glow: makeGlow(cabinX + 18, cabinY + 14, 60, 30, 'rgba(255, 200, 110, 0.12)'),
        lamp: makeGlow(cabinX + 60, cabinY + 6, 22, 26, 'rgba(255, 220, 140, 0.10)'),
        snow: Array.from({ length: Math.round(W * 0.8) }, () => ({ x: r() * W, y: r() * H, v: 0.4 + r() * 0.8, p: r() * 6 })),
        smoke: [],
        shooting: null,
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
      if (Math.random() < 0.25) s.smoke.push({ x: s.cabinX + 30, y: s.cabinY - 20, life: 0 });
      for (const p of s.smoke) {
        p.y -= 0.6;
        p.x += 0.35;
        p.life++;
      }
      s.smoke = s.smoke.filter((p) => p.life < 40);
      if (s.shooting) {
        s.shooting.x += 4;
        s.shooting.y += 1.5;
        if (++s.shooting.life > 18) s.shooting = null;
      } else if (Math.random() < 1 / 300) s.shooting = { x: Math.random() * W * 0.6, y: 6 + Math.random() * H * 0.15, life: 0 };
    },
    draw(s, t) {
      ctxRef.drawImage(s.bg, 0, 0);
      for (const st of s.stars) if (Math.sin(t / 700 + st.p) > -0.3) px(st.x, st.y, 1, 1, '#dfe8ff');
      if (s.shooting) {
        const { x, y } = s.shooting;
        for (let k = 0; k < 8; k++) px(x - k * 2, y - k * 0.75, 1, 1, `rgba(255,255,255,${1 - k / 8})`);
      }
      // aurora ribbon
      for (let x = 0; x < W; x++) {
        const y = Math.round(H * 0.16 + Math.sin(x / 31 + t / 3000) * 9 + Math.sin(x / 13 + t / 1700) * 3);
        const h = 6 + Math.round(Math.sin(x / 17 + t / 2200) * 3);
        for (let k = 0; k < h; k++) {
          if ((k + x) % 3 === 0 || BAYER[(y + k) & 3][x & 3] > 8 + k * 1.2) continue;
          px(x, y + k, 1, 1, k < 2 ? 'rgba(160, 255, 200, 0.55)' : 'rgba(90, 210, 170, 0.28)');
        }
      }
      // windows flicker with the fire inside
      const warm = Math.random() < 0.15 ? '#ffb74f' : '#ffcf6e';
      px(s.cabinX + 5, s.cabinY + 8, 8, 7, warm);
      px(s.cabinX + 8, s.cabinY + 8, 1, 7, '#6b4431');
      px(s.cabinX + 5, s.cabinY + 11, 8, 1, '#6b4431');
      px(s.cabinX + 28, s.cabinY + 8, 6, 6, warm);
      for (const p of s.smoke) {
        ctxRef.fillStyle = `rgba(200, 205, 220, ${0.5 * (1 - p.life / 40)})`;
        ctxRef.fillRect(Math.round(p.x), Math.round(p.y), p.life > 20 ? 2 : 1, p.life > 20 ? 2 : 1);
      }
      ctxRef.drawImage(s.glow, 0, 0);
      ctxRef.drawImage(s.lamp, 0, 0);
      for (const f of s.snow) {
        const x = Math.round(f.x + Math.sin(f.p) * 1.5);
        const nearLamp = Math.abs(x - s.cabinX - 60) < 14 && f.y > s.cabinY - 4 && f.y < s.ground + 6;
        px(x, f.y, 1, 1, nearLamp ? '#ffe9b0' : '#ffffff');
      }
    },
  };

  // ------------------------------------------------------------------ scene: neon city

  const neon = {
    id: 'city',
    name: 'เมืองนีออน',
    accent: '#ff5fd2',
    init() {
      const r = rng(41);
      const trackY = Math.round(H * 0.66);
      const skyline = (minH, maxH, color, litColors, density, signs) => {
        const out = [];
        let x = -4;
        while (x < W) {
          const w = 10 + Math.floor(r() * 18);
          const h = minH + Math.floor(r() * (maxH - minH));
          const lit = [];
          for (let y = trackY - h + 3; y < trackY; y += 3)
            for (let xx = x + 2; xx < x + w - 1; xx += 3) if (r() < density) lit.push({ x: xx, y, c: litColors[Math.floor(r() * litColors.length)], tv: r() < 0.06 });
          const sign = signs && r() < 0.3 ? { c: ['#ff5fd2', '#4ff0ff', '#ffd23f', '#9dff6a'][Math.floor(r() * 4)], phase: r() * 10, vertical: r() < 0.4 } : null;
          out.push({ x, w, top: trackY - h, color, lit, sign });
          x += w + 1;
        }
        return out;
      };
      const back = skyline(36, 80, '#2a1550', ['#5a3a9a'], 0.15, false);
      const mid = skyline(26, 62, '#1f1040', ['#7a5ac0', '#c070c0'], 0.18, false);
      const front = skyline(16, 55, '#140a28', ['#ff8fe0', '#7ff6ff', '#ffd27a'], 0.22, true);
      const bg = layer(() => {
        bands(0, 0, W, trackY, ['#0e0620', '#241047', '#4a1a6b', '#8a2d7d', '#c2457e']);
        for (let i = 0; i < W * 0.15; i++) px(r() * W, r() * H * 0.35, 1, 1, '#f3d9ff');
        disc(Math.round(W * 0.7), Math.round(H * 0.23), 18, '#ffd1ea');
        for (let k = 0; k < 5; k++) px(Math.round(W * 0.7) - 19, Math.round(H * 0.23) + 4 + k * 3, 38, 1, '#c2457e');
        for (const b of back) {
          px(b.x, b.top, b.w, trackY - b.top, b.color);
          for (const l of b.lit) px(l.x, l.y, 1, 1, l.c);
        }
        for (const b of mid) {
          px(b.x, b.top + 8, b.w, trackY - b.top - 8, b.color);
          for (const l of b.lit) if (l.y > b.top + 8) px(l.x, l.y, 1, 1, l.c);
        }
        px(0, trackY, W, H - trackY, '#0b0618');
      });
      return {
        trackY,
        bg,
        front,
        train: { x: -400, next: 60 },
        blimp: { x: -40, y: Math.round(H * 0.16) },
        beams: [
          { x: W * 0.25, a: -1.9, v: 0.006 },
          { x: W * 0.55, a: -1.2, v: -0.005 },
        ],
        haze: Array.from({ length: 5 }, () => ({ x: r() * W, y: H * 0.15 + r() * H * 0.3, w: 30 + r() * 60, v: 0.08 + r() * 0.1 })),
      };
    },
    update(s) {
      for (const h of s.haze) {
        h.x += h.v;
        if (h.x > W) h.x = -h.w;
      }
      s.blimp.x += 0.12;
      if (s.blimp.x > W + 40) s.blimp.x = -60;
      for (const b of s.beams) {
        b.a += b.v;
        if (b.a < -2.3 || b.a > -0.8) b.v *= -1;
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
      // searchlights sweeping the clouds
      for (const b of s.beams) {
        for (let d = 0; d < H * 0.9; d += 1) {
          const x = b.x + Math.cos(b.a) * d;
          const y = trackY + Math.sin(b.a) * d;
          const w = 1 + d * 0.07;
          if (BAYER[Math.round(y) & 3][Math.round(x) & 3] < 9) px(x - w / 2, y, w, 1, 'rgba(220, 200, 255, 0.09)');
        }
      }
      ctxRef.fillStyle = 'rgba(255, 140, 220, 0.12)';
      for (const h of s.haze) ctxRef.fillRect(Math.round(h.x), Math.round(h.y), Math.round(h.w), 2);
      // blimp
      const bx = Math.round(s.blimp.x);
      const by = s.blimp.y;
      px(bx + 2, by, 22, 6, '#3a2a5e');
      px(bx, by + 1, 26, 4, '#3a2a5e');
      px(bx + 9, by + 6, 8, 2, '#2a1d45');
      px(bx + 4, by + 2, 16, 2, Math.floor(t / 500) % 2 ? '#4ff0ff' : '#ff5fd2');
      if (Math.floor(t / 700) % 2) px(bx + 25, by + 2, 1, 1, '#ff3b3b');
      // front skyline with blinking signs and the odd TV glow
      for (const b of s.front) {
        px(b.x, b.top, b.w, trackY - b.top, b.color);
        for (const l of b.lit) px(l.x, l.y, 1, 1, l.tv ? (Math.floor(t / 180 + l.x) % 3 ? '#6fa8ff' : '#c5e0ff') : l.c);
        if (b.sign) {
          const on = Math.sin(t / 400 + b.sign.phase) > -0.6 || Math.floor(t / 90) % 7 === 0;
          const c = on ? b.sign.c : '#3a2050';
          if (b.sign.vertical) {
            const sx = b.x + b.w - 5;
            px(sx, b.top + 3, 4, 20, '#0b0618');
            for (let k = 0; k < 5; k++) px(sx + 1, b.top + 4 + k * 4, 2, 2, c);
          } else {
            const sx = b.x + 2;
            const sy = b.top + 4;
            const sw = Math.max(4, b.w - 4);
            px(sx, sy, sw, 1, c);
            px(sx, sy + 5, sw, 1, c);
            px(sx, sy, 1, 6, c);
            px(sx + sw - 1, sy, 1, 6, c);
            for (let k = 2; k < sw - 2; k += 2) px(sx + k, sy + 2, 1, 2, c);
          }
        }
        if (b.w > 20) {
          px(b.x + 3, b.top - 3, 1, 3, '#140a28');
          if (Math.floor(t / 600) % 2) px(b.x + 3, b.top - 4, 1, 1, '#ff3b3b');
        }
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
      // wet street: shimmering reflections of the signs
      const tick = Math.floor(t / 160);
      for (const b of s.front) {
        if (!b.sign) continue;
        for (let y = trackY + 3; y < H; y += 2) {
          if ((y + tick + b.x) % 5 === 0) continue;
          px(b.x + 2 + ((y + tick) % 3) - 1, y, Math.max(2, b.w - 6), 1, b.sign.c + '33');
        }
      }
    },
  };

  // ------------------------------------------------------------------ scene: forest campfire

  const camp = {
    id: 'camp',
    name: 'แคมป์ไฟในป่า',
    accent: '#c6f27a',
    init() {
      const r = rng(59);
      const ground = Math.round(H * 0.64);
      const fireX = Math.round(W * 0.56);
      const tentX = Math.round(W * 0.4);
      const bg = layer(() => {
        bands(0, 0, W, ground, ['#04070f', '#08101e', '#0f1a2c', '#16243a']);
        for (let i = 0; i < W * 0.3; i++) px(r() * W, r() * H * 0.45, 1, 1, r() < 0.8 ? '#cfd8ff' : '#ffe7b0');
        disc(Math.round(W * 0.22), Math.round(H * 0.16), 8, '#f4f0dc');
        disc(Math.round(W * 0.22) - 2, Math.round(H * 0.16) - 2, 2, '#d9d3b8');
        // two layers of forest silhouette
        for (let x = 0; x < W; x += 3 + Math.floor(r() * 3)) pine(x, ground, 22 + Math.floor(r() * 26), '#0d1a22', '#122531', null);
        for (let x = 0; x < W; x += 6 + Math.floor(r() * 6)) {
          if (Math.abs(x - fireX) < 46) continue;
          pine(x, ground + 6, 34 + Math.floor(r() * 30), '#070e13', null, null);
        }
        bands(0, ground, W, H - ground, ['#1f2d21', '#18241a', '#111a13']);
        for (let i = 0; i < W * 0.5; i++) {
          const x = Math.round(r() * W);
          const y = ground + 2 + Math.round(r() * (H - ground - 2));
          px(x, y, 1, 2, '#2c4230');
          px(x + 1, y + 1, 1, 1, '#2c4230');
        }
        // tent
        const ty = ground + 4;
        for (let k = 0; k < 22; k++) {
          px(tentX - k, ty - 22 + k, k * 2 + 1, 1, '#c9763d');
          px(tentX, ty - 22 + k, k + 1, 1, '#a65d2f');
        }
        for (let k = 0; k < 12; k++) px(tentX - Math.floor(k / 2), ty - 12 + k, k + 1, 1, '#2a1a12');
        px(tentX, ty - 25, 1, 4, '#5a3a28');
        // logs around the fire
        px(fireX - 18, ty - 1, 10, 3, '#6b4431');
        px(fireX + 9, ty - 1, 10, 3, '#6b4431');
        px(fireX - 18, ty - 1, 2, 3, '#c9a46a');
        px(fireX + 17, ty - 1, 2, 3, '#c9a46a');
        // fire pit stones
        for (let k = -7; k <= 7; k += 3) px(fireX + k, ty - 1, 2, 2, '#5c5a66');
        px(fireX - 5, ty - 3, 10, 2, '#4a2f25');
        px(fireX - 3, ty - 5, 6, 2, '#5a3a28');
      });
      return {
        ground,
        fireX,
        fireY: ground + 1,
        bg,
        glowA: makeGlow(fireX, ground, 80, 50, 'rgba(255, 150, 60, 0.12)'),
        glowB: makeGlow(fireX, ground, 60, 38, 'rgba(255, 170, 80, 0.10)'),
        sparks: [],
        flies: Array.from({ length: Math.round(W / 14) }, () => ({ x: r() * W, y: ground - 30 + r() * 50, a: r() * 6, p: r() * 6 })),
      };
    },
    update(s) {
      if (Math.random() < 0.5) s.sparks.push({ x: s.fireX + (Math.random() - 0.5) * 6, y: s.fireY - 8, vx: (Math.random() - 0.5) * 0.6, life: 0 });
      for (const p of s.sparks) {
        p.y -= 1;
        p.x += p.vx;
        p.life++;
      }
      s.sparks = s.sparks.filter((p) => p.life < 22);
      for (const f of s.flies) {
        f.a += (Math.random() - 0.5) * 0.6;
        f.x += Math.cos(f.a) * 0.4;
        f.y += Math.sin(f.a) * 0.25;
        f.p += 0.15;
        if (f.x < 0) f.x = W;
        if (f.x > W) f.x = 0;
        f.y = Math.max(s.ground - 50, Math.min(s.ground + 30, f.y));
      }
    },
    draw(s, t) {
      ctxRef.drawImage(s.bg, 0, 0);
      // flames: three layers of flickering columns
      const fx = s.fireX;
      const fy = s.fireY - 5;
      const layers = [
        ['#d8452c', 17, 10],
        ['#f5913a', 12, 7],
        ['#ffe08a', 6, 4],
      ];
      for (const [color, height, width] of layers) {
        for (let k = -width; k <= width; k++) {
          const h = Math.round(height * (1 - Math.abs(k) / (width + 1)) * (0.7 + Math.random() * 0.5));
          px(fx + k * 0.6, fy - h, 1, h, color);
        }
      }
      for (const p of s.sparks) px(p.x, p.y, 1, 1, p.life < 10 ? '#ffd27a' : '#ff8a4a');
      ctxRef.globalAlpha = 0.75 + Math.random() * 0.25;
      ctxRef.drawImage(s.glowA, 0, 0);
      ctxRef.globalAlpha = 1;
      ctxRef.drawImage(s.glowB, 0, 0);
      for (const f of s.flies) {
        const on = Math.sin(f.p) > 0.2;
        if (!on) continue;
        px(f.x, f.y, 1, 1, '#e8ff9a');
        px(f.x - 1, f.y, 3, 1, 'rgba(200, 255, 120, 0.25)');
        px(f.x, f.y - 1, 1, 3, 'rgba(200, 255, 120, 0.25)');
      }
    },
  };

  const SCENES = [rainyRoom, seaside, cabin, neon, camp];

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
