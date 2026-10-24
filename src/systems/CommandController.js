import { PUSH, SPEARS } from '../config/balance.js';
import { COMMAND_IDS as C, getCommand } from '../data/commands.js';
import { EVENTS } from './EventBus.js';
import { MODES } from './GameState.js';

const CONFIRM = {
  SHIELDS: 'Orden recibida: ESCUDOS',
  SPEARS: 'Orden recibida: LANZAS',
  PUSH: 'Orden recibida: EMPUJEN',
  RELIEF: 'Relevo en proceso',
  PAUSE: 'Partida pausada',
  RESUME: 'Partida reanudada',
};

const seconds = (ms) => Math.ceil(ms / 1000);

/**
 * Recibe intenciones ya interpretadas (voz, teclado o botón) y decide si se
 * ejecutan. Ninguna orden llega directamente a los objetos gráficos: primero
 * se valida la partida, la pausa, el enfriamiento y el estado de la formación.
 */
export class CommandController {
  constructor(state, formation, bus) {
    this.state = state;
    this.formation = formation;
    this.bus = bus;
    this.unsubscribe = bus.on(EVENTS.COMMAND_RECEIVED, (cmd) => this.handle(cmd));
  }

  destroy() {
    this.unsubscribe();
  }

  /** @param {{id: string, source?: 'voice'|'keyboard'|'button', transcript?: string}} cmd */
  handle(cmd) {
    const def = getCommand(cmd.id);
    const s = this.state;
    if (!def) return this.#finish(cmd, 'rejected', 'Orden desconocida');
    if (s.phase !== 'playing') return this.#finish(cmd, 'rejected', 'La partida no está activa');

    if (def.id === C.PAUSE) {
      if (s.isPaused) return this.#finish(cmd, 'rejected', 'La partida ya está en pausa');
      this.#setPaused(true);
      return this.#finish(cmd, 'executed', CONFIRM.PAUSE);
    }
    if (def.id === C.RESUME) {
      if (!s.isPaused) return this.#finish(cmd, 'rejected', '«Continuar» solo funciona con la partida en pausa');
      this.#setPaused(false);
      return this.#finish(cmd, 'executed', CONFIRM.RESUME);
    }

    if (s.isPaused) return this.#finish(cmd, 'rejected', 'Partida en pausa: di «continuar» o pulsa Esc');
    if (this.formation.busy && s.pending && def.id === s.formationMode) {
      // Repetir la postura actual durante la transición anula la orden en espera.
      s.pending = null;
      return this.#finish(cmd, 'cancelled', `Se mantiene ${def.label.toUpperCase()}: orden en espera anulada`);
    }
    const check = this.validate(def.id);
    if (!check.ok) return this.#finish(cmd, 'rejected', check.reason);

    if (this.formation.busy) {
      // Durante una transición se guarda una sola orden; la nueva sustituye a la anterior.
      const replaced = s.pending ? getCommand(s.pending.id).label : null;
      s.pending = { id: def.id, source: cmd.source ?? 'button' };
      const msg = `En espera: ${def.label.toUpperCase()}` + (replaced && replaced !== def.label ? ` (sustituye a ${replaced.toUpperCase()})` : '');
      return this.#finish(cmd, 'pending', msg);
    }
    return this.#execute(cmd, def);
  }

  /** Reglas de disponibilidad de cada orden táctica. */
  validate(id) {
    const s = this.state;
    const mode = s.formationMode;
    switch (id) {
      case C.SHIELDS:
        if (mode === MODES.SHIELDS) return { ok: false, reason: 'Los escudos ya están en alto' };
        return { ok: true };
      case C.SPEARS:
        if (mode === MODES.SPEARS) return { ok: false, reason: 'Las lanzas ya están adelantadas' };
        if (s.stamina < SPEARS.minStamina) return { ok: false, reason: 'Resistencia insuficiente para las lanzas: ordena RELEVO' };
        return { ok: true };
      case C.PUSH: {
        const wait = s.cooldowns.PUSH - s.simTime;
        if (wait > 0) return { ok: false, reason: `Empuje en enfriamiento (${seconds(wait)} s)` };
        if (mode === MODES.EXHAUSTED) return { ok: false, reason: 'Formación agotada: no puede empujar' };
        if (s.stamina < PUSH.staminaCost) return { ok: false, reason: 'Resistencia insuficiente para empujar' };
        return { ok: true };
      }
      case C.RELIEF: {
        if (mode === MODES.RELIEF) return { ok: false, reason: 'Relevo en proceso' };
        const wait = s.cooldowns.RELIEF - s.simTime;
        if (wait > 0) return { ok: false, reason: `Relevo no disponible (${seconds(wait)} s)` };
        return { ok: true };
      }
      default:
        return { ok: false, reason: 'Orden desconocida' };
    }
  }

  /** Ejecuta la orden en espera cuando termina la transición. */
  flushPending() {
    const s = this.state;
    if (!s.pending || this.formation.busy || s.isPaused) return;
    const pending = s.pending;
    s.pending = null;
    const def = getCommand(pending.id);
    const check = this.validate(def.id);
    if (!check.ok) {
      this.#finish(pending, 'rejected', check.reason);
      return;
    }
    this.#execute(pending, def);
  }

  #execute(cmd, def) {
    switch (def.id) {
      case C.SHIELDS: this.formation.raiseShields(); break;
      case C.SPEARS: this.formation.advanceSpears(); break;
      case C.PUSH: this.formation.startPush(); break;
      case C.RELIEF: this.formation.startRelief(); break;
      default: break;
    }
    return this.#finish(cmd, 'executed', CONFIRM[def.id]);
  }

  #setPaused(paused) {
    this.state.isPaused = paused;
    this.bus.emit(EVENTS.PAUSE_CHANGED, { paused });
  }

  #finish(cmd, status, message) {
    const def = getCommand(cmd.id);
    const source = cmd.source ?? 'button';
    const result = {
      id: cmd.id,
      label: def?.label ?? cmd.id,
      source,
      transcript: cmd.transcript ?? null,
      status,
      accepted: status !== 'rejected',
      message,
    };
    this.state.lastCommand = result;
    if (status === 'executed' && def?.tactical) this.state.stats.commands[source] = (this.state.stats.commands[source] ?? 0) + 1;
    if (status === 'rejected') this.state.stats.rejected++;
    this.bus.emit(EVENTS.COMMAND_RESULT, result);
    return result;
  }
}
