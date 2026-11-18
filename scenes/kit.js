// Shared drawing kit for the scenes: the state every helper draws with, pixel helpers, lighting,
// and the sleeping animal used in more than one scene.
//
// Every helper draws to `ctxRef`: the screen, or an offscreen canvas while a layer is being built.
// Scenes read W, H and ctxRef (ES module bindings stay live) but only this module changes them,
// through setSize, setCtx and drawInto.

export let W = 0;
export let H = 0;
export let ctxRef = null;

export function setSize(w, h) {
  W = w;
  H = h;
}

export function setCtx(c) {
  ctxRef = c;
}

/** Run `fn` with every helper drawing into `canvas`, then go back to the previous target. */
export function drawInto(canvas, fn) {
  const saved = ctxRef;
  ctxRef = canvas.getContext('2d');
  try {
    fn();
  } finally {
    ctxRef = saved;
  }
  return canvas;
}

// Where the viewer is looking, -1..1 on each axis, eased toward the pointer by the engine. Scenes
// shift their layers by a few whole pixels from this for a gentle parallax.
export const view = { x: 0, y: 0, tx: 0, ty: 0 };
/** The view at time t, with a slow drift so the scene never sits perfectly still. */
export const look = (t) => ({ x: view.x + Math.sin(t / 9000) * 0.25, y: view.y + Math.sin(t / 13000) * 0.15 });

export function rng(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function px(x, y, w, h, color) {
  ctxRef.fillStyle = color;
  ctxRef.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function disc(cx, cy, r, color) {
  ctxRef.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    ctxRef.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
  }
}

export function sprite(rows, palette) {
  return { rows, palette, w: rows[0].length, h: rows.length };
}

export function blit(s, x, y) {
  for (let j = 0; j < s.h; j++) {
    for (let i = 0; i < s.w; i++) {
      const ch = s.rows[j][i];
      if (ch === '.') continue;
      ctxRef.fillStyle = s.palette[ch];
      ctxRef.fillRect(Math.round(x) + i, Math.round(y) + j, 1, 1);
    }
  }
}

export const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Horizontal bands of colour, blended into each other with an ordered dither. */
export function bands(x0, y0, w, h, colors) {
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
export function makeGlow(cx, cy, rx, ry, color, layers = 3) {
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
export function layer(draw) {
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
export function shadeEllipse(cx, cy, rx, ry, paint) {
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
export const dith = (x, y, t) => t * 16 > BAYER[y & 3][x & 3];

/** Cheap repeatable noise in 0..1. */
export const hash = (a) => {
  const v = Math.sin(a) * 43758.5453;
  return v - Math.floor(v);
};

/** Scanline-filled polygon with hard pixel edges; `paint` is a colour or (x, y) => colour. */
export function poly(pts, paint) {
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
export function stroke(x0, y0, x1, y1, color, w = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, w, w, color);
}

/** Dithered halo between two radii, fading outward. */
export function haloRing(cx, cy, r0, r1, color) {
  for (let y = -r1; y <= r1; y++)
    for (let x = -r1; x <= r1; x++) {
      const d = Math.hypot(x, y);
      if (d <= r0 || d >= r1) continue;
      if (dith(cx + x, cy + y, (1 - (d - r0) / (r1 - r0)) * 0.6)) px(cx + x, cy + y, 1, 1, color);
    }
}

/** Stars, denser toward the top; a few get a four-point sparkle. */
export function makeStars(r, count, maxY, colors) {
  return Array.from({ length: Math.round(count) }, () => ({
    x: Math.floor(r() * W),
    y: Math.floor(r() * r() * maxY),
    p: r() * 6.28,
    v: 500 + r() * 900,
    big: r() < 0.07,
    c: colors[Math.floor(r() * colors.length)],
  }));
}

export function drawStars(stars, t) {
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
export function makeCloud(r, w, h, pal) {
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
export function hdPine(x, base, h, pal, snow) {
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
export function makeLightmap(ambient, lights, { levels = 14, vignette = 0 } = {}) {
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
export function applyLight(map) {
  ctxRef.save();
  ctxRef.globalCompositeOperation = 'multiply';
  ctxRef.drawImage(map, 0, 0);
  ctxRef.restore();
}

/** A dithered shaft of light (a polygon that fades from `from` to `to`), for adding on top. */
export function makeShaft(pts, from, to, color, strength = 0.5) {
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
export function makeRays(cx, cy, len, color, { count = 9, strength = 0.5, maxY = H, seed = 1 } = {}) {
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
export function makeMist(top, mid, bottom, color, strength = 0.5, width = W) {
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
export function inside(pts, x, y) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Dust motes drifting inside a shaft of light. */
export function makeMotes(r, pts, count) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  return { pts, box, list: Array.from({ length: count }, () => ({ x: box.x + r() * box.w, y: box.y + r() * box.h, p: r() * 6.28, v: 0.04 + r() * 0.08 })) };
}

export function updateMotes(m) {
  for (const d of m.list) {
    d.y += d.v;
    d.x += Math.sin(d.p += 0.03) * 0.12;
    if (d.y > m.box.y + m.box.h) {
      d.y = m.box.y;
      d.x = m.box.x + Math.random() * m.box.w;
    }
  }
}

export function drawMotes(m, t, color) {
  for (const d of m.list) {
    if (!inside(m.pts, d.x, d.y) || Math.sin(t / 700 + d.p * 3) < -0.2) continue;
    px(d.x, d.y, 1, 1, color);
  }
}

// ------------------------------------------------------------------ shared: a sleeping animal

export const TABBY = {
  pal: { hi: '#f6c088', base: '#e39a52', mid: '#cf8440', dark: '#a8612a', stripe: '#9a5524', cream: '#f5e2c4', creamS: '#dcc3a0', line: '#5a2f18' },
  stripes: true,
};
export const FOX = {
  pal: { hi: '#f9a860', base: '#e27a36', mid: '#c25c20', dark: '#93411a', stripe: '#93411a', cream: '#f8ecd9', creamS: '#d9c5a8', line: '#3a1c10' },
  stripes: false,
  tip: '#f8ecd9',
  ear: '#3a1c10',
};

/** A sleeping animal, curled up and lit from the right; `look` picks the coat (TABBY or FOX). */
export function hdCat(x, y, t, look = TABBY) {
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
