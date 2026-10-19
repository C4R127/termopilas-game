import Phaser from 'phaser';
import { LANE, SPEARS } from '../config/balance.js';
import { EnemyUnit } from '../entities/EnemyUnit.js';
import { EventMarker } from '../entities/EventMarker.js';
import { FormationView, RANK_X } from '../entities/FormationView.js';
import { BattleSimulation } from '../systems/BattleSimulation.js';
import { EVENTS } from '../systems/EventBus.js';
import { floatText } from './pixelText.js';

const ARROW_GRAVITY = 260;
const ARROWS_PER_ARCHER = 4;

/**
 * Escena de combate: dibuja la simulación (BattleSimulation) y sus eventos.
 * Las reglas no viven aquí; la escena solo traduce el estado a sprites,
 * animaciones, físicas arcade de proyectiles y partículas.
 */
export class BattleScene extends Phaser.Scene {
  constructor() {
    super('BattleScene');
  }

  create() {
    this.app = this.registry.get('app');
    const { bus, state } = this.app;
    this.add.image(0, 0, 'bg-pass').setOrigin(0).setDepth(-10);
    this.#seaShimmer();

    this.sim = new BattleSimulation(state, bus);
    this.app.sim = this.sim;
    this.formation = new FormationView(this);
    this.units = new Map();
    this.arrows = this.physics.add.group({ allowGravity: true });
    this.hpBars = this.add.graphics().setDepth(1900);
    this.fx = {
      dust: this.add.particles(0, 0, 'particles', { frame: 0, speed: { min: 8, max: 26 }, angle: { min: 200, max: 340 }, lifespan: 500, alpha: { start: 1, end: 0 }, gravityY: 30, emitting: false }).setDepth(1950),
      spark: this.add.particles(0, 0, 'particles', { frame: 1, speed: { min: 20, max: 50 }, lifespan: 260, scale: { start: 1, end: 0.3 }, emitting: false }).setDepth(1950),
      splash: this.add.particles(0, 0, 'particles', { frame: 2, speed: { min: 20, max: 55 }, angle: { min: 230, max: 310 }, gravityY: 140, lifespan: 600, emitting: false }).setDepth(1950),
      rock: this.add.particles(0, 0, 'particles', { frame: 3, speed: { min: 10, max: 30 }, angle: { min: 200, max: 340 }, gravityY: 120, lifespan: 500, emitting: false }).setDepth(1950),
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
    ];
    this.events.on('enemy-splash', (x) => this.fx.splash.explode(10, x, 176));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#cleanup());

    this.sim.start();
    this.formation.setMode(state.formationMode);
    this.scene.launch('HUDScene');
    this.app.onBattleStarted();
  }

  update(_time, delta) {
    this.sim.update(delta);
    const now = this.app.state.simTime;
    this.hpBars.clear();
    for (const rec of this.sim.enemies) {
      const unit = this.units.get(rec.id);
      if (!unit) continue;
      unit.sync(rec, now);
      if (rec.hp < rec.maxHp) {
        const w = Math.max(1, Math.round((rec.hp / rec.maxHp) * 10));
        this.hpBars.fillStyle(0x120d0a, 0.8).fillRect(unit.x - 6, unit.y - 23, 12, 3);
        this.hpBars.fillStyle(0xd0533f, 1).fillRect(unit.x - 5, unit.y - 22, w, 1);
      }
    }
    this.formation.setEngaged(this.sim.enemies.some((e) => e.x <= LANE.frontX + SPEARS.range));
    // Cada flecha se orienta según su velocidad.
    for (const arrow of this.arrows.getChildren()) arrow.rotation = Math.atan2(arrow.body.velocity.y, arrow.body.velocity.x);
  }

