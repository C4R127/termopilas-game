import Phaser from 'phaser';
import { LANE, RELIEF } from '../config/balance.js';
import { MODES } from '../systems/GameState.js';

// Posiciones (centro del sprite) de las tres filas de la falange y de la reserva.
export const RANK_X = [86, 73, 60];
export const RESERVE_X = 40;
const OFFSCREEN_X = -14; // fuera del borde izquierdo del lienzo
const MODE_ICON = { SHIELDS: 0, SPEARS: 1, PUSH: 2, RELIEF: 3, EXHAUSTED: 4 };
const depthFor = (x, y) => y * 10 + x / 100;
// Las filas de detrás se oscurecen un 22 % para separar planos (biblia de arte, §2).
const BACK_TINT = 0xc7c7c7;

/**
 * Dibujo de la formación aliada. Lee el estado (Formation/GameState) y lo
 * traduce a animaciones; no aplica reglas de juego.
 */
export class FormationView {
  constructor(scene, { withIcon = true } = {}) {
    this.scene = scene;
    this.mode = null;
    this.engaged = false;
    this.relieving = false;
    this.rows = LANE.rowsY.map((y) => ({
      y,
      ranks: RANK_X.map((x) => this.#soldier(x, y)),
      reserve: this.#soldier(RESERVE_X, y),
    }));
    this.#depthTints();
    // Las sombras siguen a cada hoplita (también durante el relevo y la retirada).
    const sync = () => {
      for (const s of this.soldiers) {
        s.shadow.x = s.x;
        s.shadow.alpha = s.alpha;
      }
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, sync);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, sync));
    if (withIcon) {
      this.icon = scene.add.image(RANK_X[1], LANE.rowsY[0] - 30, 'icons', 1).setDepth(800);
      scene.tweens.add({ targets: this.icon, y: this.icon.y - 2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  #soldier(x, y) {
    const s = this.scene.add.sprite(x, y, 'hoplite', 0).setOrigin(0.5, 1);
    s.setDepth(depthFor(x, y));
    s.shadow = this.scene.add.image(x, y + 2, 'shadow').setOrigin(0.5, 1).setDepth(y * 10 - 2);
    s.homeX = x;
    // Pequeño desfase para que la formación no respire al unísono.
    s.anims.play({ key: 'hop-idle', startFrame: Math.floor(Math.random() * 2) });
    return s;
  }

  /** Primera fila a plena luz; segunda, tercera y reserva, más oscuras. */
  #depthTints() {
    for (const row of this.rows) {
      row.ranks.forEach((s, rank) => {
        s.baseTint = rank === 0 ? null : BACK_TINT;
      });
      row.reserve.baseTint = BACK_TINT;
    }
    for (const s of this.soldiers) this.#restoreTint(s);
  }

  #restoreTint(s) {
    if (s.baseTint) s.setTint(s.baseTint);
    else s.clearTint();
  }

  get soldiers() {
    return this.rows.flatMap((r) => [...r.ranks, r.reserve]);
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    if (this.icon) {
      this.icon.setFrame(MODE_ICON[mode]);
      this.icon.setTint(mode === MODES.EXHAUSTED ? 0xe0a030 : 0xffffff);
      this.scene.tweens.add({ targets: this.icon, scale: { from: 1.6, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    }
    if (mode === MODES.RELIEF) this.#relief();
    if (mode === MODES.PUSH) this.#lunge();
    this.#applyAnims();
  }

  /** La primera fila ataca solo cuando hay enemigos al alcance. */
  setEngaged(engaged) {
    if (this.engaged === engaged) return;
    this.engaged = engaged;
    if (this.mode === MODES.SPEARS) this.#applyAnims();
  }

  #applyAnims() {
    for (const row of this.rows) {
      row.ranks.forEach((s, rank) => {
        if (s.walking) return;
        this.#poseFor(s, rank === 0);
      });
      if (!row.reserve.walking) row.reserve.anims.play('hop-idle', true);
    }
  }

  #poseFor(s, front) {
    switch (this.mode) {
      case MODES.SHIELDS: s.anims.play('hop-shields', true); break;
      case MODES.PUSH: s.anims.play('hop-push', true); break;
      case MODES.EXHAUSTED: s.anims.play('hop-tired', true); break;
      case MODES.SPEARS:
        if (front && this.engaged) {
          s.anims.play('hop-thrust', true);
        } else {
          s.anims.stop();
          s.setFrame(4);
        }
        break;
      default: s.anims.play('hop-idle', true);
    }
  }

  #lunge() {
    const front = this.rows.flatMap((r) => r.ranks);
    this.scene.tweens.add({ targets: front, x: '+=5', duration: 120, yoyo: true, ease: 'Quad.easeOut' });
  }

