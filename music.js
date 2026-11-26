// Lofi Room radio: lofi hip hop written and played live in the browser with Web Audio. No
// samples, no network: chords on an FM electric piano, a round bass, a few bell notes on top,
// drums made from noise, all through a worn tape (the pitch wobbles, the top end is rolled off,
// a vinyl crackle underneath). Each scene has its own mood (key, tempo, sound); the weather
// muffles it; between tracks the tape stops and the next one starts in a new key.
//
// The kick is also handed to the scenes (kit.beat), so lights can pulse with the music.

import { audioContext } from './ambience.js';
import { beat } from './scenes/kit.js';

// ------------------------------------------------------------------ harmony

const NOTE = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const QUAL = {
  maj7: { iv: [0, 4, 7, 11], name: 'maj7' },
  maj9: { iv: [0, 4, 7, 11, 14], name: 'maj9' },
  m7: { iv: [0, 3, 7, 10], name: 'm7' },
  m9: { iv: [0, 3, 7, 10, 14], name: 'm9' },
  m11: { iv: [0, 3, 10, 14, 17], name: 'm11' },
  dom9: { iv: [0, 4, 10, 14], name: '9' },
  dom13: { iv: [0, 4, 10, 14, 21], name: '13' },
  hdim: { iv: [0, 3, 6, 10], name: 'm7♭5' },
};
// four bars each, as [degree in semitones from the key, quality]
const PROGS = {
  major: [
    [[2, 'm9'], [7, 'dom9'], [0, 'maj9'], [0, 'maj7']],
    [[0, 'maj9'], [9, 'm9'], [2, 'm9'], [7, 'dom13']],
    [[5, 'maj9'], [4, 'm7'], [2, 'm9'], [0, 'maj9']],
    [[0, 'maj7'], [4, 'm7'], [9, 'm9'], [5, 'maj9']],
    [[5, 'maj9'], [7, 'dom13'], [4, 'm7'], [9, 'm9']],
  ],
  minor: [
    [[0, 'm9'], [5, 'm9'], [10, 'dom9'], [3, 'maj9']],
    [[0, 'm11'], [8, 'maj9'], [3, 'maj7'], [10, 'dom13']],
    [[0, 'm9'], [10, 'dom9'], [8, 'maj7'], [7, 'dom9']],
    [[2, 'hdim'], [7, 'dom9'], [0, 'm9'], [0, 'm9']],
    [[0, 'm9'], [3, 'maj7'], [5, 'm9'], [7, 'dom9']],
  ],
};
const PENTA = { major: [0, 2, 4, 7, 9], minor: [0, 3, 5, 7, 10] };

// Each scene's mood: keys to pick from (C = 0), tempo, the instrument on the chords, how dark
// the tape is, how much crackle, and how busy the drums are.
export const MOODS = {
  room: { keys: [2, 9, 4], mode: 'minor', bpm: 72, chords: 'ep', lead: 'bell', lp: 1900, crackle: 1, drums: 0.8 },
  sea: { keys: [5, 0, 7], mode: 'major', bpm: 80, chords: 'ep', lead: 'bell', lp: 3200, crackle: 0.5, drums: 0.9 },
  snow: { keys: [3, 10, 8], mode: 'major', bpm: 64, chords: 'ep', lead: 'bell', lp: 1700, crackle: 0.8, drums: 0.5 },
  city: { keys: [9, 4, 11], mode: 'minor', bpm: 88, chords: 'pad', lead: 'bell', lp: 2600, crackle: 0.6, drums: 1 },
  camp: { keys: [7, 2, 0], mode: 'major', bpm: 70, chords: 'pluck', lead: 'bell', lp: 2200, crackle: 0.7, drums: 0.6 },
  market: { keys: [0, 5, 7], mode: 'major', bpm: 86, chords: 'ep', lead: 'bell', lp: 2800, crackle: 0.6, drums: 1 },
  cafe: { keys: [10, 3, 5], mode: 'major', bpm: 84, chords: 'ep', lead: 'bell', lp: 3000, crackle: 0.5, drums: 0.9 },
  temple: { keys: [7, 0, 5], mode: 'major', bpm: 66, chords: 'ep', lead: 'bell', lp: 2100, crackle: 0.6, drums: 0.55 },
};

