import { LEONIDAS, LOW_COHESION } from '../data/leonidas.js';
import { EVENTS } from './EventBus.js';

/**
 * Decide qué dice Leónidas durante la campaña a partir de los eventos del
 * juego. Cada aviso de situación (cohesión baja, brecha, agotamiento) se da
 * como mucho una vez por oleada para no saturar al jugador.
 */
export class CommanderMessages {
  /**
   * @param {import('./EventBus.js').EventBus} bus
   * @param {import('./GameState.js').GameState} state
   * @param {(msg: {id: string, text: string}) => void} onMessage
   */
  constructor(bus, state, onMessage) {
    this.state = state;
    this.onMessage = onMessage;
    this.said = new Set(); // avisos ya dados en la oleada actual
    this.offs = [
      bus.on(EVENTS.WAVE_STARTED, ({ index, wave }) => {
        this.said.clear();
        this.#say(`wave-${index}`, wave.hint);
      }),
      bus.on(EVENTS.WAVE_COMPLETED, ({ index, last }) => {
        this.said.clear();
        // Tras la última oleada habla del enfrentamiento con Jerjes (BOSS_STARTED).
        if (!last && LEONIDAS.waveCleared[index]) this.#say(`cleared-${index}`, LEONIDAS.waveCleared[index]);
      }),
      bus.on(EVENTS.ENEMY_BREACH, () => this.#once('breach', LEONIDAS.breach)),
      bus.on(EVENTS.FORMATION_CHANGED, ({ reason }) => {
        if (reason === 'stamina') this.#once('exhausted', LEONIDAS.exhausted);
      }),
      bus.on(EVENTS.GAME_OVER, ({ victory, reason }) => {
        if (!victory) this.#say('defeat', LEONIDAS.defeat);
        else this.#say('victory', reason === 'xerxes' ? LEONIDAS.victoryXerxes : LEONIDAS.victory);
      }),
      bus.on(EVENTS.BOSS_STARTED, () => this.#say('boss', LEONIDAS.bossIntro)),
      bus.on(EVENTS.BOSS_DECREE, ({ ids }) => this.#say(`decree-${ids.join('+')}`, ids.map((id) => LEONIDAS.decrees[id]).join(' '))),
      bus.on(EVENTS.BOSS_PHASE, ({ phase }) => {
        this.said.clear(); // en cada fase del enfrentamiento los avisos vuelven a estar disponibles
        this.#say(`phase-${phase}`, LEONIDAS.bossPhase);
      }),
    ];
  }

  /** Parte de Leónidas al empezar la campaña. */
  start() {
    this.#say('intro', LEONIDAS.intro);
  }

  /** Comprobaciones periódicas del estado (las llama HUDScene). */
  check() {
    const s = this.state;
    if (s.phase === 'playing' && s.cohesion > 0 && s.cohesion < LOW_COHESION) this.#once('low-cohesion', LEONIDAS.lowCohesion);
  }

  destroy() {
    this.offs.forEach((off) => off());
  }

  #once(id, text) {
    if (this.said.has(id)) return;
    this.said.add(id);
    this.#say(id, text);
  }

  #say(id, text) {
    this.onMessage({ id, text });
  }
}