  /**
   * Relevo: la reserva avanza a la primera fila mientras la primera fila cansada
   * se retira por la izquierda y sale de la pantalla; después entra un hoplita
   * de refresco que ocupa el puesto de reserva.
   */
  #relief() {
    if (this.relieving) return;
    this.relieving = true;
    const dur = RELIEF.durationMs * 0.9;
    for (const row of this.rows) {
      const tired = row.ranks[0];
      const fresh = row.reserve;
      for (const s of [tired, fresh]) {
        s.walking = true;
        s.anims.play('hop-walk', true);
      }
      tired.setFlipX(true);
      fresh.y -= 1;
      tired.y += 1;
      const depth = (s) => s.setDepth(depthFor(s.x, row.y));
      this.scene.tweens.add({ targets: fresh, x: RANK_X[0], duration: dur, ease: 'Sine.easeInOut', onUpdate: () => depth(fresh) });
      this.scene.tweens.chain({
        targets: tired,
        tweens: [
          // Retirada fuera de pantalla…
          { x: OFFSCREEN_X, duration: dur * 1.4, ease: 'Sine.easeIn', onUpdate: () => depth(tired) },
          // …y llega un hoplita de refresco desde la retaguardia.
          {
            x: RESERVE_X,
            duration: 900,
            ease: 'Sine.easeOut',
            onStart: () => tired.setFlipX(false),
            onUpdate: () => depth(tired),
            onComplete: () => {
              tired.walking = false;
              tired.y = row.y;
              depth(tired);
              if (this.mode !== 'VICTORY' && this.mode !== 'DEFEAT') tired.anims.play('hop-idle', true);
            },
          },
        ],
      });
      row.ranks[0] = fresh;
      row.reserve = tired;
    }
    this.scene.time.delayedCall(dur + 20, () => {
      this.relieving = false;
      for (const row of this.rows) {
        const s = row.ranks[0];
        s.walking = false;
        s.setFlipX(false);
        s.y = row.y;
      }
      this.#depthTints();
      this.#applyAnims();
    });
  }

  /** Final de la campaña: escudos y lanzas en alto. */
  victory() {
    this.mode = 'VICTORY';
    this.icon?.setVisible(false);
    for (const s of this.soldiers) {
      s.walking = false;
      s.anims.play({ key: 'hop-victory', startFrame: Math.floor(Math.random() * 2) }, true);
    }
  }

  /** La línea cede: los hoplitas caen de rodillas y al suelo, de delante hacia atrás. */
  defeat() {
    this.mode = 'DEFEAT';
    this.icon?.setVisible(false);
    this.rows.forEach((row) => {
      row.ranks.forEach((s, rank) => {
        s.walking = false;
        this.scene.time.delayedCall(rank * 220 + Math.random() * 150, () => s.anims.play('hop-defeat', true));
      });
      // La reserva se retira del campo y sale de la pantalla.
      const r = row.reserve;
      this.scene.tweens.killTweensOf(r);
      r.walking = true;
      r.setFlipX(true).anims.play('hop-walk', true);
      this.scene.tweens.add({ targets: r, x: OFFSCREEN_X, delay: 400 + Math.random() * 300, duration: 1600, ease: 'Sine.easeIn' });
    });
  }

  /** Destello al recibir daño (se omite con «Reducir efectos»). */
  hurt() {
    if (this.scene.reduceEffects) return;
    for (const s of this.soldiers) {
      s.setTintFill(0xd0533f);
      this.scene.time.delayedCall(90, () => this.#restoreTint(s));
    }
  }

  frontPoints() {
    return this.rows.map((r) => ({ x: RANK_X[0], y: r.y }));
  }
}
