// Ambient sound for each scene, made in the browser with Web Audio: no sound files, so it works
// offline and there is nothing to license.
//
// Each scene has a bed (rain on the glass, waves, wind, a fire, a market crowd, a café) that
// changes with the time of day (birds at dawn and by day, crickets at night). On top of that:
//  - a scene can expose sound(state) returning levels for its bed, e.g. { rain: 0.8 }, which is
//    read a few times a second, so a downpour or a blizzard is heard as it builds;
//  - a scene calls sfx(name, opts) from kit.js when something happens (thunder, a firework, the
//    cat purring); those arrive here as 'lofi:sfx' events.
// The master volume and on/off are the app's; with the sound off nothing is scheduled.

let ctx = null;

/** The page's one AudioContext (the focus timer's chime uses it too). Null if there is no Web Audio. */
export function audioContext() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

const rand = (a, b) => a + Math.random() * (b - a);
const chance = (p) => Math.random() < p;

// ------------------------------------------------------------------ building blocks

let noiseBufs = null;
/** Looping noise buffers: white, and a brown-ish one (white run through a leaky integrator). */
function noise(kind) {
  if (!noiseBufs) {
    const len = ctx.sampleRate * 4;
    const make = (fn) => {
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) fn(buf.getChannelData(ch));
      return buf;
    };
    noiseBufs = {
      white: make((d) => {
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }),
      brown: make((d) => {
        let last = 0;
        for (let i = 0; i < d.length; i++) {
          const w = Math.random() * 2 - 1;
          last = (last + 0.04 * w) / 1.04;
          d[i] = last * 3 + w * 0.08;
        }
      }),
    };
  }
  return noiseBufs[kind];
}

function src(kind, out, at = ctx.currentTime, dur) {
  const s = ctx.createBufferSource();
  s.buffer = noise(kind);
  s.loop = true;
  s.connect(out);
  const off = Math.random() * 3.5;
  s.start(at, off);
  if (dur) s.stop(at + dur);
  return s;
}

function filt(type, freq, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function amp(v = 1) {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
}

/** Chain nodes left to right; returns the first. */
function chain(...nodes) {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return nodes[0];
}

/** An attack/decay envelope on a gain param. */
function env(g, at, peak, attack, decay) {
  g.setValueAtTime(0.0001, at);
  g.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
  g.exponentialRampToValueAtTime(0.0001, at + attack + decay);
}

/** A tone with an envelope, optionally gliding to `to` Hz. */
function tone(out, at, { f, to, type = 'sine', vol = 0.1, attack = 0.005, decay = 0.2, glide }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  if (to) o.frequency.exponentialRampToValueAtTime(to, at + (glide || attack + decay));
  const g = amp(0);
  env(g.gain, at, vol, attack, decay);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + attack + decay + 0.05);
  return o;
}

/** A short burst of filtered noise. */
function burst(out, at, { kind = 'white', type = 'bandpass', f = 1500, to, q = 1, vol = 0.1, attack = 0.002, decay = 0.05 }) {
  const fl = filt(type, f, q);
  if (to) fl.frequency.exponentialRampToValueAtTime(to, at + attack + decay);
  const g = amp(0);
  env(g.gain, at, vol, attack, decay);
  src(kind, fl, at, attack + decay + 0.05);
  fl.connect(g).connect(out);
}

/** Drift a param toward a fresh random target now and then, so a loop never sounds like one. */
function wander(param, lo, hi, minT, maxT) {
  let next = 0;
  return (now) => {
    if (now < next) return;
    const d = rand(minT, maxT);
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(rand(lo, hi), now + d);
    next = now + d;
  };
}

/** Run `fn(at)` at random intervals between `min` and `max` seconds. */
function every(min, max, fn) {
  let next = ctx.currentTime + rand(0, max);
  return (now) => {
    // schedule a little ahead of the clock, so a late tick still lands on time
    while (next < now + 0.3) {
      if (next >= now - 0.05) fn(next);
      next += rand(min, max);
    }
  };
}

// ------------------------------------------------------------------ sounds of life

function cricket(out, at, vol = 0.03) {
  const f = rand(4300, 4700);
  const n = 2 + Math.floor(rand(0, 3));
  for (let k = 0; k < n; k++) tone(out, at + k * 0.06, { f, vol, attack: 0.004, decay: 0.035 });
}

