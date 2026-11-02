import Phaser from 'phaser';
import { FLANK, LANE, RELIEF } from '../config/balance.js';
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
    this.facing = 'front'; // 'rear': la falange mira a la senda de Anopea (posiciones reflejadas)
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
      // Indicador de la formación: el icono de la orden activa sobre una placa que señala a la falange.
      this.icon = scene.add.image(RANK_X[1], LANE.rowsY[0] - 30, 'icons', 1).setDepth(800);
      this.plate = scene.add.image(this.icon.x, this.icon.y + 2, 'icon-plate').setDepth(799);
      scene.tweens.add({ targets: [this.icon, this.plate], y: '-=2', duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
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

  /** Posición en pantalla de un puesto de la formación según hacia dónde mira. */
  #x(x) {
    return this.facing === 'rear' ? LANE.rearMirror - x : x;
  }

  get rear() {
    return this.facing === 'rear';
  }

  /** Centro de la formación (avisos flotantes y objetivo de las flechas). */
  get midX() {
    return this.#x(RANK_X[1]);
  }

  /**
   * Media vuelta: cada hoplita gira sobre sí mismo y la formación se recoloca
   * con el menor desplazamiento posible. La antigua reserva queda en primera
   * fila frente al nuevo enemigo y la antigua primera fila pasa a ser la reserva.
   */
  setFacing(facing) {
    if (this.facing === facing) return;
    this.facing = facing;
    const dur = FLANK.turnMs * 0.9;
    for (const row of this.rows) {
      const [first, second, third] = row.ranks;
      row.ranks = [row.reserve, third, second];
      row.reserve = first;
      const slots = [...row.ranks.map((s, i) => [s, RANK_X[i]]), [row.reserve, RESERVE_X]];
      for (const [s, x] of slots) {
        this.scene.tweens.killTweensOf(s);
        s.setFlipX(this.rear);
        s.walking = true;
        s.anims.play('hop-walk', true);
        this.scene.tweens.add({
          targets: s,
          x: this.#x(x),
          duration: dur,
          ease: 'Sine.easeInOut',
          onUpdate: () => s.setDepth(depthFor(s.x, row.y)),
          onComplete: () => { s.walking = false; },
        });
      }
    }
    if (this.icon) this.scene.tweens.add({ targets: [this.icon, this.plate], x: this.midX, duration: dur, ease: 'Sine.easeInOut' });
    this.scene.time.delayedCall(dur + 20, () => {
      this.#depthTints();
      this.#applyAnims();
    });
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
        this.#poseFor(s, rank);
      });
      if (!row.reserve.walking) row.reserve.anims.play('hop-idle', true);
    }
  }

  /** rank: 0 primera fila, 1 segunda, 2 tercera. */
  #poseFor(s, rank) {
    switch (this.mode) {
      case MODES.SHIELDS: s.anims.play('hop-shields', true); break;
      case MODES.PUSH: s.anims.play('hop-push', true); break;
      case MODES.EXHAUSTED: s.anims.play('hop-tired', true); break;
      case MODES.SPEARS:
        // La primera fila y la segunda (por encima del hombro) clavan las lanzas; la tercera espera.
        if (rank <= 1 && this.engaged) {
          s.anims.play({ key: 'hop-thrust', startFrame: rank }, true);
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
    this.scene.tweens.add({ targets: front, x: this.rear ? '-=5' : '+=5', duration: 120, yoyo: true, ease: 'Quad.easeOut' });
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
      tired.setFlipX(!this.rear); // se retira dando la espalda al enemigo
      fresh.y -= 1;
      tired.y += 1;
      const depth = (s) => s.setDepth(depthFor(s.x, row.y));
      this.scene.tweens.add({ targets: fresh, x: this.#x(RANK_X[0]), duration: dur, ease: 'Sine.easeInOut', onUpdate: () => depth(fresh) });
      const settle = () => {
        tired.walking = false;
        tired.y = row.y;
        depth(tired);
        if (this.mode !== 'VICTORY' && this.mode !== 'DEFEAT') tired.anims.play('hop-idle', true);
      };
      if (this.rear) {
        // Mirando a la senda, detrás de la línea está el paso: el cansado va directo a la reserva.
        this.scene.tweens.add({
          targets: tired,
          x: this.#x(RESERVE_X),
          duration: dur * 1.2,
          ease: 'Sine.easeInOut',
          onUpdate: () => depth(tired),
          onComplete: () => {
            tired.setFlipX(true);
            settle();
          },
        });
      } else {
        this.scene.tweens.chain({
          targets: tired,
          tweens: [
            // Retirada fuera de pantalla…
            { x: OFFSCREEN_X, duration: dur * 1.4, ease: 'Sine.easeIn', onUpdate: () => depth(tired) },
            // …y llega un hoplita de refresco desde la retaguardia.
            { x: RESERVE_X, duration: 900, ease: 'Sine.easeOut', onStart: () => tired.setFlipX(false), onUpdate: () => depth(tired), onComplete: settle },
          ],
        });
      }
      row.ranks[0] = fresh;
      row.reserve = tired;
    }
    this.scene.time.delayedCall(dur + 20, () => {
      this.relieving = false;
      for (const row of this.rows) {
        const s = row.ranks[0];
        s.walking = false;
        s.setFlipX(this.rear);
        s.y = row.y;
      }
      this.#depthTints();
      this.#applyAnims();
    });
  }

  /** Choque en una fila: el hoplita de primera fila cede un píxel y vuelve a su sitio. */
  jolt(rowIndex) {
    const s = this.rows[rowIndex]?.ranks[0];
    if (!s || s.walking || this.relieving || this.scene.reduceEffects || this.scene.tweens.isTweening(s)) return;
    this.scene.tweens.add({ targets: s, x: s.x - (this.rear ? -1 : 1), duration: 70, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** Oleada superada: lanzas en alto un momento y vuelta a la postura. */
  cheer() {
    if (this.mode === 'VICTORY' || this.mode === 'DEFEAT') return;
    for (const s of this.soldiers) {
      if (!s.walking) s.anims.play({ key: 'hop-victory', startFrame: Math.floor(Math.random() * 2) }, true);
    }
    this.scene.time.delayedCall(1500, () => {
      if (this.mode !== 'VICTORY' && this.mode !== 'DEFEAT') this.#applyAnims();
    });
  }

  /** Final de la campaña: escudos y lanzas en alto. */
  victory() {
    this.mode = 'VICTORY';
    this.icon?.setVisible(false);
    this.plate?.setVisible(false);
    for (const s of this.soldiers) {
      s.walking = false;
      s.anims.play({ key: 'hop-victory', startFrame: Math.floor(Math.random() * 2) }, true);
    }
  }

  /** La línea cede: los hoplitas caen de rodillas y al suelo, de delante hacia atrás. */
  defeat() {
    this.mode = 'DEFEAT';
    this.icon?.setVisible(false);
    this.plate?.setVisible(false);
    this.rows.forEach((row) => {
      row.ranks.forEach((s, rank) => {
        s.walking = false;
        this.scene.time.delayedCall(rank * 220 + Math.random() * 150, () => s.anims.play('hop-defeat', true));
      });
      // La reserva se retira del campo y sale de la pantalla.
      const r = row.reserve;
      this.scene.tweens.killTweensOf(r);
      r.walking = true;
      r.setFlipX(!this.rear).anims.play('hop-walk', true);
      this.scene.tweens.add({ targets: r, x: this.rear ? 340 : OFFSCREEN_X, delay: 400 + Math.random() * 300, duration: 1600, ease: 'Sine.easeIn' });
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
    return this.rows.map((r) => ({ x: this.#x(RANK_X[0]), y: r.y, dir: this.rear ? -1 : 1 }));
  }
}
