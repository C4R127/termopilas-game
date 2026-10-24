import Phaser from 'phaser';

/**
 * Señal visual previa a un evento (p. ej. arqueros a punto de disparar):
 * icono parpadeante sobre la unidad que dura hasta que el evento ocurre.
 */
export class EventMarker extends Phaser.GameObjects.Image {
  constructor(scene, target, { icon = 4, durationMs = 1500, offsetY = -26, blink = true } = {}) {
    super(scene, target.x, target.y + offsetY, 'icons', icon);
    this.target = target;
    this.offsetY = offsetY;
    this.setDepth(1800);
    scene.add.existing(this);
    this.addToUpdateList(); // las imágenes no reciben preUpdate por defecto
    // Parpadeo como señal previa; sin él (Reducir efectos) el icono queda fijo.
    if (blink) scene.tweens.add({ targets: this, alpha: { from: 1, to: 0.35 }, duration: 180, yoyo: true, repeat: -1 });
    this.timer = scene.time.delayedCall(durationMs, () => this.destroy());
  }

  destroy(fromScene) {
    if (this.scene) {
      this.scene.tweens.killTweensOf(this);
      this.timer?.remove();
    }
    super.destroy(fromScene);
  }

  preUpdate() {
    if (this.target.active === false) {
      this.destroy();
      return;
    }
    this.x = this.target.x;
    this.y = this.target.y + this.offsetY;
  }
}
