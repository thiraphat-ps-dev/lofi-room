import {
  W,
  H,
  ctxRef,
  drawInto,
  look,
  rng,
  px,
  disc,
  sprite,
  blit,
  bands,
  layer,
  shadeEllipse,
  dith,
  hash,
  poly,
  stroke,
  makeStars,
  drawStars,
  makeLightmap,
  makeMist,
} from './kit.js';

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
    s.dyn.width = W;
    s.dyn.height = H;
    drawInto(s.dyn, () => {
      blit(dogFrames[Math.floor(t / 1600) % 2], s.dog.x, s.dog.y);
      const lanes = [...s.peeps].sort((a, b) => a.lane - b.lane);
      for (const p of lanes) drawPeep(p, p.x, s.walkY + p.lane, p.dir, t, p.stop <= 0);
      for (const p of s.smoke) disc(Math.round(p.x), Math.round(p.y), 2 + Math.floor(p.life / 16), `rgba(190, 185, 195, ${0.28 * (1 - p.life / 80)})`);
    });
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

export default market;
