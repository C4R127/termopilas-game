import Phaser from 'phaser';
import { FormationView } from '../entities/FormationView.js';
import { MODES } from '../systems/GameState.js';
import { createBackdrop } from './backdrop.js';
import { resolveLight } from './lighting.js';

/**
 * Inicio: el paso con la falange en reposo; el menú es HTML (Screens).
 * La escena se congela tras el primer fotograma y el lienzo se oscurece (CSS),
 * para que la batalla «despierte» al empezar.
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const app = this.registry.get('app');
    this.reduceEffects = app.settings.get('access', 'reduceEffects');
    this.app = app;
    ({ lighting: this.lighting } = createBackdrop(this, { light: resolveLight(app.settings.get('game', 'lighting'), 'MenuScene') }));
    const formation = new FormationView(this, { withIcon: false });
    formation.setMode(MODES.SHIELDS);
    app.enterMenu();
    // Una vez dibujado el primer fotograma, la escena se pausa: el fondo queda quieto.
    this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
      if (this.sys.isActive()) this.scene.pause();
    });
  }

  /** Vista previa del ajuste «Iluminación» desde el menú (al instante: la escena está en pausa). */
  applyLighting() {
    this.lighting.set(resolveLight(this.app.settings.get('game', 'lighting'), 'MenuScene'), 0);
  }
}
