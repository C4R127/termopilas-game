import { BattleSimulation } from '../systems/BattleSimulation.js';
import { TutorialDirector } from '../systems/TutorialDirector.js';
import { BattleScene } from './BattleScene.js';

/**
 * Enseña las órdenes con situaciones controladas y mensajes en pantalla.
 * Reutiliza el dibujo de BattleScene con una simulación sin oleadas en la que
 * la línea nunca cede del todo; TutorialDirector prepara cada paso.
 */
export class TutorialScene extends BattleScene {
  constructor() {
    super('TutorialScene');
  }

  createSimulation() {
    return new BattleSimulation(this.app.state, this.app.bus, {
      waves: [],
      noDefeat: true,
      volley: { warningMs: 3500, intervalMs: 9000 },
      warningScale: this.app.warningScale,
    });
  }

  afterCreate() {
    this.director = new TutorialDirector(this.sim, this.app.bus);
    this.app.tutorial = this.director;
    this.events.once('shutdown', () => {
      this.director.destroy();
      if (this.app.tutorial === this.director) this.app.tutorial = null;
    });
    this.director.start();
  }

  afterUpdate() {
    if (!this.app.state.isPaused) this.director.update();
  }
}
