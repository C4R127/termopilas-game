import { identityFromPitch } from './PlayerProfile.js';

/**
 * Estimación del tono de voz de quien juega, para que Leónidas sepa cómo
 * dirigirse a esa persona. Todo ocurre en memoria, fotograma a fotograma: no se
 * graba, no se guarda y no se envía audio. Solo cuentan los fotogramas cercanos
 * a una frase que el reconocedor acaba de oír (las órdenes), así la música del
 * juego o la voz de Leónidas no se confunden con la del jugador.
 */

export const PITCH = {
  frameMs: 50, // cada cuánto se analiza un fragmento del micrófono
  windowMs: 3000, // fotogramas anteriores a una frase reconocida que se le atribuyen
  minFrames: 30, // fotogramas con voz necesarios para decidir (≈1,5 s de habla)
  minUtterances: 2, // y al menos dos frases distintas
  panelMinMs: 2500, // panel de identificación: escucha al menos esto (lo que dura la frase)…
  panelMaxMs: 8000, // …y como mucho esto si aún no ha oído voz suficiente
  panelMinFrames: 16, // fotogramas con voz necesarios en el panel (≈0,8 s de habla)
  minHz: 70,
  maxHz: 400,
};

/**
 * Frecuencia fundamental de un fragmento por autocorrelación normalizada.
 * Devuelve null si es silencio o no hay una periodicidad clara (ruido, consonantes).
 * @param {Float32Array|number[]} buf muestras en [-1, 1]
 */
export function estimatePitch(buf, sampleRate, { minHz = PITCH.minHz, maxHz = PITCH.maxHz, minRms = 0.01, minClarity = 0.8 } = {}) {
  const n = buf.length;
  let energy = 0;
  for (let i = 0; i < n; i++) energy += buf[i] * buf[i];
  if (Math.sqrt(energy / n) < minRms) return null;
  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  const maxLag = Math.min(Math.ceil(sampleRate / minHz), Math.floor(n / 2));
  const r = new Float32Array(maxLag + 2);
  let peak = 0;
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let xy = 0;
    let xx = 0;
    let yy = 0;
    for (let i = 0; i + lag < n; i++) {
      xy += buf[i] * buf[i + lag];
      xx += buf[i] * buf[i];
      yy += buf[i + lag] * buf[i + lag];
    }
    r[lag] = xx && yy ? xy / Math.sqrt(xx * yy) : 0;
    if (lag <= maxLag) peak = Math.max(peak, r[lag]);
  }
  if (peak < minClarity) return null;
  // El primer máximo local cercano al mayor evita confundir la voz con su octava grave.
  for (let lag = minLag + 1; lag <= maxLag; lag++) {
    if (r[lag] >= 0.9 * peak && r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1]) {
      const a = r[lag - 1];
      const b = r[lag];
      const c = r[lag + 1];
      const shift = a - 2 * b + c === 0 ? 0 : (0.5 * (a - c)) / (a - 2 * b + c);
      return sampleRate / (lag + shift);
    }
  }
  return null;
}

/** Junta los tonos de las frases del jugador y decide la forma de trato. */
export class PitchProfile {
  constructor() {
    this.reset();
  }

  reset() {
    this.frames = []; // { t, hz } aún sin atribuir
    this.samples = []; // tonos atribuidos a frases del jugador
    this.utterances = 0;
  }

  addFrame(t, hz) {
    this.frames.push({ t, hz });
    // Solo hace falta conservar la ventana de atribución.
    while (this.frames.length && this.frames[0].t < t - PITCH.windowMs) this.frames.shift();
  }

  /** El reconocedor acaba de oír una frase: los fotogramas recientes son del jugador. */
  commitUtterance(now) {
    const recent = this.frames.filter((f) => f.t >= now - PITCH.windowMs && f.t <= now);
    this.frames = [];
    if (!recent.length) return;
    this.samples.push(...recent.map((f) => f.hz));
    this.utterances++;
  }

  get ready() {
    return this.samples.length >= PITCH.minFrames && this.utterances >= PITCH.minUtterances;
  }

  get median() {
    if (!this.samples.length) return NaN;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /** Forma de trato, o null si aún no hay voz suficiente. */
  decide() {
    return this.ready ? identityFromPitch(this.median) : null;
  }
}

/**
 * Decisión del panel de identificación: con voz suficiente, el trato por el tono
 * mediano; si no, null (hay que repetir).
 */
export function identityFromSamples(samples, minFrames = PITCH.panelMinFrames) {
  if (samples.length < minFrames) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { identity: identityFromPitch(median), median };
}

/**
 * Escucha el micrófono con Web Audio y entrega el tono de cada fragmento.
 * Se detiene en cuanto ya no hace falta (y libera el micrófono).
 */
export class PitchSensor {
  constructor({ onFrame = () => {} } = {}) {
    this.onFrame = onFrame;
    this.running = false;
    this.suspended = false; // mientras habla Leónidas no se analiza nada
  }

  static get supported() {
    return !!(globalThis.navigator?.mediaDevices?.getUserMedia && (globalThis.AudioContext || globalThis.webkitAudioContext));
  }

  /** @returns {Promise<boolean>} true si el micrófono quedó abierto */
  async start() {
    if (this.running) return true;
    if (!PitchSensor.supported) return false;
    this.running = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (!this.running) {
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }
      const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
      this.ctx = new Ctx();
      this.stream = stream;
      const source = this.ctx.createMediaStreamSource(stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser); // no se conecta a los altavoces
      const raw = new Float32Array(this.analyser.fftSize);
      const half = new Float32Array(raw.length / 2);
      this.timer = setInterval(() => {
        if (this.suspended) return;
        this.analyser.getFloatTimeDomainData(raw);
        // Se reduce a la mitad la frecuencia de muestreo: basta para la voz y cuesta cuatro veces menos.
        for (let i = 0; i < half.length; i++) half[i] = (raw[2 * i] + raw[2 * i + 1]) / 2;
        const hz = estimatePitch(half, this.ctx.sampleRate / 2);
        if (hz) this.onFrame(hz, performance.now());
      }, PITCH.frameMs);
      return true;
    } catch {
      this.running = false; // sin permiso o sin micrófono: Leónidas usa la forma neutra
      return false;
    }
  }

  setSuspended(on) {
    this.suspended = on;
  }

  stop() {
    this.running = false;
    clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
