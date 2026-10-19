import Phaser from 'phaser';
import { FormationView } from '../entities/FormationView.js';
import { MODES } from '../systems/GameState.js';

/** Inicio: fondo del paso con la falange en reposo; el menú es HTML (Screens). */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.add.image(0, 0, 'bg-pass').setOrigin(0);
    const formation = new FormationView(this, { withIcon: false });
    formation.setMode(MODES.SHIELDS);
    // Polvo en suspensión, muy ligero.
    this.add.particles(0, 0, 'particles', {
      frame: 0, x: { min: 0, max: 320 }, y: { min: 110, max: 150 }, speedX: { min: -6, max: -2 },
      lifespan: 4000, alpha: { start: 0.6, end: 0 }, frequency: 400,
    });
    this.registry.get('app').enterMenu();
  }
}
