import {
  W,
  H,
  ctxRef,
  look,
  rng,
  px,
  disc,
  sprite,
  blit,
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
  makeShaft,
  makeMist,
} from './kit.js';

// ------------------------------------------------------------------ scene: snowy cabin

const harePal = { w: '#c4b3a0', k: '#22202c' };
const hareFrames = [
  sprite(['.......w.w.', '.......w.w.', '......wwww.', '..www.wwkw.', '.wwwwwwwww.', 'wwwwwwwww..', 'wwwwwwww...', '.www.www...'], harePal),
  sprite(['........w.w', '.......wwww', '.......wwkw', '..wwwwwwww.', '.wwwwwwww..', 'wwwwwwww...', 'w.w....ww..', '...........'], harePal),
];

const cabin = {
  id: 'snow',
  name: 'กระท่อมหิมะ',
  accent: '#9fe3ff',
  init() {
    const r = rng(23);
    const narrow = W < 420;
    const ground = Math.round(H * 0.66);
    const cw = 80;
    const ch = 45;
    const cx = narrow ? Math.round(W / 2 - cw / 2) : Math.round(W * 0.5);
    const cy = ground + 6 - ch; // top of the log wall
    const dx = cx + 33; // door
    const wy = cy + 17; // window top
    const windows = [cx + 8, cx + 56];
    const chx = cx + 52;
    const chy = cy - 42;
    const lampX = cx + cw + (narrow ? 16 : 44);
    const moon = { x: Math.round(W * 0.34), y: Math.round(H * 0.13) };
    const SNOW = '#f4f8ff';

    const sky = layer(() => {
      bands(0, 0, W, ground, ['#050818', '#08102a', '#0d1a3e', '#142650', '#1d3462', '#284474']);
      haloRing(moon.x, moon.y, 9, 28, 'rgba(210, 225, 255, 0.12)');
      disc(moon.x, moon.y, 9, '#f4f7ff');
      disc(moon.x + 5, moon.y - 2, 8, '#14234a');
    });

    const ridge = (base, amp, seed) =>
      Array.from({ length: W + 2 }, (_, x) =>
        Math.round(base - (1 - Math.abs(Math.sin(x / 71 + seed))) * amp - (1 - Math.abs(Math.sin(x / 31 + seed * 2.3))) * amp * 0.4 - Math.sin(x / 7 + seed) * amp * 0.04),
      );
    const paintRidge = (rd, base, C) => {
      for (let x = 0; x < W; x++) {
        const top = rd[x];
        const cap = Math.max(0, Math.round((base - top) * 0.42 + Math.sin(x / 2.3) * 1.5 + Math.sin(x / 5.1) * 2));
        for (let y = top; y < ground; y++) {
          const d = y - top;
          const sx = Math.max(4, Math.min(W - 4, Math.round(x + d * 0.5)));
          const lit = rd[sx + 4] - rd[sx - 4] < 0; // the face that looks toward the moon
          px(x, y, 1, 1, d < cap ? (lit ? C.snow : C.snowS) : lit ? C.rock : C.rockS);
        }
      }
    };

    const far = layer(() => {
      paintRidge(ridge(H * 0.5, H * 0.2, 1.3), H * 0.5, { rock: '#2f4672', rockS: '#243963', snow: '#c3d2ec', snowS: '#8ba0c8' });
      paintRidge(ridge(H * 0.58, H * 0.14, 4.1), H * 0.58, { rock: '#243c66', rockS: '#182a4e', snow: '#e3ecfb', snowS: '#9db3d8' });
    });

    const land = layer(() => {
      for (let x = 0; x < W; x += 5 + Math.floor(r() * 6)) hdPine(x, ground + 1, 12 + Math.floor(r() * 14), ['#142c44', '#1b3a56', '#24506c'], '#aebfdc');

      // snowfield with drifts
      bands(0, ground, W, H - ground, ['#e9f1fb', '#d6e2f4', '#c0d0ea', '#a9bcdc', '#93a8cd']);
      for (let i = 0; i < Math.round(W / 50); i++) {
        const x0 = r() * W;
        const y0 = ground + 16 + r() * (H - ground - 22);
        const len = 30 + r() * 50;
        for (let k = 0; k < len; k++) {
          const yy = y0 - Math.round(Math.sin((k / len) * Math.PI) * 3);
          px(x0 + k, yy, 1, 1, '#f8fbff');
          if (dith(Math.round(x0 + k), Math.round(y0 + 1), 0.6)) px(x0 + k, y0 + 1, 1, 1, '#9db1d6');
        }
      }
      for (let i = 0; i < W * 0.3; i++) px(r() * W, ground + 4 + r() * (H - ground - 4), 1, 1, '#ffffff');

      // tall pines either side, the nearest drawn last
      const trees = [];
      for (let i = 0; i < Math.round(W / 24); i++) {
        const x = Math.round(r() * W);
        if (x > cx - 76 && x < lampX + 30) continue;
        trees.push({ x, base: ground + 2 + Math.round(r() * 28), h: 44 + Math.floor(r() * 60) });
      }
      trees.sort((a, b) => a.base - b.base);
      for (const tr of trees) {
        shadeEllipse(tr.x + 5, tr.base + 1, tr.h * 0.28, 3, (nx, ny, x, y) => (dith(x, y, 0.5) ? '#9db1d6' : null));
        hdPine(tr.x, tr.base, tr.h, ['#0f2a3e', '#173b52', '#215068'], '#eef4fd');
      }

      // fence on both sides of the yard
      const fence = (x0, x1) => {
        if (x1 - x0 < 20) return;
        for (const ry of [ground + 8, ground + 13]) {
          px(x0, ry, x1 - x0, 2, '#7a5844');
          px(x0, ry - 1, x1 - x0, 1, SNOW);
        }
        for (let x = x0; x <= x1; x += 12) {
          px(x, ground + 4, 3, 14, '#6b4b3a');
          px(x + 2, ground + 4, 1, 14, '#4f3629');
          px(x - 1, ground + 2, 5, 2, SNOW);
        }
      };
      fence(Math.max(-6, cx - 150), cx - 64);
      fence(lampX + 14, Math.min(W + 6, lampX + 158));

      // footprints from the door toward us
      for (let k = 0; k < 14; k++) {
        const f = k / 14;
        const fy = ground + 12 + Math.round(f * (H - ground - 14));
        const fx = dx + 6 + Math.round(Math.sin(f * 2.2) * 26) + (k % 2 ? 4 : -2);
        const size = 2 + Math.round(f * 2);
        px(fx, fy, size + 1, size, '#a9bcdc');
        px(fx, fy, size + 1, 1, '#8ea4cc');
      }

      // ---- the cabin: log walls with round log ends at the corners
      const LOG = { a: '#8a5638', hi: '#a56d48', lo: '#5e3826', end: '#c79a6a', endLo: '#8a5e3e' };
      for (let y = cy; y < cy + ch; y += 5) {
        px(cx, y, cw, 5, LOG.a);
        px(cx, y, cw, 1, LOG.hi);
        px(cx, y + 4, cw, 1, LOG.lo);
        for (let k = 0; k < 3; k++) px(cx + 6 + Math.floor(r() * (cw - 14)), y + 2, 2 + Math.floor(r() * 4), 1, LOG.lo);
        for (const ex of [cx - 2, cx + cw - 3]) {
          px(ex, y, 5, 5, LOG.end);
          px(ex + 1, y + 1, 3, 3, LOG.endLo);
          px(ex + 2, y + 2, 1, 1, LOG.end);
        }
      }
      px(cx - 2, cy + 6, cw + 4, 3, 'rgba(20, 10, 10, 0.3)');

      // roof under a blanket of snow, with a couple of bare patches
      const rh = 30;
      for (let k = 0; k <= rh; k++) {
        const inset = Math.round((k / rh) * 23);
        const x0 = cx - 9 + inset;
        const x1 = cx + cw + 9 - inset;
        const y = cy - k;
        const v = 1 - k / rh;
        for (let x = x0; x < x1; x++) {
          const edge = x - x0 < 3;
          px(x, y, 1, 1, edge || (v > 0.6 && dith(x, y, (v - 0.6) * 1.8)) ? '#c6d6ee' : v > 0.3 && dith(x, y, (v - 0.3) * 1.2) ? '#e6eefa' : '#ffffff');
        }
      }
      for (const [ox, oy, w] of [[12, 9, 13], [60, 6, 9]]) {
        px(cx + ox, cy - oy, w, 4, '#5a3a2c');
        for (let i = 0; i < w; i += 4) px(cx + ox + i, cy - oy, 1, 4, '#472c20');
        px(cx + ox, cy - oy + 2, w, 1, '#472c20');
        px(cx + ox - 1, cy - oy - 1, w + 2, 1, '#c6d6ee');
      }
      // stone chimney
      px(chx, chy, 12, 28, '#676370');
      for (let j = 0; j < 28; j += 4) {
        px(chx, chy + j, 12, 1, '#4a4654');
        for (let i = (j / 4) % 2 ? 3 : 7; i < 12; i += 8) px(chx + i, chy + j, 1, 4, '#4a4654');
        if (r() < 0.6) px(chx + 1 + Math.floor(r() * 7), chy + j + 1, 3, 2, '#7f7b88');
      }
      px(chx + 9, chy, 3, 28, 'rgba(10, 10, 30, 0.25)');
      px(chx - 2, chy - 3, 16, 4, SNOW);
      px(chx - 2, chy, 16, 1, '#b9cbe6');
      px(chx + 3, chy - 3, 6, 2, '#2a2630');
      px(chx - 4, chy + 25, 20, 4, '#ffffff');
      // eave: a thick lip of snow with icicles
      px(cx - 11, cy, cw + 22, 4, SNOW);
      px(cx - 12, cy + 1, cw + 24, 2, SNOW);
      px(cx - 11, cy + 3, cw + 22, 1, '#b9cbe6');
      px(cx - 8, cy + 4, cw + 16, 2, '#3c241a');
      for (let x = cx - 9; x < cx + cw + 9; x += 3 + Math.floor(r() * 4)) {
        const len = 2 + Math.floor(r() * 6);
        px(x, cy + 4, 1, len, '#dcebff');
        px(x, cy + 4, 1, Math.ceil(len / 2), '#ffffff');
      }

      // door with a wreath, a stone step and a wall lantern
      px(dx - 2, cy + 16, 18, 29, '#3c241a');
      px(dx, cy + 18, 14, 27, '#5a3524');
      for (let i = 0; i < 14; i += 4) px(dx + i, cy + 18, 1, 27, '#472a1c');
      px(dx, cy + 18, 14, 1, '#6e4530');
      px(dx + 11, cy + 33, 2, 2, '#e8c98a');
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        px(dx + 6 + Math.cos(a) * 4, cy + 25 + Math.sin(a) * 4, 2, 2, k % 3 ? '#2f7a4a' : '#49a868');
      }
      px(dx + 2, cy + 24, 1, 1, '#e0453c');
      px(dx + 10, cy + 27, 1, 1, '#e0453c');
      px(dx + 6, cy + 29, 3, 2, '#e0453c');
      px(dx - 6, cy + 45, 26, 3, '#7d7986');
      px(dx - 7, cy + 44, 28, 2, SNOW);
      px(dx + 18, cy + 21, 4, 1, '#23252f');
      px(dx + 19, cy + 22, 3, 5, '#23252f');

      // window frames, shutters and snowy sills (the panes are lit at run time)
      for (const wx of windows) {
        px(wx - 2, wy - 2, 20, 18, '#3c241a');
        for (const sx of [wx - 6, wx + 18]) {
          px(sx, wy - 1, 4, 16, '#2f6a52');
          px(sx, wy - 1, 1, 16, '#3f8a6a');
          for (let j = 1; j < 15; j += 3) px(sx + 1, wy + j, 3, 1, '#24523f');
        }
        px(wx - 3, wy + 15, 22, 2, SNOW);
        px(wx - 3, wy + 17, 22, 1, '#b9cbe6');
      }

      // snow banked against the walls
      for (let x = cx - 12; x < cx + cw + 12; x++) {
        if (x >= dx - 7 && x <= dx + 21) continue;
        const hh = Math.round(3 + Math.sin(x / 7) * 1.5 + Math.sin(x / 3) * 0.7);
        px(x, ground + 6 - hh, 1, hh + 2, SNOW);
      }

      // firewood stacked by the wall
      for (let row = 0; row < 4; row++)
        for (let k = 0; k < 5 - (row > 2 ? 1 : 0); k++) {
          const lx = cx - 29 + k * 5 + (row % 2 ? 2 : 0);
          const ly = ground + 4 - row * 5;
          disc(lx, ly, 2, '#9a6a44');
          px(lx - 1, ly - 1, 3, 3, '#c79a6a');
          px(lx, ly, 1, 1, '#7a4e30');
        }
      px(cx - 32, ground - 14, 25, 2, SNOW);
      px(cx - 30, ground - 16, 18, 2, SNOW);

      // snowman
      const smx = cx - 54;
      const sb = ground + 16;
      const ball = (bx, by, rr) =>
        shadeEllipse(bx, by, rr, rr, (nx, ny, x, y) => {
          const l = nx * 0.6 - ny * 0.6;
          if (nx * nx + ny * ny > 0.8 && l < 0.3) return '#9fb2d6';
          return l > 0.5 ? '#ffffff' : l > -0.2 ? '#eaf1fb' : dith(x, y, 0.5) ? '#d3dff2' : '#c3d2ec';
        });
      shadeEllipse(smx + 3, sb + 1, 15, 3, (nx, ny, x, y) => (dith(x, y, 0.6) ? '#8ea4cc' : null));
      ball(smx, sb - 9, 10);
      ball(smx, sb - 23, 7.5);
      ball(smx, sb - 34, 5.5);
      stroke(smx - 7, sb - 24, smx - 16, sb - 31, '#5a3a28');
      stroke(smx - 13, sb - 29, smx - 16, sb - 26, '#5a3a28');
      stroke(smx + 7, sb - 24, smx + 16, sb - 30, '#5a3a28');
      stroke(smx + 13, sb - 28, smx + 15, sb - 33, '#5a3a28');
      px(smx - 7, sb - 40, 14, 2, '#22202c');
      px(smx - 4, sb - 47, 9, 7, '#22202c');
      px(smx - 4, sb - 42, 9, 1, '#c94a4a');
      px(smx - 2, sb - 36, 1, 1, '#22202c');
      px(smx + 2, sb - 36, 1, 1, '#22202c');
      px(smx, sb - 34, 5, 1, '#f08a3c');
      px(smx, sb - 33, 3, 1, '#d9722a');
      for (const [mx2, my2] of [[-2, -31], [-1, -30], [0, -30], [1, -30], [2, -31]]) px(smx + mx2, sb + my2 - 1, 1, 1, '#22202c');
      px(smx - 6, sb - 30, 12, 2, '#d8453c');
      px(smx + 3, sb - 28, 3, 6, '#d8453c');
      px(smx + 3, sb - 22, 1, 1, '#d8453c');
      px(smx + 5, sb - 22, 1, 1, '#d8453c');
      px(smx, sb - 24, 1, 1, '#22202c');
      px(smx, sb - 20, 1, 1, '#22202c');
      px(smx, sb - 13, 1, 1, '#22202c');

      // iron lamp post
      px(lampX, ground - 34, 2, 48, '#23252f');
      px(lampX - 2, ground + 12, 6, 3, '#23252f');
      px(lampX - 1, ground + 11, 4, 2, SNOW);
      px(lampX - 3, ground - 43, 8, 9, '#23252f');
      px(lampX - 4, ground - 45, 10, 2, '#23252f');
      px(lampX - 2, ground - 42, 6, 7, '#ffe08a');
      px(lampX, ground - 42, 2, 7, '#fff6d0');
      px(lampX - 5, ground - 48, 12, 3, SNOW);
      px(lampX - 3, ground - 50, 8, 2, SNOW);
    });

    const glow = layer(() => {
      for (const g of [
        makeGlow(cx + cw / 2, cy + 26, 120, 64, 'rgba(255, 190, 110, 0.06)', 3),
        makeGlow(windows[0] + 8, ground + 15, 34, 11, 'rgba(255, 190, 100, 0.13)', 3),
        makeGlow(windows[1] + 8, ground + 15, 34, 11, 'rgba(255, 190, 100, 0.13)', 3),
        makeGlow(lampX + 1, ground - 30, 48, 56, 'rgba(255, 220, 140, 0.085)', 4),
        makeGlow(lampX + 1, ground + 15, 38, 9, 'rgba(255, 220, 140, 0.15)', 3),
      ])
        ctxRef.drawImage(g, 0, 0);
    });

    return {
      ground,
      cx,
      cy,
      dx,
      wy,
      windows,
      lampX,
      chimney: { x: chx + 6, y: chy - 4 },
      sky,
      land,
      glow,
      stars: makeStars(r, W * 0.35, ground * 0.85, ['#dfe8ff', '#b9c9f0', '#fff3d0']),
      snowFar: Array.from({ length: Math.round(W * 0.9) }, () => ({ x: r() * W, y: r() * H, v: 0.5 + r() * 0.6, p: r() * 6 })),
      snowNear: Array.from({ length: Math.round(W * 0.35) }, () => ({ x: r() * W, y: r() * H, v: 1.2 + r() * 1.1, p: r() * 6 })),
      far,
      mist: makeMist(H * 0.47, ground - 8, ground + 3, 'rgba(176, 196, 236, 0.32)', 0.7, W + 60),
      lightmap: makeLightmap(
        '#62729e',
        [
          { poly: [[0, 0], [W, 0], [W, ground * 0.8], [0, ground * 0.8]], from: [0, 0], to: [0, ground * 0.8], color: '#8c8c8c' },
          { x: moon.x, y: moon.y, r: 260, color: '#34446a' },
          { x: cx + cw / 2, y: cy + 26, r: 150, ry: 85, color: '#a8683c' },
          ...windows.flatMap((wx) => [
            { x: wx + 8, y: wy + 8, r: 46, color: '#ffb060' },
            { x: wx + 8, y: ground + 15, r: 44, ry: 12, color: '#ffc080' },
          ]),
          { x: dx + 20, y: cy + 24, r: 30, color: '#ffb060' },
          { x: lampX + 1, y: ground - 38, r: 110, ry: 120, color: '#ffd890' },
          { x: lampX + 1, y: ground + 15, r: 56, ry: 13, color: '#ffe0a0' },
        ],
        { vignette: 0.35 },
      ),
      lampShaft: makeShaft(
        [
          [lampX - 3, ground - 35],
          [lampX + 5, ground - 35],
          [lampX + 26, ground + 16],
          [lampX - 24, ground + 16],
        ],
        [lampX + 1, ground - 35],
        [lampX + 1, ground + 16],
        'rgba(255, 222, 150, 0.16)',
        0.6,
      ),
      // tall pines right in front of us, framing the yard
      frame: layer(() => {
        const pal = ['#06111a', '#0a1824', '#0f2230'];
        // the trunk would hang below the screen, so sink each tree by its trunk height
        const tall = (h) => [H + Math.round(h * 0.08) + 4, h];
        const [b1, h1] = tall(Math.round(H * (narrow ? 0.5 : 0.72)));
        const [b2, h2] = tall(Math.round(H * (narrow ? 0.55 : 0.8)));
        hdPine(narrow ? -10 : -4, b1, h1, pal, '#6f84ac');
        hdPine(W + (narrow ? 8 : 2), b2, h2, pal, '#6f84ac');
      }),
      bokeh: Array.from({ length: 10 }, () => ({ x: r() * W, y: r() * H, v: 2.2 + r() * 1.2, p: r() * 6 })),
      smoke: [],
      shooting: null,
      hare: { x: -14, wait: 70, phase: 0, rest: 0 },
      hareY: ground + Math.round((H - ground) * 0.5),
    };
  },
  update(s) {
    for (const f of s.snowFar) {
      f.y += f.v;
      f.p += 0.08;
      if (f.y > H) {
        f.y = -2;
        f.x = Math.random() * W;
      }
    }
    for (const f of [...s.snowNear, ...s.bokeh]) {
      f.y += f.v;
      f.p += 0.1;
      if (f.y > H) {
        f.y = -3;
        f.x = Math.random() * W;
      }
    }
    if (Math.random() < 0.22) s.smoke.push({ x: s.chimney.x, y: s.chimney.y, life: 0, w: Math.random() * 6 });
    for (const p of s.smoke) {
      p.y -= 0.9;
      p.x += 0.45 + Math.sin(p.life / 9 + p.w) * 0.3;
      p.life++;
    }
    s.smoke = s.smoke.filter((p) => p.life < 70);
    if (s.shooting) {
      s.shooting.x += 7;
      s.shooting.y += 2.6;
      if (++s.shooting.life > 20) s.shooting = null;
    } else if (Math.random() < 1 / 320) s.shooting = { x: Math.random() * W * 0.6, y: 10 + Math.random() * H * 0.15, life: 0 };
    const h = s.hare;
    if (h.wait > 0) {
      if (--h.wait === 0) h.x = -14;
    } else if (h.rest > 0) h.rest--;
    else {
      h.phase = (h.phase + 1) % 11;
      if (h.phase < 7) h.x += 2.4;
      else if (h.phase === 10 && Math.random() < 0.15) h.rest = 20 + Math.floor(Math.random() * 30);
      if (h.x > W + 14) h.wait = 160 + Math.floor(Math.random() * 300);
    }
  },
  draw(s, t) {
    ctxRef.drawImage(s.sky, 0, 0);
    drawStars(s.stars, t);
    if (s.shooting) {
      const { x, y } = s.shooting;
      for (let k = 0; k < 14; k++) px(x - k * 2.6, y - k, k < 3 ? 2 : 1, 1, `rgba(255, 255, 255, ${1 - k / 14})`);
    }
    // aurora: a bright lower edge with rays fading upward, green into violet
    for (let x = 0; x < W; x++) {
      const base = Math.round(H * 0.3 + Math.sin(x / 61 + t / 4000) * 14 + Math.sin(x / 23 + t / 2600) * 5);
      const power = 0.6 + 0.4 * Math.sin(x / 27 + t / 1500 + Math.sin(x / 53 + t / 3100) * 2);
      const ray = 0.8 + 0.2 * Math.sin(x * 1.3 + t / 900);
      const len = 26 + power * 40;
      let band = -1;
      for (let k = 0; k < len; k++) {
        const f = k / len;
        if (!dith(x, base - k, (1 - f) * (1 - f * 0.3) * power * ray)) continue;
        const b = f < 0.22 ? 0 : f < 0.58 ? 1 : 2;
        if (b !== band) {
          band = b;
          ctxRef.fillStyle = ['rgba(140, 255, 190, 0.5)', 'rgba(80, 215, 190, 0.38)', 'rgba(140, 110, 220, 0.34)'][b];
        }
        ctxRef.fillRect(x, base - k, 1, 1);
      }
    }
    ctxRef.drawImage(s.far, 0, 0);
    ctxRef.drawImage(s.mist, Math.round(-30 + Math.sin(t / 7000) * 24), 0);
    ctxRef.drawImage(s.land, 0, 0);
    for (const p of s.smoke) disc(Math.round(p.x), Math.round(p.y), 2 + Math.floor(p.life / 14), `rgba(205, 212, 228, ${0.3 * (1 - p.life / 70)})`);
    const h = s.hare;
    if (h.wait <= 0) {
      const hop = h.rest <= 0 && h.phase < 7;
      const lift = hop ? Math.round(Math.sin((h.phase / 7) * Math.PI) * 5) : 0;
      px(h.x + 1, s.hareY + 8, 9, 1, 'rgba(110, 135, 180, 0.6)');
      blit(hareFrames[hop ? 1 : 0], h.x, s.hareY - lift);
    }

    // ---- light pass: a cold blue night, warm only near the cabin and the lamp
    applyLight(s.lightmap);

    // firelight inside: panes, curtains and muntins
    const flick = Math.sin(t / 130) * Math.sin(t / 310) > 0.5;
    s.windows.forEach((wx, i) => {
      const wy = s.wy;
      px(wx, wy, 16, 14, flick ? '#ffc25e' : '#ffd277');
      px(wx, wy, 16, 4, flick ? '#ffd88a' : '#ffe6a0');
      px(wx, wy + 11, 16, 3, '#f0a24a');
      px(wx, wy, 3, 14, '#c9584a');
      px(wx + 13, wy, 3, 14, '#c9584a');
      px(wx + 3, wy, 2, 5, '#c9584a');
      px(wx + 11, wy, 2, 5, '#c9584a');
      if (i === 1) {
        // a cat watching the snow
        px(wx + 6, wy + 9, 5, 5, '#3c241a');
        px(wx + 6, wy + 7, 1, 2, '#3c241a');
        px(wx + 10, wy + 7, 1, 2, '#3c241a');
        px(wx + 6, wy + 8, 5, 1, '#3c241a');
      }
      px(wx + 7, wy, 2, 14, '#3c241a');
      px(wx, wy + 6, 16, 2, '#3c241a');
    });
    px(s.dx + 20, s.cy + 23, 1, 3, flick ? '#ffc25e' : '#ffe08a');
    // lamp glass
    px(s.lampX - 2, s.ground - 42, 6, 7, '#ffe08a');
    px(s.lampX, s.ground - 42, 2, 7, '#fff6d0');

    ctxRef.drawImage(s.glow, 0, 0);
    ctxRef.drawImage(s.lampShaft, 0, 0);
    ctxRef.fillStyle = '#c9d6ee';
    for (const f of s.snowFar) ctxRef.fillRect(Math.round(f.x + Math.sin(f.p) * 2), Math.round(f.y), 1, 1);
    for (const f of s.snowNear) {
      const x = Math.round(f.x + Math.sin(f.p) * 3);
      const lit = Math.abs(x - s.lampX) < 26 && f.y > s.ground - 60 && f.y < s.ground + 14;
      ctxRef.fillStyle = lit ? '#ffe9b0' : '#ffffff';
      ctxRef.fillRect(x, Math.round(f.y), 2, 2);
    }

    // ---- foreground: the framing pines, and big soft flakes drifting right past us
    const { x: vx, y: vy } = look(t);
    ctxRef.drawImage(s.frame, -Math.round(vx * 7), -Math.round(vy * 3));
    for (const f of s.bokeh) {
      const x = Math.round(f.x + Math.sin(f.p) * 5 - vx * 10);
      const y = Math.round(f.y);
      px(x - 1, y - 1, 4, 4, 'rgba(235, 242, 255, 0.22)');
      px(x, y, 2, 2, 'rgba(255, 255, 255, 0.55)');
    }
  },
};

export default cabin;
