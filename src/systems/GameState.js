import { FORMATION } from '../config/balance.js';

export const MODES = Object.freeze({
  SHIELDS: 'SHIELDS',
  SPEARS: 'SPEARS',
  PUSH: 'PUSH',
  RELIEF: 'RELIEF',
  EXHAUSTED: 'EXHAUSTED',
});

export const MODE_LABELS = {
  SHIELDS: 'Defensa con escudos',
  SPEARS: 'Lanzas',
  PUSH: 'Empuje',
  RELIEF: 'Relevo en proceso',
  EXHAUSTED: 'Agotada',
};

/**
 * Estado global de la partida (sección 9.1). Solo datos: las reglas viven en
 * Formation, CommandController, WaveManager y BattleSimulation.
 */
export class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.currentScene = 'MenuScene';
    this.phase = 'idle'; // idle | playing | over
    this.formationMode = MODES.SPEARS;
    this.stance = MODES.SPEARS; // postura estable a la que se vuelve tras empuje o relevo
    this.cohesion = FORMATION.cohesionMax;
    this.stamina = FORMATION.staminaMax;
    this.morale = FORMATION.moraleStart;
    this.waveIndex = 0;
    this.activeEnemies = 0;
    this.voiceEnabled = this.voiceEnabled ?? false; // preferencia del usuario: sobrevive al reinicio
    this.lastCommand = null;
    this.isPaused = false;
    this.simTime = 0; // reloj de simulación: se congela durante la pausa
    this.busyUntil = 0; // fin del bloqueo por transición de estado
    this.pending = null; // única orden en espera durante una transición
    this.modeEndsAt = 0; // fin de empuje o relevo
    this.cooldowns = { PUSH: 0, RELIEF: 0 }; // simTime en que vuelven a estar disponibles
    this.breaches = 0;
    this.result = null; // { victory, reason }
    this.stats = {
      kills: 0,
      edgeKills: 0,
      volleysBlocked: 0,
      volleysTaken: 0,
      commands: { voice: 0, keyboard: 0, button: 0 },
      rejected: 0,
    };
    return this;
  }

  get exhausted() {
    return this.formationMode === MODES.EXHAUSTED;
  }

  /** Copia de solo lectura para el HUD y las pruebas. */
  snapshot() {
    return {
      formationMode: this.formationMode,
      cohesion: this.cohesion,
      stamina: this.stamina,
      morale: this.morale,
      waveIndex: this.waveIndex,
      activeEnemies: this.activeEnemies,
      voiceEnabled: this.voiceEnabled,
      lastCommand: this.lastCommand,
      isPaused: this.isPaused,
      breaches: this.breaches,
      simTime: this.simTime,
      pushReadyIn: Math.max(0, this.cooldowns.PUSH - this.simTime),
      reliefReadyIn: Math.max(0, this.cooldowns.RELIEF - this.simTime),
      pending: this.pending,
    };
  }
}
