// The map: one small island with every scene on it, joined by a railway (and a ferry out to the
// beach). Painted in pixels on a little canvas; the place names are buttons laid over it, so they
// stay crisp, follow the language and work from the keyboard. Picking one travels there.

const MW = 240;
const MH = 150;

// where each scene sits on the island (0..1), and the order the railway runs
const PLACES = {
  snow: [0.27, 0.22],
  camp: [0.16, 0.5],
  cafe: [0.38, 0.64],
  market: [0.56, 0.68],
  room: [0.47, 0.42],
  city: [0.68, 0.3],
  sea: [0.82, 0.78],
};
const RAIL = ['snow', 'camp', 'cafe', 'market', 'room', 'city'];
const FERRY = ['market', 'sea'];

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const dith = (x, y, t) => t * 16 > BAYER[y & 3][x & 3];
const wave = (x, y) => Math.sin(x * 9.1 + y * 3.3) * 0.5 + Math.sin(x * 4.7 - y * 7.9) * 0.3 + Math.sin(x * 17 + y * 13) * 0.2;

/** Paint the island once; returns the canvas. */
function paintIsland() {
  const cv = document.createElement('canvas');
  cv.width = MW;
  cv.height = MH;
  const c = cv.getContext('2d');
  const put = (x, y, col) => {
    c.fillStyle = col;
    c.fillRect(x, y, 1, 1);
  };
  const rock = new Uint8Array(MW * MH); // where the mountains are
  for (let y = 0; y < MH; y++)
    for (let x = 0; x < MW; x++) {
      const nx = x / MW;
      const ny = y / MH;
      // an island: an ellipse with a ragged coast and a bay cut in on the south-east
      let d = Math.hypot((nx - 0.47) / 0.42, (ny - 0.48) / 0.4) + wave(nx, ny) * 0.12;
      d += Math.max(0, 0.18 - Math.hypot(nx - 0.86, ny - 0.62)) * 2.2;
      if (d > 1.12) {
        // sea, lighter in the shallows, with dithered swell lines
        const shallow = Math.max(0, 1 - (d - 1.12) / 0.18);
        put(x, y, dith(x, y, shallow * 0.8) ? '#5fa8d8' : (y + Math.round(Math.sin(x / 6) * 2)) % 7 === 0 ? '#3f86c0' : '#346fa8');
        continue;
      }
      if (d > 1.02) {
        put(x, y, dith(x, y, (d - 1.02) / 0.1) ? '#7cc4e8' : '#ecd9a6'); // surf over sand
        continue;
      }
      // regions with ragged, natural edges: the range in the north-west, forest below it, the town
      const mountain = Math.hypot((nx - 0.24) / 1.3, ny - 0.14) + wave(nx * 2.2, ny * 2.2) * 0.06 < 0.24;
      const forest = !mountain && Math.hypot(nx - 0.17, (ny - 0.5) / 1.2) + wave(nx * 3, ny * 3) * 0.05 < 0.19;
      const town = Math.hypot(nx - 0.58, (ny - 0.48) * 1.2) + wave(nx * 4, ny * 4) * 0.03 < 0.16;
      if (mountain) {
        rock[y * MW + x] = 1;
        put(x, y, dith(x, y, 0.4) ? '#7a849a' : '#6e7890'); // the peaks are painted over this below
      } else if (forest) {
        // little pines: a dark triangle every few pixels
        const tx = x % 5;
        const ty = (y + (Math.floor(x / 5) % 2) * 3) % 6;
        const tree = ty < 5 && Math.abs(tx - 2) <= ty / 2;
        put(x, y, tree ? (tx < 2 ? '#4a8a4c' : '#2a5a34') : '#3a6e3e');
      } else if (town) {
        const block = (x % 6 < 4 && y % 5 < 3) || dith(x, y, 0.15);
        put(x, y, block ? '#c9b8a2' : '#a8987e');
      } else put(x, y, dith(x, y, 0.35 + wave(nx * 3, ny * 3) * 0.2) ? '#8cc06a' : '#76ad58');
    }
  // the range: separate peaks, back ones first, each lit on its left with a cap of snow
  const peaks = [];
  for (let gy = 0; gy < MH * 0.42; gy += 8)
    for (let gx = (gy / 8) % 2 ? 6 : 0; gx < MW * 0.55; gx += 12) {
      const h = 10 + Math.abs(wave(gx * 0.13, gy * 0.17)) * 12;
      const x = gx + wave(gy, gx) * 3;
      if (rock[Math.round(gy + h) * MW + Math.round(x)]) peaks.push({ x, y: gy, h });
    }
  peaks.sort((a, b) => a.y + a.h - (b.y + b.h));
  for (const p of peaks)
    for (let y = Math.round(p.y); y <= p.y + p.h; y++) {
      const half = (y - p.y) * 0.95;
      for (let x = Math.round(p.x - half); x <= p.x + half; x++) {
        if (x < 0 || x >= MW || !rock[y * MW + x]) continue;
        const lit = x < p.x;
        const snow = y < p.y + p.h * 0.38;
        put(x, y, snow ? (lit ? '#ffffff' : '#c8d2e6') : lit ? '#8c96ac' : '#5e6880');
      }
    }

  // the railway: sleepers along a line between the stations
  const at = (id) => [Math.round(PLACES[id][0] * MW), Math.round(PLACES[id][1] * MH)];
  for (let i = 0; i < RAIL.length - 1; i++) {
    const [ax, ay] = at(RAIL[i]);
    const [bx, by] = at(RAIL[i + 1]);
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let k = 0; k <= n; k++) {
      const x = Math.round(ax + ((bx - ax) * k) / n);
      const y = Math.round(ay + ((by - ay) * k) / n);
      put(x, y, '#4a3a30');
      if (k % 3 === 0) put(x + (Math.abs(by - ay) > Math.abs(bx - ax) ? 1 : 0), y + (Math.abs(by - ay) > Math.abs(bx - ax) ? 0 : 1), '#4a3a30');
    }
  }
  // the ferry route: a dashed white line over the water
  const [fx, fy] = at(FERRY[0]);
  const [gx, gy] = at(FERRY[1]);
  const n = Math.max(Math.abs(gx - fx), Math.abs(gy - fy));
  for (let k = 0; k <= n; k++) if (k % 4 < 2) put(Math.round(fx + ((gx - fx) * k) / n), Math.round(fy + ((gy - fy) * k) / n) + 1, '#f4f0e6');
  return cv;
}

