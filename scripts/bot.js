// Jugadores automáticos para validar el balance sin interfaz (pruebas y `npm run simulate`).
import { LANE, PUSH } from '../src/config/balance.js';
import { BattleSimulation } from '../src/systems/BattleSimulation.js';
import { EventBus, EVENTS } from '../src/systems/EventBus.js';
import { GameState } from '../src/systems/GameState.js';

const STRATEGIES = {
  /** Lee los avisos: escudos ante flechas, lanzas el resto, relevo y empuje cuando conviene. */
  attentive(sim, ctx) {
    const s = sim.state;
    const send = (id) => sim.bus.emit(EVENTS.COMMAND_RECEIVED, { id, source: 'keyboard' });
    if (sim.formation.busy || s.pending) return;
    const threat = ctx.warningUntil > s.simTime;
    if (threat) {
      if (s.formationMode !== 'SHIELDS') send('SHIELDS');
      return;
    }
    const close = sim.enemies.filter((e) => e.x <= LANE.frontX + PUSH.range);
    const edge = close.filter((e) => e.row === LANE.edgeRow).length;
    if (s.stamina < 22 && s.cooldowns.RELIEF <= s.simTime) return send('RELIEF');
    if ((edge >= 1 && close.length >= 2) && s.cooldowns.PUSH <= s.simTime && s.stamina >= 30) return send('PUSH');
    if (s.formationMode !== 'SPEARS' && s.stamina >= 12) send('SPEARS');
    else if (s.formationMode === 'EXHAUSTED') send('SHIELDS');
  },
  /** No da ninguna orden: debe perder. */
  idle() {},
  /** Mantiene los escudos siempre: tampoco debe bastar. */
  turtle(sim) {
    if (sim.state.formationMode !== 'SHIELDS' && !sim.formation.busy) sim.bus.emit(EVENTS.COMMAND_RECEIVED, { id: 'SHIELDS', source: 'keyboard' });
  },
  /** Ataca siempre e ignora los avisos de flechas. */
  reckless(sim) {
    const s = sim.state;
    if (sim.formation.busy) return;
    if (s.stamina < 22 && s.cooldowns.RELIEF <= s.simTime) sim.bus.emit(EVENTS.COMMAND_RECEIVED, { id: 'RELIEF', source: 'keyboard' });
    else if (s.formationMode !== 'SPEARS' && s.stamina >= 12) sim.bus.emit(EVENTS.COMMAND_RECEIVED, { id: 'SPEARS', source: 'keyboard' });
  },
};

/**
 * Juega una partida completa con la estrategia indicada.
 * @param {keyof STRATEGIES} strategy
 * @param {{reactionMs?: number, maxMs?: number}} opts reactionMs simula el retraso humano/voz
 */
export function playGame(strategy = 'attentive', { reactionMs = 600, maxMs = 6 * 60 * 1000 } = {}) {
  const bus = new EventBus();
  const state = new GameState();
  const sim = new BattleSimulation(state, bus);
  const ctx = { warningUntil: 0 };
  const log = [];
  let over = null;
  bus.on(EVENTS.VOLLEY_WARNING, (e) => {
    // El jugador ve el aviso con retraso y mantiene la defensa hasta el impacto.
    ctx.warningUntil = Infinity;
    ctx.pendingWarning = state.simTime + reactionMs;
    ctx.fireAt = e.fireAt;
  });
  bus.on(EVENTS.VOLLEY_IMPACT, (e) => {
    ctx.warningUntil = 0;
    log.push({ t: state.simTime, ev: 'volley', blocked: e.blocked });
  });
  bus.on(EVENTS.WAVE_COMPLETED, (e) => log.push({ t: state.simTime, ev: 'wave', index: e.index, cohesion: state.cohesion }));
  bus.on(EVENTS.GAME_OVER, (e) => { over = e; });
  sim.start();
  const dt = 1000 / 60;
  let lastDecision = 0;
  while (!over && state.simTime < maxMs) {
    // Antes de reaccionar al aviso el jugador aún no lo ha visto.
    const visible = { warningUntil: ctx.pendingWarning && state.simTime < ctx.pendingWarning ? 0 : ctx.warningUntil };
    if (state.simTime - lastDecision >= 100) {
      STRATEGIES[strategy](sim, visible);
      lastDecision = state.simTime;
    }
    sim.update(dt);
  }
  sim.destroy();
  return { result: over, state, log };
}
