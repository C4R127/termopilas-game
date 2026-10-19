import { ARROWS, BREACH, INTERMISSION, LANE, MORALE, PUSH, SPEARS } from '../config/balance.js';
import { ENEMY_TYPES, WAVES } from '../data/waves.js';
import { Formation } from '../entities/Formation.js';
import { CommandController } from './CommandController.js';
import { EVENTS } from './EventBus.js';
import { WaveManager } from './WaveManager.js';

// Pasos fijos: la simulación da el mismo resultado con cualquier tasa de fotogramas.
const STEP_MS = 1000 / 60;
const MAX_STEPS = 10;

/**
 * Núcleo jugable de BattleScene: enemigos, lluvias de flechas, oleadas y
 * condiciones de partida. Es independiente de Phaser para poder probarlo y
 * simular partidas completas; la escena solo dibuja lo que aquí ocurre.
 */
export class BattleSimulation {
  constructor(state, bus, { waves = WAVES } = {}) {
    this.state = state;
    this.bus = bus;
    this.formation = new Formation(state, bus);
    this.commands = new CommandController(state, this.formation, bus);
    this.waves = new WaveManager(waves, state, bus);
    this.enemies = [];
    this.volleys = []; // descargas en vuelo
    this.volleyClock = null; // { warnAt, fireAt, warned }
    this.nextId = 1;
    this.accumulator = 0;
    this.offPush = bus.on(EVENTS.FORMATION_CHANGED, (e) => {
      if (e.mode === 'PUSH') this.#resolvePush();
    });
  }

  destroy() {
    this.commands.destroy();
    this.offPush();
  }

  start() {
    this.state.reset();
    this.state.phase = 'playing';
    this.state.currentScene = 'BattleScene';
    this.enemies = [];
    this.volleys = [];
    this.volleyClock = null;
    this.accumulator = 0;
    this.waves.start();
  }

  get running() {
    return this.state.phase === 'playing' && !this.state.isPaused;
  }

  /** Avanza la simulación con el tiempo real transcurrido (se ignora en pausa). */
  update(dtMs) {
    if (!this.running) return;
    this.accumulator += Math.min(dtMs, STEP_MS * MAX_STEPS);
    while (this.accumulator >= STEP_MS && this.running) {
      this.accumulator -= STEP_MS;
      this.step(STEP_MS);
    }
  }

  step(dt) {
    const s = this.state;
    s.simTime += dt;

    for (const spawn of this.waves.update(dt)) this.#spawn(spawn);
    this.#moveEnemies(dt);
    const engaged = this.#spearTargets().length > 0;
    this.#melee(dt);
    this.#updateVolleys(dt);
    this.formation.tick(dt, { engaged, resting: this.waves.resting });
    this.commands.flushPending();

    this.enemies = this.enemies.filter((e) => !e.removed);
    s.activeEnemies = this.enemies.length;
    this.#checkEnd();
  }

  // ── Enemigos ───────────────────────────────────────────────────────────

