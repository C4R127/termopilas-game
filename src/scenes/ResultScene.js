import Phaser from 'phaser';
import { FormationView } from '../entities/FormationView.js';
import { MODES } from '../systems/GameState.js';

/** Fondo de la pantalla de resultado; las estadísticas y botones son HTML (Screens). */
export class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  create(result) {
    this.add.image(0, 0, 'bg-pass').setOrigin(0);
    const formation = new FormationView(this, { withIcon: false });
    formation.setMode(result?.victory ? MODES.SPEARS : MODES.EXHAUSTED);
    this.cameras.main.fadeIn(400, 23, 18, 14);
  }
}