// A track's sections: [name, bars]. Drums, bass and melody come in and drop out by section.
const FORM = [
  ['intro', 4],
  ['a', 8],
  ['b', 8],
  ['break', 4],
  ['a', 8],
  ['b', 8],
  ['outro', 4],
];
const PARTS = {
  intro: { drums: 0, bass: 0, lead: 0, lp: 0.55 },
  a: { drums: 1, bass: 1, lead: 0, lp: 1 },
  b: { drums: 1, bass: 1, lead: 1, lp: 1 },
  break: { drums: 0, bass: 1, lead: 1, lp: 0.7 },
  outro: { drums: 0.5, bass: 1, lead: 0, lp: 0.6 },
};

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

export function createMusic() {
  let ctx = null;
  let out = null; // volume
  let bus = null; // everything, before the tape
  let keysBus = null; // chords and melody (ducked by the kick)
  let tone = null; // the tape's lowpass
  let pitch = null; // cents added to every pitched voice: wow, flutter, the tape stopping
  let crackleGain = null;
  let noiseBuf = null;
  let timer = null;
  let playing = false;
  let vol = 0.6;
  let sceneId = 'room';
  let fixed = null; // a mood held by the station, or null to follow the scene
  let weatherKind = 'clear';
  let song = null;
  let rand = Math.random;
  const listeners = new Set();
  const kicks = []; // audio times of recent kicks, for the scenes

  // ---------------------------------------------------------------- the rig

  function build() {
    ctx = audioContext();
    if (!ctx) return false;
    out = ctx.createGain();
    out.gain.value = 0;
    out.connect(ctx.destination);

    // soft saturation: a worn tape rounds the peaks off
    const sat = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6);
    }
    sat.curve = curve;
    tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2400;
    tone.Q.value = 0.5;
    const low = ctx.createBiquadFilter(); // and the very bottom, so the bass stays round
    low.type = 'highpass';
    low.frequency.value = 38;
    tone.connect(low).connect(sat).connect(out);

    bus = ctx.createGain();
    bus.gain.value = 0.8;
    bus.connect(tone);
    keysBus = ctx.createGain();
    keysBus.connect(bus);

    // a small room: a convolver fed with a decaying noise burst
    const verb = ctx.createConvolver();
    const len = Math.round(ctx.sampleRate * 2.2);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    verb.buffer = ir;
    const send = ctx.createGain();
    send.gain.value = 0.22;
    keysBus.connect(send).connect(verb).connect(tone);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    // wow (slow) and flutter (fast), as a shared pitch offset every note's detune follows
    pitch = ctx.createConstantSource();
    pitch.offset.value = 0;
    pitch.start();
    for (const [f, cents] of [
      [0.33, 9],
      [6.5, 2.5],
    ]) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = cents;
      lfo.connect(g).connect(pitch.offset);
      lfo.start();
    }

    // vinyl: a hiss and a loop of sparse clicks, never quite in time with the music
    const crackle = ctx.createBuffer(1, ctx.sampleRate * 5, ctx.sampleRate);
    const cd = crackle.getChannelData(0);
    for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * 0.015;
    for (let k = 0; k < 260; k++) {
      const at = Math.floor(Math.random() * (cd.length - 40));
      const amp = (Math.random() < 0.1 ? 0.7 : 0.25) * (Math.random() < 0.5 ? 1 : -1);
      for (let j = 0; j < 30; j++) cd[at + j] += amp * Math.exp(-j / 5);
    }
    const vinyl = ctx.createBufferSource();
    vinyl.buffer = crackle;
    vinyl.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    crackleGain = ctx.createGain();
    crackleGain.gain.value = 0;
    vinyl.connect(hp).connect(crackleGain).connect(out);
    vinyl.start();
    return true;
  }

  // ---------------------------------------------------------------- voices

  function osc(type, f, at, end, dest) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    pitch.connect(o.detune);
    o.connect(dest);
    o.start(at);
    o.stop(end);
    o.onended = () => {
      o.disconnect();
      try {
        pitch.disconnect(o.detune);
      } catch {
        /* already gone */
      }
    };
    return o;
  }
  function env(at, peak, attack, decay, dest) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    g.connect(dest);
    setTimeout(() => g.disconnect(), (at - ctx.currentTime + attack + decay + 0.5) * 1000);
    return g;
  }

  /** Electric piano: a sine whose bright FM attack fades into a pure tone. */
  function ep(m, at, dur, vel) {
    const f = mtof(m);
    const end = at + dur + 1.6;
    const g = env(at, 0.11 * vel, 0.006, dur + 1.5, keysBus);
    const car = osc('sine', f, at, end, g);
    const mod = ctx.createOscillator();
    mod.frequency.value = f;
    pitch.connect(mod.detune);
    const idx = ctx.createGain();
    idx.gain.setValueAtTime(f * 1.4 * vel, at);
    idx.gain.exponentialRampToValueAtTime(f * 0.05, at + 0.6);
    mod.connect(idx).connect(car.frequency);
    mod.start(at);
    mod.stop(end);
    mod.onended = () => mod.disconnect();
  }
  /** Synth pad for the city: two detuned saws, slow in, through their own lowpass. */
  function pad(m, at, dur, vel) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.035 * vel, at + 0.35);
    g.gain.setValueAtTime(0.035 * vel, at + dur);
    g.gain.linearRampToValueAtTime(0, at + dur + 0.6);
    lp.connect(g).connect(keysBus);
    for (const d of [-7, 7]) osc('sawtooth', mtof(m), at, at + dur + 0.7, lp).detune.value = d;
    setTimeout(() => g.disconnect(), (at - ctx.currentTime + dur + 1.2) * 1000);
  }
  /** Plucked string for the campfire: a triangle and its octave, dying away quickly. */
  function pluck(m, at, dur, vel) {
    const g = env(at, 0.12 * vel, 0.003, Math.min(1.4, dur + 0.6), keysBus);
    osc('triangle', mtof(m), at, at + 1.6, g);
    const g2 = env(at, 0.03 * vel, 0.002, 0.3, keysBus);
    osc('sine', mtof(m + 12), at, at + 0.4, g2);
  }
  /** A soft bell for the melody. */
  function bell(m, at, vel) {
    const f = mtof(m);
    const g = env(at, 0.07 * vel, 0.004, 1.3, keysBus);
    const car = osc('sine', f, at, at + 1.4, g);
    const mod = ctx.createOscillator();
    mod.frequency.value = f * 3.5;
    const idx = ctx.createGain();
    idx.gain.setValueAtTime(f * 0.9, at);
    idx.gain.exponentialRampToValueAtTime(f * 0.02, at + 0.4);
    mod.connect(idx).connect(car.frequency);
    mod.start(at);
    mod.stop(at + 1.4);
    mod.onended = () => mod.disconnect();
  }
  function bass(m, at, dur, vel) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.32 * vel, at + 0.012);
    g.gain.setTargetAtTime(0.2 * vel, at + 0.05, 0.15);
    g.gain.setTargetAtTime(0, at + dur, 0.06);
    lp.connect(g).connect(bus);
    osc('sine', mtof(m), at, at + dur + 0.4, lp);
    osc('triangle', mtof(m), at, at + dur + 0.4, lp).detune.value = 3;
    setTimeout(() => g.disconnect(), (at - ctx.currentTime + dur + 0.8) * 1000);
  }
  function noise(at, dur, type, f, q, peak, decay, dest = bus) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = f;
    fl.Q.value = q;
    const g = env(at, peak, 0.002, decay, dest);
    s.connect(fl).connect(g);
    s.start(at, Math.random() * 0.5);
    s.stop(at + dur);
    s.onended = () => s.disconnect();
  }
  function kick(at, vel) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(130, at);
    o.frequency.exponentialRampToValueAtTime(42, at + 0.12);
    const g = env(at, 0.55 * vel, 0.003, 0.38, bus);
    o.connect(g);
    o.start(at);
    o.stop(at + 0.45);
    o.onended = () => o.disconnect();
    // the chords duck out of its way, the lofi pump
    keysBus.gain.setValueAtTime(0.62, at);
    keysBus.gain.linearRampToValueAtTime(1, at + 0.28);
    kicks.push(at);
    if (kicks.length > 8) kicks.shift();
  }
  function snare(at, vel) {
    noise(at, 0.3, 'bandpass', 1900, 0.7, 0.22 * vel, 0.18);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(200, at);
    o.frequency.exponentialRampToValueAtTime(150, at + 0.08);
    const g = env(at, 0.12 * vel, 0.002, 0.1, bus);
    o.connect(g);
    o.start(at);
    o.stop(at + 0.15);
    o.onended = () => o.disconnect();
  }
  const hat = (at, vel, open) => noise(at, open ? 0.3 : 0.06, 'highpass', 7200, 0.6, 0.07 * vel, open ? 0.22 : 0.035);

  // ---------------------------------------------------------------- writing a track

  const moodNow = () => MOODS[fixed || sceneId] || MOODS.room;

  function newTrack(at, n) {
    const M = moodNow();
    const key = M.keys[Math.floor(rand() * M.keys.length)];
    const progs = PROGS[M.mode];
    const prog = progs[Math.floor(rand() * progs.length)];
    const bpm = Math.round(M.bpm * (0.96 + rand() * 0.08) * (weatherKind === 'rain' || weatherKind === 'storm' ? 0.96 : 1));
    song = {
      n,
      M,
      key,
      prog,
      bpm,
      swing: 0.18 + rand() * 0.1, // how late the off-beat eighths land
      sec: 0,
      secBar: 0,
      bar: 0,
      step: 0,
      next: at,
      voicing: null,
      kickPat: [
        [0, 10],
        [0, 7, 10],
        [0, 8, 11],
        [0, 3, 10],
      ][Math.floor(rand() * 4)],
      motif: makeMotif(M),
      reHit: rand() < 0.5, // chords struck again on the and of three
    };
    emit();
  }

  /** Two bars of melody: a few pentatonic notes, kept and varied through the track. */
  function makeMotif(M) {
    const notes = [];
    const scale = PENTA[M.mode];
    let deg = Math.floor(rand() * scale.length);
    for (let b = 0; b < 2; b++)
      for (let st = 0; st < 16; st += 2) {
        if (rand() > (st % 4 === 0 ? 0.45 : 0.25)) continue;
        deg = Math.max(0, Math.min(scale.length * 2 - 1, deg + Math.round((rand() - 0.5) * 3)));
        notes.push({ bar: b, step: st, oct: Math.floor(deg / scale.length), pc: scale[deg % scale.length] });
      }
    return notes;
  }

  /** Voice a chord near the last one, between about E3 and D5, so it moves smoothly. */
  function voice(root, qual) {
    const centre = song.voicing ? song.voicing.reduce((a, b) => a + b, 0) / song.voicing.length : 62;
    const iv = QUAL[qual].iv;
    const notes = iv.slice(iv.length > 4 ? 1 : 0).map((i) => {
      let m = 48 + root + i;
      while (m < centre - 6) m += 12;
      while (m > centre + 6) m -= 12;
      return m;
    });
    notes.sort((a, b) => a - b);
    song.voicing = notes;
    return notes;
  }

  const chordName = (c) => NOTE[(song.key + c[0]) % 12] + QUAL[c[1]].name;

  function playStep(at) {
    const s = song;
    const M = s.M;
    const [secName] = FORM[s.sec];
    const P = PARTS[secName];
    const stepDur = 60 / s.bpm / 4;
    const chord = s.prog[s.bar % s.prog.length];
    const root = (s.key + chord[0]) % 12;
    const swingAt = (st) => at + (st % 4 === 2 ? s.swing * stepDur : 0);
    const st = s.step;
    const t = swingAt(st);
    const human = () => (rand() - 0.5) * 0.012;

    // the tape darkens and opens with the sections, and closes up in the rain
    if (st === 0) {
      const wet = weatherKind === 'storm' ? 0.6 : weatherKind === 'rain' || weatherKind === 'fog' ? 0.75 : 1;
      tone.frequency.setTargetAtTime(M.lp * P.lp * wet, at, 1.2);
      crackleGain.gain.setTargetAtTime(0.5 * M.crackle * (P.drums ? 1 : 1.4), at, 1);
    }

    // chords: struck on the one (and sometimes again on the and of three), strummed a little
    if (st === 0 || (st === 10 && s.reHit && P.drums)) {
      const notes = voice(root, chord[1]);
      const play = { ep, pad, pluck }[M.chords];
      const dur = st === 0 ? stepDur * (s.reHit && P.drums ? 9 : 15) : stepDur * 5;
      notes.forEach((m, i) => play(m, t + i * 0.018 + human(), dur, st === 0 ? 0.9 : 0.55));
      if (st === 0) emit(chordName(chord));
    }
    // bass: the root on the one, a fifth or the octave later, sometimes a step into the next chord
    if (P.bass) {
      const b = 36 + root;
      if (st === 0) bass(b, t, stepDur * 5, 1);
      if (st === 6 && rand() < 0.6) bass(b + (rand() < 0.5 ? 7 : 12), t, stepDur * 2, 0.7);
      if (st === 10) bass(b, t, stepDur * 3, 0.85);
      if (st === 14 && rand() < 0.35) {
        const next = s.prog[(s.bar + 1) % s.prog.length];
        bass(36 + ((s.key + next[0] + 11) % 12), t, stepDur * 1.5, 0.7);
      }
    }
    // drums
    const busy = M.drums * P.drums;
    if (busy > 0) {
      if (s.kickPat.includes(st)) kick(t + human(), st === 0 ? 1 : 0.8);
      if (st === 4 || st === 12) snare(t + human(), 0.9);
      if (st === 15 && rand() < 0.2 * busy) snare(t, 0.3); // a ghost note
      if (st % 2 === 0 && (busy > 0.6 || st % 4 === 0)) hat(t + human(), st % 4 === 0 ? 0.9 : 0.55, false);
      if (st === 14 && rand() < 0.15) hat(t, 0.5, true);
    }
    // melody, from the motif (an octave higher now and then)
    if (P.lead) {
      const bar2 = s.secBar % 2;
      for (const n of s.motif)
        if (n.bar === bar2 && n.step === st && rand() > 0.12) {
          const up = s.secBar >= 4 && rand() < 0.3 ? 12 : 0;
          bell(72 + ((s.key + n.pc) % 12) + n.oct * 12 + up - 12, t + human(), 0.8);
        }
    }

    // move on
    s.step++;
    if (s.step === 16) {
      s.step = 0;
      s.bar++;
      s.secBar++;
      if (s.secBar >= FORM[s.sec][1]) {
        s.secBar = 0;
        s.sec++;
        if (FORM[s.sec]?.[0] === 'b' && rand() < 0.4) s.motif = makeMotif(M); // a new tune for the second half
        if (s.sec >= FORM.length) return 'end';
      }
    }
    s.next = at + stepDur;
    return null;
  }

  /** The tape slows to a stop, then the next track. */
  function tapeStop(at) {
    pitch.offset.cancelScheduledValues(at);
    pitch.offset.setValueAtTime(0, at);
    pitch.offset.linearRampToValueAtTime(-1500, at + 0.9);
    bus.gain.setValueAtTime(0.8, at);
    bus.gain.linearRampToValueAtTime(0, at + 0.9);
    pitch.offset.setValueAtTime(0, at + 1.3);
    bus.gain.setValueAtTime(0.8, at + 1.3);
    return at + 1.6;
  }

  function schedule() {
    const ahead = ctx.currentTime + 0.2;
    while (song && song.next < ahead) {
      if (playStep(song.next) === 'end') {
        newTrack(tapeStop(song.next + 60 / song.bpm / 4), song.n + 1);
      }
    }
    // the beat for the scenes: how recently the kick hit, 1 falling to 0
    const now = ctx.currentTime - (ctx.outputLatency || 0);
    let last = -1;
    for (const k of kicks) if (k <= now) last = k;
    beat.kick = last < 0 ? 0 : Math.exp(-(now - last) * 7);
  }

  function emit(chord) {
    const info = api.info(chord);
    for (const fn of listeners) fn(info);
  }

  // ---------------------------------------------------------------- outside

  const api = {
    get playing() {
      return playing;
    },
    /** Start (or resume). `mood` is a scene id to hold, or 'auto' to follow the scene. */
    play(mood = 'auto') {
      fixed = mood === 'auto' ? null : MOODS[mood] ? mood : null;
      if (!ctx && !build()) return false;
      if (ctx.state === 'suspended') ctx.resume();
      if (!song || song.M !== moodNow()) newTrack(ctx.currentTime + 0.1, (song?.n || 0) + 1);
      out.gain.cancelScheduledValues(ctx.currentTime);
      out.gain.setTargetAtTime(vol, ctx.currentTime, 0.4);
      playing = true;
      beat.on = true;
      clearInterval(timer);
      timer = setInterval(schedule, 40);
      schedule();
      emit();
      return true;
    },
    pause() {
      if (!ctx || !playing) return;
      playing = false;
      beat.on = false;
      beat.kick = 0;
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      clearInterval(timer);
      // the notes already scheduled just play out under the fade; start the bar afresh next time
      setTimeout(() => {
        if (!playing && song) {
          song.step = 0;
          song.next = 0;
        }
      }, 300);
      emit();
    },
    /** Skip to a new track, with the tape stop. */
    next() {
      if (!ctx || !song) return;
      newTrack(tapeStop(ctx.currentTime + 0.05), song.n + 1);
    },
    setVolume(v) {
      vol = v;
      if (ctx && playing) out.gain.setTargetAtTime(vol, ctx.currentTime, 0.1);
    },
    /** The scene changed: a station that follows the scene moves on to its mood at the next track. */
    setScene(id) {
      sceneId = id;
      if (playing && !fixed && song && song.M !== moodNow()) api.next();
    },
    setWeather(kind) {
      weatherKind = kind;
    },
    info(chord) {
      if (!song) return { playing };
      return { playing, track: song.n, key: NOTE[song.key] + (song.M.mode === 'minor' ? 'm' : ''), bpm: song.bpm, chord, mood: fixed || sceneId };
    },
    onChange(fn) {
      listeners.add(fn);
    },
    /** For the console: LofiMusic.peek().song is the track being written. */
    peek: () => ({ ctx, out, song, beat }),
    /** For listening together later: the same seed writes the same music. */
    seed(n) {
      let s = n % 2147483647 || 1;
      rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    },
  };
  // when resumed, restart the clock from now
  const resume = api.play;
  api.play = (mood) => {
    if (song && song.next < (ctx?.currentTime || 0)) song.next = ctx.currentTime + 0.05;
    return resume(mood);
  };
  return api;
}
