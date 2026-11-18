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
  hash,
  poly,
  stroke,
  makeStars,
  drawStars,
  makeCloud,
  makeLightmap,
  applyLight,
  makeRays,
  makeMist,
} from './kit.js';

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
  en: 'Seaside sunset',
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

export default seaside;
