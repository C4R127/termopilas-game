import { ANOPAEA } from '../data/anopaea.js';
import { BattleSimulation } from '../systems/BattleSimulation.js';
import { BattleScene } from './BattleScene.js';

/**
 * Escenario histórico «La senda de Anopea» (día 3): oleadas por el paso y por
 * la retaguardia, sin el enfrentamiento con Jerjes. Reutiliza todo el dibujo
 * de BattleScene; solo cambia la simulación (dos frentes y media vuelta).
 */
export class AnopaeaScene extends BattleScene {
  constructor() {
    super('AnopaeaScene');
  }

  createSimulation() {
    return new BattleSimulation(this.app.state, this.app.bus, {
      waves: ANOPAEA.waves,
      scenario: 'anopaea',
      warningScale: this.app.warningScale,
      difficulty: this.app.settings.get('game', 'difficulty'),
    });
  }
}
