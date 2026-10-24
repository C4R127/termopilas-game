import { VOICE } from '../config/balance.js';
import { IDENTITIES } from './PlayerProfile.js';

const STORAGE_KEY = 'termopilas.settings.v1';

// Acciones que se pueden asignar a una tecla (sección 7.5: remapear las teclas).
export const KEY_ACTIONS = ['SHIELDS', 'SPEARS', 'PUSH', 'RELIEF', 'PAUSE', 'VOICE', 'MUTE'];
export const KEY_ACTION_LABELS = {
  SHIELDS: 'Escudos',
  SPEARS: 'Lanzas',
  PUSH: 'Empujen',
  RELIEF: 'Relevo',
  PAUSE: 'Pausa / Continuar',
  VOICE: 'Micrófono',
  MUTE: 'Silenciar sonido',
};
// Teclas reservadas: Esc siempre pausa o cierra; Tab, Intro y Espacio manejan los botones.
export const RESERVED_KEYS = ['Escape', 'Tab', 'Enter', 'NumpadEnter', 'Space'];

/** Confianza mínima exigida al reconocedor según la precisión elegida. */
export const VOICE_SENSITIVITY = {
  strict: { label: 'Alta (menos falsos positivos)', minConfidence: 0.6 },
  normal: { label: 'Normal', minConfidence: VOICE.minConfidence },
  relaxed: { label: 'Baja (micrófonos o acentos difíciles)', minConfidence: 0.25 },
};

export const DEFAULT_SETTINGS = Object.freeze({
  audio: { master: 0.8, music: 0.5, sfx: 0.8, muted: false },
  access: {
    reduceEffects: false, // menos partículas, sin sacudidas ni destellos
    highContrast: false,
    largeText: false,
    longWarnings: false, // avisos de flechas un 50 % más largos
    narration: false, // leer en voz alta las indicaciones del tutorial y los mensajes de Leónidas
  },
  keys: { SHIELDS: 'Digit1', SPEARS: 'Digit2', PUSH: 'Digit3', RELIEF: 'Digit4', PAUSE: 'KeyP', VOICE: 'KeyV', MUTE: 'KeyM' },
  voice: { lang: VOICE.lang, sensitivity: 'normal' },
  progress: { tutorialDone: false },
  // Cómo quiere el jugador que Leónidas se dirija a él; lo dice el propio jugador.
  player: { identity: 'unspecified', asked: false },
});

const clone = (o) => JSON.parse(JSON.stringify(o));
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

/** Mezcla lo guardado con los valores por defecto, descartando claves o tipos desconocidos. */
function sanitize(raw) {
  const out = clone(DEFAULT_SETTINGS);
  if (!raw || typeof raw !== 'object') return out;
  for (const section of Object.keys(out)) {
    const src = raw[section];
    if (!src || typeof src !== 'object') continue;
    for (const key of Object.keys(out[section])) {
      if (typeof src[key] === typeof out[section][key]) out[section][key] = src[key];
    }
  }
  for (const k of ['master', 'music', 'sfx']) out.audio[k] = clamp01(out.audio[k]);
  if (!VOICE_SENSITIVITY[out.voice.sensitivity]) out.voice.sensitivity = 'normal';
  if (!IDENTITIES[out.player.identity]) out.player.identity = 'unspecified';
  // Si quedaron teclas repetidas o reservadas, se vuelve a la distribución por defecto.
  const codes = Object.values(out.keys);
  if (new Set(codes).size !== codes.length || codes.some((c) => RESERVED_KEYS.includes(c))) out.keys = clone(DEFAULT_SETTINGS.keys);
  return out;
}

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Ajustes del jugador guardados en el navegador (solo preferencias, sin datos
 * personales). Si el almacenamiento no está disponible, funcionan en memoria.
 */
export class SettingsStore {
  constructor(storage = defaultStorage()) {
    this.storage = storage;
    this.listeners = new Set();
    let raw = null;
    try {
      raw = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? 'null');
    } catch {
      raw = null;
    }
    this.data = sanitize(raw);
  }

  get(section, key) {
    return key == null ? this.data[section] : this.data[section][key];
  }

  set(section, key, value) {
    if (!(section in this.data) || !(key in this.data[section])) throw new Error(`Ajuste desconocido: ${section}.${key}`);
    this.data[section][key] = value;
    this.data = sanitize(this.data);
    this.#save();
    this.#notify(section, key);
  }

  /**
   * Asigna una tecla a una acción. Si otra acción la usaba, ambas intercambian
   * sus teclas para que nunca haya dos acciones en la misma tecla.
   * @returns {{ok: boolean, swappedWith?: string, reason?: string}}
   */
  rebind(action, code) {
    if (!KEY_ACTIONS.includes(action)) return { ok: false, reason: 'Acción desconocida' };
    if (RESERVED_KEYS.includes(code)) return { ok: false, reason: `${keyLabel(code)} está reservada` };
    const keys = this.data.keys;
    const other = KEY_ACTIONS.find((a) => a !== action && keys[a] === code);
    if (other) keys[other] = keys[action];
    keys[action] = code;
    this.#save();
    this.#notify('keys', action);
    return { ok: true, swappedWith: other };
  }

  resetKeys() {
    this.data.keys = clone(DEFAULT_SETTINGS.keys);
    this.#save();
    this.#notify('keys', null);
  }

  /** Acción asignada a un código de tecla (o null). */
  actionFor(code) {
    return KEY_ACTIONS.find((a) => this.data.keys[a] === code) ?? null;
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  #notify(section, key) {
    for (const fn of this.listeners) fn(section, key, this.data);
  }

  #save() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch { /* almacenamiento lleno o bloqueado: los ajustes duran solo esta sesión */ }
  }
}

/** Nombre legible de un código de tecla (KeyboardEvent.code). */
export function keyLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  const named = {
    Space: 'Espacio', Escape: 'Esc', Enter: 'Intro', Backspace: 'Retroceso', ShiftLeft: 'Mayús izq.', ShiftRight: 'Mayús der.',
    ControlLeft: 'Ctrl izq.', ControlRight: 'Ctrl der.', AltLeft: 'Alt', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=',
  };
  return named[code] ?? code;
}
