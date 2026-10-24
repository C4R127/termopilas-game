import Phaser from 'phaser';
import { LANE, SPEARS } from '../config/balance.js';
import { EnemyUnit } from '../entities/EnemyUnit.js';
import { EventMarker } from '../entities/EventMarker.js';
import { FormationView, RANK_X } from '../entities/FormationView.js';
import { XerxesView } from '../entities/XerxesView.js';
import { XERXES } from '../data/boss.js';
import { BattleSimulation } from '../systems/BattleSimulation.js';
import { EVENTS } from '../systems/EventBus.js';
import { createBackdrop } from './backdrop.js';
import { floatText } from './pixelText.js';

const ARROW_GRAVITY = 260;
const ARROWS_PER_ARCHER = 4;
const MAX_ARROWS = 64; // reserva de flechas reutilizables (no se crean objetos nuevos en cada descarga)

/**
 * Escena de combate: dibuja la simulación (BattleSimulation) y sus eventos.
 * Las reglas no viven aquí; la escena solo traduce el estado a sprites,
 * animaciones, físicas arcade de proyectiles y partículas.
 */
export class BattleScene extends Phaser.Scene {
  constructor(key = 'BattleScene') {
    super(key);
  }

  /** Simulación de la campaña. TutorialScene la sustituye por una sin oleadas. */
  createSimulation() {
    return new BattleSimulation(this.app.state, this.app.bus, { warningScale: this.app.warningScale, boss: XERXES });
  }