/** A little building for each place, in the scene's colour. */
function drawMarker(c, x, y, col, here) {
  c.fillStyle = 'rgba(0, 0, 0, 0.35)';
  c.fillRect(x - 3, y + 3, 8, 2);
  c.fillStyle = '#2a2230';
  c.fillRect(x - 4, y - 4, 9, 8);
  c.fillStyle = col;
  c.fillRect(x - 3, y - 3, 7, 6);
  c.fillStyle = '#fff8e8';
  c.fillRect(x - 1, y - 1, 3, 2);
  if (here) {
    c.fillStyle = '#ffffff';
    for (const [dx, dy] of [
      [-6, -6],
      [6, -6],
      [-6, 6],
      [6, 6],
    ])
      c.fillRect(x + dx - (dx > 0 ? 1 : 0), y + dy - (dy > 0 ? 1 : 0), 2, 2);
  }
}

let island = null;

/**
 * Fill the map dialog: the island on `canvas`, a button per place in `pins`.
 * `places` is [{ id, name, accent }], `here` the scene showing, `pick(id)` what a choice does.
 */
export function renderMap(canvas, pins, places, here, pick) {
  island ||= paintIsland();
  canvas.width = MW;
  canvas.height = MH;
  const c = canvas.getContext('2d');
  c.drawImage(island, 0, 0);
  const buttons = [];
  for (const p of places) {
    const pos = PLACES[p.id];
    if (!pos) continue;
    const x = Math.round(pos[0] * MW);
    const y = Math.round(pos[1] * MH);
    drawMarker(c, x, y, p.accent, p.id === here);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pin' + (p.id === here ? ' here' : '');
    b.style.left = (pos[0] * 100).toFixed(2) + '%';
    b.style.top = (pos[1] * 100).toFixed(2) + '%';
    b.style.setProperty('--pin', p.accent);
    b.textContent = p.name;
    if (p.id === here) b.setAttribute('aria-current', 'location');
    b.addEventListener('click', () => pick(p.id));
    buttons.push(b);
  }
  pins.replaceChildren(...buttons);
}