function bird(out, at, vol = 0.04) {
  // a few quick up-and-down whistles, like a sparrow or a bulbul
  const base = rand(2600, 4200);
  const n = 2 + Math.floor(rand(0, 4));
  for (let k = 0; k < n; k++) {
    const t = at + k * rand(0.08, 0.16);
    const up = chance(0.5);
    tone(out, t, { f: base * (up ? 0.8 : 1.2), to: base * (up ? 1.25 : 0.75), vol, attack: 0.01, decay: 0.07 });
  }
}

function gull(out, at, vol = 0.05) {
  // the long falling "kee-ow", two or three times
  const n = 1 + Math.floor(rand(0, 3));
  for (let k = 0; k < n; k++) {
    const t = at + k * 0.42;
    const bp = filt('bandpass', 1600, 3);
    bp.connect(out);
    tone(bp, t, { f: 1900, to: 1150, type: 'sawtooth', vol: vol * 3, attack: 0.04, decay: 0.3 });
  }
}

function crackle(out, at, vol = 0.12) {
  const n = 1 + Math.floor(rand(0, 4));
  for (let k = 0; k < n; k++)
    burst(out, at + k * rand(0.01, 0.06), { type: 'highpass', f: rand(1500, 4000), vol: vol * rand(0.3, 1), decay: rand(0.004, 0.02) });
}

function clink(out, at, vol = 0.04) {
  const f = rand(2400, 3800);
  tone(out, at, { f, vol, decay: rand(0.25, 0.5) });
  tone(out, at, { f: f * 2.7, vol: vol * 0.4, decay: 0.15 });
  if (chance(0.3)) tone(out, at + 0.09, { f: f * 1.06, vol: vol * 0.6, decay: 0.3 });
}

function owl(out, at, vol = 0.1) {
  const lp = filt('lowpass', 900);
  lp.connect(out);
  tone(lp, at, { f: 400, to: 370, type: 'triangle', vol, attack: 0.05, decay: 0.35 });
  tone(lp, at + 0.55, { f: 390, to: 350, type: 'triangle', vol: vol * 0.8, attack: 0.05, decay: 0.5 });
}

// ------------------------------------------------------------------ beds

// Each bed builds its nodes into `out` and returns { tick(now, levels), nodes } where levels is
// what the scene's sound(state) said. Levels use the names below; a missing one means 1.

function rainBed(out, { gain = 1, lp = 2600 } = {}) {
  const g = amp(0.9 * gain);
  const nodes = [src('brown', chain(filt('highpass', 250), filt('lowpass', lp), g, out))];
  // drips: the odd heavier drop on the sill
  const drip = amp(1);
  drip.connect(out);
  const drips = every(0.15, 0.6, (at) => burst(drip, at, { f: rand(1800, 3200), q: 4, vol: 0.04, decay: 0.03 }));
  return {
    nodes,
    tick(now, lv) {
      const level = lv.rain ?? 1;
      g.gain.setTargetAtTime(0.9 * gain * Math.min(1.6, level), now, 0.8);
      drip.gain.setTargetAtTime(Math.min(1, level), now, 0.8);
      drips(now);
    },
  };
}

function windBed(out, { vol = 0.5 } = {}) {
  const bp = filt('bandpass', 500, 1.6);
  const g = amp(vol);
  const nodes = [src('white', chain(bp, g, out))];
  const low = amp(vol * 0.8);
  nodes.push(src('brown', chain(filt('lowpass', 300), low, out)));
  const f = wander(bp.frequency, 300, 900, 2, 6);
  const gw = wander(g.gain, vol * 0.3, vol, 1.5, 5);
  return {
    nodes,
    tick(now, lv) {
      const w = lv.wind ?? 1;
      f(now);
      if (w > 1.05) g.gain.setTargetAtTime(vol * w, now, 0.6);
      else gw(now);
      low.gain.setTargetAtTime(vol * 0.8 * w, now, 0.6);
    },
  };
}

