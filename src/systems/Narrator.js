/**
 * Lectura en voz alta opcional (sección 7.5: «tutorial silencioso con texto,
 * además de las instrucciones habladas opcionales»). Usa la síntesis de voz del
 * navegador (speechSynthesis); si no existe, el juego sigue solo con texto.
 */

/** Prepara el texto para leerlo: sin comillas angulares y sin palabras en mayúsculas que se deletrearían. */
export function toSpeech(text) {
  return String(text ?? '')
    .replace(/[«»]/g, '')
    .replace(/\b[A-ZÁÉÍÓÚÑ]{2,}\b/g, (w) => w.toLowerCase())
    .replace(/\s+/g, ' ')
    .trim();
}

export class Narrator {
  constructor({
    synth = globalThis.speechSynthesis,
    Utterance = globalThis.SpeechSynthesisUtterance,
    lang = 'es-PE',
    onSpeaking = () => {},
  } = {}) {
    this.synth = synth ?? null;
    this.Utterance = Utterance ?? null;
    this.lang = lang;
    this.onSpeaking = onSpeaking;
    this.speaking = false;
  }

  get supported() {
    return !!(this.synth && this.Utterance);
  }

  setLanguage(lang) {
    this.lang = lang;
  }

  /** Voz en español: primero la del idioma exacto, luego cualquier variante «es». */
  #voice() {
    const voices = this.synth.getVoices?.() ?? [];
    return voices.find((v) => v.lang === this.lang) ?? voices.find((v) => v.lang?.toLowerCase().startsWith('es')) ?? null;
  }

  #setSpeaking(on) {
    if (this.speaking === on) return;
    this.speaking = on;
    this.onSpeaking(on);
  }

  /** Lee el texto e interrumpe lo que se estuviera leyendo. Devuelve false si no hay síntesis. */
  speak(text, { volume = 1 } = {}) {
    const clean = toSpeech(text);
    if (!this.supported || !clean || volume <= 0) return false;
    this.synth.cancel();
    const u = new this.Utterance(clean);
    u.lang = this.lang;
    const voice = this.#voice();
    if (voice) u.voice = voice;
    u.volume = Math.max(0, Math.min(1, volume));
    u.rate = 1;
    u.onstart = () => this.#setSpeaking(true);
    u.onend = () => this.#setSpeaking(false);
    u.onerror = () => this.#setSpeaking(false);
    this.#setSpeaking(true); // el reconocimiento se suspende desde ya, antes del primer sonido
    this.synth.speak(u);
    return true;
  }

  stop() {
    if (this.supported) this.synth.cancel();
    this.#setSpeaking(false);
  }
}