  #spawn({ type, row }) {
    const def = ENEMY_TYPES[type];
    const enemy = {
      id: this.nextId++,
      type,
      row,
      x: LANE.spawnX,
      hp: def.hp,
      maxHp: def.hp,
      vx: 0, // velocidad de retroceso (positiva hacia la derecha)
      stunUntil: 0,
      contactMs: 0,
      inContact: false,
      volleysLeft: def.volleys ?? 0,
      state: 'advance', // advance | contact | aiming | stunned
      removed: false,
    };
    this.enemies.push(enemy);
    this.bus.emit(EVENTS.ENEMY_SPAWNED, { enemy });
  }

  #moveEnemies(dt) {
    const sec = dt / 1000;
    const t = this.state.simTime;
    const contactX = LANE.frontX + LANE.contactGap;
    for (let row = 0; row < LANE.rowsY.length; row++) {
      const inRow = this.enemies.filter((e) => e.row === row && !e.removed).sort((a, b) => a.x - b.x);
      let limit = contactX; // el primero choca con la falange; los demás, con el de delante
      for (const e of inRow) {
        const def = ENEMY_TYPES[e.type];
        if (e.vx > 0) {
          // Retroceso del empuje con desaceleración constante.
          e.x += e.vx * sec;
          e.vx = Math.max(0, e.vx - PUSH.knockbackDecel * sec);
        } else if (t >= e.stunUntil) {
          const holdX = e.type === 'archer' && e.volleysLeft > 0 ? LANE.archerStopX : limit;
          const target = Math.max(holdX, limit);
          if (e.x > target) e.x = Math.max(target, e.x - def.speed * sec);
        }
        e.x = Math.max(e.x, limit);
        e.inContact = e.x <= contactX + 0.5 && e.vx === 0;
        if (t < e.stunUntil) e.state = 'stunned';
        else if (e.inContact) e.state = 'contact';
        else if (e.type === 'archer' && e.volleysLeft > 0 && e.x <= LANE.archerStopX + 0.5) e.state = 'aiming';
        else e.state = 'advance';
        // Los arqueros apostados se apartan: la infantería pasa por delante de ellos.
        if (!(e.type === 'archer' && e.volleysLeft > 0)) limit = e.x + LANE.enemyGap;
      }
    }
  }

  /** Enemigo más adelantado de cada fila dentro del alcance de las lanzas. */
  #spearTargets() {
    const reach = LANE.frontX + SPEARS.range;
    const targets = [];
    for (let row = 0; row < LANE.rowsY.length; row++) {
      let best = null;
      for (const e of this.enemies) {
        if (e.removed || e.row !== row || e.x > reach) continue;
        if (!best || e.x < best.x) best = e;
      }
      if (best) targets.push(best);
    }
    return targets;
  }

  #melee(dt) {
    const sec = dt / 1000;
    const f = this.formation;
    if (f.canAttack) {
      for (const e of this.#spearTargets()) this.#hurt(e, f.spearDps * sec, 'spears');
    }
    for (const e of this.enemies) {
      if (e.removed || !e.inContact || e.state === 'stunned') continue;
      f.damageCohesion(ENEMY_TYPES[e.type].contactDps * f.meleeFactor * sec);
      e.contactMs += dt;
      if (e.contactMs >= BREACH.contactMs) this.#breach(e);
    }
  }

  #hurt(enemy, amount, cause) {
    if (enemy.removed) return;
    enemy.hp -= amount;
    if (enemy.hp <= 0) this.#kill(enemy, cause);
  }

  #kill(enemy, cause) {
    enemy.removed = true;
    const s = this.state;
    s.stats.kills++;
    if (cause === 'edge') s.stats.edgeKills++;
    this.formation.changeMorale(cause === 'edge' ? MORALE.edgeKillBonus : MORALE.killBonus, 'kill');
    this.bus.emit(EVENTS.ENEMY_DIED, { enemy, cause });
  }

  #breach(enemy) {
    enemy.removed = true;
    this.state.breaches++;
    this.formation.damageCohesion(BREACH.cohesionLoss);
    this.formation.changeMorale(-BREACH.moralePenalty, 'breach');
    this.bus.emit(EVENTS.ENEMY_BREACH, { enemy, breaches: this.state.breaches, max: BREACH.maxBreaches });
  }

  #resolvePush() {
    const reach = LANE.frontX + PUSH.range;
    const t = this.state.simTime;
    const hits = [];
    for (const e of this.enemies) {
      if (e.removed || e.x > reach) continue;
      if (e.row === LANE.edgeRow) {
        // Junto al acantilado, el retroceso los hace caer al mar.
        hits.push({ enemy: e, fell: true });
        this.#kill(e, 'edge');
        continue;
      }
      e.vx = PUSH.knockbackSpeed;
      e.stunUntil = t + PUSH.stunMs;
      e.contactMs = 0;
      hits.push({ enemy: e, fell: false });
      this.#hurt(e, PUSH.damage, 'push');
    }
    this.bus.emit(EVENTS.PUSH_EXECUTED, { hits });
  }

  // ── Lluvias de flechas ───────────────────────────────────────────────────

  #archersReady() {
    return this.enemies.filter((e) => !e.removed && e.state === 'aiming');
  }

  #updateVolleys(dt) {
    const t = this.state.simTime;
    const wave = this.waves.current;
    const archers = this.#archersReady();

    if (!this.volleyClock && archers.length > 0 && wave) {
      // Primer aviso poco después de que los arqueros tomen posición.
      this.volleyClock = { warnAt: t + 800, warned: false };
    }
    const clock = this.volleyClock;
    if (clock && wave) {
      if (!clock.warned && t >= clock.warnAt) {
        if (archers.length === 0) {
          this.volleyClock = null;
        } else {
          clock.warned = true;
          clock.fireAt = t + wave.volley.warningMs;
          this.bus.emit(EVENTS.VOLLEY_WARNING, { archers, warningMs: wave.volley.warningMs, fireAt: clock.fireAt });
        }
      } else if (clock.warned && t >= clock.fireAt) {
        if (archers.length > 0) this.#fire(archers);
        this.volleyClock = archers.length > 0 ? { warnAt: t + wave.volley.intervalMs - wave.volley.warningMs, warned: false } : null;
      }
    }

    for (const v of this.volleys) {
      if (v.done || t < v.impactAt) continue;
      v.done = true;
      this.#impact(v);
    }
    this.volleys = this.volleys.filter((v) => !v.done);
  }

  #fire(archers) {
    const t = this.state.simTime;
    const damage = Math.min(ARROWS.maxDamage, ARROWS.damagePerArcher * archers.length);
    const volley = { impactAt: t + ARROWS.flightMs, damage, archers: archers.length, done: false };
    for (const a of archers) a.volleysLeft--; // sin flechas, cargan cuerpo a cuerpo
    this.volleys.push(volley);
    this.bus.emit(EVENTS.VOLLEY_FIRED, { archers, flightMs: ARROWS.flightMs, damage });
  }

  #impact(volley) {
    const blocked = this.formation.blocksArrows;
    if (blocked) {
      this.state.stats.volleysBlocked++;
    } else {
      this.state.stats.volleysTaken++;
      this.formation.damageCohesion(volley.damage);
      this.formation.changeMorale(-ARROWS.moralePenalty, 'arrows');
    }
    this.bus.emit(EVENTS.VOLLEY_IMPACT, { blocked, damage: blocked ? 0 : volley.damage });
  }

  // ── Fin de oleada y de partida ───────────────────────────────────────────

  #checkEnd() {
    const s = this.state;
    if (s.cohesion <= 0) return this.#gameOver(false, 'cohesion');
    if (s.breaches >= BREACH.maxBreaches) return this.#gameOver(false, 'breaches');
    if (this.waves.isCleared(s.activeEnemies) && this.volleys.length === 0) {
      const index = s.waveIndex;
      this.volleyClock = null;
      this.formation.changeMorale(MORALE.waveBonus, 'wave');
      this.formation.restoreCohesion(INTERMISSION.cohesionBonus);
      const finished = this.waves.completeWave();
      this.bus.emit(EVENTS.WAVE_COMPLETED, { index, total: this.waves.total, last: finished });
      if (finished) this.#gameOver(true, 'campaign');
    }
    return undefined;
  }

  #gameOver(victory, reason) {
    const s = this.state;
    if (s.phase === 'over') return;
    s.phase = 'over';
    s.pending = null;
    s.result = { victory, reason, timeMs: s.simTime, wavesCleared: victory ? this.waves.total : s.waveIndex };
    this.bus.emit(EVENTS.GAME_OVER, { ...s.result, stats: s.stats });
  }
}
