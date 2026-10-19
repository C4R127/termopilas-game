import Phaser from 'phaser';
import { LANE } from '../config/balance.js';

const ANIMS = {
  infantry: { advance: 'inf-walk', contact: 'inf-attack', aiming: 'inf-walk' },
  archer: { advance: 'arc-walk', contact: 'arc-melee', aiming: null },
};

/**
 * Sprite de un enemigo. Sigue al registro de la simulación (posición, estado,
 * vida) y se encarga de las animaciones de golpe, caída y brecha.
 */
export class EnemyUnit extends Phaser.GameObjects.Sprite {
  constructor(scene, record) {
    super(scene, record.x, LANE.rowsY[record.row], record.type, 0);
    this.record = record;
    this.lastHp = record.hp;
    this.flashUntil = 0;
    this.dying = false;
    this.releasing = false;
    this.setOrigin(0.5, 1).setFlipX(true); // los sprites miran a la derecha: el enemigo avanza hacia la izquierda
    this.setDepth(this.y * 10 + 5);
    scene.add.existing(this);
    this.play(ANIMS[record.type].advance);
  }

  sync(rec, now) {
    if (this.dying) return;
    this.x = Math.round(rec.x);
    if (rec.state === 'stunned') {
      this.anims.stop();
      this.setFrame(6);
    } else if (!this.releasing) {
      const key = ANIMS[rec.type][rec.state];
      if (key) this.anims.play(key, true);
      else if (rec.state === 'aiming') {
        this.anims.stop();
        this.setFrame(4);
      }
    }
    if (rec.hp < this.lastHp - 0.5 && now > this.flashUntil) {
      this.setTintFill(0xffffff);
      this.flashUntil = now + 160;
      this.scene.time.delayedCall(60, () => !this.dying && this.clearTint());
    }
    this.lastHp = rec.hp;
  }

  /** El arquero suelta la cuerda al disparar la descarga. */
  release() {
    if (this.dying) return;
    this.releasing = true;
    this.anims.play('arc-release');
    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => { this.releasing = false; });
  }

  die(cause) {
    this.dying = true;
    this.anims.stop();
    this.clearTint();
    if (cause === 'edge') {
      // Cae por el acantilado: cuerpo de Arcade Physics con gravedad.
      this.scene.physics.add.existing(this);
      this.body.setAllowGravity(true).setGravityY(420).setVelocity(55, -70).setAngularVelocity(260);
      this.setFrame(6);
      this.setDepth(1700);
      return;
    }
    this.setFrame(7);
    this.scene.tweens.add({ targets: this, alpha: 0, delay: 500, duration: 500, onComplete: () => this.destroy() });
  }

  /** Atraviesa la línea y se pierde en la retaguardia. */
  breach() {
    this.dying = true;
    this.setTint(0xff8a70);
    this.anims.play(this.record.type === 'archer' ? 'arc-walk' : 'inf-walk', true);
    this.setDepth(this.y * 10 + 9);
    this.scene.tweens.add({ targets: this, x: 8, alpha: 0, duration: 900, ease: 'Sine.easeIn', onComplete: () => this.destroy() });
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (this.body && this.y > 186) {
      this.scene.events.emit('enemy-splash', this.x);
      this.destroy();
    }
  }
}