  create() {
    this.app = this.registry.get('app');
    const { bus, state } = this.app;
    this.reduceEffects = this.app.settings.get('access', 'reduceEffects');
    createBackdrop(this);

    this.sim = this.createSimulation();
    this.app.sim = this.sim;
    this.formation = new FormationView(this);
    this.units = new Map();
    this.arrows = this.physics.add.group({ allowGravity: true, maxSize: MAX_ARROWS, defaultKey: 'arrow' });
    this.hpBars = this.add.graphics().setDepth(1900);
    const particle = (frame, extra) => this.add.particles(0, 0, 'particles', { frame, emitting: false, maxParticles: 60, ...extra }).setDepth(1950);
    this.fx = {
      dust: particle(0, { speed: { min: 8, max: 26 }, angle: { min: 200, max: 340 }, lifespan: 500, alpha: { start: 1, end: 0 }, gravityY: 30 }),
      spark: particle(1, { speed: { min: 20, max: 50 }, lifespan: 260, scale: { start: 1, end: 0.3 } }),
      splash: particle(2, { speed: { min: 20, max: 55 }, angle: { min: 230, max: 310 }, gravityY: 140, lifespan: 600 }),
      rock: particle(3, { speed: { min: 10, max: 30 }, angle: { min: 200, max: 340 }, gravityY: 120, lifespan: 500 }),
    };

    this.offs = [
      bus.on(EVENTS.ENEMY_SPAWNED, ({ enemy }) => this.units.set(enemy.id, new EnemyUnit(this, enemy))),
      bus.on(EVENTS.ENEMY_DIED, (e) => this.#onDied(e)),
      bus.on(EVENTS.ENEMY_BREACH, (e) => this.#onBreach(e)),
      bus.on(EVENTS.FORMATION_CHANGED, ({ mode }) => this.formation.setMode(mode)),
      bus.on(EVENTS.VOLLEY_WARNING, (e) => this.#onVolleyWarning(e)),
      bus.on(EVENTS.VOLLEY_FIRED, (e) => this.#onVolleyFired(e)),
      bus.on(EVENTS.VOLLEY_IMPACT, (e) => this.#onVolleyImpact(e)),
      bus.on(EVENTS.PUSH_EXECUTED, (e) => this.#onPush(e)),
      bus.on(EVENTS.GAME_OVER, (e) => this.#onGameOver(e)),
      // Enfrentamiento final con Jerjes.
      bus.on(EVENTS.BOSS_STARTED, () => { this.xerxes = new XerxesView(this); }),
      bus.on(EVENTS.BOSS_DECREE, (e) => this.xerxes?.decree(e)),
      bus.on(EVENTS.BOSS_PHASE, () => {
        this.xerxes?.rise();
        this.shake(200, 0.006);
      }),
      bus.on(EVENTS.BOSS_DEFEATED, () => this.xerxes?.retreat()),
      bus.on(EVENTS.ENEMY_RETREAT, ({ enemy }) => {
        const unit = this.units.get(enemy.id);
        this.units.delete(enemy.id);
        unit?.retreat();
      }),
      bus.on(EVENTS.FRENZY, ({ enemies }) => {
        for (const e of enemies.slice(0, 3)) {
          const unit = this.units.get(e.id);
          if (unit) floatText(this, unit.x, unit.y - 26, '¡Látigos!', 0xff9a7a);
        }
      }),
    ];
    this.events.on('enemy-splash', (x) => this.burst('splash', 10, x, 176));
    this.events.on('elite-staggered', (unit) => floatText(this, unit.x, unit.y - 26, '¡Desequilibrado!', 0xffe08a));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#cleanup());

    this.sim.start();
    this.formation.setMode(state.formationMode);
    this.scene.launch('HUDScene');
    this.app.onBattleStarted(this.scene.key);
    this.afterCreate?.();
  }

  update(_time, delta) {
    this.sim.update(delta);
    this.afterUpdate?.(delta);
    const now = this.app.state.simTime;
    this.hpBars.clear();
    for (const rec of this.sim.enemies) {
      const unit = this.units.get(rec.id);
      if (!unit) continue;
      unit.sync(rec, now);
      if (rec.hp < rec.maxHp) {
        const w = Math.max(1, Math.round((rec.hp / rec.maxHp) * 10));
        this.hpBars.fillStyle(0x120d0a, 0.8).fillRect(unit.x - 6, unit.y - 23, 12, 3);
        this.hpBars.fillStyle(rec.type === 'elite' ? 0xe2b24c : 0xd0533f, 1).fillRect(unit.x - 5, unit.y - 22, w, 1);
      }
    }
    if (this.app.state.phase === 'playing') this.formation.setEngaged(this.sim.enemies.some((e) => e.x <= LANE.frontX + SPEARS.range));
    // Cada flecha en vuelo se orienta según su velocidad.
    for (const arrow of this.arrows.getMatching('active', true)) {
      if (arrow.flying) arrow.rotation = Math.atan2(arrow.body.velocity.y, arrow.body.velocity.x);
    }
  }

  /** Partículas, reducidas al mínimo con la opción de accesibilidad. */
  burst(kind, count, x, y) {
    const n = this.reduceEffects ? Math.floor(count / 4) : count;
    if (n > 0) this.fx[kind].explode(n, x, y);
  }

  shake(duration, intensity) {
    if (!this.reduceEffects) this.cameras.main.shake(duration, intensity);
  }

  #onDied({ enemy, cause }) {
    const unit = this.units.get(enemy.id);
    this.units.delete(enemy.id);
    if (!unit) return;
    if (cause === 'edge') {
      floatText(this, unit.x, unit.y - 24, '¡Al mar!', 0x9fd3e6);
      this.burst('rock', 5, unit.x, LANE.rowsY[LANE.edgeRow]);
    }
    unit.die(cause);
  }

  #onBreach({ enemy, breaches, max }) {
    const unit = this.units.get(enemy.id);
    this.units.delete(enemy.id);
    floatText(this, RANK_X[1], LANE.rowsY[enemy.row] - 26, `¡Brecha! ${breaches}/${max}`, 0xff8a70);
    this.shake(160, 0.006);
    this.formation.hurt();
    this.app.audio.play('breach');
    unit?.breach();
  }

  #onVolleyWarning({ archers, warningMs }) {
    for (const a of archers) {
      const unit = this.units.get(a.id);
      if (unit) new EventMarker(this, unit, { icon: 4, durationMs: warningMs, blink: !this.reduceEffects });
    }
  }

  #onVolleyFired({ archers, flightMs, storm }) {
    const T = flightMs / 1000;
    if (storm) {
      // Tormenta del decreto: las flechas llegan desde fuera de la pantalla, por la derecha.
      const n = this.reduceEffects ? 6 : 12;
      for (let i = 0; i < n; i++) this.#launchArrow(Phaser.Math.Between(330, 380), Phaser.Math.Between(-30, 20), T);
      return;
    }
    for (const a of archers) {
      const unit = this.units.get(a.id);
      if (!unit) continue;
      unit.release();
      for (let i = 0; i < ARROWS_PER_ARCHER; i++) this.#launchArrow(unit.x - 4, unit.y - 14, T);
    }
  }

  /** Tiro parabólico calculado para caer sobre la falange al terminar el vuelo. */
  #launchArrow(sx, sy, T) {
    const tx = Phaser.Math.Between(RANK_X[2] - 8, RANK_X[0] + 4);
    const ty = Phaser.Utils.Array.GetRandom(LANE.rowsY) - Phaser.Math.Between(8, 14);
    const arrow = this.arrows.get(sx, sy);
    if (!arrow) return; // reserva agotada: se omite la flecha decorativa
    arrow.setActive(true).setVisible(true).setAlpha(1).setDepth(1850);
    arrow.body.reset(sx, sy);
    arrow.body.enable = true;
    arrow.body.setAllowGravity(true).setGravityY(ARROW_GRAVITY);
    arrow.flying = true;
    const t = T * Phaser.Math.FloatBetween(0.95, 1.02);
    arrow.setVelocity((tx - sx) / t, (ty - sy - 0.5 * ARROW_GRAVITY * t * t) / t);
  }

  #releaseArrow(arrow) {
    this.arrows.killAndHide(arrow);
    arrow.body.stop();
    arrow.body.enable = false;
  }

  #onVolleyImpact({ blocked, damage }) {
    for (const arrow of this.arrows.getMatching('flying', true)) {
      const { x, y } = arrow;
      arrow.flying = false;
      if (blocked) {
        // Rebotan en los escudos.
        this.burst('spark', 2, x, y);
        arrow.setVelocity(Phaser.Math.Between(20, 50), Phaser.Math.Between(-60, -30));
        this.tweens.add({ targets: arrow, alpha: 0, duration: 350, onComplete: () => this.#releaseArrow(arrow) });
      } else {
        // Se clavan en el suelo y la formación acusa el golpe.
        arrow.body.stop();
        arrow.body.setAllowGravity(false);
        this.burst('dust', 2, x, y + 6);
        this.tweens.add({ targets: arrow, alpha: 0, delay: 600, duration: 400, onComplete: () => this.#releaseArrow(arrow) });
      }
    }
    if (!blocked) {
      this.formation.hurt();
      this.shake(140, 0.005);
      floatText(this, RANK_X[1], LANE.rowsY[0] - 34, `-${damage}`, 0xff8a70);
      this.app.audio.play('hit');
    } else {
      floatText(this, RANK_X[1], LANE.rowsY[0] - 34, 'Bloqueado', 0xecc272);
      this.app.audio.play('blocked');
    }
  }

  #onPush({ hits }) {
    this.app.audio.play('push');
    this.shake(90, 0.004);
    for (const p of this.formation.frontPoints()) this.burst('dust', 4, p.x + 6, p.y);
    for (const { enemy, fell } of hits) {
      if (!fell) this.burst('dust', 3, enemy.x, LANE.rowsY[enemy.row]);
    }
  }

  #onGameOver(result) {
    if (result.victory) this.formation.victory();
    else this.formation.defeat();
    this.time.delayedCall(result.victory ? 2200 : 1800, () => {
      this.scene.stop('HUDScene');
      this.app.showResult(result);
      this.scene.start('ResultScene', result);
    });
  }

  #cleanup() {
    this.offs.forEach((off) => off());
    this.sim.destroy();
    if (this.app.sim === this.sim) this.app.sim = null;
  }
}
