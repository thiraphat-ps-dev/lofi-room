// Full-screen pixel scenes. Each scene draws into a low-resolution canvas (about 360 px tall)
// that CSS scales up with crisp pixels, so the art fills any screen shape.
(() => {
  'use strict';

  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STEP = 1000 / 12; // pixel art reads best at a low, steady frame rate
  const TARGET_H = 360;

  let W = 0;
  let H = 0;
  let current = null;
  let state = null;
  // Where the viewer is looking, -1..1 on each axis, eased toward the pointer. Scenes shift
  // their layers by a few whole pixels from this for a gentle parallax.
  const view = { x: 0, y: 0, tx: 0, ty: 0 };
  /** The view at time t, with a slow drift so the scene never sits perfectly still. */
  const look = (t) => ({ x: view.x + Math.sin(t / 9000) * 0.25, y: view.y + Math.sin(t / 13000) * 0.15 });

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

  /** Ordered-dither test: true for a share `t` (0..1) of the pixels. */
  const dith = (x, y, t) => t * 16 > BAYER[y & 3][x & 3];

  /** Cheap repeatable noise in 0..1. */
  const hash = (a) => {
    const v = Math.sin(a) * 43758.5453;
    return v - Math.floor(v);
  };

  /** Scanline-filled polygon with hard pixel edges; `paint` is a colour or (x, y) => colour. */
  function poly(pts, paint) {
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of pts) {
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
    for (let y = Math.round(y0); y < Math.round(y1); y++) {
      const yy = y + 0.5;
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if ((yy >= ay && yy < by) || (yy >= by && yy < ay)) xs.push(ax + ((yy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const xa = Math.round(xs[i]);
        const xb = Math.max(xa + 1, Math.round(xs[i + 1]));
        if (typeof paint === 'string') px(xa, y, xb - xa, 1, paint);
        else
          for (let x = xa; x < xb; x++) {
            const c = paint(x, y);
            if (c) px(x, y, 1, 1, c);
          }
      }
    }
  }

  /** A straight run of square dots. */
  function stroke(x0, y0, x1, y1, color, w = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, w, w, color);
  }

  /** Dithered halo between two radii, fading outward. */
  function haloRing(cx, cy, r0, r1, color) {
    for (let y = -r1; y <= r1; y++)
      for (let x = -r1; x <= r1; x++) {
        const d = Math.hypot(x, y);
        if (d <= r0 || d >= r1) continue;
        if (dith(cx + x, cy + y, (1 - (d - r0) / (r1 - r0)) * 0.6)) px(cx + x, cy + y, 1, 1, color);
      }
  }

  /** Stars, denser toward the top; a few get a four-point sparkle. */
  function makeStars(r, count, maxY, colors) {
    return Array.from({ length: Math.round(count) }, () => ({
      x: Math.floor(r() * W),
      y: Math.floor(r() * r() * maxY),
      p: r() * 6.28,
      v: 500 + r() * 900,
      big: r() < 0.07,
      c: colors[Math.floor(r() * colors.length)],
    }));
  }

  function drawStars(stars, t) {
    for (const s of stars) {
      const tw = Math.sin(t / s.v + s.p);
      if (tw < -0.7) continue;
      ctxRef.fillStyle = tw > 0.6 ? '#ffffff' : s.c;
      ctxRef.fillRect(s.x, s.y, 1, 1);
      if (s.big && tw > 0) {
        ctxRef.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctxRef.fillRect(s.x - 1, s.y, 3, 1);
        ctxRef.fillRect(s.x, s.y - 1, 1, 3);
      }
    }
  }

  /** A flat-bottomed puffy cloud as its own small canvas, shaded top to bottom through `pal`. */
  function makeCloud(r, w, h, pal) {
    const g = document.createElement('canvas');
    g.width = w;
    g.height = h;
    const c = g.getContext('2d');
    const n = Math.max(3, Math.round(w / (h * 0.9)));
    const puffs = Array.from({ length: n }, (_, i) => {
      const f = (i + 0.5) / n;
      const rad = Math.min(h - 1, h * (0.35 + Math.sin(f * Math.PI) * 0.45) * (0.75 + r() * 0.35));
      return { x: rad + f * (w - rad * 2), rad };
    });
    for (let x = 0; x < w; x++) {
      let top = h;
      for (const p of puffs) {
        const dx = x - p.x;
        if (Math.abs(dx) < p.rad) top = Math.min(top, h - 1 - Math.sqrt(p.rad * p.rad - dx * dx));
      }
      top = Math.round(top);
      for (let y = top; y < h; y++) {
        const v = y - top < 2 ? 0 : (y / (h - 1)) * (pal.length - 1);
        const i = Math.min(pal.length - 2, Math.floor(v));
        c.fillStyle = (v - i) * 16 > BAYER[y & 3][x & 3] ? pal[i + 1] : pal[i];
        c.fillRect(x, y, 1, 1);
      }
    }
    return g;
  }

  /** A pine in flared tiers, shaded dark on the left and light on the right, with optional snow. */
  function hdPine(x, base, h, pal, snow) {
    const [dark, mid, light] = pal;
    const trunk = Math.max(2, Math.round(h * 0.08));
    px(x - 1, base - trunk, h > 40 ? 3 : 2, trunk, '#1c120e');
    const top = base - trunk - h;
    const tiers = Math.min(9, Math.max(3, Math.round(h / 11)));
    const tierH = h / tiers;
    const maxHalf = h * 0.3;
    for (let k = 0; k < h; k++) {
      const tier = Math.floor(k / tierH);
      const f = k / tierH - tier;
      const half = Math.round(((tier + 0.2 + f * 1.3) / (tiers + 0.5)) * maxHalf);
      const y = top + k;
      px(x - half, y, half * 2 + 1, 1, mid);
      if (half > 1) {
        px(x - half, y, Math.ceil(half * 0.75), 1, dark);
        px(x + half - Math.floor(half * 0.3), y, Math.floor(half * 0.3) + 1, 1, light);
      }
      if (snow && half > 0 && f < 0.5) {
        // snow lies along the top of each tier and piles up on the lit side
        const sw = Math.round(half * (f < 0.15 ? 1.3 : 0.95 - f * 1.6));
        if (sw > 0) px(x + half - sw - (f < 0.15 ? 0 : 1), y, sw, 1, snow);
      }
    }
  }

  // ------------------------------------------------------------------ shared: lighting

  /**
   * A light map for a 'multiply' pass: the room sits in `ambient` darkness and each light adds
   * colour back. The result is posterised with the Bayer dither, so light falls off in pixel steps
   * rather than a smooth gradient. White leaves the art untouched; darker colours dim it.
   *
   * A light is one of:
   *   { x, y, r, ry?, color }                  radial, optionally squashed to an ellipse
   *   { poly: [[x, y], …], from, to, color }   polygon, fading from `from` to `to`
   *   { rect: [x, y, w, h], color }            flat
   */
  function makeLightmap(ambient, lights, { levels = 14, vignette = 0 } = {}) {
    const g = document.createElement('canvas');
    g.width = W;
    g.height = H;
    const c = g.getContext('2d');
    c.fillStyle = ambient;
    c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      if (l.rect) {
        c.fillStyle = l.color;
        c.fillRect(...l.rect);
      } else if (l.poly) {
        const grad = c.createLinearGradient(l.from[0], l.from[1], l.to[0], l.to[1]);
        grad.addColorStop(0, l.color);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        c.fillStyle = grad;
        c.beginPath();
        l.poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.fill();
      } else {
        const sy = (l.ry || l.r) / l.r;
        c.save();
        c.translate(l.x, l.y);
        c.scale(1, sy);
        const grad = c.createRadialGradient(0, 0, 0, 0, 0, l.r);
        grad.addColorStop(0, l.color);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        c.fillStyle = grad;
        c.fillRect(-l.r, -l.r, l.r * 2, l.r * 2);
        c.restore();
      }
    }
    if (vignette) {
      // darker toward the edges, so the eye settles on the middle of the scene
      c.globalCompositeOperation = 'multiply';
      const v = Math.round(255 * (1 - vignette));
      const grad = c.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H * 0.45, Math.hypot(W / 2, H * 0.55));
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, `rgb(${v}, ${v}, ${v})`);
      c.fillStyle = grad;
      c.fillRect(0, 0, W, H);
    }
    const img = c.getImageData(0, 0, W, H);
    const d = img.data;
    const step = 255 / levels;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const th = (BAYER[y & 3][x & 3] + 0.5) / 16;
        for (let k = 0; k < 3; k++) {
          const v = d[i + k] / step;
          const f = Math.floor(v);
          d[i + k] = Math.min(255, Math.round((f + (v - f > th ? 1 : 0)) * step));
        }
        d[i + 3] = 255;
      }
    c.putImageData(img, 0, 0);
    return g;
  }

  /** Darken everything drawn so far by a light map. */
  function applyLight(map) {
    ctxRef.save();
    ctxRef.globalCompositeOperation = 'multiply';
    ctxRef.drawImage(map, 0, 0);
    ctxRef.restore();
  }

  /** A dithered shaft of light (a polygon that fades from `from` to `to`), for adding on top. */
  function makeShaft(pts, from, to, color, strength = 0.5) {
    const g = document.createElement('canvas');
    g.width = W;
    g.height = H;
    const saved = ctxRef;
    ctxRef = g.getContext('2d');
    const [fx, fy] = from;
    const dx = to[0] - fx;
    const dy = to[1] - fy;
    const len2 = dx * dx + dy * dy;
    poly(pts, (x, y) => {
      const f = Math.max(0, Math.min(1, ((x - fx) * dx + (y - fy) * dy) / len2));
      return dith(x, y, (1 - f) * strength) ? color : null;
    });
    ctxRef = saved;
    return g;
  }

  /** Rays of light fanning out from (cx, cy), above `maxY` only, fading with distance. */
  function makeRays(cx, cy, len, color, { count = 9, strength = 0.5, maxY = H, seed = 1 } = {}) {
    return layer(() => {
      for (let y = Math.max(0, Math.floor(cy - len)); y < Math.min(maxY, cy + len); y++)
        for (let x = Math.max(0, Math.floor(cx - len)); x < Math.min(W, cx + len); x++) {
          const d = Math.hypot(x - cx, y - cy) / len;
          if (d >= 1 || d < 0.08) continue;
          const a = Math.atan2(y - cy, x - cx);
          const ray = Math.max(0, Math.sin(a * count + seed) * 0.6 + Math.sin(a * count * 2.3 + seed * 3) * 0.4);
          if (dith(x, y, ray * ray * (1 - d) * strength)) px(x, y, 1, 1, color);
        }
    });
  }

  /** A horizontal band of dithered mist, thickest at `mid`; `width` lets it be wider than the screen. */
  function makeMist(top, mid, bottom, color, strength = 0.5, width = W) {
    const g = document.createElement('canvas');
    g.width = width;
    g.height = H;
    const saved = ctxRef;
    ctxRef = g.getContext('2d');
    for (let y = Math.round(top); y < bottom; y++) {
      const f = y < mid ? (y - top) / (mid - top) : 1 - (y - mid) / (bottom - mid);
      for (let x = 0; x < width; x++) {
        const wisp = 0.75 + 0.25 * Math.sin(x / 37 + y / 5) * Math.sin(x / 13 - y / 3);
        if (dith(x, y, f * strength * wisp)) px(x, y, 1, 1, color);
      }
    }
    ctxRef = saved;
    return g;
  }

  /** Is (x, y) inside the polygon? */
  function inside(pts, x, y) {
    let hit = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  }

  /** Dust motes drifting inside a shaft of light. */
  function makeMotes(r, pts, count) {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    return { pts, box, list: Array.from({ length: count }, () => ({ x: box.x + r() * box.w, y: box.y + r() * box.h, p: r() * 6.28, v: 0.04 + r() * 0.08 })) };
  }

  function updateMotes(m) {
    for (const d of m.list) {
      d.y += d.v;
      d.x += Math.sin(d.p += 0.03) * 0.12;
      if (d.y > m.box.y + m.box.h) {
        d.y = m.box.y;
        d.x = m.box.x + Math.random() * m.box.w;
      }
    }
  }

  function drawMotes(m, t, color) {
    for (const d of m.list) {
      if (!inside(m.pts, d.x, d.y) || Math.sin(t / 700 + d.p * 3) < -0.2) continue;
      px(d.x, d.y, 1, 1, color);
    }
  }

  // ------------------------------------------------------------------ shared: a sleeping animal

  const TABBY = {
    pal: { hi: '#f6c088', base: '#e39a52', mid: '#cf8440', dark: '#a8612a', stripe: '#9a5524', cream: '#f5e2c4', creamS: '#dcc3a0', line: '#5a2f18' },
    stripes: true,
  };
  const FOX = {
    pal: { hi: '#f9a860', base: '#e27a36', mid: '#c25c20', dark: '#93411a', stripe: '#93411a', cream: '#f8ecd9', creamS: '#d9c5a8', line: '#3a1c10' },
    stripes: false,
    tip: '#f8ecd9',
    ear: '#3a1c10',
  };

  /** A sleeping animal, curled up and lit from the right; `look` picks the coat (TABBY or FOX). */
  function hdCat(x, y, t, look = TABBY) {
    const breathe = Math.sin(t / 900) * 0.6;
    const C = look.pal;
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
      shadeEllipse(tx, ty, 2.2, 2.2, (nx, ny, xx, yy) => (look.stripes && Math.floor((k + 2) / 4) % 2 ? C.stripe : look.tip && k > 23 ? look.tip : tone(nx, ny, xx, yy)));
    }
    // body
    shadeEllipse(x, y + 3 - breathe, 22, 9 + breathe, (nx, ny, xx, yy) => {
      if (ny > 0.55 && nx > -0.5) return C.cream;
      const stripe = look.stripes && ny < 0.35 && Math.floor((xx - x + yy * 0.6 + 40) / 5) % 3 === 0;
      return stripe ? C.stripe : tone(nx, ny, xx, yy);
    });
    // head, tucked in on the right
    const hx = x + 19;
    const hy = y + 1;
    shadeEllipse(hx, hy, 8.5, 7, (nx, ny, xx, yy) => {
      if (ny > 0.3 && Math.abs(nx) < 0.55) return ny > 0.6 ? C.creamS : C.cream;
      if (look.stripes && ny < -0.45 && Math.abs(nx) < 0.15) return C.stripe;
      return tone(nx, ny, xx, yy);
    });
    // ears (one twitches now and then)
    const twitch = Math.floor(t / 2300) % 7 === 0 ? 1 : 0;
    for (const [ex, dir, tw] of [[hx - 5, -1, 0], [hx + 4, 1, twitch]]) {
      for (let k = 0; k < 6; k++) {
        const w = Math.max(1, 5 - k);
        px(ex - Math.floor(w / 2) + dir * Math.floor(k / 3) + tw, hy - 5 - k, w, 1, k < 2 ? C.mid : look.ear || C.dark);
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

  // ------------------------------------------------------------------ scene: rainy room

  const rainyRoom = {
    id: 'room',
    name: 'ห้องฝนตก',
    accent: '#ffb35c',
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
        // a little wider than the glass, so the parallax shift never shows an edge
        let x = win.x - 16;
        while (x < win.x + win.w + 16) {
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

      // far and middle city on their own layers, so they can slide behind the glass
      const cityFar = layer(() => {
        // a low haze over the far skyline
        bands(win.x - 16, horizon - 40, win.w + 32, 40, ['rgba(0,0,0,0)', '#1a2150', '#232a60']);
        for (const b of far) px(b.x, b.top, b.w, horizon - b.top, '#1c2350');
        for (const b of far) for (let y = b.top + 4; y < horizon; y += 7) if ((b.x + y) % 3 === 0) px(b.x + 3, y, 1, 1, '#3d4a8a');
      });
      const cityMid = layer(() => {
        for (const b of mid) {
          px(b.x, b.top, b.w, horizon - b.top, '#151a3d');
          px(b.x, b.top, 1, horizon - b.top, '#1b2148');
          if (b.roof < 0.3) px(b.x + 3, b.top - 4, 6, 4, '#151a3d');
          for (let y = b.top + 4; y < horizon; y += 5) for (let x = b.x + 2; x < b.x + b.w - 2; x += 4) if ((x * 7 + y * 3) % 5 === 0) px(x, y, 2, 1, '#8a7a4a');
        }
        // mist rising off the wet street below
        for (let y = horizon - 14; y < horizon; y++)
          for (let x = win.x - 16; x < win.x + win.w + 16; x++) if (dith(x, y, ((y - horizon + 14) / 14) * 0.55)) px(x, y, 1, 1, '#2a3270');
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

      // ---- light: a dim night room, lit by the lamp, the moon through the glass, a candle and
      // the fairy lights. Everything is drawn plainly, then multiplied by this map.
      const sx = lampX + 26; // lamp shade, as drawn in fg
      const sy = deskY - 66;
      const sill = win.y + win.h + 15;
      const candle = { x: Math.round(W * 0.66) + 38, y: Math.round(H * 0.44) };
      const lampCone = [
        [sx - 4, sy + 18],
        [sx + 20, sy + 18],
        [sx + 62, deskY + 1],
        [sx - 50, deskY + 1],
      ];
      // the moon is high on the right of the glass, so its light lands down-left, on the cat
      const catX = narrow ? win.x + Math.round(win.w * 0.4) : Math.round(W * 0.49);
      const moonBeam = [
        [win.x + win.w * 0.42, sill],
        [win.x + win.w * 0.94, sill],
        [catX + 50, deskY],
        [catX - 75, deskY],
      ];
      const lights = [
        { rect: [win.x, win.y, win.w, win.h], color: '#ffffff' },
        { x: win.x + win.w / 2, y: win.y + win.h * 0.6, r: win.w * 0.75, ry: win.h * 1.1, color: '#3a4580' },
        { poly: moonBeam, from: [win.x + win.w * 0.68, sill], to: [catX - 12, deskY + 20], color: '#55639f' },
        { x: catX - 10, y: deskY - 6, r: 80, ry: 22, color: '#6a76b0' },
        { x: win.x + win.w / 2, y: win.y - 14, r: win.w / 2 + 60, ry: 20, color: '#6a4858' },
        { x: sx + 8, y: sy + 20, r: 250, ry: 200, color: '#b07a48' },
        { x: sx + 8, y: sy + 18, r: 80, color: '#ffc27a' },
        { poly: lampCone, from: [sx + 8, sy + 18], to: [sx + 8, deskY + 40], color: '#ffd9a0' },
        { x: sx + 6, y: deskY + 3, r: 110, ry: 18, color: '#ffe0b0' },
      ];
      if (!narrow) lights.push({ x: candle.x + 3, y: candle.y - 15, r: 55, color: '#a8683a' });
      const lightmap = makeLightmap('#584e86', lights);

      // ---- foreground: a pothos hanging close to the viewer, top right, lit from the lamp below
      let plant = null;
      if (!narrow) {
        plant = document.createElement('canvas');
        plant.width = 90;
        plant.height = 190;
        const saved = ctxRef;
        ctxRef = plant.getContext('2d');
        const P = { rope: '#3a2e34', pot: '#22192a', potHi: '#3e2c34', rim: '#5a3c34', dark: '#0c1a13', mid: '#14301f', hi: '#1f452e', warm: '#8a6038' };
        const cx = 45;
        const potY = 70;
        stroke(cx, 0, cx - 13, potY, P.rope);
        stroke(cx, 0, cx + 13, potY, P.rope);
        stroke(cx, 0, cx, potY, P.rope);
        for (let k = 0; k < 16; k++) {
          const w = 30 - Math.round(k * 0.5);
          px(cx - w / 2, potY + k, w, 1, k < 3 ? P.rim : P.pot);
          px(cx - w / 2, potY + k, 3, 1, P.potHi);
        }
        // vines spilling over the rim, heart-shaped leaves alternating sides
        const vines = [
          [-12, 50, -0.15],
          [-4, 85, 0.05],
          [6, 40, 0.15],
          [13, 68, 0.25],
        ];
        for (const [vx, len, lean] of vines) {
          let x = cx + vx;
          for (let y = potY + 2; y < potY + len; y++) {
            x += lean * 0.35 + Math.sin(y / 9) * 0.25;
            px(x, y, 1, 1, P.dark);
            if ((y - potY) % 11 === 0) {
              const side = (y / 11) % 2 ? -1 : 1;
              const lx = x + side * 4;
              shadeEllipse(lx, y + 1, 3.5, 2.6, (nx, ny) => {
                const l = -nx * 0.6 + ny * 0.7; // lit from below-left, where the lamp is
                return l > 0.55 ? P.warm : l > 0.1 ? P.hi : l > -0.4 ? P.mid : P.dark;
              });
            }
          }
        }
        for (const [lx, ly] of [[-14, 4], [-6, 1], [4, 2], [12, 3], [17, 6], [-18, 8]]) {
          shadeEllipse(cx + lx, potY + ly, 5, 3.5, (nx, ny) => (ny > 0.3 ? P.hi : nx < -0.3 ? P.mid : P.dark));
        }
        ctxRef = saved;
      }

      return {
        narrow,
        win,
        deskY,
        lampX,
        moon,
        bg,
        cityFar,
        cityMid,
        fg,
        near,
        horizon,
        candle,
        lightmap,
        plant,
        plantAt: { x: W - 64, y: -24 },
        catX,
        // the desk front is closest to the viewer and furthest from the lamp: sink it into shadow
        deskShade: layer(() => {
          for (let y = deskY + 14; y < H; y++) {
            const f = Math.min(1, (y - deskY - 14) / (H - deskY - 14));
            for (let x = 0; x < W; x++) if (dith(x, y, 0.15 + f * 0.6)) px(x, y, 1, 1, 'rgba(8, 5, 16, 0.55)');
          }
        }),
        moonShaft: makeShaft(moonBeam, [win.x + win.w * 0.68, sill], [catX - 12, deskY], 'rgba(170, 190, 255, 0.13)', 0.55),
        lampShaft: makeShaft(lampCone, [sx + 8, sy + 18], [sx + 8, deskY + 10], 'rgba(255, 214, 150, 0.16)', 0.7),
        moonMotes: makeMotes(r, moonBeam, 22),
        lampMotes: makeMotes(r, lampCone, 16),
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
      updateMotes(s.moonMotes);
      updateMotes(s.lampMotes);
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
      // looking through glass: the farther a layer is, the more it slides as the view moves
      const { x: vx, y: vy } = look(t);
      ctxRef.drawImage(s.cityFar, Math.round(vx * 4), Math.round(vy * 2));
      ctxRef.drawImage(s.cityMid, Math.round(vx * 2.5), Math.round(vy * 1));
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
      ctxRef.save();
      ctxRef.translate(Math.round(vx * 1.2), 0);
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
      ctxRef.restore();
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
      // fairy-light wire (the bulbs glow, so they are drawn after the light pass)
      const x0 = win.x - 30;
      const x1 = win.x + win.w + 30;
      const sagAt = (x) => win.y - 15 + Math.round(Math.sin((((x - x0) % 54) / 54) * Math.PI) * 6);
      for (let x = x0; x < x1; x += 9) px(x, sagAt(x), 9, 1, '#241a36');
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
      hdCat(s.catX, deskY - 12, t);

      // ---- light pass: everything above is plain art; now the room goes dark except where lit
      applyLight(s.lightmap);
      if (s.flash > 0) {
        ctxRef.fillStyle = `rgba(150, 165, 255, ${s.flash * 0.16})`;
        ctxRef.fillRect(0, 0, W, H);
      }

      ctxRef.drawImage(s.deskShade, 0, 0);

      // light you can see in the air, with dust drifting through it
      ctxRef.drawImage(s.moonShaft, 0, 0);
      ctxRef.drawImage(s.lampShaft, 0, 0);
      drawMotes(s.moonMotes, t, 'rgba(200, 215, 255, 0.55)');
      drawMotes(s.lampMotes, t, 'rgba(255, 232, 185, 0.75)');
      ctxRef.drawImage(s.pool, 0, 0);
      ctxRef.drawImage(s.glow, 0, 0);

      // things that give off light stay bright
      const colors = ['#ffd27a', '#ff8fb1', '#8fd3ff', '#b6f28a', '#ffb35c'];
      for (let x = x0, i = 0; x <= x1; x += 9, i++) {
        const y = sagAt(x);
        const on = Math.sin(t / 650 + i * 1.9) > -0.35;
        const c = colors[i % colors.length];
        if (on) {
          px(x - 3, y - 1, 9, 8, 'rgba(255, 225, 170, 0.06)');
          px(x - 1, y + 1, 5, 4, 'rgba(255, 225, 170, 0.12)');
        }
        px(x + 1, y + 1, 2, 3, on ? c : '#3a2e4c');
        if (on) px(x + 1, y + 1, 1, 1, '#ffffff');
      }
      if (!s.narrow) {
        const { x: cx, y: cy } = s.candle;
        px(cx, cy - 10, 6, 10, '#d9c8ae');
        px(cx, cy - 10, 2, 10, '#f3e4c8');
        px(cx + 2, cy - 12, 1, 2, '#3a2a20');
        const fl = Math.random() < 0.3 ? 1 : 0;
        px(cx - 4, cy - 22, 14, 13, 'rgba(255, 190, 110, 0.07)');
        px(cx - 1, cy - 19, 8, 8, 'rgba(255, 190, 110, 0.10)');
        px(cx + 1 + fl, cy - 17, 2, 5, '#ffb347');
        px(cx + 2, cy - 15 - fl, 1, 3, '#fff1c9');
      }
      // lamp bulb rim
      px(s.lampX + 21, s.deskY - 50, 26, 2, '#fff1c9');

      // ---- foreground: near the viewer, so it moves against the room and sways a little
      if (s.plant) {
        const sway = Math.round(Math.sin(t / 2600) * 1.2);
        ctxRef.drawImage(s.plant, s.plantAt.x - Math.round(vx * 7) + sway, s.plantAt.y - Math.round(vy * 4));
      }
    },
  };

  // ------------------------------------------------------------------ scene: seaside sunset

  const crabPal = { r: '#e2553f', d: '#b53d2e', k: '#2a1420' };
  const crabFrames = [
    sprite(['.r.......r.', 'rr.......rr', '.r.rrrrr.r.', '..rrkrkrr..', '.rrrrrrrrr.', 'r.rdddddr.r', '.r.r...r.r.'], crabPal),
    sprite(['rr.......rr', '.r.......r.', '.r.rrrrr.r.', '..rrkrkrr..', '.rrrrrrrrr.', '.rrdddddrr.', 'r..r...r..r'], crabPal),
  ];
  const starfish = sprite(['...o...', '...o...', 'ooooooo', '.ooooo.', '..ooo..', '.oo.oo.', '.o...o.'], { o: '#f08a5a' });

  const seaside = {
    id: 'sea',
    name: 'ทะเลยามเย็น',
    accent: '#ff9e6b',
    init() {
      const r = rng(11);
      const narrow = W < 420;
      const horizon = Math.round(H * 0.5);
      const shore = Math.round(H * 0.7);
      const sand = H - shore;
      const sunX = Math.round(W * 0.62);
      const sunR = Math.round(H * 0.1);
      const sunY = horizon - Math.round(sunR * 0.3);
      const ux = Math.round(W * (narrow ? 0.5 : 0.52)); // umbrella pole
      const uy = shore + Math.round(sand * 0.42); // where the props stand
      const headW = Math.round(W * 0.22);
      const headH = (k) => Math.max(0, Math.round(Math.pow(k / headW, 0.7) * 20 + Math.sin(k / 5) * 1.5 + Math.sin(k / 13) * 2));
      const lightK = headW - Math.round(headW * 0.42);
      const lightX = W - headW + lightK;
      const lightTop = horizon - headH(lightK) - 26;
      const castle = { x: Math.round(W * 0.67), y: shore + Math.round(sand * 0.3) };
      const shade = 'rgba(110, 60, 50, 0.24)';

      const bg = layer(() => {
        bands(0, 0, W, horizon, ['#1b1340', '#2a1a4f', '#47235c', '#7a3163', '#b84a62', '#e0654f', '#f48a52', '#fbb561', '#ffd98a']);
        ctxRef.drawImage(makeGlow(sunX, sunY, sunR * 3.4, sunR * 2.6, 'rgba(255, 225, 160, 0.09)', 4), 0, 0);
        shadeEllipse(sunX, sunY, sunR, sunR, (nx, ny, x, y) => {
          const v = (ny + 1) / 2;
          if (v < 0.4) return dith(x, y, v / 0.4) ? '#ffe9a6' : '#fffbe0';
          return dith(x, y, (v - 0.4) / 0.6) ? '#ffc978' : '#ffe9a6';
        });
        // thin cloud bars across the sun
        px(sunX - sunR - 8, sunY + Math.round(sunR * 0.1), Math.round(sunR * 1.5), 2, '#f48a52');
        px(sunX - 6, sunY + Math.round(sunR * 0.42), Math.round(sunR * 1.6), 2, '#ee7a50');

        // far island with palms
        const miniPalm = (x, base, h, c) => {
          for (let k = 0; k < h; k++) px(x + Math.round((k / h) ** 2 * 3), base - k, 1, 1, c);
          const tx = x + 3;
          const ty = base - h;
          for (const d of [-1, 1])
            for (let k = 0; k < 7; k++) {
              px(tx + d * k, ty + Math.round((k * k) / 10), 1, 1, c);
              px(tx + d * k, ty - 2 + Math.round((k * k) / 6), 1, 1, c);
            }
          px(tx, ty - 3, 1, 3, c);
        };
        const ix = Math.round(W * 0.2);
        const iw = Math.max(20, Math.round(W * 0.08));
        for (let k = -iw; k <= iw; k++) {
          const h = Math.round(8 * Math.cos((k / iw) * (Math.PI / 2)));
          px(ix + k, horizon - h, 1, h, '#4a2350');
          if (h > 1) px(ix + k, horizon - h, 1, 1, '#7a3d68');
        }
        miniPalm(ix - 12, horizon - 6, 13, '#3a1a44');
        miniPalm(ix - 1, horizon - 7, 18, '#3a1a44');
        miniPalm(ix + 10, horizon - 5, 11, '#3a1a44');

        // headland with a lighthouse
        for (let k = 0; k < headW; k++) {
          const h = headH(k);
          px(W - headW + k, horizon - h, 1, h, '#3f1f4a');
          px(W - headW + k, horizon - h, 1, 1, '#6f3862');
          if (k % 7 === 3 && h > 6) px(W - headW + k, horizon - h + 3, 2, 2, '#351a40');
        }
        for (let j = 0; j < 26; j++) {
          const w = 5 + Math.floor(j / 10);
          const x0 = lightX - Math.floor(w / 2);
          px(x0, lightTop + j, w, 1, Math.floor(j / 6) % 2 ? '#b8485a' : '#ecd6d4');
          px(x0 + w - 2, lightTop + j, 2, 1, 'rgba(40, 10, 50, 0.3)');
        }
        px(lightX - 4, lightTop - 1, 8, 1, '#2a1638');
        px(lightX - 3, lightTop - 6, 6, 5, '#2a1638');
        px(lightX - 4, lightTop - 8, 8, 2, '#2a1638');
        px(lightX - 1, lightTop - 11, 2, 3, '#2a1638');

        // sea
        bands(0, horizon, W, shore - horizon, ['#c06a78', '#8a5088', '#5f3e84', '#43306f', '#31265c', '#353070', '#454284']);

        // sand: wet where the waves reach, then dry and rippled
        bands(0, shore - 3, W, sand + 3, ['#ecbf8a', '#e2b07a', '#d6a06a', '#c68f5b', '#b47d4e']);
        px(0, shore - 3, W, 11, '#b98a66');
        for (let x = 0; x < W; x++) for (let k = 0; k < 5; k++) if (dith(x, shore + 8 + k, 1 - k / 5)) px(x, shore + 8 + k, 1, 1, '#b98a66');
        for (let i = 0; i < W * 1.2; i++) {
          const y = shore + 14 + r() * (sand - 14);
          px(r() * W, y, r() < 0.3 ? 2 : 1, 1, r() < 0.5 ? '#f6d9ac' : '#a8743f');
        }
        for (let i = 0; i < W / 12; i++) {
          const x0 = r() * W;
          const y0 = shore + 18 + r() * (sand - 22);
          const len = 8 + r() * 16;
          for (let k = 0; k < len; k++) px(x0 + k, y0 + Math.round(Math.sin((k / len) * Math.PI) * 1.5), 1, 1, '#c08a55');
        }
        for (let i = 0; i < Math.round(W / 36); i++) {
          const sx = Math.round(r() * W);
          const sy = Math.round(shore + 18 + r() * (sand - 24));
          px(sx, sy, 3, 2, '#fbe9d2');
          px(sx + 1, sy - 1, 1, 1, '#fbe9d2');
          px(sx, sy + 1, 3, 1, '#d8b9a0');
        }
        blit(starfish, Math.round(W * 0.6), shore + Math.round(sand * 0.72));
        // footprints from the umbrella down to the water
        for (let k = 0; k < 9; k++) {
          const fx = ux - 34 - k * 9;
          const fy = uy - 2 - Math.round(k * ((uy - shore - 14) / 9));
          px(fx + (k % 2 ? 0 : 3), fy + (k % 2 ? 2 : 0), 3, 2, '#b58250');
        }

      });

      // everything standing on the sand goes in its own layer, drawn over the surf
      const props = layer(() => {
        if (!narrow) {
          // towel with flip-flops
          const tx = ux - 78;
          const ty = uy + 4;
          for (let j = 0; j < 9; j++) for (let s2 = 0; s2 < 9; s2++) px(tx + s2 * 4 + (9 - j), ty + j, 4, 1, s2 % 2 ? '#f7f1e6' : '#f08aa6');
          px(tx + 9, ty + 9, 36, 1, shade);
          px(tx + 50, ty + 5, 5, 2, '#3c7fd0');
          px(tx + 53, ty + 9, 5, 2, '#3c7fd0');
          // surfboard stuck in the sand
          const bx = ux + 78;
          px(bx - 6, uy + 3, 16, 2, shade);
          shadeEllipse(bx, uy - 20, 5, 24, (nx) => (Math.abs(nx) < 0.18 ? '#f2c14e' : nx > 0.4 ? '#2f8f9d' : '#45b6c4'));
          // sandcastle (its flag flutters at run time)
          const S = { a: '#e8bf88', b: '#cf9f66', c: '#a8773f' };
          const { x: sx, y: sy } = castle;
          px(sx - 16, sy, 36, 2, shade);
          px(sx - 14, sy - 8, 28, 8, S.a);
          px(sx + 6, sy - 8, 8, 8, S.b);
          for (let k = -14; k < 14; k += 4) px(sx + k, sy - 10, 2, 2, S.a);
          for (const ox of [-17, 10]) {
            px(sx + ox, sy - 16, 7, 16, S.a);
            px(sx + ox + 5, sy - 16, 2, 16, S.b);
            px(sx + ox - 1, sy - 18, 3, 2, S.a);
            px(sx + ox + 5, sy - 18, 3, 2, S.a);
            px(sx + ox + 2, sy - 12, 2, 3, S.c);
          }
          px(sx - 4, sy - 22, 9, 14, S.a);
          px(sx + 3, sy - 22, 2, 14, S.b);
          px(sx - 5, sy - 24, 3, 2, S.a);
          px(sx - 1, sy - 24, 3, 2, S.a);
          px(sx + 3, sy - 24, 3, 2, S.a);
          px(sx - 2, sy - 6, 4, 6, S.c);
          px(sx, sy - 32, 1, 8, '#6b4431');
        }

        // cooler
        const kx = ux - 32;
        const ky = uy - 9;
        px(kx + 1, ky + 11, 19, 2, shade);
        px(kx, ky, 18, 11, '#3c7fd0');
        px(kx, ky, 18, 4, '#f5efe2');
        px(kx, ky + 4, 18, 1, '#2a5fa3');
        px(kx + 14, ky + 4, 4, 7, '#2f69b3');
        px(kx + 5, ky - 3, 8, 1, '#d8d2c6');
        px(kx + 5, ky - 3, 1, 3, '#d8d2c6');
        px(kx + 12, ky - 3, 1, 3, '#d8d2c6');

        // umbrella: striped dome with a scalloped edge, and its shadow
        shadeEllipse(ux - 12, uy + 3, 32, 5, (nx, ny, x, y) => (dith(x, y, 0.8) ? shade : null));
        px(ux, uy - 54, 2, 56, '#f3ead9');
        px(ux + 1, uy - 54, 1, 56, '#cdbfa8');
        const cr = 34;
        const dome = 18;
        const cty = uy - 64;
        const red = (j, half) => Math.floor(((j / (half + 0.5)) * 0.5 + 0.5) * 6) % 2 === 0;
        for (let k = 0; k < dome; k++) {
          const half = Math.round(cr * Math.sqrt(1 - (1 - (k + 1) / dome) ** 2));
          for (let j = -half; j <= half; j++) {
            const dark = k > dome - 4 || j < -half * 0.55;
            px(ux + j, cty + k, 1, 1, red(j, half) ? (dark ? '#c2423c' : '#ee5f4f') : dark ? '#d9cbb6' : '#f8f0e0');
          }
        }
        for (let j = -cr; j <= cr; j++) if (Math.floor((j + cr) / 3) % 2 === 0) px(ux + j, cty + dome, 1, 2, red(j, cr) ? '#c2423c' : '#d9cbb6');
        px(ux, cty - 3, 2, 3, '#f3ead9');

        // deck chair
        const cx0 = ux + 12;
        px(cx0 - 1, uy + 2, 32, 2, shade);
        stroke(cx0 + 2, uy - 4, cx0 + 8, uy + 2, '#8a5a3a');
        stroke(cx0 + 8, uy - 4, cx0 + 2, uy + 2, '#8a5a3a');
        stroke(cx0 + 16, uy - 6, cx0 + 24, uy + 2, '#8a5a3a');
        stroke(cx0 + 25, uy - 8, cx0 + 18, uy + 2, '#8a5a3a');
        for (let k = 0; k < 22; k++) px(cx0 + k, uy - 6 - Math.round(k * 0.15), 1, 3, Math.floor(k / 3) % 2 ? '#f7f1e6' : '#3fa3b5');
        for (let k = 0; k < 17; k++) px(cx0 + 21 + Math.round(k * 0.45), uy - 10 - k, 3, 1, Math.floor(k / 3) % 2 ? '#f7f1e6' : '#3fa3b5');

        // beach ball
        px(ux + 46, uy + 12, 10, 2, shade);
        shadeEllipse(ux + 50, uy + 7, 5, 5, (nx, ny) => {
          const seg = Math.floor(((Math.atan2(ny + 0.3, nx - 0.2) + Math.PI) / (Math.PI * 2)) * 6) % 6;
          return ['#f8f0e0', '#ee5f4f', '#f8f0e0', '#3fa3b5', '#f8f0e0', '#f2c14e'][seg];
        });
      });

      const cloudPal = ['#5a3070', '#8a4078', '#c85a7a', '#f08a6a', '#ffb878'];
      return {
        narrow,
        horizon,
        shore,
        sand,
        sunX,
        sunR,
        bg,
        props,
        castle,
        light: { x: lightX, y: lightTop - 5 },
        stars: makeStars(r, W * 0.16, horizon * 0.5, ['#f7e7ff', '#d9c2ff']),
        clouds: Array.from({ length: Math.max(4, Math.round(W / 110)) }, () => {
          const w = 40 + Math.floor(r() * 70);
          const h = 8 + Math.floor(r() * 9);
          return { x: r() * W, y: Math.round(H * 0.08 + r() * horizon * 0.52), w, v: 0.03 + r() * 0.07, img: makeCloud(r, w, h, cloudPal) };
        }),
        birds: Array.from({ length: narrow ? 3 : 5 }, (_, i) => ({ x: r() * W, y: H * 0.18 + i * 7 + r() * 16, v: 0.4 + r() * 0.3, p: r() * 4 })),
        waves: Array.from({ length: Math.round(W / 5) }, () => {
          const f = r();
          return {
            x: r() * W,
            y: horizon + 3 + f * (shore - horizon - 18),
            len: Math.round(3 + f * 12),
            v: 0.15 + f * 0.5,
            c: f < 0.3 ? '#e09a8e' : f < 0.65 ? '#9a74b4' : '#7a66a8',
          };
        }),
        boat: { x: W * 0.36 },
        crab: { x: W * 0.56, dir: 1, pause: 0 },
        crabY: shore + Math.round(sand * 0.84),
        palmX: narrow ? -8 : Math.round(W * 0.03),
        palmH: Math.round(H * 0.6),
        // the sun is behind everything: whatever is far from it, or close to us, falls into dusk
        lightmap: makeLightmap(
          '#9a7a96',
          [
            { x: sunX, y: horizon, r: W * 0.7, ry: H * 0.75, color: '#ffffff' },
            { x: sunX, y: horizon + 10, r: W * 0.35, ry: H * 0.3, color: '#ffd0a0' },
          ],
          { vignette: 0.32 },
        ),
        rays: makeRays(sunX, horizon - 2, Math.max(W * 0.55, 220), 'rgba(255, 214, 160, 0.16)', { count: 11, strength: 0.55, maxY: horizon - 1, seed: 2 }),
        haze: makeMist(horizon - 16, horizon - 1, horizon + 8, 'rgba(255, 196, 160, 0.30)', 0.65),
        // dune grass close to the viewer, bottom right
        grass: Array.from({ length: narrow ? 10 : 22 }, () => ({ x: W - 70 + r() * 90, h: 18 + r() * 34, lean: 0.2 + r() * 0.5, p: r() * 6 })),
      };
    },
    update(s) {
      for (const c of s.clouds) {
        c.x += c.v;
        if (c.x > W + 10) c.x = -c.w - 10;
      }
      for (const b of s.birds) {
        b.x += b.v;
        if (b.x > W + 10) {
          b.x = -10;
          b.y = H * 0.14 + Math.random() * s.horizon * 0.4;
        }
      }
      for (const w of s.waves) {
        w.x -= w.v;
        if (w.x < -16) w.x = W + Math.random() * 10;
      }
      s.boat.x += 0.07;
      if (s.boat.x > W + 30) s.boat.x = -30;
      const c = s.crab;
      if (c.pause > 0) c.pause--;
      else {
        c.x += c.dir * 0.8;
        if (Math.random() < 0.02) c.pause = 20 + Math.random() * 30;
        if (c.x < W * 0.44 || c.x > W * 0.72) c.dir *= -1;
      }
    },
    draw(s, t) {
      const { horizon, shore, sunX, sunR } = s;
      const { x: vx, y: vy } = look(t);
      ctxRef.drawImage(s.bg, 0, 0);
      for (const c of s.clouds) ctxRef.drawImage(c.img, Math.round(c.x), c.y);

      // sailboat, bobbing, with a broken reflection
      const tick = Math.floor(t / 180);
      const bx = Math.round(s.boat.x);
      const by = horizon + 7 + Math.round(Math.sin(t / 900));
      px(bx, by - 26, 1, 22, '#3a1d3f');
      poly([[bx + 2, by - 25], [bx + 2, by - 6], [bx + 14, by - 6]], '#fff1dc');
      poly([[bx - 1, by - 21], [bx - 1, by - 6], [bx - 9, by - 6]], '#f3cdb0');
      px(bx + 1, by - 28, 4, 2, '#e8574a');
      px(bx - 10, by - 4, 22, 2, '#f1e4d4');
      px(bx - 9, by - 3, 20, 1, '#c8485a');
      px(bx - 8, by - 2, 18, 2, '#5a2a4a');
      for (let k = 0; k < 8; k++) if ((k + tick) % 3) px(bx - 6 + ((k + tick) % 2), by + 1 + k, 12 - k, 1, 'rgba(60, 30, 70, 0.35)');

      // sun glitter: short dashes that widen toward the shore
      const depth = shore - horizon;
      for (let y = horizon + 1; y < shore - 5; y++) {
        const f = (y - horizon) / depth;
        const spread = sunR * (0.9 + f * 2.4);
        const step = Math.floor(t / 260 + y * 0.37);
        ctxRef.fillStyle = f < 0.25 ? '#fff0b8' : f < 0.6 ? '#ffd08a' : '#f7a26a';
        for (let i = 0; i < 2 + Math.floor(f * 3); i++) {
          const a = hash(y * 12.9898 + i * 78.233 + step * 4.1);
          if (a < 0.3) continue;
          const off = (hash(y * 3.17 + i * 9.1 + step) - 0.5) * spread;
          ctxRef.fillRect(Math.round(sunX + off), y, Math.round(2 + f * 7 * a), 1);
        }
      }
      for (const w of s.waves) {
        const x = Math.round(w.x);
        const y = Math.round(w.y);
        px(x, y, w.len, 1, w.c);
        px(x + 1, y + 1, w.len - 1, 1, 'rgba(20, 14, 50, 0.3)');
      }
      // a breaker rolling in, then the foam edge washing up the sand
      ctxRef.fillStyle = '#e9def2';
      for (let x = 0; x < W; x++) {
        const v = Math.sin(x / 31 - t / 2100);
        if (v > 0.2) ctxRef.fillRect(x, shore - 11 + Math.round(Math.sin(x / 13 + t / 900)), 1, v > 0.7 ? 2 : 1);
      }
      const fleck = Math.floor(t / 300);
      for (let x = 0; x < W; x++) {
        const e = Math.round(shore + 2 + Math.sin(x / 21 + t / 1400) * 1.5 + Math.sin(t / 1100 + x / 140) * 3.5);
        px(x, shore - 3, 1, e - shore + 3, '#4a4686');
        px(x, e, 1, 2, '#fff8ec');
        if ((x + fleck) % 3 === 0) px(x, e - 2, 1, 1, '#cfc4e6');
      }

      ctxRef.drawImage(s.props, 0, 0);
      if (!s.narrow) {
        const fl = Math.floor(t / 200) % 2;
        px(s.castle.x + 1, s.castle.y - 32 + fl, 3, 3, '#e8574a');
        px(s.castle.x + 4, s.castle.y - 31 - fl, 2, 2, '#e8574a');
      }
      const moving = s.crab.pause <= 0;
      px(s.crab.x + 1, s.crabY + 7, 9, 1, 'rgba(110, 60, 50, 0.3)');
      blit(crabFrames[moving ? Math.floor(t / 160) % 2 : 0], s.crab.x, s.crabY);

      // ---- light pass, then what glows or sits against the light
      applyLight(s.lightmap);
      drawStars(s.stars, t);
      ctxRef.globalAlpha = 0.8 + 0.2 * Math.sin(t / 3000);
      ctxRef.drawImage(s.rays, 0, 0);
      ctxRef.globalAlpha = 1;
      ctxRef.drawImage(s.haze, 0, 0);
      // lighthouse: the beam sweeps across and flashes as it turns our way
      const L = s.light;
      const flash = Math.sin(t / 1900) > 0.88;
      px(L.x - 2, L.y, 4, 3, flash ? '#ffffff' : '#ffe9a0');
      if (flash) px(L.x - 5, L.y - 3, 10, 9, 'rgba(255, 240, 180, 0.28)');
      const reach = Math.round(Math.cos(t / 1900) * 80);
      ctxRef.fillStyle = 'rgba(255, 240, 180, 0.2)';
      for (let k = 4; k < Math.abs(reach); k++) {
        if (!dith(k, 0, 0.75 * (1 - k / 90))) continue;
        const half = 1 + Math.floor(k / 14);
        ctxRef.fillRect(L.x + Math.sign(reach) * k, L.y + 1 - half, 1, half * 2 + 1);
      }

      // birds heading home
      ctxRef.fillStyle = '#3a1d3f';
      for (const b of s.birds) {
        const f = Math.floor(t / 200 + b.p) % 4;
        const d1 = f === 0 ? -1 : f === 2 ? 1 : 0;
        const d2 = f === 0 ? -2 : f === 2 ? 2 : 0;
        const x = Math.round(b.x);
        const y = Math.round(b.y);
        ctxRef.fillRect(x, y, 2, 1);
        ctxRef.fillRect(x - 2, y + d1, 2, 1);
        ctxRef.fillRect(x + 2, y + d1, 2, 1);
        ctxRef.fillRect(x - 4, y + d2, 2, 1);
        ctxRef.fillRect(x + 4, y + d2, 2, 1);
      }

      // ---- foreground, close to the viewer: it slides against the view and sways
      ctxRef.save();
      ctxRef.translate(-Math.round(vx * 7), -Math.round(vy * 3));
      // palm: a ringed trunk leaning in from the left, fronds swaying in the breeze
      const th = s.palmH;
      for (let k = -4; k < th; k++) {
        const f = Math.max(0, k / th);
        const x = s.palmX + Math.round(f * f * 34);
        const w = 7 - Math.round(f * 3);
        px(x, H - k, w, 1, k % 6 === 0 ? '#1a0e2a' : '#2c1840');
        px(x + w - 2, H - k, 2, 1, k % 6 === 0 ? '#4a2a4a' : '#8a4658');
      }
      const topX = s.palmX + 36;
      const topY = H - th;
      const sway = Math.sin(t / 900) * 3;
      const fronds = [[-2.95, 44], [-2.45, 50], [-1.95, 42], [-1.3, 44], [-0.7, 52], [-0.2, 48], [0.3, 40], [2.75, 36]];
      fronds.forEach(([a, len], i) => {
        for (let k = 0; k < len; k++) {
          const f = k / len;
          const x = Math.round(topX + Math.cos(a) * k + sway * f * (i % 2 ? 1 : 0.6));
          const y = Math.round(topY + Math.sin(a) * k + k * k * 0.011);
          px(x, y, 2, 2, '#22143a');
          if (k % 2 === 0) px(x, y + 1, 1, Math.round(2 + Math.sin(f * Math.PI) * 9), k % 4 ? '#22143a' : '#3b2452');
        }
      });
      disc(topX - 2, topY + 3, 2, '#3a1d2a');
      disc(topX + 3, topY + 4, 2, '#4a2536');
      for (const g of s.grass) {
        const sway = Math.sin(t / 1100 + g.p) * 2;
        for (let k = -4; k < g.h; k++) {
          const f = Math.max(0, k / g.h);
          px(g.x - f * f * g.h * g.lean + sway * f * f, H - k, f > 0.8 ? 1 : 2, 1, k % 7 ? '#24122e' : '#3a1d3a');
        }
      }
      ctxRef.restore();
    },
  };

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

  // ------------------------------------------------------------------ scene: neon city

  const noteSprite = ['..n..', '..nn.', '..n.n', '..n..', '.nn..', 'nnn..', '.n...'];

  function drawGlyph(g, x, y, color) {
    ctxRef.fillStyle = color;
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (g[j] & (1 << i)) ctxRef.fillRect(x + i, y + j, 1, 1);
  }

  const neon = {
    id: 'city',
    name: 'เมืองนีออน',
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
        const fur = (nx, ny) => (nx * nx + ny * ny > 0.78 && ny < 0.55 ? '#d868e0' : nx < -0.35 ? '#3a2260' : '#2b1a4a');
        shadeEllipse(catX, ledge - 9, 8, 10, fur);
        shadeEllipse(catX, ledge - 22, 6, 5.5, fur);
        poly([[catX - 6, ledge - 22], [catX - 6, ledge - 32], [catX, ledge - 26]], '#2b1a4a');
        poly([[catX + 7, ledge - 22], [catX + 7, ledge - 32], [catX + 1, ledge - 26]], '#2b1a4a');
        stroke(catX - 6, ledge - 24, catX - 6, ledge - 32, '#d868e0');
        stroke(catX - 5, ledge - 31, catX - 2, ledge - 28, '#d868e0');
        stroke(catX + 6, ledge - 24, catX + 6, ledge - 32, '#d868e0');
        stroke(catX + 5, ledge - 31, catX + 2, ledge - 28, '#d868e0');
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

  // ------------------------------------------------------------------ scene: forest campfire

  const camp = {
    id: 'camp',
    name: 'แคมป์ไฟในป่า',
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
        const tone = (nx, ny) => {
          const l = -nx * 0.6 + ny * 0.5;
          return l > 0.35 ? '#8a6a48' : l > -0.15 ? '#5e4630' : '#3a2b1e';
        };
        shadeEllipse(owl.x, owl.y - 9, 6.5, 9, (nx, ny, x, y) => (Math.abs(nx) < 0.5 && ny > -0.2 ? (y % 3 === 0 ? '#6e553a' : '#a8875e') : tone(nx, ny)));
        shadeEllipse(owl.x, owl.y - 19, 6, 5, tone);
        px(owl.x - 5, owl.y - 25, 2, 3, '#3a2b1e');
        px(owl.x + 4, owl.y - 25, 2, 3, '#3a2b1e');
        px(owl.x, owl.y - 17, 1, 2, '#d9a24e');
        px(owl.x - 3, owl.y, 2, 1, '#d9a24e');
        px(owl.x + 2, owl.y, 2, 1, '#d9a24e');
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
      const o = s.owl;
      const blink = Math.floor(t / 180) % 26 === 0;
      for (const ex of [o.x - 3, o.x + 3]) {
        if (blink) px(ex - 1 + ox, o.y - 19 + oy, 3, 1, '#2a1d14');
        else {
          disc(ex + ox, o.y - 19 + oy, 2, '#ffd23f');
          px(ex + ox, o.y - 19 + oy, 1, 1, '#1a1008');
          px(ex - 1 + ox, o.y - 20 + oy, 1, 1, '#fff6c8');
        }
      }
    },
  };

  // ------------------------------------------------------------------ scene: Thai night market

  /**
   * Text drawn crisp: rendered with a real font at a small size, then snapped to whole pixels
   * (every pixel is either fully on or off). Draws onto context `c`; returns the width.
   */
  function pixelText(c, text, x, y, size, color, align = 'left', weight = 600) {
    const font = `${weight} ${size}px "Thira Sans", "Noto Sans Thai", sans-serif`;
    const g = document.createElement('canvas');
    let gc = g.getContext('2d');
    gc.font = font;
    const w = Math.ceil(gc.measureText(text).width) + 2;
    const h = Math.ceil(size * 1.7);
    g.width = w;
    g.height = h;
    gc = g.getContext('2d');
    gc.font = font;
    gc.textBaseline = 'middle';
    gc.fillStyle = '#fff';
    gc.fillText(text, 1, h / 2);
    const img = gc.getImageData(0, 0, w, h);
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] > 100 ? 255 : 0;
    gc.putImageData(img, 0, 0);
    gc.globalCompositeOperation = 'source-in';
    gc.fillStyle = color;
    gc.fillRect(0, 0, w, h);
    c.drawImage(g, Math.round(align === 'center' ? x - w / 2 : x), Math.round(y - h / 2));
    return w;
  }

  /** A lit sign board with text, as its own small canvas. */
  function makeSign(text, bg, fg, size = 9, padX = 4) {
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = `600 ${size}px "Thira Sans", "Noto Sans Thai", sans-serif`;
    const w = Math.ceil(probe.measureText(text).width) + padX * 2 + 2;
    const h = size + 6;
    const g = document.createElement('canvas');
    g.width = w;
    g.height = h;
    const c = g.getContext('2d');
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255, 255, 255, 0.22)';
    c.fillRect(0, 0, w, 1);
    c.fillStyle = 'rgba(0, 0, 0, 0.3)';
    c.fillRect(0, h - 1, w, 1);
    pixelText(c, text, w / 2, h / 2, size, fg, 'center');
    return g;
  }

  /**
   * Multiply a layer by a light map without touching its transparent pixels, so a lit plane can
   * be stacked over whatever is behind it. Writes into `out` (or a new canvas) and returns it.
   */
  function lightLayer(src, map, out) {
    const g = out || document.createElement('canvas');
    g.width = W;
    g.height = H;
    const c = g.getContext('2d');
    c.clearRect(0, 0, W, H);
    c.drawImage(src, 0, 0);
    c.globalCompositeOperation = 'multiply';
    c.drawImage(map, 0, 0);
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(src, 0, 0);
    c.globalCompositeOperation = 'source-over';
    return g;
  }

  /** A small round, dithered glow to stamp around a light. */
  function glowSprite(rad, color, strength = 0.8) {
    const g = document.createElement('canvas');
    g.width = g.height = rad * 2 + 1;
    const c = g.getContext('2d');
    c.fillStyle = color;
    for (let y = -rad; y <= rad; y++)
      for (let x = -rad; x <= rad; x++) {
        const d = Math.hypot(x, y) / rad;
        if (d < 1 && dith(x + rad, y + rad, (1 - d) * (1 - d) * strength * 1.4)) c.fillRect(x + rad, y + rad, 1, 1);
      }
    return g;
  }

  // a soi dog curled up asleep, two frames of breathing
  const dogPal = { b: '#c99a62', h: '#e6be88', d: '#8a6238', c: '#f2e2c8', k: '#2a1a12', e: '#6e4a2a' };
  const dogFrames = [
    sprite(['.....ee..........', '....ehhe.........', '...hbbbbh.hhhh...', '..kbbbbbbhbbbbbh.', '..ccbbbbbbbbbbbbd', '...ccbbbbbbbbbbd.', '....ddddddddddd..'], dogPal),
    sprite(['.....ee..........', '....ehhe..hhh....', '...hbbbbhhbbbbh..', '..kbbbbbbbbbbbbh.', '..ccbbbbbbbbbbbbd', '...ccbbbbbbbbbbd.', '....ddddddddddd..'], dogPal),
  ];

  const SKIN = ['#eebd94', '#d69f74', '#b47c52', '#f2cca4'];
  const HAIR = ['#16121a', '#2a1e18', '#3a2a20', '#0e0c12'];
  const SHIRT = ['#e85a5a', '#4a8ae0', '#f2c14e', '#5fb06b', '#ece6da', '#b46ad8', '#34405e', '#ff8a5c', '#3fa3b5'];
  const PANTS = ['#2a3450', '#1e1e28', '#4a4a58', '#3a5a8a', '#5a4636'];

  function makePeep(r) {
    const pick = (a) => a[Math.floor(r() * a.length)];
    return { shirt: pick(SHIRT), pants: pick(PANTS), skin: pick(SKIN), hair: pick(HAIR), h: 32 + Math.floor(r() * 6), ph: r() * 4, bag: r() < 0.35 ? pick(['#f2ede2', '#e85a5a', '#2a62c8']) : null, long: r() < 0.4, skirt: r() < 0.2 };
  }

  /** A person seen side-on: feet at (x, y), facing `dir`, legs and arm swinging while walking. */
  function drawPeep(p, x, y, dir, t, walking) {
    x = Math.round(x);
    const f = walking ? Math.floor(t / 150 + p.ph) % 4 : 0;
    const legH = Math.round(p.h * 0.44);
    const bodyH = Math.round(p.h * 0.34);
    const headH = p.h - legH - bodyH;
    const hip = y - legH;
    const sh = hip - bodyH; // shoulders
    const sw = f === 1 ? 2 : f === 3 ? -2 : 0;
    const front = dir > 0 ? 1 : -1;
    const shade = 'rgba(0, 0, 0, 0.22)';
    // legs: the far one darker, both swinging from the hip
    const leg = (dx, c) => {
      for (let k = 0; k < legH; k++) px(x + 3 + Math.round((dx * k) / legH), hip + k, 3, 1, c);
      px(x + 3 + dx + (front > 0 ? 1 : -1), y - 1, 4, 1, '#1a1418');
    };
    leg(-sw, p.pants);
    px(x + 3 - sw, hip, 3, legH, shade);
    leg(sw, p.pants);
    if (p.skirt) px(x + 1, hip - 1, 9, Math.round(legH * 0.55), p.shirt);
    // torso, then the near arm swinging
    px(x + 2, sh, 7, bodyH + 1, p.shirt);
    px(front > 0 ? x + 2 : x + 8, sh, 1, bodyH + 1, shade);
    px(x + 2, sh, 7, 1, 'rgba(255, 255, 255, 0.15)');
    for (let k = 0; k < bodyH; k++) px(x + 4 - Math.round((sw * k) / bodyH), sh + 1 + k, 2, 1, k > bodyH - 3 ? p.skin : p.shirt);
    if (p.bag) px(front > 0 ? x : x + 8, hip - 4, 3, 5, p.bag);
    // head: hair over the back, a nose and an eye toward the front
    const hx = x + 2;
    const hy = sh - headH;
    px(hx + 2, hy + headH - 1, 3, 2, p.skin); // neck
    px(hx, hy, 7, headH - 1, p.skin);
    px(hx, hy, 7, 2, p.hair);
    px(front > 0 ? hx : hx + 4, hy, 3, p.long ? headH + 4 : headH - 2, p.hair);
    px(front > 0 ? hx + 7 : hx - 1, hy + 3, 1, 2, p.skin);
    px(front > 0 ? hx + 5 : hx + 1, hy + 3, 1, 1, '#2a1a14');
  }

  const market = {
    id: 'market',
    name: 'ตลาดกลางคืน',
    accent: '#ffc857',
    init() {
      const r = rng(83);
      const narrow = W < 420;
      const floorY = Math.round(H * 0.7); // where the stalls stand
      const walkY = floorY + 13; // shoppers' feet
      const base = floorY - 10; // foot of the shophouses, behind the stalls
      const fh = Math.max(30, Math.round(H * 0.085)); // one storey
      const lights = []; // everything that lights the scene, for the light map
      const glowing = []; // little canvases that stay bright after the light pass
      const bulbs = [];
      const tubes = [];
      const coals = [];
      const pots = [];
      const reflect = [];

      // ---- sky: city glow low down, hazy stars up top
      const sky = layer(() => {
        bands(0, 0, W, floorY, ['#07061a', '#110d30', '#1e1646', '#33205a', '#4e2a62', '#6e3866', '#8a4a66']);
      });

      // ---- shophouses: a row of tired, lovely concrete, with signs and life on every floor
      const WALLS = [
        ['#c4b088', '#a0906c', '#d8c8a0'],
        ['#8eaea6', '#6c8c84', '#a8c6be'],
        ['#cf9a7c', '#ab7a5e', '#e2b294'],
        ['#b4aec6', '#928ca6', '#ccc6dc'],
        ['#dcc07c', '#b89e5c', '#ecd496'],
        ['#a4b48a', '#82926a', '#bccaa2'],
      ];
      const SHOPS = [
        ['ร้านทอง', '#c8241e', '#ffd84a'],
        ['ข้าวมันไก่', '#f2ede2', '#c8241e'],
        ['ร้านยา', '#1e6a4a', '#ffffff'],
        ['โชห่วย', '#2a56b4', '#ffffff'],
        ['ซ่อมมือถือ', '#f2c12e', '#1a1418'],
        ['กาแฟโบราณ', '#3a2418', '#f2d29a'],
        ['ร้านตัดผม', '#e8e2d6', '#2a56b4'],
        ['ก๋วยเตี๋ยวเรือ', '#d8342c', '#ffffff'],
      ];
      const houses = [];
      const houseLayer = layer(() => {
        let x = -16;
        let k = Math.floor(r() * SHOPS.length);
        while (x < W + 16) {
          const w = 60 + Math.floor(r() * 36);
          const floors = 3 + (r() < 0.45 ? 1 : 0);
          const top = base - floors * fh;
          const [wall, wallS, wallHi] = WALLS[Math.floor(r() * WALLS.length)];
          houses.push({ x, w, top });
          // walls, a stain or two, the parapet on top
          px(x, top, w, base - top, wall);
          px(x + w - 2, top, 2, base - top, wallS);
          px(x, top, 1, base - top, wallHi);
          for (let s = 0; s < 3; s++) {
            const sx = x + 4 + Math.floor(r() * (w - 12));
            for (let y = top + 6; y < base - fh; y++) if (dith(sx, y, 0.18 * (1 - (y - top) / (base - top)))) px(sx, y, 3, 1, wallS);
          }
          px(x - 1, top - 4, w + 2, 4, wallHi);
          px(x - 1, top - 1, w + 2, 1, wallS);
          // roof clutter
          const roof = r();
          if (roof < 0.35) {
            // stainless water tank on legs
            const tx = x + 8 + Math.floor(r() * (w - 26));
            px(tx + 2, top - 10, 1, 6, '#5a5660');
            px(tx + 11, top - 10, 1, 6, '#5a5660');
            shadeEllipse(tx + 7, top - 15, 8, 6, (nx) => (nx < -0.4 ? '#e2e6ee' : nx > 0.5 ? '#8a909c' : '#b8bec8'));
          } else if (roof < 0.6) {
            const ax = x + Math.floor(w * 0.7);
            px(ax, top - 18, 1, 14, '#3a3640');
            px(ax - 5, top - 16, 11, 1, '#3a3640');
            px(ax - 3, top - 12, 7, 1, '#3a3640');
          } else if (roof < 0.75) {
            // a corrugated roof shack someone added
            px(x + 6, top - 9, 26, 5, '#7a7680');
            for (let i = 0; i < 26; i += 2) px(x + 6 + i, top - 9, 1, 5, '#5e5a66');
            px(x + 8, top - 4, 22, 1, '#4a4650');
          }

          // upper floors: windows with grilles, balconies, air conditioners, laundry
          for (let f = 1; f < floors; f++) {
            const y0 = base - (f + 1) * fh;
            px(x, y0 + fh - 2, w, 2, wallS); // floor line
            const count = w > 80 ? 3 : 2;
            const ww = 12;
            const gap = (w - count * ww) / (count + 1);
            for (let i = 0; i < count; i++) {
              const wx = Math.round(x + gap + i * (ww + gap));
              const wy = y0 + 7;
              const wh = fh - 16;
              px(wx - 1, wy - 1, ww + 2, wh + 2, wallS);
              const lit = r();
              const c = lit < 0.32 ? '#ffd48a' : lit < 0.4 ? '#9ec0ff' : lit < 0.46 ? '#ffb070' : null;
              px(wx, wy, ww, wh, c || '#1c1a2c');
              if (c) {
                px(wx, wy + wh - 3, ww, 3, 'rgba(0, 0, 0, 0.18)');
                if (r() < 0.6) px(wx + (r() < 0.5 ? 0 : ww - 4), wy, 4, wh, r() < 0.5 ? '#c8584a' : '#5a8a6a'); // curtain
                const win = { x: wx, y: wy, w: ww, h: wh, c };
                glowing.push({ kind: 'win', ...win, house: true });
                lights.push({ x: wx + ww / 2, y: wy + wh / 2, r: 22, color: c === '#9ec0ff' ? '#3a4a70' : '#6a5038' });
              }
              // window grille (เหล็กดัด): bars and a sunburst arc on top
              for (let gx = 2; gx < ww; gx += 3) px(wx + gx, wy, 1, wh, 'rgba(30, 26, 34, 0.75)');
              px(wx, wy + Math.round(wh / 2), ww, 1, 'rgba(30, 26, 34, 0.75)');
              if (r() < 0.4) {
                // air conditioner under the window
                const ay = wy + wh + 3;
                px(wx + 1, ay, 11, 7, '#d8d6cc');
                px(wx + 1, ay, 11, 1, '#f0eee6');
                for (let gx = 2; gx < 10; gx += 2) px(wx + 1 + gx, ay + 2, 1, 4, '#9a988e');
                px(wx + 11, ay + 7, 1, 4, '#3a3640');
              }
            }
            if (f === 1 && r() < 0.65) {
              // balcony: rail, pot plants, washing on a line
              const by = y0 + fh - 9;
              px(x + 3, by, w - 6, 1, '#4a4650');
              for (let i = x + 4; i < x + w - 4; i += 3) px(i, by + 1, 1, 7, '#4a4650');
              px(x + 3, by + 7, w - 6, 1, '#4a4650');
              for (let i = 0; i < 3; i++) {
                const ppx = x + 8 + Math.floor(r() * (w - 20));
                px(ppx, by - 4, 6, 4, '#b86a42');
                shadeEllipse(ppx + 3, by - 7, 4 + r() * 2, 3, (nx, ny) => (ny < -0.2 ? '#6ab05a' : '#3a7a42'));
              }
              stroke(x + 4, y0 + 3, x + w - 4, y0 + 4, '#2a2630');
              for (let i = x + 8; i < x + w - 10; i += 7 + Math.floor(r() * 5)) {
                const cw = 4 + Math.floor(r() * 3);
                px(i, y0 + 4, cw, 6 + Math.floor(r() * 4), SHIRT[Math.floor(r() * SHIRT.length)]);
              }
            }
          }

          // ground floor: sign board over a half-open roller shutter, warm light from inside
          const gy = base - fh;
          const [text, bg, fg] = SHOPS[k++ % SHOPS.length];
          const sign = makeSign(text, bg, fg, 9);
          const signX = Math.round(x + (w - Math.min(sign.width, w - 4)) / 2);
          glowing.push({ kind: 'img', img: sign, x: signX, y: gy + 1, house: true });
          lights.push({ x: signX + sign.width / 2, y: gy + 8, r: 30, ry: 18, color: '#5a4038' });
          ctxRef.drawImage(sign, signX, gy + 1);
          const sy = gy + sign.height + 3;
          const open = 0.35 + r() * 0.35;
          const sh = base - sy;
          const shutterH = Math.round(sh * (1 - open));
          px(x + 3, sy, w - 6, sh, '#ffcf8a');
          bands(x + 3, sy + shutterH, w - 6, sh - shutterH, ['#ffe2a8', '#f2b468', '#c88446']);
          // shelves inside
          for (let y = sy + shutterH + 3; y < base - 2; y += 5) {
            px(x + 6, y, w - 12, 1, '#8a5a32');
            for (let i = x + 7; i < x + w - 8; i += 3) if (r() < 0.6) px(i, y - 3, 2, 3, SHIRT[Math.floor(r() * SHIRT.length)]);
          }
          for (let y = sy; y < sy + shutterH; y++) px(x + 3, y, w - 6, 1, (y - sy) % 2 ? '#8a8690' : '#a6a2ac');
          px(x + 3, sy + shutterH, w - 6, 1, '#5a5660');
          glowing.push({ kind: 'win', x: x + 3, y: sy + shutterH + 1, w: w - 6, h: sh - shutterH - 1, c: null, house: true, interior: true });
          lights.push({ x: x + w / 2, y: base - 4, r: w * 0.7, ry: 26, color: '#8a6038' });
          reflect.push({ x: x + w / 2, y: base - 6, w: w - 16, c: 'rgba(255, 200, 130, 0.16)' });
          x += w;
          px(x - 1, top, 1, base - top, 'rgba(0, 0, 0, 0.25)');
        }
      });

      // ---- power poles and the famous tangle of cables
      const poleXs = narrow ? [Math.round(W * 0.82)] : [Math.round(W * 0.2), Math.round(W * 0.74)];
      const poleTop = Math.round(H * 0.2);
      const wireLayer = layer(() => {
        for (const pxl of poleXs) {
          px(pxl - 2, poleTop, 5, base - poleTop + 6, '#9c988e');
          px(pxl - 2, poleTop, 1, base - poleTop + 6, '#bab6ac');
          px(pxl + 2, poleTop, 1, base - poleTop + 6, '#6e6a62');
          for (const cy of [poleTop + 6, poleTop + 16]) {
            px(pxl - 14, cy, 29, 2, '#7a766e');
            for (const ix of [-12, -5, 6, 12]) px(pxl + ix, cy - 2, 1, 2, '#e8e2d6');
          }
          // a transformer can
          px(pxl + 4, poleTop + 24, 8, 14, '#8a8e94');
          px(pxl + 4, poleTop + 24, 8, 2, '#a8acb2');
          px(pxl + 11, poleTop + 24, 1, 14, '#5e6268');
          // coils of spare cable hanging off the pole
          for (let c = 0; c < 4; c++) {
            const cx = pxl + (c % 2 ? 4 : -4) + Math.floor(r() * 4 - 2);
            const cy = poleTop + 34 + c * 9 + Math.floor(r() * 4);
            const rx = 4 + Math.floor(r() * 4);
            const ry = 3 + Math.floor(r() * 3);
            for (let a = 0; a < 40; a++) px(cx + Math.cos((a / 40) * Math.PI * 2) * rx, cy + Math.sin((a / 40) * Math.PI * 2) * ry, 1, 1, '#14111a');
            for (let a = 0; a < 30; a++) px(cx + 1 + Math.cos((a / 30) * Math.PI * 2) * (rx - 1), cy + 1 + Math.sin((a / 30) * Math.PI * 2) * (ry - 1), 1, 1, '#1e1a24');
          }
          px(pxl - 4, base - 30, 9, 12, '#e8e2d6'); // a notice stuck on the pole
          for (let i = 0; i < 4; i++) px(pxl - 3, base - 28 + i * 2, 6 - (i % 2) * 2, 1, '#6a6670');
        }
        // the wires: many sagging spans, pole to pole and off past both edges
        const anchors = [-30, ...poleXs, W + 30];
        for (let i = 0; i + 1 < anchors.length; i++) {
          const a = anchors[i];
          const b = anchors[i + 1];
          for (let wi = 0; wi < 7; wi++) {
            const y0 = poleTop + 4 + wi * 3;
            const sag = 10 + wi * 3 + r() * 8;
            for (let x = a; x <= b; x++) {
              const f = (x - a) / (b - a);
              px(x, y0 + Math.sin(f * Math.PI) * sag, 1, wi % 3 ? 1 : 2, wi % 2 ? '#14111a' : '#1c1822');
            }
          }
        }
      });

      // ---- the street: sidewalk behind the stalls, then wet asphalt toward us
      const street = layer(() => {
        px(0, base, W, 4, '#6a6672');
        px(0, base, W, 1, '#8a8692');
        bands(0, base + 4, W, floorY - base - 4 + 2, ['#3a3644', '#2e2a38']);
        bands(0, floorY, W, H - floorY, ['#2a2634', '#211e2c', '#1a1824', '#14121c', '#0e0c16']);
        for (let i = 0; i < W * 0.6; i++) px(r() * W, floorY + 2 + r() * (H - floorY), 1, 1, r() < 0.5 ? '#2e2a3a' : '#16141e');
        // puddles that hold the reflections a little sharper
        for (let i = 0; i < Math.round(W / 120); i++) {
          const cx = r() * W;
          const cy = floorY + 18 + r() * (H - floorY - 26);
          shadeEllipse(cx, cy, 24 + r() * 30, 3 + r() * 3, (nx, ny, x, y) => (dith(x, y, 0.7) ? '#0c0a14' : '#121020'));
        }
        // a yellow line on the kerb
        for (let x = 0; x < W; x += 12) px(x, floorY - 1, 8, 1, '#c8a23a');
      });

      // ---- the stalls
      const cycle = ['grill', 'tea', 'noodle', 'fruit', 'roti'];
      const sw = narrow ? Math.round(W * 0.42) : 84;
      const gap = narrow ? Math.round(W * 0.06) : 12;
      const n = Math.max(2, Math.floor((W + 40) / (sw + gap)));
      const mid = Math.floor(n / 2);
      const total = n * sw + (n - 1) * gap;
      const start = Math.round((W - total) / 2);
      const stalls = Array.from({ length: n }, (_, i) => ({ kind: cycle[(((i - mid + 2) % 5) + 5) % 5], x: start + i * (sw + gap), w: sw }));
      const UMB = [
        ['#d8342c', '#f2ede2'],
        ['#2a62c8', '#f2ede2'],
        ['#2a8a5a', '#f2c14e'],
        ['#f08a2a', '#f2ede2'],
        ['#c83a7a', '#f2ede2'],
      ];
      const counterY = floorY - 22;
      const stallLayer = layer(() => {
        stalls.forEach((st, si) => {
          const { x, w } = st;
          const cx = x + Math.round(w / 2);
          const canopyY = floorY - 70;
          // poles
          px(x + 3, canopyY, 2, floorY - canopyY, '#8a8e96');
          px(x + w - 5, canopyY, 2, floorY - canopyY, '#6a6e76');
          // the vendor, standing behind the counter
          drawPeep(makePeep(r), cx - 5 + (st.kind === 'noodle' ? 12 : 0), floorY - 2, si % 2 ? 1 : -1, 0, false);
          // the canopy: a big striped umbrella or a sloped tarp with a scalloped hem
          if (si % 2 === 0) {
            const [a, b] = UMB[si % UMB.length];
            const rr = Math.round(w * 0.62);
            const dome = 16;
            for (let k = 0; k < dome; k++) {
              const half = Math.round(rr * Math.sqrt(1 - (1 - (k + 1) / dome) ** 2));
              for (let j = -half; j <= half; j++) {
                const seg = Math.floor(((j / (half + 0.5)) * 0.5 + 0.5) * 8) % 2 === 0;
                const dark = k > dome - 4 || j < -half * 0.5;
                px(cx + j, canopyY - dome + k, 1, 1, seg ? (dark ? '#9a2420' : a) : dark ? '#c8c2b4' : b);
              }
            }
            for (let j = -rr; j <= rr; j++) if (Math.floor((j + rr) / 3) % 2 === 0) px(cx + j, canopyY, 1, 2, '#3a2a2a');
            px(cx, canopyY - dome - 4, 2, 4, '#c8c2b4');
            st.under = canopyY + 2;
          } else {
            const T = ['#2a5ab8', '#e86a2a', '#c83a5a', '#2a8a7a'][si % 4];
            for (let k = 0; k < 10; k++) px(x - 4, canopyY - 10 + k, w + 8, 1, k < 2 ? '#ffffff55' : T);
            px(x - 4, canopyY - 10, w + 8, 10, 'rgba(0, 0, 0, 0)');
            for (let j = 0; j < w + 8; j++) {
              const d = Math.round(Math.abs(Math.sin((j / (w + 8)) * Math.PI * 5)) * 3);
              px(x - 4 + j, canopyY, 1, d + 1, T);
            }
            px(x - 4, canopyY - 10, w + 8, 1, 'rgba(255, 255, 255, 0.3)');
            st.under = canopyY + 4;
          }
          // what hangs under the canopy: bare bulbs, or a fluorescent tube at the noodle cart
          if (st.kind === 'noodle') {
            tubes.push({ x: cx - 14, y: st.under + 3, w: 28 });
            lights.push({ x: cx, y: st.under + 14, r: 76, ry: 58, color: '#7ab8a8' });
            lights.push({ x: cx, y: counterY, r: 46, ry: 24, color: '#b8f0dc' });
            reflect.push({ x: cx, y: st.under + 3, w: 26, c: 'rgba(200, 255, 235, 0.2)' });
          }
          for (const bx of st.kind === 'noodle' ? [x + 10] : [x + Math.round(w * 0.3), x + Math.round(w * 0.72)]) {
            const drop = 6 + Math.floor(r() * 6);
            bulbs.push({ x: bx, y: st.under + drop, top: st.under, p: r() * 6 });
            lights.push({ x: bx, y: st.under + drop + 4, r: 74, ry: 62, color: '#d29458' });
            lights.push({ x: bx, y: st.under + drop + 2, r: 24, color: '#ffe0b0' });
            reflect.push({ x: bx, y: st.under + drop, w: 6, c: 'rgba(255, 210, 140, 0.22)' });
          }

          // ---- the counter and its goods
          const cTop = counterY;
          const body = (c1, c2) => {
            px(x + 2, cTop, w - 4, floorY - cTop, c1);
            px(x + 2, cTop, w - 4, 2, c2);
            px(x + 2, floorY - 3, w - 4, 3, 'rgba(0, 0, 0, 0.3)');
          };
          if (st.kind === 'noodle') {
            // stainless cart with a glass cabinet, big soup pots on the left
            body('#9aa0aa', '#c8ced8');
            for (let i = x + 6; i < x + w - 6; i += 8) px(i, cTop + 4, 1, floorY - cTop - 8, '#7a808a');
            disc(x + 12, floorY + 1, 3, '#1a1820');
            disc(x + w - 12, floorY + 1, 3, '#1a1820');
            const gx = x + 30;
            const gw = w - 34;
            px(gx, cTop - 20, gw, 20, '#c8302a');
            px(gx + 2, cTop - 18, gw - 4, 16, '#d8eeee');
            px(gx + 2, cTop - 18, gw - 4, 1, '#ffffff');
            for (let i = 0; i < gw - 8; i += 2) px(gx + 4 + i, cTop - 6 - (i % 3), 1, 3, '#f2d27a'); // noodles
            for (let i = 0; i < gw - 10; i += 5) px(gx + 5 + i, cTop - 12, 3, 2, '#5fb06b'); // greens
            px(gx + gw - 12, cTop - 15, 8, 4, '#e8a8a0'); // pork
            const sign = makeSign('ก๋วยเตี๋ยว', '#f2ede2', '#c8241e', 8, 3);
            glowing.push({ kind: 'img', img: sign, x: Math.round(gx + (gw - sign.width) / 2), y: cTop - 20 - sign.height });
            ctxRef.drawImage(sign, Math.round(gx + (gw - sign.width) / 2), cTop - 20 - sign.height);
            for (const [ox, rr] of [[8, 7], [21, 6]]) {
              const pxx = x + ox;
              px(pxx - rr, cTop - 12, rr * 2, 12, '#b8bec8');
              px(pxx - rr, cTop - 12, 2, 12, '#e2e6ee');
              px(pxx + rr - 2, cTop - 12, 2, 12, '#7a808a');
              shadeEllipse(pxx, cTop - 12, rr, 2, () => '#d8dce4');
              shadeEllipse(pxx, cTop - 12, rr - 1, 1, () => '#c8a070');
              pots.push({ x: pxx, y: cTop - 14 });
            }
          } else if (st.kind === 'grill') {
            body('#5a3a2a', '#7a5238');
            const gx = x + 8;
            const gw = w - 16;
            px(gx, cTop - 8, gw, 8, '#26222a');
            px(gx, cTop - 8, gw, 1, '#4a4650');
            coals.push({ x: gx + 2, y: cTop - 7, w: gw - 4 });
            lights.push({ x: gx + gw / 2, y: cTop - 8, r: 52, ry: 34, color: '#c05a28' });
            for (let i = 0; i < gw - 6; i += 5) {
              px(gx + 3 + i, cTop - 11, 1, 6, '#c8a878'); // skewer
              px(gx + 2 + i, cTop - 10, 3, 3, i % 10 ? '#8a3a22' : '#a84a2a'); // moo ping
            }
            // sticky rice basket
            px(x + w - 16, cTop - 10, 10, 10, '#c8a060');
            for (let y = cTop - 9; y < cTop; y += 2) px(x + w - 16, y, 10, 1, '#a07c44');
            px(x + w - 15, cTop - 12, 8, 2, '#d8b878');
            smokeSrcPush(gx + gw / 2, cTop - 12);
            const sign = makeSign('หมูปิ้ง', '#ffd84a', '#c8241e', 8, 3);
            glowing.push({ kind: 'img', img: sign, x: x + 4, y: cTop + 4 });
            ctxRef.drawImage(sign, x + 4, cTop + 4);
          } else if (st.kind === 'tea') {
            body('#2a62c8', '#4a82e8');
            px(x + 6, cTop + 6, w - 12, 1, '#1e4a9a');
            // rows of Thai tea in clear cups
            for (let i = 0; i < 6; i++) {
              const tx = x + 8 + i * 6;
              px(tx, cTop - 8, 4, 8, '#f08a3a');
              px(tx, cTop - 8, 4, 2, '#f8e8d0');
              px(tx, cTop - 8, 1, 8, 'rgba(255, 255, 255, 0.35)');
              px(tx + 2, cTop - 12, 1, 4, i % 2 ? '#e85a5a' : '#3fa3b5');
            }
            // a big cooler and a stack of cups
            px(x + w - 24, cTop - 14, 18, 14, '#e8e2d6');
            px(x + w - 24, cTop - 14, 18, 3, '#d8342c');
            px(x + w - 24, cTop - 9, 18, 1, '#c8c2b4');
            for (let i = 0; i < 4; i++) px(x + 46 + (i % 2), cTop - 4 - i * 3, 5, 3, 'rgba(230, 240, 255, 0.55)');
            const sign = makeSign('ชาไทย', '#f08a3a', '#ffffff', 8, 3);
            glowing.push({ kind: 'img', img: sign, x: x + 8, y: cTop + 8 });
            ctxRef.drawImage(sign, x + 8, cTop + 8);
          } else if (st.kind === 'fruit') {
            body('#3a6a3a', '#5a8a52');
            const FR = [
              ['#f2c14e', '#d8a02e'], // mango
              ['#e04a8a', '#a8305e'], // dragon fruit
              ['#e83a2a', '#a82418'], // rambutan
              ['#f08a2a', '#c86a1a'], // oranges
              ['#7ab84a', '#4a8a2a'], // guava
            ];
            for (let i = 0; i < 4; i++) {
              const bx = x + 5 + i * Math.floor((w - 10) / 4);
              const bw = Math.floor((w - 10) / 4) - 2;
              px(bx, cTop - 4, bw, 5, '#2a62c8');
              px(bx, cTop - 4, bw, 1, '#4a82e8');
              const [a, b] = FR[(i + si) % FR.length];
              for (let row = 0; row < 3; row++)
                for (let j = row; j < bw - row; j += 3) {
                  px(bx + j, cTop - 7 - row * 3, 3, 3, b);
                  px(bx + j, cTop - 7 - row * 3, 2, 2, a);
                }
            }
            // watermelon slices on ice
            for (let i = 0; i < 4; i++) {
              const wx = x + 10 + i * 9;
              poly([[wx, cTop + 10], [wx + 7, cTop + 10], [wx + 3.5, cTop + 4]], '#e8384a');
              px(wx, cTop + 10, 7, 1, '#3a8a3a');
            }
            const sign = makeSign('ผลไม้สด', '#ffffff', '#2a8a3a', 8, 3);
            glowing.push({ kind: 'img', img: sign, x: x + w - sign.width - 6, y: cTop + 6 });
            ctxRef.drawImage(sign, x + w - sign.width - 6, cTop + 6);
          } else {
            // roti: a flat griddle, bananas, a can of condensed milk
            body('#c8a24a', '#e2bc62');
            px(x + 8, cTop - 3, 30, 3, '#2a2630');
            px(x + 8, cTop - 3, 30, 1, '#6a6670');
            shadeEllipse(x + 22, cTop - 4, 10, 2, (nx) => (nx < 0 ? '#f8e2a8' : '#e8c47a'));
            for (let i = 0; i < 4; i++) {
              const bx = x + 44 + i * 4;
              for (let k = 0; k < 9; k++) px(bx + Math.round(Math.sin((k / 9) * Math.PI) * 2), cTop - 2 - k, 2, 1, k > 7 ? '#5a4a1a' : '#f2d23e');
            }
            px(x + w - 16, cTop - 8, 6, 8, '#e8e2d6');
            px(x + w - 16, cTop - 6, 6, 3, '#2a62c8');
            for (let i = 0; i < 3; i++) shadeEllipse(x + w - 26, cTop - 2 - i * 2, 6, 1.5, () => (i % 2 ? '#e8c47a' : '#f2d898'));
            const sign = makeSign('โรตี', '#2a8a5a', '#ffffff', 8, 4);
            glowing.push({ kind: 'img', img: sign, x: x + 8, y: cTop + 6 });
            ctxRef.drawImage(sign, x + 8, cTop + 6);
          }
          // a price card
          px(x + w - 16, cTop + 8, 10, 7, '#ffffff');
          px(x + w - 15, cTop + 10, 8, 1, '#c8241e');
          px(x + w - 15, cTop + 12, 6, 1, '#c8241e');
        });

        // a moped parked by the kerb
        if (!narrow) {
          const mx = Math.round(W * 0.05);
          const my = floorY + 30;
          disc(mx, my, 6, '#16141c');
          disc(mx, my, 3, '#6a6670');
          disc(mx + 34, my, 6, '#16141c');
          disc(mx + 34, my, 3, '#6a6670');
          poly([[mx + 4, my - 4], [mx + 14, my - 14], [mx + 30, my - 12], [mx + 34, my - 4], [mx + 22, my - 2]], '#c8302a');
          px(mx + 12, my - 18, 16, 4, '#1a1820');
          stroke(mx + 32, my - 4, mx + 36, my - 22, '#5a5660', 2);
          px(mx + 33, my - 26, 8, 2, '#3a3640');
          px(mx + 38, my - 22, 4, 4, '#f2ede2');
          px(mx + 2, my - 8, 4, 2, '#e8e2d6');
        }
      });

      function smokeSrcPush(x, y) {
        coals.at(-1).smoke = { x, y };
      }

      // ---- a few tables and stools in front of the noodle cart
      const noodle = stalls.find((st) => st.kind === 'noodle') || stalls[0];
      const tables = layer(() => {
        if (narrow) return;
        const tx = noodle.x + noodle.w / 2 + 8;
        const ty = floorY + 34;
        const stool = (sx, sy, c) => {
          px(sx, sy - 11, 11, 2, c);
          px(sx, sy - 11, 11, 1, 'rgba(255, 255, 255, 0.25)');
          px(sx + 1, sy - 9, 2, 9, c);
          px(sx + 8, sy - 9, 2, 9, c);
          px(sx + 2, sy - 4, 7, 1, c);
        };
        stool(tx - 34, ty + 2, '#d8342c');
        stool(tx + 24, ty + 3, '#2a62c8');
        px(tx - 20, ty - 20, 40, 3, '#c8ccd4');
        px(tx - 20, ty - 20, 40, 1, '#eef2f8');
        px(tx - 20, ty - 17, 40, 1, '#6a6e76');
        px(tx - 16, ty - 17, 2, 17, '#8a8e96');
        px(tx + 14, ty - 17, 2, 17, '#8a8e96');
        // a bowl, a jar of chilli, a box of tissue
        shadeEllipse(tx - 8, ty - 22, 6, 2.5, () => '#f2ede2');
        px(tx + 4, ty - 26, 4, 6, '#d8342c');
        px(tx + 10, ty - 25, 6, 5, '#f2ede2');
        stool(tx - 64, ty + 8, '#2a62c8');
        stool(tx + 52, ty + 1, '#d8342c');
      });

      // ---- the soi dog asleep by the fruit stall
      const fruit = stalls.find((st) => st.kind === 'fruit') || stalls[stalls.length - 1];
      const dog = { x: Math.min(W - 24, fruit.x + fruit.w - 22), y: floorY + 16 };

      // ---- coloured fair lights across the street, pole to pole
      const fair = [];
      {
        const a = narrow ? -10 : poleXs[0];
        const b = narrow ? poleXs[0] : poleXs[1];
        const y0 = poleTop + 26;
        for (let x = a; x <= b; x += 1) {
          const f = (x - a) / (b - a);
          fair.push([x, Math.round(y0 + Math.sin(f * Math.PI) * 22)]);
        }
        const tail = narrow ? [] : [[b, W + 20]];
        for (const [p, q] of tail)
          for (let x = p; x <= q; x++) fair.push([x, Math.round(y0 + Math.sin(((x - p) / (q - p + 40)) * Math.PI) * 16)]);
        lights.push({ x: (a + b) / 2, y: y0 + 18, r: (b - a) / 2 + 20, ry: 30, color: '#4a3a50' });
      }

      // ---- the light map
      const lightmap = makeLightmap(
        '#3a3660',
        [{ poly: [[0, 0], [W, 0], [W, H * 0.4], [0, H * 0.4]], from: [0, 0], to: [0, H * 0.4], color: '#9a9a9a' }, ...lights],
        { vignette: 0.32 },
      );

      // ---- foreground: the edge of our own umbrella overhead, and our table
      const near = layer(() => {
        const ex = Math.round(W * (narrow ? 0.35 : 0.55));
        for (let x = ex; x < W + 20; x++) {
          const f = (x - ex) / (W + 20 - ex);
          const y = Math.round(14 - f * 10 + Math.abs(Math.sin(x / 9)) * 4);
          const stripe = Math.floor(x / 22) % 2;
          px(x, -2, 1, y + 2, stripe ? '#a82420' : '#d8cfc0');
          px(x, y, 1, 1, stripe ? '#6a1612' : '#9a9284');
        }
        px(ex, -2, 1, 10, '#3a2a2a');
        if (narrow) return;
        // the table: brushed steel, with a rooster bowl of noodles and a glass of iced tea
        const tx = Math.round(W * 0.86);
        const ty = H - 14;
        px(tx - 66, ty + 4, 132, 3, '#3a3e46');
        shadeEllipse(tx, ty, 66, 10, (nx, ny, x, y) => (ny < -0.55 ? '#c8ccd4' : ny > 0.55 ? '#5e626a' : dith(x, y, 0.25 + nx * 0.2) ? '#8e949e' : '#7a808a'));
        px(tx - 4, ty + 10, 8, 14, '#2e3238');
        const bx = tx - 22;
        const by = ty - 10;
        shadeEllipse(bx, by + 4, 14, 7, (nx, ny) => (ny > 0.2 ? '#d8d2c6' : '#f4efe4'));
        px(bx - 14, by, 28, 2, '#f4efe4');
        px(bx - 13, by + 1, 26, 1, '#2a62c8');
        // the rooster on the side of the bowl
        px(bx - 4, by + 5, 4, 3, '#e8402a');
        px(bx - 1, by + 4, 2, 2, '#e8402a');
        px(bx - 5, by + 8, 2, 1, '#2a8a3a');
        px(bx + 3, by + 6, 3, 1, '#2a8a3a');
        shadeEllipse(bx, by, 12, 2.5, (nx) => (nx > 0.3 ? '#c8803a' : '#a8602a'));
        for (let i = -8; i < 8; i += 3) px(bx + i, by - 1, 2, 1, '#f2d27a');
        px(bx + 2, by - 2, 4, 2, '#e8a8a0');
        px(bx - 6, by - 2, 3, 1, '#5fb06b');
        stroke(bx + 8, by - 3, bx + 26, by - 16, '#c89a5a');
        stroke(bx + 10, by - 2, bx + 28, by - 14, '#a87a3a');
        // iced tea with a straw
        const gx = tx + 20;
        px(gx, ty - 26, 12, 20, 'rgba(230, 240, 255, 0.35)');
        px(gx + 1, ty - 18, 10, 12, '#f08a3a');
        px(gx + 1, ty - 22, 10, 4, '#f8e2c8');
        px(gx + 1, ty - 25, 2, 18, 'rgba(255, 255, 255, 0.4)');
        stroke(gx + 7, ty - 22, gx + 10, ty - 34, '#e85a5a', 2);
        px(gx + 3, ty - 20, 2, 2, '#ffffff');
        px(gx + 7, ty - 16, 2, 2, '#ffffff');
      });
      // light each plane once, now, so planes stack in the right order at run time
      const far = layer(() => {
        ctxRef.drawImage(houseLayer, 0, 0);
        ctxRef.drawImage(wireLayer, 0, 0);
      });
      const farLit = lightLayer(far, lightmap);
      {
        const c = farLit.getContext('2d');
        for (const g of glowing) {
          if (!g.house) continue;
          if (g.kind === 'img') c.drawImage(g.img, g.x, g.y);
          else if (g.interior) {
            c.fillStyle = 'rgba(255, 210, 140, 0.35)';
            c.fillRect(g.x, g.y, g.w, g.h);
          } else {
            c.fillStyle = g.c + 'aa';
            c.fillRect(g.x, g.y, g.w, g.h);
          }
        }
      }
      const midLit = lightLayer(
        layer(() => {
          ctxRef.drawImage(street, 0, 0);
          ctxRef.drawImage(stallLayer, 0, 0);
        }),
        lightmap,
      );
      for (const g of glowing) if (!g.house && g.kind === 'img') midLit.getContext('2d').drawImage(g.img, g.x, g.y);
      const tablesLit = lightLayer(tables, lightmap);

      const nearBulbs = narrow
        ? [{ x: Math.round(W * 0.7), y: 22, p: 1 }]
        : [
            { x: Math.round(W * 0.66), y: 24, p: 1 },
            { x: Math.round(W * 0.9), y: 20, p: 3 },
          ];

      return {
        narrow,
        floorY,
        walkY,
        base,
        sky,
        farLit,
        midLit,
        tablesLit,
        dyn: document.createElement('canvas'),
        mask: document.createElement('canvas'),
        bulbGlow: glowSprite(12, 'rgba(255, 214, 150, 0.30)'),
        bulbGlowBig: glowSprite(16, 'rgba(255, 214, 150, 0.30)', 1.2),
        fairGlow: glowSprite(4, 'rgba(255, 255, 255, 0.30)'),
        near,
        nearBulbs,
        lightmap,
        bulbs,
        tubes,
        coals,
        pots,
        reflect,
        fair,
        dog,
        bowl: narrow ? null : { x: Math.round(W * 0.86) - 22, y: H - 26 },
        stars: makeStars(r, W * 0.1, H * 0.25, ['#cfc8ff', '#ffe6c8']),
        haze: makeMist(H * 0.3, H * 0.4, H * 0.5, 'rgba(255, 170, 150, 0.10)', 0.3, W + 40),
        peeps: Array.from({ length: narrow ? 3 : 8 }, (_, i) => ({
          ...makePeep(r),
          x: r() * W,
          dir: i % 2 ? 1 : -1,
          v: 0.28 + r() * 0.3,
          lane: Math.floor(r() * 3) * 4,
          stop: 0,
        })),
        smoke: [],
        steam: [],
        moths: Array.from({ length: 4 }, () => ({ a: r() * 6, r: 4 + r() * 6, v: 0.15 + r() * 0.2 })),
      };
    },
    update(s) {
      for (const p of s.peeps) {
        if (p.stop > 0) {
          p.stop--;
          continue;
        }
        p.x += p.v * p.dir;
        if (Math.random() < 0.004) p.stop = 30 + Math.floor(Math.random() * 60); // browsing a stall
        if (p.x > W + 12) p.x = -12;
        if (p.x < -12) p.x = W + 12;
      }
      for (const c of s.coals) if (c.smoke && Math.random() < 0.5) s.smoke.push({ x: c.smoke.x + (Math.random() - 0.5) * 10, y: c.smoke.y, life: 0 });
      for (const p of s.pots) if (Math.random() < 0.3) s.steam.push({ x: p.x + (Math.random() - 0.5) * 6, y: p.y, life: 0, max: 40 });
      if (s.bowl && Math.random() < 0.25) s.steam.push({ x: s.bowl.x + (Math.random() - 0.5) * 12, y: s.bowl.y - 4, life: 0, max: 46, near: true });
      for (const p of s.smoke) {
        p.y -= 0.6;
        p.x += 0.35 + Math.sin(p.life / 8) * 0.25;
        p.life++;
      }
      for (const p of s.steam) {
        p.y -= 0.5;
        p.x += Math.sin(p.life / 6 + p.x) * 0.25;
        p.life++;
      }
      s.smoke = s.smoke.filter((p) => p.life < 80);
      s.steam = s.steam.filter((p) => p.life < p.max);
      for (const m of s.moths) m.a += m.v;
    },
    draw(s, t) {
      const { x: vx, y: vy } = look(t);
      const { floorY } = s;
      ctxRef.drawImage(s.sky, 0, 0);
      drawStars(s.stars, t);

      // ---- the far plane: shophouses, poles and wires (lit already), haze, the fair lights
      const hx = Math.round(vx * 2.5);
      const hy = Math.round(vy * 1);
      ctxRef.save();
      ctxRef.translate(hx, hy);
      ctxRef.drawImage(s.farLit, 0, 0);
      ctxRef.drawImage(s.haze, Math.round(-20 + Math.sin(t / 9000) * 14), 0);
      for (const [x, y] of s.fair) px(x, y, 1, 1, '#16121c');
      const FAIR = ['#ff4a4a', '#ffd84a', '#5fe07a', '#5aa8ff', '#ff8ad8'];
      for (let i = 0; i < s.fair.length; i += 8) {
        const [x, y] = s.fair[i];
        const on = (Math.floor(t / 400) + i / 8) % 5 !== 0;
        const c = FAIR[(i / 8) % FAIR.length];
        if (on) ctxRef.drawImage(s.fairGlow, x - 3, y - 2);
        px(x, y + 1, 2, 2, on ? c : '#3a3040');
      }
      ctxRef.restore();

      // ---- the street and stalls (lit already), and the wet street's reflections
      ctxRef.drawImage(s.midLit, 0, 0);
      for (const rf of s.reflect) {
        const ry = Math.round(floorY + 4 + (floorY - rf.y) * 0.3);
        for (let y = ry; y < Math.min(H, ry + 16); y += 3) {
          const fade = (1 - (y - ry) / 16) * 0.7;
          const wob = Math.round(Math.sin(y * 0.7 + t / 350) * 1.5);
          const w = Math.max(1, Math.round(rf.w * (0.5 + 0.5 * hash(y * 1.7 + rf.x))));
          if (dith(Math.round(rf.x), y, fade)) px(rf.x - w / 2 + wob, y, w, 1, rf.c);
        }
      }

      // ---- what moves: drawn on its own canvas, lit by the same map, then laid on top
      const saved = ctxRef;
      s.dyn.width = W;
      s.dyn.height = H;
      ctxRef = s.dyn.getContext('2d');
      blit(dogFrames[Math.floor(t / 1600) % 2], s.dog.x, s.dog.y);
      const lanes = [...s.peeps].sort((a, b) => a.lane - b.lane);
      for (const p of lanes) drawPeep(p, p.x, s.walkY + p.lane, p.dir, t, p.stop <= 0);
      for (const p of s.smoke) disc(Math.round(p.x), Math.round(p.y), 2 + Math.floor(p.life / 16), `rgba(190, 185, 195, ${0.28 * (1 - p.life / 80)})`);
      ctxRef = saved;
      lightLayer(s.dyn, s.lightmap, s.mask);
      ctxRef.drawImage(s.mask, 0, 0);
      ctxRef.drawImage(s.tablesLit, 0, 0);
      for (const p of s.steam) if (!p.near) px(p.x, p.y, 1, 2, `rgba(240, 240, 250, ${0.4 * (1 - p.life / p.max)})`);
      // the dog dreams
      const zt = (t / 1500) % 3;
      if (zt < 2) {
        ctxRef.fillStyle = 'rgba(244, 233, 216, 0.6)';
        const zx = s.dog.x + 2 + Math.floor(zt * 2);
        const zy = s.dog.y - 5 - Math.floor(zt * 4);
        ctxRef.fillRect(zx, zy, 3, 1);
        ctxRef.fillRect(zx + 1, zy + 1, 1, 1);
        ctxRef.fillRect(zx, zy + 2, 3, 1);
      }

      // ---- lights: bulbs, the fluorescent tube, the coals, moths round a bulb
      for (const b of s.bulbs) {
        const sway = Math.round(Math.sin(t / 1500 + b.p) * 0.6);
        stroke(b.x, b.top, b.x + sway, b.y - 1, '#1a1418');
        ctxRef.drawImage(s.bulbGlow, b.x + sway - 12, b.y - 10);
        px(b.x + sway, b.y, 2, 3, '#ffe7b0');
        px(b.x + sway, b.y, 1, 1, '#ffffff');
      }
      for (const tb of s.tubes) {
        const beat = Math.floor(t / 90) % 97;
        const dead = beat === 0 || beat === 2;
        if (!dead) px(tb.x - 2, tb.y - 1, tb.w + 4, 4, 'rgba(200, 255, 235, 0.18)');
        px(tb.x, tb.y, tb.w, 2, dead ? '#6a7a76' : '#eafff6');
      }
      for (const c of s.coals) {
        for (let i = 0; i < c.w; i += 2) {
          const hot = hash(i * 3.1 + Math.floor(t / 220)) > 0.45;
          px(c.x + i, c.y, 2, 2, hot ? '#ff8a3a' : '#c8401e');
        }
      }
      if (s.bulbs.length) {
        const b = s.bulbs[Math.min(1, s.bulbs.length - 1)];
        for (const m of s.moths) px(b.x + Math.cos(m.a) * m.r, b.y + 1 + Math.sin(m.a * 1.3) * m.r * 0.6, 1, 1, '#f2e6d0');
      }

      // ---- foreground: our umbrella and table, nearest of all
      const nx = -Math.round(vx * 7);
      const ny = -Math.round(vy * 3);
      ctxRef.save();
      ctxRef.translate(nx, ny);
      ctxRef.drawImage(s.near, 0, 0);
      for (const b of s.nearBulbs) {
        const sway = Math.round(Math.sin(t / 1300 + b.p) * 1);
        stroke(b.x, 6, b.x + sway, b.y - 1, '#1a1418');
        ctxRef.drawImage(s.bulbGlowBig, b.x + sway - 18, b.y - 16);
        px(b.x + sway, b.y, 3, 4, '#ffe7b0');
        px(b.x + sway, b.y, 1, 1, '#ffffff');
      }
      for (const p of s.steam) if (p.near) px(p.x, p.y, 2, 2, `rgba(240, 240, 250, ${0.4 * (1 - p.life / p.max)})`);
      ctxRef.restore();
    },
  };

  const SCENES = [rainyRoom, seaside, cabin, neon, camp, market];

  // ------------------------------------------------------------------ engine

  function resize() {
    const scale = Math.max(1, Math.round(innerHeight / TARGET_H));
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
  window.LofiScenes = { list: SCENES.map(({ id, name }) => ({ id, name })), set };
  resize();
  if (!still) requestAnimationFrame(frame);
})();
