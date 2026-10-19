import { describe, expect, it } from 'vitest';
import { ARROWS, LANE } from '../src/config/balance.js';
import { WAVES } from '../src/data/waves.js';
import { BattleSimulation } from '../src/systems/BattleSimulation.js';
import { EventBus, EVENTS } from '../src/systems/EventBus.js';
import { GameState } from '../src/systems/GameState.js';
import { FIRST_WAVE_DELAY_MS, WaveManager } from '../src/systems/WaveManager.js';
import { playGame } from '../scripts/bot.js';

const DT = 1000 / 60;
function makeSim(waves) {
  const bus = new EventBus();
  const state = new GameState();
  const sim = new BattleSimulation(state, bus, { waves });
  sim.start();
  const run = (ms) => {
    for (let t = 0; t < ms; t += DT) sim.step(DT);
  };
  return { bus, state, sim, run };
}

const enemyAt = (id, row, x) => ({ id, type: 'infantry', row, x, hp: 40, maxHp: 40, vx: 0, stunUntil: 0, contactMs: 0, volleysLeft: 0, state: 'contact', removed: false });

describe('WaveManager', () => {
  it('la beta tiene tres oleadas y dos tipos de enemigo', () => {
    expect(WAVES).toHaveLength(3);
    const types = new Set(WAVES.flatMap((w) => w.groups.map((g) => g.type)));
    expect([...types].sort()).toEqual(['archer', 'infantry']);
  });

  it('hace aparecer todos los enemigos de la oleada y solo entonces permite completarla', () => {
    const state = new GameState();
    const wm = new WaveManager(WAVES, state, new EventBus());
    wm.start();
    let spawned = 0;
    for (let t = 0; t < FIRST_WAVE_DELAY_MS + 60000 && wm.phase !== 'clearing'; t += DT) {
      spawned += wm.update(DT).length;
      expect(wm.isCleared(0)).toBe(wm.phase === 'clearing');
    }
    expect(spawned).toBe(WAVES[0].groups.reduce((n, g) => n + g.count, 0));
    expect(wm.completeWave()).toBe(false);
    expect(state.waveIndex).toBe(1);
    expect(wm.resting).toBe(true);
  });
});

describe('BattleSimulation', () => {
  const archerWave = [{ id: 1, name: 't', groups: [{ type: 'archer', count: 1, delayMs: 0, intervalMs: 0, rows: [0] }], volley: { warningMs: 1500, intervalMs: 5000 } }];

  it('con escudos la lluvia de flechas no reduce la cohesión', () => {
    const { bus, state, sim, run } = makeSim(archerWave);
    const impacts = [];
    bus.on(EVENTS.VOLLEY_WARNING, () => sim.commands.handle({ id: 'SHIELDS', source: 'keyboard' }));
    bus.on(EVENTS.VOLLEY_IMPACT, (e) => impacts.push(e));
    run(20000);
    expect(impacts.length).toBeGreaterThan(0);
    expect(impacts.every((i) => i.blocked)).toBe(true);
    expect(state.cohesion).toBe(100);
  });

  it('sin escudos la lluvia de flechas daña la cohesión', () => {
    const { bus, state, run } = makeSim(archerWave);
    const impacts = [];
    bus.on(EVENTS.VOLLEY_IMPACT, (e) => impacts.push(e));
    run(12000);
    expect(impacts[0]).toMatchObject({ blocked: false, damage: ARROWS.damagePerArcher });
    expect(state.cohesion).toBeLessThan(100);
  });

  it('el empuje derriba al mar a los enemigos de la fila del acantilado y hace retroceder al resto', () => {
    const { bus, state, sim } = makeSim([]);
    const front = LANE.frontX + LANE.contactGap;
    sim.enemies.push(enemyAt(1, LANE.edgeRow, front), enemyAt(2, 0, front));
    const deaths = [];
    bus.on(EVENTS.ENEMY_DIED, (e) => deaths.push(e));
    sim.commands.handle({ id: 'PUSH', source: 'keyboard' });
    expect(deaths).toEqual([expect.objectContaining({ cause: 'edge' })]);
    for (let t = 0; t < 1500; t += DT) sim.step(DT);
    expect(sim.enemies.find((e) => e.id === 2).x).toBeGreaterThan(front + 30);
    expect(state.stats.edgeKills).toBe(1);
  });

  it('un enemigo trabado demasiado tiempo abre brecha', () => {
    const wave = [{ id: 1, name: 't', groups: [{ type: 'infantry', count: 1, delayMs: 0, intervalMs: 0, rows: [1] }], volley: { warningMs: 1000, intervalMs: 5000 } }];
    const { bus, state, sim, run } = makeSim(wave);
    sim.commands.handle({ id: 'SHIELDS', source: 'keyboard' });
    const breaches = [];
    bus.on(EVENTS.ENEMY_BREACH, (e) => breaches.push(e));
    run(30000);
    expect(breaches).toHaveLength(1);
    expect(state.breaches).toBe(1);
  });

  it('los enemigos de una fila no se solapan', () => {
    const { sim, run } = makeSim([{ id: 1, name: 't', groups: [{ type: 'infantry', count: 4, delayMs: 0, intervalMs: 200, rows: [1] }], volley: { warningMs: 1000, intervalMs: 5000 } }]);
    sim.commands.handle({ id: 'SHIELDS', source: 'keyboard' });
    run(4000 + 20000);
    const xs = sim.enemies.map((e) => e.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(LANE.enemyGap - 0.01);
  });
});

describe('partida completa (bots)', () => {
  it('un jugador atento gana la beta aun reaccionando con retraso de voz', () => {
    for (const reactionMs of [400, 1400]) {
      const { result, state } = playGame('attentive', { reactionMs });
      expect(result).toMatchObject({ victory: true, reason: 'campaign', wavesCleared: 3 });
      expect(state.cohesion).toBeGreaterThan(20);
    }
  });

  it('no dar órdenes, o mantener siempre los escudos, lleva a la derrota', () => {
    expect(playGame('idle').result).toMatchObject({ victory: false, reason: 'cohesion' });
    expect(playGame('turtle').result).toMatchObject({ victory: false, reason: 'breaches' });
  });

  it('reiniciar restablece el estado de la partida y conserva la preferencia de voz', () => {
    const { state } = playGame('idle');
    state.voiceEnabled = true;
    state.reset();
    expect(state).toMatchObject({ cohesion: 100, stamina: 100, waveIndex: 0, breaches: 0, isPaused: false, result: null, voiceEnabled: true });
  });
});
