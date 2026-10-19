import { describe, expect, it, vi } from 'vitest';
import { matchCommand, normalize, VoiceCommandManager } from '../src/systems/VoiceCommandManager.js';

describe('normalización y mapeo de alias', () => {
  it('normaliza mayúsculas, tildes, puntuación y espacios', () => {
    expect(normalize('  ¡ESCUDOS!  ')).toBe('escudos');
    expect(normalize('Empújen.')).toBe('empujen');
    expect(normalize('re   lanzar,  ya')).toBe('re lanzar ya');
  });

  it.each([
    ['escudos', 'SHIELDS'], ['Falange', 'SHIELDS'], ['lanzas', 'SPEARS'], ['¡Empujen!', 'PUSH'],
    ['relevo', 'RELIEF'], ['cambio', 'RELIEF'], ['fuego', 'RELIEF'], ['pausa', 'PAUSE'],
    ['continuar', 'RESUME'], ['Reanudar.', 'RESUME'], ['escudos ya', 'SHIELDS'],
  ])('«%s» → %s', (phrase, id) => {
    expect(matchCommand(phrase).id).toBe(id);
  });

  it('no ejecuta frases desconocidas ni ambiguas', () => {
    expect(matchCommand('hola leónidas')).toEqual({ id: null, reason: 'unknown' });
    expect(matchCommand('escudos y lanzas')).toEqual({ id: null, reason: 'ambiguous' });
    expect(matchCommand('')).toEqual({ id: null, reason: 'empty' });
    // Solo palabras completas: «lanzaste» no es «lanzas».
    expect(matchCommand('lanzaste').id).toBeNull();
  });
});

class FakeRecognition {
  static instances = [];
  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() { this.onstart?.(); }
  abort() {}
  say(transcript, confidence = 0.9, isFinal = true) {
    const alt = [{ transcript, confidence }];
    alt.isFinal = isFinal;
    this.onresult?.({ resultIndex: 0, results: [alt] });
  }
}

function makeManager() {
  FakeRecognition.instances = [];
  let t = 0;
  const onCommand = vi.fn();
  const onHeard = vi.fn();
  const onStatus = vi.fn();
  const m = new VoiceCommandManager({ recognitionCtor: FakeRecognition, onCommand, onHeard, onStatus, now: () => t });
  return { m, onCommand, onHeard, onStatus, advance: (ms) => { t += ms; }, rec: () => FakeRecognition.instances.at(-1) };
}

describe('VoiceCommandManager', () => {
  it('sin API informa de que no es compatible y no lanza errores', () => {
    const onStatus = vi.fn();
    const m = new VoiceCommandManager({ recognitionCtor: null, onStatus });
    expect(m.supported).toBe(false);
    expect(m.start()).toBe(false);
    expect(onStatus).toHaveBeenCalledWith('unsupported', expect.stringContaining('teclado'));
  });

  it('ejecuta solo la orden mapeada a partir de resultados finales', () => {
    const { m, onCommand, rec } = makeManager();
    m.start();
    expect(m.status).toBe('listening');
    rec().say('lanzas', 0.9, false); // parcial: se ignora
    expect(onCommand).not.toHaveBeenCalled();
    rec().say('lanzas');
    expect(onCommand).toHaveBeenCalledWith('SPEARS', expect.objectContaining({ transcript: 'lanzas' }));
  });

  it('rechaza confianza baja y repeticiones inmediatas', () => {
    const { m, onCommand, onHeard, advance, rec } = makeManager();
    m.start();
    rec().say('escudos', 0.2);
    expect(onCommand).not.toHaveBeenCalled();
    expect(onHeard).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'low-confidence' }));
    rec().say('escudos', 0); // confianza no informada: se acepta
    rec().say('escudos', 0.9);
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onHeard).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'repeat' }));
    advance(1500);
    rec().say('escudos', 0.9);
    expect(onCommand).toHaveBeenCalledTimes(2);
  });

  it('informa de frases desconocidas sin ejecutar nada', () => {
    const { m, onCommand, onHeard, rec } = makeManager();
    m.start();
    rec().say('a la carga');
    expect(onCommand).not.toHaveBeenCalled();
    expect(onHeard).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'unknown', transcript: 'a la carga' }));
  });

  it('el permiso denegado detiene la escucha y deja un mensaje claro', () => {
    const { m, rec } = makeManager();
    m.start();
    const r = rec();
    r.onerror({ error: 'not-allowed' });
    r.onend();
    expect(m.wanted).toBe(false);
    expect(m.status).toBe('error');
    expect(m.message).toMatch(/denegado/);
  });

  it('stop() apaga el micrófono y no reanuda', () => {
    const { m } = makeManager();
    m.start();
    m.stop();
    expect(m.status).toBe('off');
    expect(m.recognition).toBeNull();
  });
});
