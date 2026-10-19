// Juega partidas sin interfaz con varios estilos para revisar el balance de la beta.
import { playGame } from './bot.js';

for (const strategy of ['attentive', 'reckless', 'turtle', 'idle']) {
  for (const reactionMs of strategy === 'attentive' ? [400, 900, 1400] : [600]) {
    const { result, state } = playGame(strategy, { reactionMs });
    const r = result ?? { victory: false, reason: 'timeout' };
    console.log(
      `${strategy.padEnd(9)} reacción ${String(reactionMs).padStart(4)} ms → ${r.victory ? 'VICTORIA' : 'derrota '} (${r.reason})`,
      `t=${(state.simTime / 1000).toFixed(0)}s oleadas=${r.wavesCleared ?? state.waveIndex}`,
      `cohesión=${state.cohesion.toFixed(0)} resist=${state.stamina.toFixed(0)} moral=${state.morale.toFixed(0)}`,
      `bajas=${state.stats.kills} (mar ${state.stats.edgeKills}) brechas=${state.breaches}`,
      `flechas bloq/recib=${state.stats.volleysBlocked}/${state.stats.volleysTaken}`,
    );
  }
}
