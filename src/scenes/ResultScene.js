import Phaser from 'phaser';
import { FormationView } from '../entities/FormationView.js';
import { createBackdrop } from './backdrop.js';

/** Fondo de la pantalla de resultado; las estadísticas y botones son HTML (Screens). */
export class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  create(result) {
    this.reduceEffects = this.registry.get('app').settings.get('access', 'reduceEffects');
    createBackdrop(this, { calm: !result?.victory });
    const formation = new FormationView(this, { withIcon: false });
    if (result?.victory) formation.victory();
    else formation.defeat();
    this.cameras.main.fadeIn(400, 23, 18, 14);
  }
}
