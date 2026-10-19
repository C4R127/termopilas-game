// Efectos mínimos de la beta sintetizados con Web Audio (sin archivos de terceros).
// Cada sonido tiene siempre un aviso visual equivalente en el HUD.

const SOUNDS = {
  accept: [{ f: 660, d: 0.07 }, { f: 880, d: 0.09 }],
  reject: [{ f: 220, d: 0.12, type: 'square', g: 0.05 }],
  heard: [{ f: 520, d: 0.05, g: 0.05 }],
  warning: [{ f: 740, d: 0.12, type: 'triangle' }, { f: 740, d: 0.12, type: 'triangle', delay: 0.18 }],
  blocked: [{ f: 1200, d: 0.05, type: 'square', g: 0.04 }, { f: 900, d: 0.06, type: 'square', g: 0.03, delay: 0.05 }],
  hit: [{ f: 140, d: 0.18, type: 'sawtooth', g: 0.06 }],
  push: [{ f: 180, d: 0.1, type: 'triangle' }, { f: 120, d: 0.12, type: 'triangle', delay: 0.06 }],
  wave: [{ f: 392, d: 0.15 }, { f: 523, d: 0.2, delay: 0.15 }],
  victory: [{ f: 523, d: 0.18 }, { f: 659, d: 0.18, delay: 0.18 }, { f: 784, d: 0.35, delay: 0.36 }],
  defeat: [{ f: 330, d: 0.25, type: 'triangle' }, { f: 247, d: 0.45, type: 'triangle', delay: 0.25 }],
};

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  /** Los navegadores exigen un gesto del usuario antes de reproducir audio. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Ctx) return;
    try {
      this.ctx = new Ctx();
    } catch {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  play(name) {
    const notes = SOUNDS[name];
    if (!notes || this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    for (const n of notes) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + (n.delay ?? 0);
      osc.type = n.type ?? 'sine';
      osc.frequency.value = n.f;
      gain.gain.setValueAtTime(n.g ?? 0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + n.d);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + n.d + 0.02);
    }
  }
}
