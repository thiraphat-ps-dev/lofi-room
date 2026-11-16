// The pixel room: drawn at 240x135 and scaled up with crisp pixels by CSS.
// A window with a rainy city outside, a desk lamp, a mug, a plant and a sleeping cat.
(() => {
  'use strict';

  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const W = 240;
  const H = 135;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Window opening (inside the frame)
  const WIN = { x: 22, y: 14, w: 128, h: 74 };

  const C = {
    wall: '#2b2142',
    wallLine: '#30254a',
    frame: '#5b4672',
    frameLight: '#7a6194',
    sill: '#6d5585',
    sky: ['#0c1130', '#121a3f', '#1b2350', '#262a5c'],
    moon: '#f3e7c4',
    bldg: ['#10152f', '#151b3a', '#1a2045'],
    lit: '#ffd27a',
    litDim: '#c99a4e',
    rain: '#7b8ccf',
    drop: '#b9c6f2',
    deskTop: '#7a523d',
    deskEdge: '#94664c',
    deskFront: '#563728',
    deskShadow: '#3d271d',
    glow: 'rgba(255, 179, 92, 0.10)',
  };

  // --- tiny sprite helper: rows of characters mapped to colours, '.' is transparent
  function sprite(rows, palette) {
    return { rows, palette, w: rows[0].length, h: rows.length };
  }
  function blit(s, x, y) {
    for (let j = 0; j < s.h; j++) {
      const row = s.rows[j];
      for (let i = 0; i < s.w; i++) {
        const ch = row[i];
        if (ch === '.') continue;
        ctx.fillStyle = s.palette[ch];
        ctx.fillRect(x + i, y + j, 1, 1);
      }
    }
  }

  const catPal = { o: '#e39a52', d: '#b96c2f', w: '#f5e2c4', e: '#4a2c1c', p: '#f29a9a' };
  const catBody = sprite(
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
  // tail frames, drawn to the left of the body
  const tails = [
    sprite(['..oo', '.o..', 'o...', 'o...'], catPal),
    sprite(['....', '.oo.', 'o..o', 'o...'], catPal),
  ];

  const mug = sprite(
    ['.wwwww..', '.wrrrw..', '.wrrrwww', '.wrrrw.w', '.wrrrwww', '.wwwww..', '..www...'],
    { w: '#e9e2f2', r: '#5a2f24' },
  );

  const plant = sprite(
    [
      '...g..g...',
      '..gGg.gg..',
      '.gGGggGg..',
      'gg.gGGg.g.',
      '...gGg....',
      '..ppppp...',
      '..pPPPp...',
      '..pPPPp...',
      '...ppp....',
    ],
    { g: '#4f9d5b', G: '#6fc27a', p: '#b5643e', P: '#cf7a4f' },
  );

  const books = sprite(
    ['bbbbbbbbbb', 'BBBBBBBBBB', 'rrrrrrrrr.', 'RRRRRRRRR.', 'tttttttttt'],
    { b: '#4a6fb3', B: '#3a5891', r: '#b0495c', R: '#8c3849', t: '#d9b46a' },
  );

  // --- deterministic random so the skyline doesn't change on resize
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const buildings = [];
  {
    let x = WIN.x - 2;
    while (x < WIN.x + WIN.w) {
      const w = 8 + Math.floor(rnd() * 14);
      const top = WIN.y + 26 + Math.floor(rnd() * 34);
      const windows = [];
      for (let wy = top + 3; wy < WIN.y + WIN.h - 2; wy += 4) {
        for (let wx = x + 2; wx < x + w - 2; wx += 3) {
          if (rnd() < 0.35) windows.push({ x: wx, y: wy, on: rnd() < 0.8 });
        }
      }
      buildings.push({ x, w, top, color: C.bldg[Math.floor(rnd() * C.bldg.length)], windows });
      x += w + (rnd() < 0.3 ? 2 : 0);
    }
  }

  const rain = Array.from({ length: 70 }, () => ({
    x: WIN.x + Math.floor(rnd() * WIN.w),
    y: WIN.y + Math.floor(rnd() * WIN.h),
    v: 3 + Math.floor(rnd() * 3),
  }));
  const drops = Array.from({ length: 18 }, () => ({
    x: WIN.x + 2 + Math.floor(rnd() * (WIN.w - 4)),
    y: WIN.y + Math.floor(rnd() * WIN.h),
    slide: rnd() < 0.4,
  }));

  // --- pre-rendered lamp glow with ordered dithering (classic pixel-art light falloff)
  const BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  const glow = document.createElement('canvas');
  glow.width = W;
  glow.height = H;
  {
    const g = glow.getContext('2d');
    const cx = 196;
    const cy = 82;
    const r = 95;
    g.fillStyle = C.glow;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot((x - cx) * 0.9, y - cy) / r;
        if (d >= 1) continue;
        const level = (1 - d) * 3; // up to three stacked layers
        for (let k = 0; k < 3; k++) {
          const t = level - k;
          if (t <= 0) break;
          if (t >= 1 || t * 16 > BAYER[y & 3][x & 3]) g.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  function px(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function drawRoom(t) {
    // wall with faint vertical wallpaper lines
    px(0, 0, W, H, C.wall);
    for (let x = 4; x < W; x += 8) px(x, 0, 1, H, C.wallLine);

    // sky, in dithered bands
    const bandH = Math.ceil(WIN.h / C.sky.length);
    C.sky.forEach((c, i) => px(WIN.x, WIN.y + i * bandH, WIN.w, bandH, c));
    for (let i = 1; i < C.sky.length; i++) {
      const y0 = WIN.y + i * bandH;
      ctx.fillStyle = C.sky[i];
      for (let x = WIN.x; x < WIN.x + WIN.w; x += 2) ctx.fillRect(x + ((y0 >> 0) & 1), y0 - 1, 1, 1);
    }

    // moon
    ctx.fillStyle = C.moon;
    for (let y = -5; y <= 5; y++)
      for (let x = -5; x <= 5; x++) if (x * x + y * y <= 25) ctx.fillRect(WIN.x + 104 + x, WIN.y + 12 + y, 1, 1);
    px(WIN.x + 106, WIN.y + 9, 2, 2, '#d9cca6');
    px(WIN.x + 101, WIN.y + 14, 2, 1, '#d9cca6');

    // skyline; a window flips now and then
    ctx.save();
    ctx.beginPath();
    ctx.rect(WIN.x, WIN.y, WIN.w, WIN.h);
    ctx.clip();
    const tick = Math.floor(t / 2500);
    buildings.forEach((b, bi) => {
      px(b.x, b.top, b.w, WIN.y + WIN.h - b.top, b.color);
      b.windows.forEach((w, wi) => {
        const flicker = (bi * 31 + wi * 17 + tick) % 97 === 0;
        const on = w.on !== flicker;
        if (on) px(w.x, w.y, 1, 2, (wi + bi) % 3 ? C.lit : C.litDim);
      });
    });

    // rain
    ctx.fillStyle = C.rain;
    for (const r of rain) ctx.fillRect(r.x, r.y, 1, 3);
    ctx.restore();

    // drops on the glass
    ctx.fillStyle = C.drop;
    for (const d of drops) {
      ctx.fillRect(d.x, d.y, 1, 1);
      if (d.slide) ctx.fillRect(d.x, d.y - 1, 1, 1);
    }

    // window frame, mullions and sill
    px(WIN.x - 4, WIN.y - 4, WIN.w + 8, 4, C.frame);
    px(WIN.x - 4, WIN.y + WIN.h, WIN.w + 8, 4, C.frame);
    px(WIN.x - 4, WIN.y, 4, WIN.h, C.frame);
    px(WIN.x + WIN.w, WIN.y, 4, WIN.h, C.frame);
    px(WIN.x + WIN.w / 2 - 1, WIN.y, 3, WIN.h, C.frame);
    px(WIN.x, WIN.y + WIN.h / 2 - 1, WIN.w, 2, C.frame);
    px(WIN.x - 4, WIN.y - 4, WIN.w + 8, 1, C.frameLight);
    px(WIN.x - 8, WIN.y + WIN.h + 4, WIN.w + 16, 3, C.sill);
    px(WIN.x - 8, WIN.y + WIN.h + 4, WIN.w + 16, 1, C.frameLight);

    // desk
    const deskY = 104;
    px(0, deskY, W, 3, C.deskEdge);
    px(0, deskY + 3, W, 4, C.deskTop);
    px(0, deskY + 7, W, H - deskY - 7, C.deskFront);
    px(0, deskY + 7, W, 1, C.deskShadow);
    for (let x = 12; x < W; x += 56) px(x, deskY + 14, 30, 1, C.deskShadow);

    // lamp (base, arm, shade, bulb)
    px(186, deskY - 2, 18, 2, '#3b3150');
    px(194, deskY - 26, 2, 24, '#4b4064');
    px(195, deskY - 27, 14, 2, '#4b4064');
    px(204, deskY - 30, 14, 6, '#e7a24c');
    px(203, deskY - 24, 16, 1, '#c27b2c');
    px(208, deskY - 23, 6, 2, '#fff1c9');

    // props
    blit(books, 150, deskY - 5);
    blit(plant, 166, deskY - 9);
    blit(mug, 34, deskY - 7);

    // steam rising from the mug
    const s = Math.floor(t / 300) % 4;
    ctx.fillStyle = 'rgba(233, 226, 242, 0.55)';
    [
      [37 + (s % 2), deskY - 10 - s],
      [39 - (s % 2), deskY - 13 - s],
      [38, deskY - 16 - ((s + 2) % 4)],
    ].forEach(([x, y]) => ctx.fillRect(x, y, 1, 2));

    // the cat, breathing slowly, tail flicking now and then
    const breathe = Math.floor(t / 1600) % 2;
    const catX = 78;
    const catY = deskY - catBody.h + 1;
    blit(tails[Math.floor(t / 900) % 5 === 0 ? 1 : 0], catX - 3, catY + 4);
    blit(catBody, catX, catY + (breathe ? 0 : 0));
    if (breathe) px(catX + 3, catY + 3, 6, 1, catPal.d);
    // "z" floating up
    const zt = (t / 1200) % 3;
    if (zt < 2) {
      const zx = catX + 18 + Math.floor(zt * 2);
      const zy = catY - 4 - Math.floor(zt * 4);
      ctx.fillStyle = 'rgba(244, 233, 216, 0.75)';
      ctx.fillRect(zx, zy, 3, 1);
      ctx.fillRect(zx + 1, zy + 1, 1, 1);
      ctx.fillRect(zx, zy + 2, 3, 1);
    }

    // lamp light over everything
    ctx.drawImage(glow, 0, 0);
  }

  function update() {
    for (const r of rain) {
      r.y += r.v;
      r.x -= 1;
      if (r.y > WIN.y + WIN.h) {
        r.y = WIN.y - 3;
        r.x = WIN.x + Math.floor(Math.random() * (WIN.w + 20));
      }
    }
    for (const d of drops) {
      if (d.slide && Math.random() < 0.3) d.y += 1;
      if (d.y > WIN.y + WIN.h) {
        d.y = WIN.y;
        d.x = WIN.x + 2 + Math.floor(Math.random() * (WIN.w - 4));
      }
    }
  }

  ctx.imageSmoothingEnabled = false;
  if (still) {
    drawRoom(0);
    return;
  }
  // Pixel art reads best at a low, steady frame rate.
  const STEP = 1000 / 12;
  let acc = 0;
  let last = performance.now();
  function frame(now) {
    acc += Math.min(250, now - last);
    last = now;
    if (acc >= STEP) {
      while (acc >= STEP) {
        update();
        acc -= STEP;
      }
      drawRoom(now);
    }
    requestAnimationFrame(frame);
  }
  drawRoom(0);
  requestAnimationFrame(frame);
})();
