// Audio original del juego, sintetizado con Web Audio: no hay archivos de terceros.
// Tres buses (general → música y efectos) con volumen propio. Cada sonido
// importante tiene un aviso visual equivalente en el HUD (sección 6.3).

const SFX = {
  accept: [{ f: 660, d: 0.07 }, { f: 880, d: 0.09 }],
  reject: [{ f: 220, d: 0.12, type: 'square', g: 0.05 }],
  warning: [{ f: 740, d: 0.12, type: 'triangle' }, { f: 740, d: 0.12, type: 'triangle', delay: 0.18 }],
  blocked: [{ f: 1200, d: 0.05, type: 'square', g: 0.04 }, { f: 900, d: 0.06, type: 'square', g: 0.03, delay: 0.05 }],
  hit: [{ f: 140, d: 0.18, type: 'sawtooth', g: 0.06 }],
  push: [{ f: 180, d: 0.1, type: 'triangle' }, { f: 120, d: 0.12, type: 'triangle', delay: 0.06 }],
  relief: [{ f: 392, d: 0.08, type: 'triangle' }, { f: 494, d: 0.1, type: 'triangle', delay: 0.08 }],
  breach: [{ f: 196, d: 0.2, type: 'sawtooth', g: 0.06 }, { f: 147, d: 0.3, type: 'sawtooth', g: 0.06, delay: 0.15 }],
  elite: [{ f: 110, d: 0.5, type: 'sawtooth', g: 0.05 }, { f: 165, d: 0.5, type: 'sawtooth', g: 0.035 }],
  wave: [{ f: 392, d: 0.15 }, { f: 523, d: 0.2, delay: 0.15 }],
  step: [{ f: 523, d: 0.06, g: 0.05 }],
};

const midi = (n) => 440 * 2 ** ((n - 69) / 12);
// Notas en modo frigio sobre re: D Eb F G A Bb C (evoca la escala «dórica» griega).
const N = { D2: 38, Eb2: 39, F2: 41, G2: 43, A2: 45, Bb2: 46, C3: 48, D3: 50, Eb3: 51, F3: 53, G3: 55, A3: 57, Bb3: 58, C4: 60, D4: 62, Eb4: 63, F4: 65, G4: 67, A4: 69, Bb4: 70, C5: 72, D5: 74 };

/**
 * Pistas: tempo, longitud en semicorcheas y notas [paso, nota, duración, instrumento, intensidad mínima].
 * Composición original para este proyecto.
 */
const TRACKS = {
  menu: {
    bpm: 66,
    steps: 64,
    drone: [N.D2, N.A2],
    notes: [
      ...[[N.D3, N.F3, N.A3, N.D4], [N.Eb3, N.G3, N.Bb3, N.Eb4], [N.C3, N.Eb3, N.G3, N.C4], [N.D3, N.F3, N.A3, N.D4]].flatMap((chord, bar) =>
        chord.map((n, i) => [bar * 16 + i * 4, n, 6, 'lyre'])),
      [0, N.A4, 8, 'aulos'], [8, N.G4, 4, 'aulos'], [12, N.F4, 4, 'aulos'],
      [16, N.Eb4, 8, 'aulos'], [24, N.F4, 4, 'aulos'], [28, N.G4, 4, 'aulos'],
      [32, N.A4, 6, 'aulos'], [38, N.Bb4, 2, 'aulos'], [40, N.A4, 8, 'aulos'],
      [48, N.G4, 4, 'aulos'], [52, N.F4, 4, 'aulos'], [56, N.Eb4, 4, 'aulos'], [60, N.D4, 4, 'aulos'],
    ],
  },
  battle: {
    bpm: 104,
    steps: 32,
    drone: [N.D2],
    notes: [
      ...[0, 6, 8, 14, 16, 22, 24, 28, 30].map((s) => [s, 0, 1, 'drum']),
      [0, N.D2, 3, 'bass'], [4, N.D2, 3, 'bass'], [8, N.F2, 3, 'bass'], [12, N.D2, 3, 'bass'],
      [16, N.G2, 3, 'bass'], [20, N.F2, 3, 'bass'], [24, N.Eb2, 3, 'bass'], [28, N.D2, 3, 'bass'],
      ...[2, 6, 10, 14, 18, 22, 26, 30].map((s) => [s, 0, 1, 'rim', 0.34]),
      [0, N.D5, 3, 'aulos', 0.67], [3, N.C5, 1, 'aulos', 0.67], [4, N.Bb4, 4, 'aulos', 0.67], [8, N.A4, 6, 'aulos', 0.67],
      [16, N.G4, 3, 'aulos', 0.67], [19, N.A4, 1, 'aulos', 0.67], [20, N.Bb4, 4, 'aulos', 0.67], [24, N.A4, 8, 'aulos', 0.67],
    ],
  },
};

