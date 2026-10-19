import { EXHAUSTED, FORMATION, INTERMISSION, MORALE, PUSH, RELIEF, SHIELDS, SPEARS } from '../config/balance.js';
import { EVENTS } from '../systems/EventBus.js';
import { MODES } from '../systems/GameState.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * Reglas colectivas de la falange: estado, resistencia, cohesión y moral.
 * No contiene código de interfaz; la escena solo lee el estado y lo dibuja.
 */
export class Formation {
  constructor(state, bus) {
    this.state = state;
    this.bus = bus;
  }

  get mode() {
    return this.state.formationMode;
  }

  get busy() {
    return this.state.simTime < this.state.busyUntil;
  }

  get canAttack() {
    return this.mode === MODES.SPEARS;
  }

  get blocksArrows() {
    return this.mode === MODES.SHIELDS;
  }

  get meleeFactor() {
    switch (this.mode) {
      case MODES.SHIELDS: return SHIELDS.meleeFactor;
      case MODES.RELIEF: return RELIEF.meleeFactor;
      case MODES.EXHAUSTED: return EXHAUSTED.meleeFactor;
      default: return 1;
    }
  }

  /** Daño por segundo de las lanzas, modulado por la moral. */
  get spearDps() {
    const m = this.state.morale;
    const factor = m >= MORALE.highThreshold ? MORALE.highFactor : m < MORALE.lowThreshold ? MORALE.lowFactor : 1;
    return SPEARS.dps * factor;
  }

  #setMode(mode, reason) {
    const previous = this.state.formationMode;
    if (previous === mode) return;
    this.state.formationMode = mode;
    if (mode === MODES.SHIELDS || mode === MODES.SPEARS) this.state.stance = mode;
    this.bus.emit(EVENTS.FORMATION_CHANGED, { mode, previous, reason });
  }

  #lock(ms = FORMATION.modeChangeMs) {
    this.state.busyUntil = this.state.simTime + ms;
  }

  raiseShields() {
    this.#setMode(MODES.SHIELDS, 'command');
    this.#lock();
  }

  advanceSpears() {
    this.#setMode(MODES.SPEARS, 'command');
    this.#lock();
  }

  startPush() {
    const s = this.state;
    s.stamina = clamp(s.stamina - PUSH.staminaCost, 0, FORMATION.staminaMax);
    s.cooldowns.PUSH = s.simTime + PUSH.cooldownMs;
    s.modeEndsAt = s.simTime + PUSH.durationMs;
    this.#setMode(MODES.PUSH, 'command');
    this.#lock(PUSH.durationMs);
  }

  startRelief() {
    const s = this.state;
    s.cooldowns.RELIEF = s.simTime + RELIEF.cooldownMs;
    s.modeEndsAt = s.simTime + RELIEF.durationMs;
    this.#setMode(MODES.RELIEF, 'command');
    this.#lock(RELIEF.durationMs);
  }

  /**
   * @param {number} dtMs
   * @param {{engaged?: boolean, resting?: boolean}} ctx engaged: hay enemigos al alcance;
   *   resting: pausa entre oleadas.
   */
  tick(dtMs, { engaged = false, resting = false } = {}) {
    const s = this.state;
    const sec = dtMs / 1000;
    let drain = 0;
    switch (this.mode) {
      case MODES.SPEARS:
        drain = engaged ? SPEARS.staminaPerSec : SPEARS.idleStaminaPerSec;
        break;
      case MODES.SHIELDS:
        drain = SHIELDS.staminaPerSec;
        break;
      case MODES.EXHAUSTED:
        drain = EXHAUSTED.staminaPerSec;
        break;
      case MODES.PUSH:
        if (s.simTime >= s.modeEndsAt) this.#setMode(s.stance, 'push-end');
        break;
      case MODES.RELIEF:
        if (s.simTime >= s.modeEndsAt) {
          s.stamina = clamp(s.stamina + RELIEF.staminaGain, 0, FORMATION.staminaMax);
          this.bus.emit(EVENTS.RELIEF_DONE, { stamina: s.stamina });
          this.#setMode(s.stance, 'relief-end');
        }
        break;
      default:
        break;
    }
    if (resting) drain = Math.min(drain, -INTERMISSION.staminaPerSec);
    s.stamina = clamp(s.stamina - drain * sec, 0, FORMATION.staminaMax);
    if (s.stamina <= 0 && this.mode === MODES.SPEARS) this.#setMode(MODES.EXHAUSTED, 'stamina');
  }

  damageCohesion(amount) {
    if (amount <= 0) return;
    this.state.cohesion = clamp(this.state.cohesion - amount, 0, FORMATION.cohesionMax);
  }

  restoreCohesion(amount) {
    this.state.cohesion = clamp(this.state.cohesion + amount, 0, FORMATION.cohesionMax);
  }

  changeMorale(delta, reason) {
    const before = this.state.morale;
    this.state.morale = clamp(before + delta, 0, FORMATION.moraleMax);
    if (this.state.morale !== before) this.bus.emit(EVENTS.MORALE_UPDATED, { morale: this.state.morale, delta, reason });
  }
}