  #onDied({ enemy, cause }) {
    const unit = this.units.get(enemy.id);
    this.units.delete(enemy.id);
    if (!unit) return;
    if (cause === 'edge') {
      floatText(this, unit.x, unit.y - 24, '¡Al mar!', 0x9fd3e6);
      this.fx.rock.explode(5, unit.x, LANE.rowsY[LANE.edgeRow]);
    }
    unit.die(cause);
  }

  #onBreach({ enemy, breaches, max }) {
    const unit = this.units.get(enemy.id);
    this.units.delete(enemy.id);
    floatText(this, RANK_X[1], LANE.rowsY[enemy.row] - 26, `¡Brecha! ${breaches}/${max}`, 0xff8a70);
    this.cameras.main.shake(160, 0.006);
    this.formation.hurt();
    unit?.breach();
  }

  #onVolleyWarning({ archers, warningMs }) {
    for (const a of archers) {
      const unit = this.units.get(a.id);
      if (unit) new EventMarker(this, unit, { icon: 4, durationMs: warningMs });
    }
  }

  #onVolleyFired({ archers, flightMs }) {
    const T = flightMs / 1000;
    for (const a of archers) {
      const unit = this.units.get(a.id);
      if (!unit) continue;
      unit.release();
      for (let i = 0; i < ARROWS_PER_ARCHER; i++) {
        // Tiro parabólico calculado para caer sobre la falange al terminar el vuelo.
        const sx = unit.x - 4;
        const sy = unit.y - 14;
        const tx = Phaser.Math.Between(RANK_X[2] - 8, RANK_X[0] + 4);
        const ty = Phaser.Utils.Array.GetRandom(LANE.rowsY) - Phaser.Math.Between(8, 14);
        const arrow = this.arrows.create(sx, sy, 'arrow');
        arrow.setDepth(1850);
        arrow.body.setGravityY(ARROW_GRAVITY);
        const t = T * Phaser.Math.FloatBetween(0.95, 1.02);
        arrow.setVelocity((tx - sx) / t, (ty - sy - 0.5 * ARROW_GRAVITY * t * t) / t);
      }
    }
  }

  #onVolleyImpact({ blocked, damage }) {
    for (const arrow of [...this.arrows.getChildren()]) {
      const { x, y } = arrow;
      if (blocked) {
        // Rebotan en los escudos.
        this.fx.spark.explode(2, x, y);
        arrow.setVelocity(Phaser.Math.Between(20, 50), Phaser.Math.Between(-60, -30));
        this.tweens.add({ targets: arrow, alpha: 0, duration: 350, onComplete: () => arrow.destroy() });
      } else {
        // Se clavan en el suelo y la formación acusa el golpe.
        arrow.body.stop();
        arrow.body.setAllowGravity(false);
        this.fx.dust.explode(2, x, y + 6);
        this.tweens.add({ targets: arrow, alpha: 0, delay: 600, duration: 400, onComplete: () => arrow.destroy() });
      }
      this.arrows.remove(arrow);
    }
    if (!blocked) {
      this.formation.hurt();
      this.cameras.main.shake(140, 0.005);
      floatText(this, RANK_X[1], LANE.rowsY[0] - 34, `-${damage}`, 0xff8a70);
      this.app.audio.play('hit');
    } else {
      floatText(this, RANK_X[1], LANE.rowsY[0] - 34, 'Bloqueado', 0xecc272);
      this.app.audio.play('blocked');
    }
  }

  #onPush({ hits }) {
    this.app.audio.play('push');
    this.cameras.main.shake(90, 0.004);
    for (const p of this.formation.frontPoints()) this.fx.dust.explode(4, p.x + 6, p.y);
    for (const { enemy, fell } of hits) {
      if (!fell) this.fx.dust.explode(3, enemy.x, LANE.rowsY[enemy.row]);
    }
  }

  #onGameOver(result) {
    this.time.delayedCall(1400, () => {
      this.scene.stop('HUDScene');
      this.app.showResult(result);
      this.scene.start('ResultScene', result);
    });
  }

  #seaShimmer() {
    // Destellos sobre el mar en primer plano (ambiente, muy ligero).
    for (let i = 0; i < 10; i++) {
      const s = this.add.rectangle(Phaser.Math.Between(0, 320), Phaser.Math.Between(163, 178), Phaser.Math.Between(2, 5), 1, 0xd2e2e3).setDepth(-5).setAlpha(0);
      this.tweens.add({ targets: s, alpha: { from: 0, to: 0.8 }, x: `+=${Phaser.Math.Between(3, 8)}`, duration: Phaser.Math.Between(900, 1600), yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 2000) });
    }
  }

  #cleanup() {
    this.offs.forEach((off) => off());
    this.sim.destroy();
    if (this.app.sim === this.sim) this.app.sim = null;
  }
}