function crowdBed(out, vol = 0.3) {
  // overlapping voices: narrow bands of noise in the speech range, each swelling at its own pace
  const nodes = [];
  const moves = [];
  for (const f of [320, 480, 650, 900, 1250]) {
    const g = amp(0);
    nodes.push(src('white', chain(filt('bandpass', f, 5), g, out)));
    moves.push(wander(g.gain, 0, vol * 4, 0.12, 0.6)); // narrow bands are quiet: lift them
  }
  return { nodes, tick: (now) => moves.forEach((m) => m(now)) };
}

const BEDS = {
  room(out, phase) {
    const rain = rainBed(out);
    return rain;
  },

  sea(out, phase) {
    const nodes = [];
    const low = amp(0.15);
    const hiss = amp(0.05);
    nodes.push(src('brown', chain(filt('lowpass', 520), low, out)));
    nodes.push(src('white', chain(filt('bandpass', 2200, 0.6), hiss, out)));
    let next = 0;
    const night = phase === 'night';
    const calls = phase !== 'night' ? every(8, 22, (at) => gull(out, at)) : every(1.2, 3.5, (at) => cricket(out, at, 0.012));
    return {
      nodes,
      tick(now, lv) {
        // one wave every 6 to 10 seconds: it builds, breaks and drains back down the sand
        if (now >= next) {
          const big = (lv.surge ?? 0) > 0 ? 1.8 : 1;
          const peak = (night ? 0.55 : 0.7) * big;
          const up = rand(1.8, 2.8);
          const down = rand(3, 5);
          for (const [g, k] of [[low.gain, 1], [hiss.gain, 0.4]]) {
            g.cancelScheduledValues(now);
            g.setValueAtTime(g.value, now);
            g.linearRampToValueAtTime(peak * k, now + up);
            g.linearRampToValueAtTime(0.12 * k, now + up + down);
          }
          next = now + up + down + rand(0, 1.5);
        }
        calls(now);
      },
    };
  },

  snow(out, phase) {
    const wind = windBed(out, { vol: 0.5 });
    const calls = phase === 'dawn' || phase === 'day' ? every(10, 30, (at) => bird(out, at, 0.02)) : () => {};
    return { nodes: wind.nodes, tick: (now, lv) => (wind.tick(now, lv), calls(now)) };
  },

  city(out, phase) {
    const nodes = [];
    const hum = amp(phase === 'night' ? 0.35 : 0.5);
    nodes.push(src('brown', chain(filt('lowpass', 260), hum, out)));
    // the electric buzz of the neon, very quietly
    const buzz = ctx.createOscillator();
    buzz.type = 'sawtooth';
    buzz.frequency.value = 100;
    buzz.connect(chain(filt('bandpass', 400, 2), amp(phase === 'day' ? 0 : 0.006), out));
    buzz.start();
    nodes.push(buzz);
    const shower = rainBed(out, { gain: 0.8 });
    nodes.push(...shower.nodes);
    const cars = every(3, 9, (at) => burst(out, at, { kind: 'brown', type: 'lowpass', f: 300, to: 900, vol: 0.18, attack: 1.2, decay: 1.6 }));
    return {
      nodes,
      tick(now, lv) {
        shower.tick(now, { rain: lv.rain ?? 0 });
        cars(now);
      },
    };
  },

  camp(out, phase) {
    const nodes = [];
    const roar = amp(0.5);
    nodes.push(src('brown', chain(filt('lowpass', 380), roar, out)));
    const r = wander(roar.gain, 0.35, 0.65, 0.5, 2);
    const fire = amp(1);
    fire.connect(out);
    const pops = every(0.08, 0.5, (at) => crackle(fire, at, 0.12));
    const night = phase === 'night' || phase === 'dusk';
    const life = night ? every(0.5, 1.6, (at) => cricket(out, at)) : every(4, 12, (at) => bird(out, at));
    return {
      nodes,
      tick(now, lv) {
        r(now);
        fire.gain.setTargetAtTime(lv.fire ?? 1, now, 0.3);
        pops(now);
        life(now);
      },
    };
  },

  market(out, phase) {
    const crowd = crowdBed(out, phase === 'day' ? 0.22 : 0.3);
    const nodes = [...crowd.nodes];
    const sizzle = amp(0.03);
    nodes.push(src('white', chain(filt('highpass', 4500), sizzle, out)));
    const s = wander(sizzle.gain, 0.015, 0.05, 1, 3);
    const bowls = every(2, 7, (at) => clink(out, at, 0.025));
    const shower = rainBed(out, { gain: 0.7 });
    nodes.push(...shower.nodes);
    const night = phase === 'night' || phase === 'dusk';
    const life = night ? every(1.5, 4, (at) => cricket(out, at, 0.015)) : every(6, 16, (at) => bird(out, at, 0.025));
    return {
      nodes,
      tick(now, lv) {
        crowd.tick(now);
        if ((lv.smoke ?? 0) > 0) sizzle.gain.setTargetAtTime(0.12, now, 0.3);
        else s(now);
        bowls(now);
        shower.tick(now, { rain: lv.rain ?? 0 });
        life(now);
      },
    };
  },

  cafe(out, phase) {
    const crowd = crowdBed(out, 0.14);
    const nodes = [...crowd.nodes];
    const room = amp(0.2);
    nodes.push(src('brown', chain(filt('lowpass', 200), room, out)));
    const cups = every(1.5, 5, (at) => clink(out, at, 0.06));
    const outside = phase === 'dawn' || phase === 'day' ? every(6, 15, (at) => bird(out, at, 0.012)) : () => {};
    return { nodes, tick: (now) => (crowd.tick(now), cups(now), outside(now)) };
  },
};

