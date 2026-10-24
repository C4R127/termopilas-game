// Bus de eventos mínimo y sin dependencias (las reglas no dependen de Phaser,
// así se prueban en Node). Nombres de la sección 9.2 más los propios de la beta.

export const EVENTS = Object.freeze({
  COMMAND_RECEIVED: 'COMMAND_RECEIVED',
  COMMAND_RESULT: 'COMMAND_RESULT',
  FORMATION_CHANGED: 'FORMATION_CHANGED',
  WAVE_STARTED: 'WAVE_STARTED',
  WAVE_COMPLETED: 'WAVE_COMPLETED',
  MORALE_UPDATED: 'MORALE_UPDATED',
  VOICE_STATUS: 'VOICE_STATUS',
  VOICE_HEARD: 'VOICE_HEARD',
  VOICE_ERROR: 'VOICE_ERROR',
  GAME_OVER: 'GAME_OVER',
  PAUSE_CHANGED: 'PAUSE_CHANGED',
  ENEMY_SPAWNED: 'ENEMY_SPAWNED',
  ENEMY_DIED: 'ENEMY_DIED',
  ENEMY_BREACH: 'ENEMY_BREACH',
  VOLLEY_WARNING: 'VOLLEY_WARNING',
  VOLLEY_FIRED: 'VOLLEY_FIRED',
  VOLLEY_IMPACT: 'VOLLEY_IMPACT',
  PUSH_EXECUTED: 'PUSH_EXECUTED',
  RELIEF_DONE: 'RELIEF_DONE',
  // Enfrentamiento final con Jerjes.
  BOSS_STARTED: 'BOSS_STARTED',
  BOSS_DECREE: 'BOSS_DECREE',
  DECREE_RESULT: 'DECREE_RESULT',
  BOSS_PHASE: 'BOSS_PHASE',
  BOSS_RESOLVE: 'BOSS_RESOLVE',
  BOSS_DEFEATED: 'BOSS_DEFEATED',
  STORM_ENDED: 'STORM_ENDED',
  FRENZY: 'FRENZY',
  FRENZY_QUELLED: 'FRENZY_QUELLED',
  ENEMY_RETREAT: 'ENEMY_RETREAT',
});

export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    this.listeners.get(event)?.delete(fn);
  }

  emit(event, payload) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of [...set]) fn(payload);
  }

  clear() {
    this.listeners.clear();
  }
}
