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

  // ------------------------------------------------------------------ scene: rainy room (high detail)
  // Drawn at twice the resolution of the other scenes, with shaded, hand-tuned shapes.

  /** Fill an ellipse pixel by pixel; `paint(nx, ny, x, y)` picks the colour (or null to skip). */
  function shadeEllipse(cx, cy, rx, ry, paint) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        const c = paint(nx, ny, x, y);
        if (c) px(x, y, 1, 1, c);
      }
    }
  }

  const dith = (x, y, t) => t * 16 > BAYER[y & 3][x & 3];

  /** Sleeping tabby, curled up, lit from the lamp on the right. */
  function hdCat(x, y, t) {
    const breathe = Math.sin(t / 900) * 0.6;
    const C = { hi: '#f6c088', base: '#e39a52', mid: '#cf8440', dark: '#a8612a', stripe: '#9a5524', cream: '#f5e2c4', creamS: '#dcc3a0', line: '#5a2f18' };
    const tone = (nx, ny, xx, yy) => {
      const light = nx * 0.55 - ny * 0.6;
      let c = light > 0.45 ? C.hi : light > 0.05 ? C.base : light > -0.35 ? C.mid : C.dark;
      if (light > 0.25 && light <= 0.45 && dith(xx, yy, 0.5)) c = C.hi;
      return c;
    };
    // tail wrapping around the front, tip twitching
    const tip = Math.floor(t / 1400) % 6 === 0 ? -2 : 0;
    for (let k = 0; k <= 30; k++) {
      const a = Math.PI * (0.95 - k / 40);
      const tx = x + 2 + Math.cos(a) * 20;
      const ty = y + 10 + Math.sin(a) * 4 + (k > 26 ? tip : 0);
      shadeEllipse(tx, ty, 2.2, 2.2, (nx, ny, xx, yy) => ((Math.floor((k + 2) / 4) % 2 ? C.stripe : tone(nx, ny, xx, yy))));
    }
    // body
    shadeEllipse(x, y + 3 - breathe, 22, 9 + breathe, (nx, ny, xx, yy) => {
      if (ny > 0.55 && nx > -0.5) return C.cream;
      const stripe = ny < 0.35 && Math.floor((xx - x + yy * 0.6 + 40) / 5) % 3 === 0;
      return stripe ? C.stripe : tone(nx, ny, xx, yy);
    });
    // head, tucked in on the right
    const hx = x + 19;
    const hy = y + 1;
    shadeEllipse(hx, hy, 8.5, 7, (nx, ny, xx, yy) => {
      if (ny > 0.3 && Math.abs(nx) < 0.55) return ny > 0.6 ? C.creamS : C.cream;
      if (ny < -0.45 && Math.abs(nx) < 0.15) return C.stripe;
      return tone(nx, ny, xx, yy);
    });
    // ears (one twitches now and then)
    const twitch = Math.floor(t / 2300) % 7 === 0 ? 1 : 0;
    for (const [ex, dir, tw] of [[hx - 5, -1, 0], [hx + 4, 1, twitch]]) {
      for (let k = 0; k < 6; k++) {
        const w = Math.max(1, 5 - k);
        px(ex - Math.floor(w / 2) + dir * Math.floor(k / 3) + tw, hy - 5 - k, w, 1, k < 2 ? C.mid : C.dark);
        if (k < 3 && w > 2) px(ex - Math.floor(w / 2) + 1 + dir * Math.floor(k / 3) + tw, hy - 5 - k, w - 2, 1, '#f0a8a0');
      }
    }
    // closed eyes, nose, whiskers
    px(hx - 5, hy, 3, 1, C.line);
    px(hx - 6, hy - 1, 1, 1, C.line);
    px(hx + 2, hy, 3, 1, C.line);
    px(hx + 5, hy - 1, 1, 1, C.line);
    px(hx - 1, hy + 2, 2, 1, '#e88a8a');
    px(hx - 1, hy + 3, 2, 1, C.line);
    for (const [wx, dir] of [[hx - 4, -1], [hx + 4, 1]]) {
      px(wx + dir * 2, hy + 2, 4, 1, 'rgba(255, 245, 230, 0.55)');
      px(wx + dir * 2, hy + 4, 4, 1, 'rgba(255, 245, 230, 0.45)');
    }
    // front paw resting under the chin
    shadeEllipse(hx - 2, hy + 7, 4, 2.2, () => C.cream);
    px(hx - 5, hy + 8, 6, 1, C.creamS);
    // floating z's
    const zt = (t / 1300) % 3;
    if (zt < 2.2) {
      const zx = hx + 10 + Math.floor(zt * 3);
      const zy = hy - 12 - Math.floor(zt * 6);
      const a = zt < 1.8 ? 0.85 : 0.4;
      ctxRef.fillStyle = `rgba(244, 233, 216, ${a})`;
      ctxRef.fillRect(zx, zy, 5, 1);
      ctxRef.fillRect(zx + 3, zy + 1, 1, 1);
      ctxRef.fillRect(zx + 2, zy + 2, 1, 1);
      ctxRef.fillRect(zx + 1, zy + 3, 1, 1);
      ctxRef.fillRect(zx, zy + 4, 5, 1);
    }
  }

  const rainyRoom = {
    id: 'room',
    name: 'ห้องฝนตก',
    accent: '#ffb35c',
    targetH: 360,
    init() {
      const r = rng(7);
      const narrow = W < 420;
      const win = {
        x: narrow ? 14 : Math.round(W * 0.19),
        y: Math.round(H * 0.12),
        w: narrow ? W - 28 : Math.min(Math.round(W * 0.42), 600),
        h: Math.round(H * 0.37),
      };
      win.w -= win.w % 2;
      const deskY = Math.round(H * 0.62);
      const lampX = narrow ? W - 46 : Math.round(W * 0.85);
      const moon = { x: win.x + Math.round(win.w * 0.78), y: win.y + 26 };
      const horizon = win.y + win.h;

      // three layers of city: far haze, middle, near (near windows flicker at run time)
      const city = (minH, maxH, wMin, wMax, gap) => {
        const out = [];
        let x = win.x - 6;
        while (x < win.x + win.w + 6) {
          const w = wMin + Math.floor(r() * (wMax - wMin));
          const top = horizon - minH - Math.floor(r() * (maxH - minH));
          out.push({ x, w, top, roof: r() });
          x += w + (r() < gap ? 3 : 0);
        }
        return out;
      };
      const far = city(30, 70, 10, 24, 0.2);
      const mid = city(18, 58, 14, 30, 0.3);
      const near = city(10, 44, 18, 36, 0.35).map((b) => {
        const windows = [];
        for (let wy = b.top + 5; wy < horizon - 3; wy += 6)
          for (let wx = b.x + 3; wx < b.x + b.w - 4; wx += 5)
            if (r() < 0.45) windows.push({ x: wx, y: wy, on: r() < 0.75, warm: r() < 0.7, blind: r() < 0.25 });
        return { ...b, windows };
      });

      const bg = layer(() => {
        // wall: deep plum, darker toward the corners, with a fine wallpaper
        bands(0, 0, W, deskY, ['#231a38', '#2b2142', '#30254a']);
        for (let y = 4; y < deskY; y += 10)
          for (let x = (y / 10) % 2 ? 0 : 5; x < W; x += 10) {
            px(x, y, 1, 1, '#3a2e58');
            px(x + 1, y + 1, 1, 1, '#342950');
          }
        // sky and moon
        bands(win.x, win.y, win.w, win.h, ['#090d26', '#0f1638', '#161e48', '#1f2758', '#2b2c63']);
        for (let k = 0; k < 4; k++) {
          const rr = 9 + k * 4;
          for (let y = -rr; y <= rr; y++)
            for (let x = -rr; x <= rr; x++) {
              const d = Math.hypot(x, y) / rr;
              if (d < 1 && d > 0.6 && dith(moon.x + x, moon.y + y, (1 - d) * 0.5)) px(moon.x + x, moon.y + y, 1, 1, 'rgba(240, 230, 200, 0.10)');
            }
        }
        shadeEllipse(moon.x, moon.y, 9, 9, (nx, ny) => (nx - ny > 0.9 ? '#fff6dc' : nx - ny < -0.8 ? '#d8cba3' : '#f3e7c4'));
        disc(moon.x - 3, moon.y - 2, 2, '#e2d5ae');
        disc(moon.x + 2, moon.y + 3, 1, '#e2d5ae');
        px(moon.x + 4, moon.y - 4, 2, 2, '#e2d5ae');
        // far and middle city
        for (const b of far) px(b.x, b.top, b.w, horizon - b.top, '#1c2350');
        for (const b of far) for (let y = b.top + 4; y < horizon; y += 7) if ((b.x + y) % 3 === 0) px(b.x + 3, y, 1, 1, '#3d4a8a');
        for (const b of mid) {
          px(b.x, b.top, b.w, horizon - b.top, '#151a3d');
          px(b.x, b.top, 1, horizon - b.top, '#1b2148');
          if (b.roof < 0.3) px(b.x + 3, b.top - 4, 6, 4, '#151a3d');
          for (let y = b.top + 4; y < horizon; y += 5) for (let x = b.x + 2; x < b.x + b.w - 2; x += 4) if ((x * 7 + y * 3) % 5 === 0) px(x, y, 2, 1, '#8a7a4a');
        }
        // framed print on the right wall
        if (!narrow) {
          const fx = Math.round(W * 0.66);
          const fy = Math.round(H * 0.12);
          const fw = 64;
          const fh = 44;
          px(fx - 4, fy - 4, fw + 8, fh + 8, '#4b3a64');
          px(fx - 4, fy - 4, fw + 8, 1, '#6d5a8a');
          px(fx - 4, fy + fh + 3, fw + 8, 1, '#2f2442');
          px(fx - 2, fy - 2, fw + 4, fh + 4, '#efe3cf');
          bands(fx, fy, fw, fh, ['#3a2a6a', '#8a3f78', '#e0654f', '#f7a45c', '#ffd383']);
          disc(fx + 44, fy + 22, 7, '#fff0c0');
          for (let k = 0; k < fw; k++) {
            const hh = Math.round(10 + Math.abs(Math.sin(k / 9)) * 9 + Math.sin(k / 3) * 2);
            px(fx + k, fy + fh - hh, 1, hh, k % 4 ? '#3a2150' : '#45285e');
            const h2 = Math.round(5 + Math.abs(Math.sin(k / 6 + 1)) * 6);
            px(fx + k, fy + fh - h2, 1, h2, '#2a1840');
          }
          // shelf with books, a candle and a succulent
          const sy = Math.round(H * 0.44);
          px(fx - 14, sy, 96, 4, '#9a6a4e');
          px(fx - 14, sy, 96, 1, '#b8866a');
          px(fx - 14, sy + 4, 96, 2, '#5a3a2a');
          for (const bx of [fx - 6, fx + 70]) {
            px(bx, sy + 6, 3, 8, '#5a3a2a');
            px(bx + 3, sy + 6, 1, 6, '#3d271d');
          }
          const spines = [
            ['#4a6fb3', 18],
            ['#b0495c', 16],
            ['#d9b46a', 19],
            ['#5f9a6e', 15],
            ['#8a62b8', 17],
          ];
          let bx = fx - 8;
          for (const [c, h] of spines) {
            px(bx, sy - h, 5, h, c);
            px(bx, sy - h, 1, h, 'rgba(255,255,255,0.18)');
            px(bx + 1, sy - h + 3, 3, 1, 'rgba(255,255,255,0.35)');
            px(bx + 1, sy - 4, 3, 1, 'rgba(0,0,0,0.25)');
            bx += 6;
          }
          // a leaning book
          for (let k = 0; k < 16; k++) px(bx + 2 + Math.floor(k / 4), sy - 1 - k, 4, 1, '#c06a3a');
          // succulent
          const px0 = fx + 52;
          px(px0, sy - 8, 12, 8, '#c9774a');
          px(px0, sy - 8, 12, 2, '#df8e60');
          px(px0 + 1, sy - 2, 10, 2, '#a85e38');
          for (const [ox, oy, h] of [[2, -12, 5], [5, -15, 7], [8, -12, 5], [4, -10, 3], [7, -10, 3]]) {
            px(px0 + ox, sy - 8 + oy + 8 - h, 2, h, '#6fbf7a');
            px(px0 + ox, sy - 8 + oy + 8 - h, 1, h, '#8fd89a');
          }
        }
      });

      const fg = layer(() => {
        // window frame with bevels
        const F = { base: '#5b4672', hi: '#7a6194', lo: '#3f2f55' };
        const bevel = (x, y, w, h) => {
          px(x, y, w, h, F.base);
          px(x, y, w, 1, F.hi);
          px(x, y, 1, h, F.hi);
          px(x, y + h - 1, w, 1, F.lo);
          px(x + w - 1, y, 1, h, F.lo);
        };
        bevel(win.x - 7, win.y - 7, win.w + 14, 7);
        bevel(win.x - 7, win.y + win.h, win.w + 14, 7);
        bevel(win.x - 7, win.y, 7, win.h);
        bevel(win.x + win.w, win.y, 7, win.h);
        bevel(win.x + win.w / 2 - 2, win.y, 5, win.h);
        bevel(win.x, win.y + Math.floor(win.h / 2) - 2, win.w, 4);
        // sill
        px(win.x - 14, win.y + win.h + 7, win.w + 28, 6, '#6d5585');
        px(win.x - 14, win.y + win.h + 7, win.w + 28, 1, '#9a84b3');
        px(win.x - 14, win.y + win.h + 13, win.w + 28, 2, '#3f2f55');
        // glass highlights
        const glare = (gx, gy, len) => {
          for (let k = 0; k < len; k++) px(gx + k, gy - k, 1, 1, 'rgba(255,255,255,0.10)');
          for (let k = 0; k < len * 0.6; k++) px(gx + 5 + k, gy - k, 1, 1, 'rgba(255,255,255,0.06)');
        };
        glare(win.x + 10, win.y + 34, 26);
        glare(win.x + win.w / 2 + 10, win.y + win.h / 2 + 30, 18);
        // curtains: soft folds with four shades and a tasselled tie-back
        px(win.x - 34, win.y - 20, win.w + 68, 3, '#3b2c55');
        px(win.x - 34, win.y - 20, win.w + 68, 1, '#55437a');
        disc(win.x - 36, win.y - 19, 3, '#c9a46a');
        disc(win.x + win.w + 36, win.y - 19, 3, '#c9a46a');
        const folds = ['#5c2c46', '#7b3f5e', '#93506f', '#a8637f'];
        const curtain = (cx, dir) => {
          const tall = win.h + 36;
          const tieY = Math.round(tall * 0.62);
          for (let y = 0; y < tall; y++) {
            const tie = Math.abs(y - tieY) / tieY;
            const width = Math.round(14 + tie * 16);
            for (let k = 0; k < width; k++) {
              const phase = (k / width) * Math.PI * 3 + (dir > 0 ? 0 : 1);
              const v = (Math.sin(phase) + 1) / 2;
              let idx = Math.min(3, Math.floor(v * 4));
              if (dith(k, y, v * 4 - idx) && idx < 3) idx++;
              px(dir > 0 ? cx + k : cx - k, win.y - 17 + y, 1, 1, folds[idx]);
            }
            if (y === tall - 1) px(dir > 0 ? cx : cx - width, win.y - 17 + y, width, 1, '#4a2238');
          }
          const tx = dir > 0 ? cx : cx - 18;
          px(tx, win.y - 17 + tieY, 19, 3, '#c9a46a');
          px(tx, win.y - 17 + tieY, 19, 1, '#e8c98a');
          px(dir > 0 ? tx + 16 : tx + 1, win.y - 14 + tieY, 2, 7, '#c9a46a');
        };
        curtain(win.x - 30, 1);
        curtain(win.x + win.w + 29, -1);

        // desk: wood with grain and a lit top edge
        px(0, deskY, W, 4, '#a8765a');
        px(0, deskY, W, 1, '#c8967a');
        bands(0, deskY + 4, W, 8, ['#86583f', '#7a523d']);
        px(0, deskY + 12, W, H - deskY - 12, '#563728');
        px(0, deskY + 12, W, 2, '#3d271d');
        for (let y = deskY + 16; y < H; y += 5)
          for (let x = 0; x < W; x += 1) if (Math.sin(x / 23 + y * 0.7) > 0.93) px(x, y, 1, 1, '#4c3022');
        for (let x = 20; x < W; x += 110) {
          px(x, deskY + 22, 70, 30, '#5e3d2c');
          px(x, deskY + 22, 70, 1, '#71493a');
          px(x, deskY + 51, 70, 1, '#3d271d');
          px(x + 29, deskY + 34, 12, 3, '#c9a46a');
          px(x + 29, deskY + 34, 12, 1, '#e8c98a');
        }

        // desk lamp: weighted base, two-part arm, shade with a lit rim
        const L = { metal: '#4b4064', metalHi: '#6c5f8c', shade: '#e7a24c', shadeHi: '#ffc778', shadeLo: '#b9752f' };
        shadeEllipse(lampX, deskY - 2, 16, 3, (nx, ny) => (ny < -0.2 ? '#5a4d78' : '#3b3150'));
        for (let k = 0; k < 40; k++) px(lampX - 1 + Math.round(k * 0.2), deskY - 4 - k, 3, 1, k % 10 === 0 ? L.metalHi : L.metal);
        disc(lampX + 7, deskY - 45, 3, L.metalHi);
        for (let k = 0; k < 22; k++) px(lampX + 7 + k, deskY - 46 - Math.round(k * 0.55), 3, 2, L.metal);
        const sx = lampX + 26;
        const sy = deskY - 66;
        for (let k = 0; k < 16; k++) {
          const w = 10 + k * 1.2;
          px(sx - 2 + 8 - w / 2, sy + k, w, 1, k < 3 ? L.shadeHi : k > 12 ? L.shadeLo : L.shade);
        }
        px(sx - 5, sy + 16, 26, 2, '#fff1c9');
        px(sx + 1, sy + 18, 14, 2, 'rgba(255, 241, 201, 0.6)');

        if (!narrow) {
          // open notebook with handwriting and a pencil
          const nx = Math.round(W * 0.36);
          const ny = deskY - 5;
          px(nx + 3, ny + 5, 54, 2, 'rgba(0,0,0,0.25)');
          px(nx, ny, 26, 6, '#efe6d6');
          px(nx + 28, ny, 26, 6, '#f6eee0');
          px(nx + 26, ny, 2, 6, '#b0a089');
          px(nx, ny - 1, 54, 1, '#d8ccb6');
          for (let k = 0; k < 3; k++) {
            for (let x = 2; x < 24; x += 1) if (Math.sin(x * 1.7 + k) > -0.2) px(nx + x, ny + 1 + k * 2, 1, 1, '#6f6a8a');
            for (let x = 30; x < 50 - k * 6; x += 1) if (Math.sin(x * 1.3 + k * 2) > -0.1) px(nx + x, ny + 1 + k * 2, 1, 1, '#6f6a8a');
          }
          px(nx + 36, ny + 7, 22, 2, '#f2c14e');
          px(nx + 36, ny + 8, 22, 1, '#d39a2c');
          px(nx + 58, ny + 7, 3, 2, '#f2b5a0');
          px(nx + 34, ny + 7, 2, 2, '#3a2a20');
          // headphones
          const hx = Math.round(W * 0.7);
          for (let k = 0; k <= 16; k++) {
            const a = Math.PI * (k / 16);
            px(hx + 10 - Math.cos(a) * 10, deskY - 4 - Math.sin(a) * 9, 2, 2, k % 4 ? '#6c5f8c' : '#8a7cb0');
          }
          shadeEllipse(hx + 1, deskY - 3, 3, 3, (nx2) => (nx2 > 0.2 ? '#f07a8a' : '#c94a5c'));
          shadeEllipse(hx + 20, deskY - 3, 3, 3, (nx2) => (nx2 > 0.2 ? '#f07a8a' : '#c94a5c'));
          // book stack and a potted plant by the lamp
          const stack = [
            ['#4a6fb3', 30, 0],
            ['#b0495c', 26, 2],
            ['#d9b46a', 28, -1],
          ];
          stack.forEach(([c, w, off], i) => {
            const yy = deskY - 6 - i * 6;
            px(lampX - 70 + off, yy, w, 6, c);
            px(lampX - 70 + off, yy, w, 1, 'rgba(255,255,255,0.25)');
            px(lampX - 70 + off + w - 3, yy + 1, 3, 4, '#efe6d6');
          });
          const pp = lampX - 32;
          px(pp, deskY - 14, 16, 14, '#c9774a');
          px(pp, deskY - 14, 16, 3, '#df8e60');
          px(pp + 2, deskY - 3, 12, 3, '#a85e38');
          // a leafy plant: overlapping shaded leaves around a short stem
          px(pp + 7, deskY - 22, 2, 9, '#3f7a48');
          const leaves = [[-6, -6], [6, -7], [-9, -12], [9, -13], [-3, -14], [4, -16], [-6, -20], [6, -21], [0, -25]];
          for (const [lx, ly] of leaves) {
            shadeEllipse(pp + 8 + lx, deskY - 14 + ly, 4.5, 2.6, (nx, ny, xx, yy) => {
              const l = nx * 0.6 - ny * 0.7;
              if (Math.abs(ny) < 0.18 && Math.abs(nx) < 0.7) return '#3f7a48';
              return l > 0.35 ? '#8fd89a' : l > -0.2 ? '#5fb06b' : '#3f8a4c';
            });
          }
        }
      });

      return {
        narrow,
        win,
        deskY,
        lampX,
        moon,
        bg,
        fg,
        near,
        horizon,
        flash: 0,
        splashes: [],
        clouds: Array.from({ length: 3 }, () => ({ x: win.x + r() * win.w, y: win.y + 8 + r() * 30, w: 30 + r() * 40, v: 0.08 + r() * 0.08 })),
        glow: makeGlow(lampX + 34, deskY - 40, 230, 170, 'rgba(255, 179, 92, 0.075)', 4),
        pool: makeGlow(lampX + 30, deskY + 2, 120, 14, 'rgba(255, 220, 150, 0.12)', 3),
        rainFar: Array.from({ length: Math.round(win.w * 0.7) }, () => ({ x: win.x + r() * win.w, y: win.y + r() * win.h, v: 4 + r() * 2, len: 3 + Math.floor(r() * 3) })),
        rainNear: Array.from({ length: Math.round(win.w * 0.25) }, () => ({ x: win.x + r() * win.w, y: win.y + r() * win.h, v: 8 + r() * 3, len: 7 + Math.floor(r() * 5) })),
        drops: Array.from({ length: Math.round(win.w / 9) }, () => ({ x: win.x + 3 + Math.floor(r() * (win.w - 6)), y: win.y + Math.floor(r() * win.h), slide: r() < 0.35, size: r() < 0.3 ? 2 : 1, trail: 0 })),
      };
    },
    update(s) {
      const { win } = s;
      for (const d of s.rainFar) {
        d.y += d.v;
        d.x -= d.v * 0.18;
        if (d.y > win.y + win.h) {
          d.y = win.y - d.len;
          d.x = win.x + Math.random() * (win.w + 30);
        }
      }
      for (const d of s.rainNear) {
        d.y += d.v;
        d.x -= d.v * 0.2;
        if (d.y > win.y + win.h) {
          if (Math.random() < 0.6) s.splashes.push({ x: Math.round(d.x), life: 4 });
          d.y = win.y - d.len;
          d.x = win.x + Math.random() * (win.w + 30);
        }
      }
      s.splashes = s.splashes.filter((p) => --p.life > 0);
      for (const d of s.drops) {
        if (d.slide && Math.random() < 0.35) {
          d.y += 1 + (Math.random() < 0.3 ? 1 : 0);
          d.trail = Math.min(10, d.trail + 1);
        }
        if (d.y > win.y + win.h) {
          d.y = win.y;
          d.trail = 0;
          d.x = win.x + 3 + Math.floor(Math.random() * (win.w - 6));
        }
      }
      for (const c of s.clouds) {
        c.x += c.v;
        if (c.x > win.x + win.w + 10) c.x = win.x - c.w - 10;
      }
      if (s.flash > 0) s.flash = Math.max(0, s.flash - 0.16);
      else if (Math.random() < 1 / 500) s.flash = 1;
      if (s.flash > 0.45 && s.flash < 0.6) s.flash = 0.95;
    },
    draw(s, t) {
      const { win, deskY, horizon } = s;
      ctxRef.drawImage(s.bg, 0, 0);
      ctxRef.save();
      ctxRef.beginPath();
      ctxRef.rect(win.x, win.y, win.w, win.h);
      ctxRef.clip();
      // night clouds drifting across the moon
      for (const c of s.clouds) {
        for (let k = 0; k < c.w; k++) {
          const h = Math.round(3 + Math.sin((k / c.w) * Math.PI) * 4);
          px(c.x + k, c.y - h / 2, 1, h, 'rgba(30, 36, 80, 0.55)');
        }
      }
      if (s.flash > 0) {
        ctxRef.fillStyle = `rgba(190, 200, 255, ${s.flash * 0.4})`;
        ctxRef.fillRect(win.x, win.y, win.w, win.h);
      }
      // near buildings with lit windows, some with blinds, the odd one switching
      const tick = Math.floor(t / 2500);
      s.near.forEach((b, bi) => {
        px(b.x, b.top, b.w, horizon - b.top, '#0d1130');
        px(b.x + b.w - 2, b.top, 2, horizon - b.top, '#0a0d26');
        px(b.x, b.top, b.w, 1, '#262c5a');
        if (b.roof < 0.25) {
          px(b.x + 4, b.top - 7, 8, 7, '#0d1130');
          px(b.x + 4, b.top - 7, 8, 1, '#262c5a');
        } else if (b.roof < 0.5) {
          px(b.x + Math.floor(b.w / 2), b.top - 10, 1, 10, '#0d1130');
          if (Math.floor(t / 700 + bi) % 2) px(b.x + Math.floor(b.w / 2), b.top - 11, 1, 1, '#ff4a4a');
        }
        b.windows.forEach((w, wi) => {
          const on = w.on !== ((bi * 31 + wi * 17 + tick) % 89 === 0);
          if (!on) {
            px(w.x, w.y, 3, 3, '#151a40');
            return;
          }
          const c = w.warm ? '#ffd27a' : '#bfe0ff';
          px(w.x, w.y, 3, 3, c);
          px(w.x, w.y + 2, 3, 1, w.warm ? '#d9a24e' : '#8fb4dd');
          if (w.blind) px(w.x, w.y, 3, 1, w.warm ? '#b9843e' : '#6f8fbf');
        });
      });
      ctxRef.fillStyle = 'rgba(123, 140, 207, 0.55)';
      for (const d of s.rainFar) ctxRef.fillRect(Math.round(d.x), Math.round(d.y), 1, d.len);
      ctxRef.fillStyle = 'rgba(170, 185, 240, 0.8)';
      for (const d of s.rainNear) ctxRef.fillRect(Math.round(d.x), Math.round(d.y), 1, d.len);
      ctxRef.restore();
      // drops on the glass, with a wet trail behind the sliding ones
      for (const d of s.drops) {
        if (d.trail) px(d.x, d.y - d.trail, 1, d.trail, 'rgba(200, 215, 255, 0.12)');
        px(d.x, d.y, d.size + 1, d.size + 1, 'rgba(200, 215, 255, 0.35)');
        px(d.x, d.y, 1, 1, 'rgba(255, 255, 255, 0.75)');
      }
      ctxRef.drawImage(s.fg, 0, 0);
      ctxRef.fillStyle = 'rgba(200, 215, 255, 0.7)';
      for (const p of s.splashes) {
        const k = 5 - p.life;
        ctxRef.fillRect(p.x - k, win.y + win.h + 6 - p.life, 1, 1);
        ctxRef.fillRect(p.x + k, win.y + win.h + 6 - p.life, 1, 1);
      }
      // fairy lights along the curtain rod, each bulb with a small halo
      const colors = ['#ffd27a', '#ff8fb1', '#8fd3ff', '#b6f28a', '#ffb35c'];
      const x0 = win.x - 30;
      const x1 = win.x + win.w + 30;
      for (let x = x0, i = 0; x <= x1; x += 9, i++) {
        const sag = Math.round(Math.sin((((x - x0) % 54) / 54) * Math.PI) * 6);
        const y = win.y - 15 + sag;
        if (x < x1) px(x, y, 9, 1, '#241a36');
        const on = Math.sin(t / 650 + i * 1.9) > -0.35;
        const c = colors[i % colors.length];
        if (on) {
          px(x - 2, y, 7, 6, 'rgba(255, 225, 170, 0.07)');
          px(x - 1, y + 1, 5, 4, 'rgba(255, 225, 170, 0.10)');
        }
        px(x + 1, y + 1, 2, 3, on ? c : '#4a3b5e');
        if (on) px(x + 1, y + 1, 1, 1, '#ffffff');
      }
      // candle on the shelf
      if (!s.narrow) {
        const cx = Math.round(W * 0.66) + 38;
        const cy = Math.round(H * 0.44);
        px(cx, cy - 10, 6, 10, '#efe3cf');
        px(cx, cy - 10, 2, 10, '#fff6e8');
        px(cx + 2, cy - 12, 1, 2, '#3a2a20');
        const fl = Math.random() < 0.3 ? 1 : 0;
        px(cx + 1 + fl, cy - 17, 2, 5, '#ffb347');
        px(cx + 2, cy - 15 - fl, 1, 3, '#fff1c9');
        px(cx - 3, cy - 20, 12, 10, 'rgba(255, 190, 110, 0.06)');
      }
      // mug of coffee with curling steam
      const mx = s.narrow ? win.x + 20 : Math.round(W * 0.62);
      const my = deskY - 13;
      px(mx + 2, deskY - 1, 16, 2, 'rgba(0,0,0,0.3)');
      shadeEllipse(mx + 7, my + 1, 7, 2, () => '#d8d0e6');
      px(mx, my + 1, 15, 12, '#e9e2f2');
      px(mx + 10, my + 1, 4, 12, '#c9c0da');
      px(mx, my + 1, 2, 12, '#ffffff');
      shadeEllipse(mx + 7, my + 1, 6, 1.5, () => '#5a2f24');
      for (let k = 0; k < 8; k++) px(mx + 15 + Math.round(Math.sin((k / 8) * Math.PI) * 4), my + 3 + k, 2, 1, '#c9c0da');
      px(mx + 3, my + 6, 8, 2, '#e05a6b');
      for (let k = 0; k < 3; k++) {
        const phase = t / 420 + k * 2.1;
        for (let j = 0; j < 9; j++) {
          const yy = my - 3 - j * 2 - ((t / 90 + k * 7) % 4);
          const xx = mx + 4 + k * 3 + Math.round(Math.sin(phase + j * 0.6) * 2);
          const a = 0.45 * (1 - j / 9);
          px(xx, yy, 1, 2, `rgba(240, 235, 250, ${a})`);
        }
      }
      hdCat(s.narrow ? win.x + Math.round(win.w * 0.4) : Math.round(W * 0.49), deskY - 12, t);
      ctxRef.drawImage(s.pool, 0, 0);
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
    const scale = Math.max(1, Math.round(innerHeight / ((current && current.targetH) || TARGET_H)));
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
    resize(); // scenes can ask for their own resolution
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