// The weather's own layer, over whichever bed is playing: rain and wind the scene doesn't make
// itself (rain at the sea, a storm's wind). Behind glass the rain is muffled.
function weatherLayer(out) {
  const rainOut = amp(0);
  const muffle = filt('lowpass', 20000);
  rainOut.connect(muffle).connect(out);
  const windOut = amp(0);
  windOut.connect(out);
  const rain = rainBed(rainOut, { gain: 0.9 });
  const wind = windBed(windOut, { vol: 0.45 });
  return {
    nodes: [...rain.nodes, ...wind.nodes],
    tick(now, lv) {
      rainOut.gain.setTargetAtTime(lv.rain || 0, now, 1);
      windOut.gain.setTargetAtTime(lv.wind || 0, now, 1);
      muffle.frequency.setTargetAtTime(lv.indoor ? 900 : 20000, now, 0.5);
      if (lv.rain) rain.tick(now, { rain: 1 });
      if (lv.wind) wind.tick(now, { wind: 1 });
    },
  };
}

// ------------------------------------------------------------------ one-shots

const SFX = {
  thunder(out, at, { near = Math.random() } = {}) {
    // a crack for a near one, then the long rolling rumble
    if (near > 0.5) burst(out, at, { kind: 'white', type: 'lowpass', f: 3000, to: 400, vol: 0.25 * near, attack: 0.005, decay: 0.4 });
    const g = amp(0);
    const lp = filt('lowpass', 160);
    src('brown', chain(lp, g, out), at, 6);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.9, at + 0.3 + (1 - near) * 0.8);
    for (let k = 1; k < 8; k++) g.gain.linearRampToValueAtTime(rand(0.3, 0.9) * (1 - k / 9), at + 0.5 + k * 0.6);
    g.gain.linearRampToValueAtTime(0, at + 5.8);
  },
  purr(out, at) {
    // a low rumble, pulsing about 25 times a second, for a couple of breaths
    const g = amp(0);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 25;
    const depth = amp(0.15);
    lfo.connect(depth).connect(g.gain);
    lfo.start(at);
    lfo.stop(at + 2.6);
    src('brown', chain(filt('lowpass', 220), g, out), at, 2.6);
    g.gain.setValueAtTime(0, at);
    for (let k = 0; k < 2; k++) {
      g.gain.linearRampToValueAtTime(0.2, at + k * 1.2 + 0.4);
      g.gain.linearRampToValueAtTime(0.06, at + k * 1.2 + 1.1);
    }
    g.gain.linearRampToValueAtTime(0, at + 2.5);
  },
  meow(out, at) {
    const bp = filt('bandpass', 700, 4);
    bp.frequency.setValueAtTime(600, at);
    bp.frequency.linearRampToValueAtTime(1100, at + 0.2);
    bp.frequency.linearRampToValueAtTime(700, at + 0.5);
    bp.connect(out);
    tone(bp, at, { f: 480, to: 620, type: 'sawtooth', vol: 0.2, attack: 0.08, decay: 0.45, glide: 0.25 });
  },
  pop(out, at) {
    // a log settling: a soft thump and a spray of crackles
    burst(out, at, { kind: 'brown', type: 'lowpass', f: 200, vol: 0.4, decay: 0.3 });
    for (let k = 0; k < 6; k++) crackle(out, at + rand(0, 0.8), 0.15);
  },
  owl: (out, at) => owl(out, at),
  firework(out, at) {
    tone(out, at, { f: 600, to: 1800, type: 'sine', vol: 0.03, attack: 0.6, decay: 0.2 });
    burst(out, at + 0.8, { kind: 'brown', type: 'lowpass', f: 300, vol: 0.5, attack: 0.005, decay: 1.2 });
    for (let k = 0; k < 10; k++) crackle(out, at + 1 + rand(0, 1), 0.06);
  },
  train(out, at) {
    // a rumble that comes and goes, with the clack of the wheels over the joints
    const g = amp(0);
    src('brown', chain(filt('lowpass', 400), g, out), at, 9);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.6, at + 4);
    g.gain.linearRampToValueAtTime(0, at + 9);
    for (let k = 0; k < 22; k++) {
      const t = at + 1 + k * 0.33 + (k % 2) * 0.12;
      const near = 1 - Math.abs(t - at - 4.5) / 4;
      burst(out, t, { kind: 'white', type: 'bandpass', f: 900, q: 2, vol: 0.06 * Math.max(0.1, near), decay: 0.05 });
    }
  },
  spark(out, at) {
    for (let k = 0; k < 12; k++) burst(out, at + k * rand(0.02, 0.07), { type: 'highpass', f: 2500, vol: rand(0.04, 0.12), decay: 0.015 });
  },
  engine(out, at, { dur = 4, pitch = 90, dir = 0 } = {}) {
    // a scooter or a tuk-tuk going by: a buzzing engine, louder and higher as it passes, and
    // (given the way it's heading, 1 left to right, -1 right to left) moving across the speakers
    if (dir && ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.setValueAtTime(-0.8 * dir, at);
      pan.pan.linearRampToValueAtTime(0.8 * dir, at + dur);
      pan.connect(out);
      out = pan;
    }
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(pitch * 1.1, at);
    o.frequency.linearRampToValueAtTime(pitch * 0.85, at + dur);
    const g = amp(0);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.12, at + dur * 0.5);
    g.gain.linearRampToValueAtTime(0, at + dur);
    o.connect(chain(filt('lowpass', 700), g, out));
    o.start(at);
    o.stop(at + dur + 0.1);
  },
  gust(out, at, { vol = 1, muffled = false } = {}) {
    // a breeze rising and falling away, the pitch of the rush following its strength
    const bp = filt('bandpass', 400, 1.2);
    bp.frequency.setValueAtTime(350, at);
    bp.frequency.linearRampToValueAtTime(muffled ? 600 : 1100, at + 1.4);
    bp.frequency.linearRampToValueAtTime(300, at + 4);
    const g = amp(0);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.35 * vol, at + 1.4);
    g.gain.linearRampToValueAtTime(0, at + 4);
    src('white', chain(bp, ...(muffled ? [filt('lowpass', 700)] : []), g, out), at, 4.2);
  },
  sizzle(out, at) {
    // fat on the coals: a hiss that flares and settles, spitting as it goes
    burst(out, at, { type: 'highpass', f: 3500, vol: 0.12, attack: 0.05, decay: 1.6 });
    for (let k = 0; k < 14; k++) crackle(out, at + rand(0, 1.4), 0.1);
  },
  steam(out, at) {
    burst(out, at, { type: 'highpass', f: 2500, vol: 0.08, attack: 0.15, decay: 1.6 });
  },
  wings(out, at) {
    for (let k = 0; k < 14; k++) burst(out, at + k * 0.07 + rand(0, 0.03), { type: 'bandpass', f: 700, q: 1, vol: 0.08, decay: 0.05 });
  },
  splash(out, at) {
    burst(out, at, { type: 'bandpass', f: 1200, to: 500, q: 0.8, vol: 0.15, attack: 0.01, decay: 0.4 });
  },
  whoomph(out, at) {
    burst(out, at, { kind: 'brown', type: 'lowpass', f: 500, to: 120, vol: 0.4, attack: 0.05, decay: 0.9 });
  },
  creak(out, at) {
    tone(chain(filt('bandpass', 600, 3), out), at, { f: 180, to: 260, type: 'sawtooth', vol: 0.06, attack: 0.1, decay: 0.6 });
    burst(out, at + 0.8, { type: 'bandpass', f: 2000, q: 3, vol: 0.06, decay: 0.03 });
  },
  woof(out, at) {
    const bp = filt('bandpass', 500, 2);
    bp.connect(out);
    tone(bp, at, { f: 260, to: 180, type: 'sawtooth', vol: 0.15, attack: 0.01, decay: 0.12 });
  },
  chirp: (out, at) => bird(out, at, 0.05),
  gull: (out, at) => gull(out, at, 0.07),
  clink: (out, at) => clink(out, at, 0.06),
  crackers(out, at) {
    // a string of firecrackers: a rattle of sharp pops, a few big bangs among them
    let k = at;
    for (let i = 0; i < 36; i++) {
      k += rand(0.03, 0.12);
      const big = Math.random() < 0.12;
      burst(out, k, { kind: 'white', type: 'bandpass', f: big ? 900 : 2200, q: 0.8, vol: big ? 0.22 : 0.09, decay: big ? 0.12 : 0.04 });
    }
  },
  boing(out, at) {
    tone(out, at, { f: 300, to: 600, type: 'triangle', vol: 0.06, attack: 0.01, decay: 0.25 });
  },
};

