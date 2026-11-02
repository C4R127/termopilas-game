import { VIEW } from '../config/balance.js';
import { anopaeaWaves } from '../data/anopaea.js';
import { EVENTS } from '../systems/EventBus.js';
import { BattleSimulation } from '../systems/BattleSimulation.js';
import { BattleScene } from './BattleScene.js';

/**
 * Escenario histórico «La senda de Anopea» (día 3): oleadas por el paso y por
 * la retaguardia, sin el enfrentamiento con Jerjes. Reutiliza todo el dibujo
 * de BattleScene; cambia la simulación (dos frentes y media vuelta) y la vista:
 * el escenario sigue hacia el oeste y la cámara se desliza hacia el lado al que mira la falange.
 */
export class AnopaeaScene extends BattleScene {
  constructor() {
    super('AnopaeaScene');
  }

  createSimulation() {
    const difficulty = this.app.settings.get('game', 'difficulty');
    return new BattleSimulation(this.app.state, this.app.bus, {
      waves: anopaeaWaves(difficulty),
      scenario: 'anopaea',
      warningScale: this.app.warningScale,
      difficulty,
    });
  }

  backdropOptions() {
    return { west: true };
  }

  afterCreate() {
    const cam = this.cameras.main;
    cam.setBounds(-VIEW.west, 0, VIEW.west + this.scale.width, this.scale.height);
    this.offs.push(this.app.bus.on(EVENTS.FORMATION_TURNED, ({ facing }) => {
      this.tweens.killTweensOf(cam);
      const scrollX = facing === 'rear' ? -VIEW.shift : 0;
      if (this.reduceEffects) cam.scrollX = scrollX;
      else this.tweens.add({ targets: cam, scrollX, duration: VIEW.panMs, ease: 'Sine.easeInOut' });
    }));
  }
}
