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

// The time of day a scene is built for: 'dawn', 'day', 'dusk' or 'night'. The engine sets it
// (from the viewer's clock, or a fixed choice) before it calls a scene's init(), and rebuilds the
// scene when it changes. A scene reads it in init() and picks its sky, light map and life from it.
export let tod = 'night';
export function setTod(p) {
  tod = p;
}
/** The time of day at a local hour (0..24): dawn 5-7, day 7-17, dusk 17-19, night otherwise. */
export const phaseAt = (h) => (h >= 5 && h < 7 ? 'dawn' : h >= 7 && h < 17 ? 'day' : h >= 17 && h < 19 ? 'dusk' : 'night');
export const PHASES = ['dawn', 'day', 'dusk', 'night'];

// Sounds a scene asks for when something happens in it (thunder, a firework, the cat purring).
// ambience.js listens; with the sound off nothing plays. `opts` is free-form per sound.
export function sfx(name, opts = {}) {
  dispatchEvent(new CustomEvent('lofi:sfx', { detail: { name, ...opts } }));
}

// Where the viewer is looking, -1..1 on each axis, eased toward the pointer by the engine. Scenes
// shift their layers by a few whole pixels from this for a gentle parallax.
export const view = { x: 0, y: 0, tx: 0, ty: 0 };
/** The view at time t, with a slow drift so the scene never sits perfectly still. */
export const look = (t) => ({ x: view.x + Math.sin(t / 9000) * 0.25, y: view.y + Math.sin(t / 13000) * 0.15 });

// ------------------------------------------------------------------ the real moon
// Where the moon is in its month tonight, 0..1: 0 new, 0.25 first quarter, 0.5 full, 0.75 last
// quarter. From a known new moon (6 Jan 2000, 18:14 UTC) and the synodic month. Set
// window.LOFI_MOON to a number to try another night.
const SYNODIC = 29.530588853;
export function moonPhase(date = new Date()) {
  if (typeof window !== 'undefined' && typeof window.LOFI_MOON === 'number') return ((window.LOFI_MOON % 1) + 1) % 1;
  const days = (date.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5;
  return (((days / SYNODIC) % 1) + 1) % 1;
}

/**
 * Shade the dark part of a moon already drawn at (cx, cy), radius r, for tonight's phase. The
 * dark side takes the colour of the sky just beside the moon, with a hint of earthshine. It never
 * goes quite dark: the scenes' moonlight needs something to come from, so a new moon shows as
 * a thin crescent.
 */
export function phaseMoon(cx, cy, r, phase = moonPhase()) {
  let p = phase;
  if (p < 0.08) p = 0.08;
  if (p > 0.92) p = 0.92;
  const c = Math.cos(2 * Math.PI * (p < 0.5 ? p : p - 0.5));
  const [sr, sg, sb] = ctxRef.getImageData(Math.min(W - 1, Math.round(cx + r + 3)), Math.round(cy), 1, 1).data;
  const [mr, mg, mb] = ctxRef.getImageData(Math.round(cx), Math.round(cy), 1, 1).data;
  const mix = (a, b, k) => Math.round(a + (b - a) * k);
  const dark = `rgb(${mix(sr, mr, 0.14)}, ${mix(sg, mg, 0.14)}, ${mix(sb, mb, 0.14)})`;
  const edge = `rgb(${mix(sr, mr, 0.35)}, ${mix(sg, mg, 0.35)}, ${mix(sb, mb, 0.35)})`;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const nx = (x - cx) / r;
      const ny = (y - cy) / r;
      if (nx * nx + ny * ny > 1) continue;
      const w = Math.sqrt(1 - ny * ny);
      const term = w * c;
      // waxing: lit right of the terminator; waning: lit left of it
      const lit = p < 0.5 ? nx > term : nx < term;
      if (lit) continue;
      const near = Math.abs(nx - term) * r < 1.2; // a soft, dithered terminator
      px(x, y, 1, 1, near && dith(x, y, 0.5) ? edge : dark);
    }
  }
}

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

/** An open umbrella seen side-on: canopy centred on cx with its top at `top`, radius r. */
export function umbrella(cx, top, color, r = 10) {
  for (let k = 0; k < 6; k++) {
    const half = Math.round(Math.sqrt(1 - ((5 - k) / 6) ** 2) * r);
    px(cx - half, top + k, half * 2 + 1, 1, k === 0 ? 'rgba(255, 255, 255, 0.25)' : color);
  }
  const step = r / 2;
  for (let k = -r; k <= r; k += step) px(cx + Math.round(k), top + 6, 1, 1, color);
  px(cx, top + 6, 1, Math.round((8 * r) / 10), '#2a2630');
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

// ------------------------------------------------------------------ shared: signs and people

/**
 * Text drawn crisp: rendered with a real font at a small size, then snapped to whole pixels
 * (every pixel is either fully on or off). Draws onto context `c`; returns the width.
 */
export function pixelText(c, text, x, y, size, color, align = 'left', weight = 600) {
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
export function makeSign(text, bg, fg, size = 9, padX = 4) {
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
export function lightLayer(src, map, out) {
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
export function glowSprite(rad, color, strength = 0.8) {
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


export const SKIN = ['#eebd94', '#d69f74', '#b47c52', '#f2cca4'];
export const HAIR = ['#16121a', '#2a1e18', '#3a2a20', '#0e0c12'];
export const SHIRT = ['#e85a5a', '#4a8ae0', '#f2c14e', '#5fb06b', '#ece6da', '#b46ad8', '#34405e', '#ff8a5c', '#3fa3b5'];
export const PANTS = ['#2a3450', '#1e1e28', '#4a4a58', '#3a5a8a', '#5a4636'];

export function makePeep(r) {
  const pick = (a) => a[Math.floor(r() * a.length)];
  return { shirt: pick(SHIRT), pants: pick(PANTS), skin: pick(SKIN), hair: pick(HAIR), h: 32 + Math.floor(r() * 6), ph: r() * 4, bag: r() < 0.35 ? pick(['#f2ede2', '#e85a5a', '#2a62c8']) : null, long: r() < 0.4, skirt: r() < 0.2 };
}

/** A person seen side-on: feet at (x, y), facing `dir`, legs and arm swinging while walking. */
export function drawPeep(p, x, y, dir, t, walking) {
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
