import { VOICE } from '../config/balance.js';
import { COMMANDS } from '../data/commands.js';

/** Minúsculas, sin puntuación, sin tildes y con espacios simples (solo para comparar). */
export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ALIAS_TABLE = COMMANDS.flatMap((c) => c.aliases.map((a) => ({ alias: normalize(a), id: c.id })));

/**
 * Busca la intención en la lista cerrada de alias: coincidencia exacta o una
 * palabra de la frase que sea un alias («¡escudos ya!»). Si la frase contiene
 * alias de dos órdenes distintas se considera ambigua y no se ejecuta nada.
 * @returns {{id: string|null, reason?: 'empty'|'unknown'|'ambiguous'}}
 */
export function matchCommand(transcript) {
  const text = normalize(transcript);
  if (!text) return { id: null, reason: 'empty' };
  const exact = ALIAS_TABLE.find((a) => a.alias === text);
  if (exact) return { id: exact.id };
  const words = new Set(text.split(' '));
  const ids = new Set(ALIAS_TABLE.filter((a) => words.has(a.alias)).map((a) => a.id));
  if (ids.size === 1) return { id: [...ids][0] };
  return { id: null, reason: ids.size > 1 ? 'ambiguous' : 'unknown' };
}

const ERROR_MESSAGES = {
  'not-allowed': 'Permiso de micrófono denegado. Puedes jugar con teclado y botones.',
  'service-not-allowed': 'El navegador no permite el reconocimiento de voz. Usa teclado y botones.',
  'audio-capture': 'No se detecta ningún micrófono.',
  network: 'El reconocimiento de voz de este navegador necesita conexión.',
  'language-not-supported': 'El idioma elegido no está disponible: prueba es-ES en el menú.',
};

/**
 * Encapsula SpeechRecognition (Web Speech API): permisos, escucha, errores y
 * estado del micrófono. Solo procesa texto: no graba ni guarda audio.
 *
 * Estados: unsupported | off | requesting | listening | error
 */
export class VoiceCommandManager {
  constructor({
    lang = VOICE.lang,
    minConfidence = VOICE.minConfidence,
    repeatCooldownMs = VOICE.repeatCooldownMs,
    onCommand = () => {},
    onHeard = () => {},
    onStatus = () => {},
    recognitionCtor,
    now = () => performance.now(),
  } = {}) {
    this.lang = lang;
    this.minConfidence = minConfidence;
    this.repeatCooldownMs = repeatCooldownMs;
    this.onCommand = onCommand;
    this.onHeard = onHeard;
    this.onStatus = onStatus;
    this.now = now;
    this.Ctor = recognitionCtor !== undefined
      ? recognitionCtor
      : globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition ?? null;
    this.status = this.Ctor ? 'off' : 'unsupported';
    this.message = this.Ctor ? '' : 'Este navegador no ofrece reconocimiento de voz. Usa teclado y botones.';
    this.wanted = false; // el usuario quiere escuchar
    this.recognition = null;
    this.failures = 0;
    this.restartTimer = null;
    this.lastAccepted = { id: null, at: -Infinity };
  }

  get supported() {
    return !!this.Ctor;
  }

  get listening() {
    return this.status === 'listening';
  }

  #setStatus(status, message = '') {
    this.status = status;
    this.message = message;
    this.onStatus(status, message);
  }

  setLanguage(lang) {
    this.lang = lang;
    if (this.wanted) {
      this.stop();
      this.start();
    }
  }

  /** Solo debe llamarse tras una acción explícita del usuario (permiso del navegador). */
  start() {
    if (!this.supported) {
      this.#setStatus('unsupported', 'Este navegador no ofrece reconocimiento de voz. Usa teclado y botones.');
      return false;
    }
    if (this.wanted && this.recognition) return true;
    this.wanted = true;
    this.failures = 0;
    this.#begin();
    return true;
  }

  stop() {
    this.wanted = false;
    clearTimeout(this.restartTimer);
    const r = this.recognition;
    this.recognition = null;
    if (r) {
      r.onstart = r.onresult = r.onerror = r.onend = null;
      try { r.abort(); } catch { /* ya detenido */ }
    }
    if (this.status !== 'unsupported') this.#setStatus('off');
  }

  /** Procesa una lista de alternativas [{transcript, confidence}] de un resultado final. */
  handleAlternatives(alternatives) {
    const first = alternatives[0] ?? { transcript: '', confidence: 0 };
    for (const alt of alternatives) {
      const match = matchCommand(alt.transcript);
      if (!match.id) continue;
      // Algunos navegadores devuelven confianza 0 cuando no la calculan: se ignora.
      if (alt.confidence > 0 && alt.confidence < this.minConfidence) {
        this.onHeard({ transcript: alt.transcript, confidence: alt.confidence, status: 'low-confidence' });
        return null;
      }
      const t = this.now();
      if (this.lastAccepted.id === match.id && t - this.lastAccepted.at < this.repeatCooldownMs) {
        this.onHeard({ transcript: alt.transcript, confidence: alt.confidence, status: 'repeat' });
        return null;
      }
      this.lastAccepted = { id: match.id, at: t };
      this.onHeard({ transcript: alt.transcript, confidence: alt.confidence, status: 'matched', id: match.id });
      this.onCommand(match.id, { transcript: alt.transcript, confidence: alt.confidence });
      return match.id;
    }
    const reason = matchCommand(first.transcript).reason ?? 'unknown';
    this.onHeard({ transcript: first.transcript, confidence: first.confidence, status: reason });
    return null;
  }

  #begin() {
    const r = new this.Ctor();
    r.lang = this.lang;
    r.continuous = true;
    r.interimResults = false; // solo resultados finales: menos activaciones accidentales
    r.maxAlternatives = 3;
    r.onstart = () => {
      this.failures = 0;
      this.#setStatus('listening', 'Escuchando órdenes');
    };
    r.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result.isFinal) continue;
        const alts = [];
        for (let k = 0; k < result.length; k++) alts.push({ transcript: result[k].transcript, confidence: result[k].confidence ?? 0 });
        this.handleAlternatives(alts);
      }
    };
    r.onerror = (event) => {
      const code = event.error;
      if (code === 'no-speech' || code === 'aborted') return;
      if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture' || code === 'language-not-supported') {
        this.wanted = false;
      } else {
        this.failures++;
      }
      this.#setStatus('error', ERROR_MESSAGES[code] ?? `Error de reconocimiento de voz (${code}).`);
    };
    r.onend = () => {
      if (this.recognition !== r) return;
      this.recognition = null;
      // Chrome corta la escucha tras un silencio: se reanuda mientras siga activada.
      if (this.wanted && this.failures < 4) {
        this.restartTimer = setTimeout(() => this.wanted && !this.recognition && this.#begin(), 250);
      } else if (this.wanted) {
        this.wanted = false;
        this.#setStatus('error', 'El reconocimiento se detuvo por errores repetidos. Sigue con teclado y botones.');
      } else if (this.status !== 'error') {
        this.#setStatus('off');
      }
    };
    this.recognition = r;
    this.#setStatus('requesting', 'Solicitando micrófono…');
    try {
      r.start();
    } catch {
      this.wanted = false;
      this.recognition = null;
      this.#setStatus('error', 'No se pudo iniciar el micrófono.');
    }
  }
}
