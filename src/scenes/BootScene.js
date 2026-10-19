import Phaser from 'phaser';

/** Configura datos básicos y pasa a la carga de recursos. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    this.game.canvas.setAttribute('aria-label', 'Campo de batalla: la falange aliada a la izquierda, el enemigo entra por la derecha');
    this.game.canvas.setAttribute('role', 'img');
    this.scene.start('PreloadScene');
  }
}
