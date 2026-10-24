import { EventMarker } from './EventMarker.js';
import { floatText } from '../scenes/pixelText.js';

const X = 298; // al fondo del paso, a la derecha
const Y = 120; // el estrado apoya en el borde superior del camino
const FRAMES = { seated: 0, seatedDecree: 1, standing: 2, standingDecree: 3, turned: 4 };
const DECREE_ICON = { storm: 4, whips: 11, guard: 7 };

/**
 * Jerjes en su trono. Solo dibuja: los decretos, las fases y la retirada los
 * decide BossDirector y llegan como eventos.
 */
export class XerxesView {
  constructor(scene) {
    this.scene = scene;
    this.standing = false;
    this.sprite = scene.add.sprite(X + 50, Y, 'xerxes', FRAMES.seated).setOrigin(0.5, 1).setFlipX(true).setDepth(1150);
    // Llega por la derecha y se instala al fondo del paso.
    scene.tweens.add({ targets: this.sprite, x: X, duration: 1800, ease: 'Sine.easeOut' });
    this.crown = scene.add.image(X, Y - 54, 'icons', 10).setDepth(1160).setAlpha(0);
    scene.tweens.add({ targets: this.crown, alpha: 1, delay: 1800, duration: 400 });
  }

  #idleFrame() {
    return this.standing ? FRAMES.standing : FRAMES.seated;
  }

  decree({ ids, names, warningMs }) {
    if (!this.sprite.active) return;
    this.sprite.setFrame(this.standing ? FRAMES.standingDecree : FRAMES.seatedDecree);
    floatText(this.scene, X - 10, Y - 58, names.join(' + '), 0xffd36b);
    ids.forEach((id, i) => {
      // Señal previa sobre el trono: el icono del decreto parpadea hasta que se cumple.
      const anchor = { x: X - 8 + i * 14, y: Y - 40, active: true };
      new EventMarker(this.scene, anchor, { icon: DECREE_ICON[id] ?? 4, durationMs: warningMs, offsetY: 0, blink: !this.scene.reduceEffects });
    });
    this.scene.time.delayedCall(warningMs, () => this.sprite.active && this.sprite.setFrame(this.#idleFrame()));
  }

  /** Al cruzar un umbral, el rey se levanta del trono (Heródoto, VII). */
  rise() {
    this.standing = true;
    this.sprite.setFrame(FRAMES.standing);
    floatText(this.scene, X - 10, Y - 60, '¡Jerjes se levanta!', 0xff8a70);
    if (!this.scene.reduceEffects) this.scene.tweens.add({ targets: this.sprite, y: Y - 2, duration: 120, yoyo: true });
  }

  /** Ordena la retirada: da la espalda al paso y se marcha. */
  retreat() {
    this.sprite.setFrame(FRAMES.turned);
    this.scene.tweens.add({ targets: [this.sprite, this.crown], x: '+=70', alpha: 0, delay: 600, duration: 1600, ease: 'Sine.easeIn' });
  }
}