// ------------------------------------------------------------------ the mixer

export function createAmbience({ levels, weather } = {}) {
  let on = false;
  let vol = 0.35;
  let scene = null;
  let phase = 'night';
  let master = null;
  let bed = null; // { out, tick, nodes }
  let sky = null; // the weather layer, kept across scene changes
  let timer = null;

  function stopBed(b) {
    if (!b) return;
    const now = ctx.currentTime;
    b.out.gain.setTargetAtTime(0, now, 0.5);
    setTimeout(() => {
      for (const n of b.nodes)
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
      b.out.disconnect();
    }, 3000);
  }

  function build() {
    if (!ctx || !on || !scene || !BEDS[scene]) return;
    stopBed(bed);
    const out = amp(0);
    out.connect(master);
    const b = BEDS[scene](out, phase);
    bed = { out, ...b };
    out.gain.setTargetAtTime(1, ctx.currentTime, 0.6);
  }

  function tick() {
    if (sky) {
      let wl = {};
      try {
        wl = weather?.() || {};
      } catch {
        /* not ready yet */
      }
      sky.tick(ctx.currentTime, wl);
    }
    if (!bed) return;
    let lv = {};
    try {
      lv = levels?.() || {};
    } catch {
      /* the scene is being rebuilt */
    }
    bed.tick(ctx.currentTime, lv);
  }

  addEventListener('lofi:sfx', (e) => {
    if (!on || !ctx || ctx.state !== 'running') return;
    const fn = SFX[e.detail.name];
    if (fn) fn(master, ctx.currentTime + 0.02, e.detail);
  });

  return {
    get on() {
      return on;
    },
    setOn(v) {
      on = v;
      if (on) {
        if (!audioContext()) return;
        if (!master) {
          master = amp(0);
          master.connect(ctx.destination);
        }
        master.gain.setTargetAtTime(vol, ctx.currentTime, 0.4);
        if (!bed) build();
        if (!sky && weather) {
          const out = amp(1);
          out.connect(master);
          sky = { out, ...weatherLayer(out) };
        }
        clearInterval(timer);
        timer = setInterval(tick, 250);
        tick();
      } else if (master) {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
        clearInterval(timer);
        stopBed(bed);
        stopBed(sky);
        bed = null;
        sky = null;
      }
    },
    setVolume(v) {
      vol = v;
      if (master && on) master.gain.setTargetAtTime(vol, ctx.currentTime, 0.1);
    },
    setScene(id) {
      if (id === scene) return;
      scene = id;
      build();
    },
    setPhase(p) {
      if (p === phase) return;
      phase = p;
      build();
    },
  };
}
