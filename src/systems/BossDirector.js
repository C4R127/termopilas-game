import { LANE } from '../config/balance.js';
import { EVENTS } from './EventBus.js';

/**
 * Enfrentamiento final con Jerjes I. Jerjes no entra en combate: desde su trono
 * lanza decretos con aviso previo, envía refuerzos sin pausa y su
 * «determinación» baja cuando la falange resiste. Al cruzar los umbrales se
 * levanta del trono y los decretos se endurecen; a cero, ordena la retirada.
 * Sin dependencias de Phaser: se prueba en Node como el resto de las reglas.
 */
export class BossDirector {
  constructor(sim, bus, config) {
    this.sim = sim;
    this.bus = bus;
    this.cfg = config;
    this.active = false;
    this.offs = [];
  }

  get state() {
    return this.sim.state;
  }

  start() {
    const t = this.state.simTime;
    this.active = true;
    this.decreeIndex = 0;
    this.pending = null; // decreto anunciado a la espera de ejecutarse
    this.guards = []; // cargas de la guardia real en curso: { ids, breached }
    this.nextDecreeAt = t + this.cfg.introMs;
    this.nextSpawnAt = t + Math.max(1000, this.cfg.introMs - 2000); // los refuerzos llegan poco antes del primer decreto
    this.spawnIndex = 0;
    // Respiro antes del enfrentamiento.
    const st = this.state;
    st.cohesion = Math.min(100, st.cohesion + this.cfg.restore.cohesion);
    st.stamina = Math.max(st.stamina, this.cfg.restore.stamina);
    this.state.boss = { resolve: this.cfg.resolveMax, max: this.cfg.resolveMax, phase: 0, decree: null, decreeName: null, standing: false, startedAt: t };
    const loss = this.cfg.resolveLoss;
    this.offs = [
      this.bus.on(EVENTS.ENEMY_DIED, ({ enemy, cause }) => {
        const amount = enemy.type === 'elite' ? loss.eliteKill : cause === 'edge' ? loss.edgeKill : loss.kill;
        this.#resolve(-amount, 'kill');
        this.#checkGuard();
      }),
      this.bus.on(EVENTS.ENEMY_BREACH, ({ enemy }) => {
        this.#resolve(-loss.breach, 'breach');
        for (const g of this.guards) if (g.ids.has(enemy.id)) g.breached = true;
        this.#checkGuard();
      }),
      this.bus.on(EVENTS.VOLLEY_IMPACT, ({ blocked, storm }) => {
        if (storm && blocked) this.#resolve(-loss.blockedVolley, 'blocked');
      }),
      this.bus.on(EVENTS.STORM_ENDED, ({ allBlocked }) => {
        if (allBlocked) this.#resolve(-this.cfg.decrees.storm.resolveIfAllBlocked, 'storm');
        this.bus.emit(EVENTS.DECREE_RESULT, { id: 'storm', success: allBlocked });
      }),
      this.bus.on(EVENTS.FRENZY_QUELLED, () => this.#resolve(-this.cfg.decrees.whips.resolvePerQuelled, 'quelled')),
    ];
    this.bus.emit(EVENTS.BOSS_STARTED, { boss: this.state.boss, name: this.cfg.name });
  }

  destroy() {
    this.offs.forEach((off) => off());
    this.offs = [];
  }

  update() {
    if (!this.active || this.state.phase !== 'playing') return;
    const t = this.state.simTime;
    const b = this.state.boss;

    // Refuerzos continuos, sin superar un máximo de enemigos en el paso.
    const r = this.cfg.reinforcements;
    if (t >= this.nextSpawnAt) {
      this.nextSpawnAt = t + r.intervalMs;
      if (this.sim.enemies.filter((e) => !e.removed).length < r.maxActive) {
        const i = this.spawnIndex++;
        this.sim.spawn(r.cycle[i % r.cycle.length], r.rows[i % r.rows.length]);
      }
    }

    // Anuncio del decreto y, tras el aviso, su ejecución.
    if (!this.pending && t >= this.nextDecreeAt) this.#announce();
    if (this.pending && t >= this.pending.executeAt) {
      for (const id of this.pending.ids) this.#execute(id);
      this.pending = null;
      b.decree = null;
      b.decreeName = null;
      this.nextDecreeAt = t + this.cfg.decreeGapMs[b.phase];
    }
  }

  #announce() {
    const b = this.state.boss;
    const order = this.cfg.decreeOrder[b.phase];
    const ids = order[this.decreeIndex++ % order.length];
    const d = this.cfg.decrees;
    // La tormenta lleva su propio aviso de flechas; los demás decretos esperan el suyo.
    const warnings = ids.map((id) => (id === 'storm' ? d.storm.warningMs[b.phase] : d[id].warningMs));
    const warningMs = Math.max(...warnings);
    this.pending = { ids, executeAt: this.state.simTime + warningMs };
    b.decree = ids.join('+');
    b.decreeName = ids.map((id) => d[id].name).join(' y ');
    if (ids.includes('storm')) {
      const st = d.storm;
      this.sim.scheduleStorm({ warningMs: st.warningMs[b.phase], volleys: st.volleys[b.phase], gapMs: st.gapMs, damage: st.damage });
    }
    this.bus.emit(EVENTS.BOSS_DECREE, { ids, names: ids.map((id) => d[id].name), warningMs, phase: b.phase });
  }

  #execute(id) {
    const d = this.cfg.decrees[id];
    if (id === 'whips') {
      // Los capitanes empujan a más hombres y azuzan a los que ya están en el paso.
      for (let i = 0; i < d.extraSpawns; i++) this.sim.spawn('infantry', [2, 0, 1][i % 3], LANE.spawnX + i * 14);
      this.sim.applyFrenzy(d.durationMs, d.speedMult, d.contactMult);
    } else if (id === 'guard') {
      const ids = new Set();
      const count = d.count[this.state.boss.phase];
      const rows = [1, 0, 2];
      for (let i = 0; i < count; i++) ids.add(this.sim.spawn('elite', rows[i % rows.length], LANE.spawnX + i * 10).id);
      this.guards.push({ ids, breached: false });
    }
  }

  #checkGuard() {
    for (const g of [...this.guards]) {
      if (this.sim.enemies.some((e) => g.ids.has(e.id) && !e.removed)) continue;
      this.guards.splice(this.guards.indexOf(g), 1);
      const success = !g.breached;
      if (success) this.#resolve(-this.cfg.decrees.guard.resolveIfRepelled, 'guard');
      this.bus.emit(EVENTS.DECREE_RESULT, { id: 'guard', success });
    }
  }

  #resolve(delta, reason) {
    const b = this.state.boss;
    if (!this.active || !b || delta === 0) return;
    b.resolve = Math.max(0, Math.min(b.max, b.resolve + delta));
    this.bus.emit(EVENTS.BOSS_RESOLVE, { resolve: b.resolve, delta, reason });
    // Umbrales: Jerjes se levanta del trono y endurece los decretos.
    const next = this.cfg.phaseThresholds.filter((th) => b.resolve <= th).length;
    if (next > b.phase) {
      b.phase = next;
      b.standing = true;
      this.decreeIndex = 0;
      this.bus.emit(EVENTS.BOSS_PHASE, { phase: b.phase });
    }
    if (b.resolve <= 0) this.#defeat();
  }

  #defeat() {
    this.active = false;
    this.pending = null;
    this.state.boss.decree = null;
    this.state.boss.decreeName = null;
    this.bus.emit(EVENTS.BOSS_DEFEATED, { name: this.cfg.name });
    this.sim.retreatAll();
    this.sim.endCampaign(true, 'xerxes');
  }
}
