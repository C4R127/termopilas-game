import { beforeEach, describe, expect, it } from 'vitest';
import { FORMATION, PUSH, RELIEF } from '../src/config/balance.js';
import { BattleSimulation } from '../src/systems/BattleSimulation.js';
import { EventBus, EVENTS } from '../src/systems/EventBus.js';
import { GameState } from '../src/systems/GameState.js';

let bus;
let state;
let sim;
const send = (id, source = 'keyboard') => sim.commands.handle({ id, source });
const run = (ms) => {
  for (let t = 0; t < ms; t += 1000 / 60) sim.step(1000 / 60);
};

beforeEach(() => {
  bus = new EventBus();
  state = new GameState();
  sim = new BattleSimulation(state, bus, { waves: [] });
  sim.start();
});

describe('CommandController', () => {
  it('rechaza órdenes si la partida no está activa', () => {
    state.phase = 'over';
    expect(send('SHIELDS').status).toBe('rejected');
  });

  it('las cuatro órdenes cambian el estado de la formación', () => {
    expect(send('SHIELDS')).toMatchObject({ status: 'executed', message: 'Orden recibida: ESCUDOS' });
    expect(state.formationMode).toBe('SHIELDS');
    run(FORMATION.modeChangeMs + 20);
    expect(send('SPEARS').status).toBe('executed');
    expect(state.formationMode).toBe('SPEARS');
    run(FORMATION.modeChangeMs + 20);
    expect(send('PUSH').status).toBe('executed');
    expect(state.formationMode).toBe('PUSH');
    run(PUSH.durationMs + 20);
    expect(state.formationMode).toBe('SPEARS');
    expect(send('RELIEF')).toMatchObject({ status: 'executed', message: 'Relevo en proceso' });
    expect(state.formationMode).toBe('RELIEF');
  });

  it('durante la pausa no se aceptan órdenes tácticas hasta reanudar', () => {
    expect(send('PAUSE').status).toBe('executed');
    expect(state.isPaused).toBe(true);
    expect(send('SHIELDS').status).toBe('rejected');
    expect(state.formationMode).toBe('SPEARS');
    expect(send('PAUSE').status).toBe('rejected');
    expect(send('RESUME').message).toBe('Partida reanudada');
    expect(send('SHIELDS').status).toBe('executed');
  });

  it('«continuar» solo funciona con la partida en pausa', () => {
    expect(send('RESUME').status).toBe('rejected');
  });

  it('la pausa congela la simulación', () => {
    send('PAUSE');
    const t = state.simTime;
    sim.update(500);
    expect(state.simTime).toBe(t);
  });

  it('respeta el enfriamiento del empuje y del relevo', () => {
    send('PUSH');
    run(PUSH.durationMs + 50);
    expect(send('PUSH')).toMatchObject({ status: 'rejected', message: expect.stringMatching(/Empuje en enfriamiento/) });
    run(PUSH.cooldownMs);
    expect(send('PUSH').status).toBe('executed');
    run(PUSH.durationMs + 50);
    send('RELIEF');
    run(RELIEF.durationMs + 50);
    expect(send('RELIEF').message).toMatch(/Relevo no disponible/);
  });

  it('guarda una sola orden pendiente durante una transición y la ejecuta al terminar', () => {
    send('SHIELDS');
    expect(send('SPEARS').status).toBe('pending');
    expect(send('PUSH').message).toMatch(/sustituye a LANZAS/);
    expect(state.pending.id).toBe('PUSH');
    run(FORMATION.modeChangeMs + 40);
    expect(state.pending).toBeNull();
    expect(state.formationMode).toBe('PUSH');
  });

  it('la formación agotada no puede empujar ni adelantar lanzas sin resistencia', () => {
    state.stamina = 0.01;
    run(100);
    expect(state.formationMode).toBe('EXHAUSTED');
    expect(send('PUSH').message).toMatch(/agotada/);
    expect(send('SPEARS').message).toMatch(/Resistencia insuficiente/);
    expect(send('RELIEF').status).toBe('executed');
    run(RELIEF.durationMs + 50);
    expect(state.stamina).toBeGreaterThanOrEqual(RELIEF.staminaGain - 1);
    expect(state.formationMode).toBe('SPEARS');
  });

  it('registra la última orden y su resultado', () => {
    const results = [];
    bus.on(EVENTS.COMMAND_RESULT, (r) => results.push(r));
    send('SHIELDS', 'voice');
    send('SPEARS', 'button');
    send('SHIELDS', 'keyboard');
    send('RESUME', 'keyboard');
    expect(results.map((r) => r.status)).toEqual(['executed', 'pending', 'cancelled', 'rejected']);
    expect(state.lastCommand).toMatchObject({ id: 'RESUME', source: 'keyboard', accepted: false });
    expect(state.pending).toBeNull();
    expect(state.stats.commands.voice).toBe(1);
  });
});
