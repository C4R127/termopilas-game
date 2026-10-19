import { INTERMISSION } from '../config/balance.js';
import { EVENTS } from './EventBus.js';

export const FIRST_WAVE_DELAY_MS = 2500;

/**
 * Selecciona la oleada, decide cuándo aparece cada enemigo y gestiona las
 * pausas entre oleadas. No crea objetos gráficos: devuelve peticiones de
 * aparición que la simulación convierte en entidades.
 *
 * Fases: intermission → spawning → clearing → (intermission | done)
 */
export class WaveManager {
  constructor(waves, state, bus) {
    this.waves = waves;
    this.state = state;
    this.bus = bus;
    this.phase = 'idle';
    this.timer = 0;
    this.elapsed = 0;
    this.progress = [];
  }

  get total() {
    return this.waves.length;
  }

  get current() {
    return this.waves[this.state.waveIndex] ?? null;
  }

  get resting() {
    return this.phase === 'intermission';
  }

  get timeToNextWave() {
    return this.phase === 'intermission' ? Math.max(0, this.timer) : 0;
  }

  /** Total de enemigos de la oleada actual y cuántos han aparecido. */
  get spawnProgress() {
    const wave = this.current;
    if (!wave) return { spawned: 0, total: 0 };
    const total = wave.groups.reduce((n, g) => n + g.count, 0);
    const spawned = this.progress.reduce((n, p) => n + p, 0);
    return { spawned, total };
  }

  start() {
    this.state.waveIndex = 0;
    if (this.waves.length === 0) {
      this.phase = 'idle'; // sin oleadas (pruebas): no aparece nadie y no termina sola
      return;
    }
    this.phase = 'intermission';
    this.timer = FIRST_WAVE_DELAY_MS;
  }

  /** @returns {{type: string, row: number}[]} enemigos que deben aparecer en este paso */
  update(dtMs) {
    const spawns = [];
    if (this.phase === 'intermission') {
      this.timer -= dtMs;
      if (this.timer <= 0) this.#beginWave();
      return spawns;
    }
    if (this.phase !== 'spawning') return spawns;

    this.elapsed += dtMs;
    const wave = this.current;
    let pending = false;
    wave.groups.forEach((group, i) => {
      while (this.progress[i] < group.count && this.elapsed >= group.delayMs + this.progress[i] * group.intervalMs) {
        const rows = group.rows ?? [1];
        spawns.push({ type: group.type, row: rows[this.progress[i] % rows.length] });
        this.progress[i]++;
      }
      if (this.progress[i] < group.count) pending = true;
    });
    if (!pending) this.phase = 'clearing';
    return spawns;
  }

  /** La oleada se completa cuando todo ha aparecido y no queda ningún enemigo activo. */
  isCleared(activeEnemies) {
    return this.phase === 'clearing' && activeEnemies === 0;
  }

  /** Avanza a la siguiente oleada. Devuelve true si la campaña ha terminado. */
  completeWave() {
    if (this.state.waveIndex >= this.waves.length - 1) {
      this.phase = 'done';
      return true;
    }
    this.state.waveIndex++;
    this.phase = 'intermission';
    this.timer = INTERMISSION.durationMs;
    return false;
  }

  #beginWave() {
    this.phase = 'spawning';
    this.elapsed = 0;
    this.progress = this.current.groups.map(() => 0);
    this.bus.emit(EVENTS.WAVE_STARTED, { index: this.state.waveIndex, wave: this.current, total: this.total });
  }
}