const STINGERS = {
  victory: [[0, N.D4, 2, 'lyre'], [2, N.F4, 2, 'lyre'], [4, N.A4, 2, 'lyre'], [6, N.D5, 10, 'lyre'], [6, N.A4, 10, 'aulos']],
  defeat: [[0, N.D3, 4, 'aulos'], [4, N.C3, 4, 'aulos'], [8, N.Bb2, 4, 'aulos'], [12, N.A2, 12, 'aulos'], [0, 0, 1, 'drum'], [12, 0, 1, 'drum']],
};

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.volumes = { master: 0.8, music: 0.5, sfx: 0.8, muted: false };
    this.track = null;
    this.intensity = 0;
    this.ducked = false;
    this.timer = null;
    this.drones = [];
  }

  /** Los navegadores exigen un gesto del usuario antes de reproducir audio. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume();
      return;
    }
    const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Ctx) return;
    try {
      this.ctx = new Ctx();
    } catch {
      this.ctx = null;
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.musicBus = c.createGain();
    this.sfxBus = c.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(c.destination);
    // Ruido blanco reutilizable para la percusión.
    this.noise = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.#applyVolumes();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) c.suspend();
      else c.resume();
    });
    if (this.wantedTrack) this.playMusic(this.wantedTrack);
  }

  setVolumes(v) {
    Object.assign(this.volumes, v);
    this.#applyVolumes();
  }

  toggleMute() {
    this.setVolumes({ muted: !this.volumes.muted });
    return this.volumes.muted;
  }

  #applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const v = this.volumes;
    this.master.gain.setTargetAtTime(v.muted ? 0 : v.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(v.music * (this.ducked ? 0.3 : 1), t, 0.1);
    this.sfxBus.gain.setTargetAtTime(v.sfx, t, 0.05);
  }

  /** Baja la música durante la pausa. */
  duck(on) {
    this.ducked = on;
    this.#applyVolumes();
  }

  /** 0–1: con más intensidad entran más capas en el tema de batalla. */
  setIntensity(level) {
    this.intensity = Math.max(0, Math.min(1, level));
  }

  play(name) {
    const notes = SFX[name];
    if (!notes || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    for (const n of notes) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + (n.delay ?? 0);
      osc.type = n.type ?? 'sine';
      osc.frequency.value = n.f;
      gain.gain.setValueAtTime(n.g ?? 0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + n.d);
      osc.connect(gain).connect(this.sfxBus);
      osc.start(t);
      osc.stop(t + n.d + 0.02);
    }
  }

  // ── Música ─────────────────────────────────────────────────────────────

  playMusic(id) {
    this.wantedTrack = id;
    if (!this.ctx || this.track?.id === id) return;
    this.stopMusic();
    const def = TRACKS[id];
    if (!def) return;
    const c = this.ctx;
    this.track = { id, def, step: 0, nextTime: c.currentTime + 0.1, stepDur: 60 / def.bpm / 4 };
    this.drones = def.drone.map((n) => this.#drone(midi(n)));
    this.timer = setInterval(() => this.#schedule(), 25);
  }

  stopMusic() {
    clearInterval(this.timer);
    this.timer = null;
    const t = this.ctx?.currentTime ?? 0;
    for (const d of this.drones) {
      d.gain.gain.setTargetAtTime(0, t, 0.3);
      d.oscs.forEach((o) => o.stop(t + 1.5));
    }
    this.drones = [];
    this.track = null;
  }

  /** Remate breve al terminar la campaña; detiene la pista en curso. */
  stinger(id) {
    this.wantedTrack = null;
    this.stopMusic();
    if (!this.ctx) return;
    const stepDur = 60 / 90 / 4;
    const t0 = this.ctx.currentTime + 0.05;
    for (const [s, note, len, inst] of STINGERS[id] ?? []) this.#note(inst, midi(note), t0 + s * stepDur, len * stepDur);
  }

  #schedule() {
    const tr = this.track;
    if (!tr || !this.ctx) return;
    while (tr.nextTime < this.ctx.currentTime + 0.12) {
      for (const [s, note, len, inst, min = 0] of tr.def.notes) {
        if (s === tr.step && this.intensity >= min) this.#note(inst, midi(note), tr.nextTime, len * tr.stepDur);
      }
      tr.step = (tr.step + 1) % tr.def.steps;
      tr.nextTime += tr.stepDur;
    }
  }

  #drone(freq) {
    const c = this.ctx;
    const gain = c.createGain();
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.045, c.currentTime + 2);
    const oscs = [0, 7].map((cents) => {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = cents;
      o.connect(filter);
      o.start();
      return o;
    });
    filter.connect(gain).connect(this.musicBus);
    return { gain, oscs };
  }

  #note(inst, freq, t, dur) {
    const c = this.ctx;
    const out = c.createGain();
    out.connect(this.musicBus);
    if (inst === 'drum' || inst === 'rim') {
      if (inst === 'drum') {
        const o = c.createOscillator();
        o.frequency.setValueAtTime(95, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
        out.gain.setValueAtTime(0.22, t);
        out.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        o.connect(out);
        o.start(t);
        o.stop(t + 0.32);
      } else {
        const src = c.createBufferSource();
        const bp = c.createBiquadFilter();
        src.buffer = this.noise;
        bp.type = 'bandpass';
        bp.frequency.value = 1900;
        out.gain.setValueAtTime(0.07, t);
        out.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
        src.connect(bp).connect(out);
        src.start(t);
        src.stop(t + 0.08);
      }
      return;
    }
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.connect(out);
    if (inst === 'aulos') {
      // Aerófono de doble caña: onda cuadrada filtrada con vibrato suave.
      const o = c.createOscillator();
      const lfo = c.createOscillator();
      const lfoGain = c.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      lfo.frequency.value = 5.2;
      lfoGain.gain.value = freq * 0.006;
      lfo.connect(lfoGain).connect(o.frequency);
      filter.frequency.value = 1500;
      out.gain.setValueAtTime(0.0001, t);
      out.gain.linearRampToValueAtTime(0.035, t + 0.06);
      out.gain.setTargetAtTime(0.0001, t + dur, 0.08);
      o.connect(filter);
      for (const n of [o, lfo]) {
        n.start(t);
        n.stop(t + dur + 0.5);
      }
      return;
    }
    // Lira (y bajo): cuerda pulsada con ataque rápido y caída larga.
    const bass = inst === 'bass';
    const tones = bass ? [['triangle', 1, 0.16]] : [['triangle', 1, 0.07], ['sine', 2, 0.03]];
    filter.frequency.value = bass ? 600 : 2600;
    out.gain.setValueAtTime(1, t);
    out.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.4, dur * 1.8));
    for (const [type, mult, g] of tones) {
      const o = c.createOscillator();
      const og = c.createGain();
      o.type = type;
      o.frequency.value = freq * mult;
      og.gain.value = g;
      o.connect(og).connect(filter);
      o.start(t);
      o.stop(t + Math.max(0.45, dur * 1.8) + 0.05);
    }
  }
}
