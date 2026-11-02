// Escenario histórico: el tercer día y la senda de Anopea (Heródoto, Historias, VII).
// Efialtes guía a la guardia real persa por un sendero de montaña que rodea el
// paso; la falange queda atacada por delante y por detrás. Oleadas de juego,
// no un orden literal de los hechos. `side: 'rear'` = llegan por la espalda.

import { DIFFICULTY, FLANK, LANE } from '../config/balance.js';
import { ENEMY_TYPES } from './waves.js';

export const ANOPAEA = {
  id: 'anopaea',
  name: 'Día 3: la senda de Anopea',
  intro:
    'Escúchame, {aliado}: un griego de esta tierra, Efialtes, ha guiado a los persas por la senda de la montaña. Al amanecer nos atacarán también por la espalda. Cuando lleguen por detrás, ordena MEDIA VUELTA.',
  rearAlert: '¡Están en la retaguardia! MEDIA VUELTA y cerrad filas: el lado que no miramos queda desprotegido.',
  victory: 'Ni rodeados han roto la línea, {aliado}. Esta resistencia se cantará durante siglos.',
  waves: [
    {
      id: 1,
      name: 'Amanecer del tercer día',
      hint: 'El frente sigue llegando por el paso. Vigila la montaña: la retaguardia ya no es segura.',
      restMs: 3000,
      groups: [
        { type: 'infantry', count: 5, delayMs: 500, intervalMs: 2300, rows: [1, 0, 2] },
        { type: 'archer', count: 1, delayMs: 4000, intervalMs: 0, rows: [0] },
      ],
      volley: { warningMs: 2200, intervalMs: 7500 },
    },
    {
      id: 2,
      name: 'Los Inmortales en la retaguardia',
      hint: '¡Bajan por la senda! Ordena MEDIA VUELTA, empuja a la guardia y ataca mientras se tambalea.',
      restMs: 4000,
      groups: [
        { type: 'elite', side: 'rear', count: 2, delayMs: 1500, intervalMs: 6000, rows: [1, 0] },
        { type: 'infantry', count: 3, delayMs: 16000, intervalMs: 2600, rows: [2, 1, 0] },
      ],
      volley: { warningMs: 2200, intervalMs: 7500 },
    },
    {
      id: 3,
      name: 'Rodeados',
      hint: 'Atacan por los dos lados: acaba primero con los de la senda y gira antes de que el frente llegue a la línea.',
      restMs: 4000,
      groups: [
        { type: 'infantry', side: 'rear', count: 3, delayMs: 500, intervalMs: 2200, rows: [0, 2, 1] },
        { type: 'infantry', count: 3, delayMs: 4000, intervalMs: 2400, rows: [1, 2, 0] },
        { type: 'archer', count: 1, delayMs: 13000, intervalMs: 0, rows: [2] },
        { type: 'elite', side: 'rear', count: 1, delayMs: 21000, intervalMs: 0, rows: [1] },
      ],
      volley: { warningMs: 2000, intervalMs: 7000 },
    },
    {
      id: 4,
      name: 'La última resistencia',
      hint: 'Su número es inmenso. Alterna los frentes y resiste hasta el final.',
      restMs: 5000,
      groups: [
        { type: 'infantry', side: 'rear', count: 3, delayMs: 0, intervalMs: 2000, rows: [1, 0, 2] },
        { type: 'mixed', mix: ['infantry', 'elite', 'infantry'], count: 4, delayMs: 5000, intervalMs: 3000, rows: [2, 1, 0, 2] },
        { type: 'archer', count: 2, delayMs: 7000, intervalMs: 1200, rows: [0, 2] },
        { type: 'infantry', side: 'rear', count: 2, delayMs: 32000, intervalMs: 2500, rows: [2, 0] },
      ],
      volley: { warningMs: 1900, intervalMs: 7000 },
    },
  ],
};

/** Tiempo (ms) desde que aparece un grupo hasta que su primer soldado choca con la línea. */
function travelMs(group) {
  const types = group.type === 'mixed' ? group.mix : [group.type];
  const speed = Math.min(...types.map((t) => ENEMY_TYPES[t].speed)); // el más lento marca el paso
  const contact = LANE.frontX + LANE.contactGap;
  const start = group.side === 'rear' ? LANE.rearMirror - LANE.rearSpawnX : LANE.spawnX;
  return ((start - contact) / speed) * 1000;
}

const firstContact = (g) => g.delayMs + travelMs(g);
const lastContact = (g) => g.delayMs + (g.count - 1) * g.intervalMs + travelMs(g);

/**
 * Oleadas de la senda según la dificultad (DIFFICULTY[id].flank):
 * - 'separate': por orden de llegada, cuando el siguiente grupo viene por el otro
 *   lado se retrasa (él y los que le siguen) hasta que el anterior haya llegado
 *   entero, más un margen; así nunca atacan los dos lados a la vez.
 * - 'mixed': las oleadas tal como están arriba.
 * - 'together': el lado que llega después se adelanta para coincidir con el primero.
 */
export function anopaeaWaves(difficulty = 'normal') {
  const mode = (DIFFICULTY[difficulty] ?? DIFFICULTY.normal).flank;
  if (mode === 'mixed') return ANOPAEA.waves;
  return ANOPAEA.waves.map((wave) => {
    const sides = new Set(wave.groups.map((g) => g.side ?? 'front'));
    if (sides.size < 2) return wave;
    const order = [...wave.groups].sort((a, b) => firstContact(a) - firstContact(b));
    const delays = new Map();
    if (mode === 'separate') {
      let shift = 0;
      let side = null;
      let blockEnd = -Infinity;
      for (const g of order) {
        const gSide = g.side ?? 'front';
        if (side && gSide !== side) shift += Math.max(0, blockEnd + FLANK.separateGapMs - (firstContact(g) + shift));
        if (gSide !== side) blockEnd = -Infinity;
        side = gSide;
        blockEnd = Math.max(blockEnd, lastContact(g) + shift);
        delays.set(g, Math.round(g.delayMs + shift));
      }
    } else {
      const second = (order[0].side ?? 'front') === 'front' ? 'rear' : 'front';
      for (const g of order) delays.set(g, (g.side ?? 'front') === second ? Math.max(0, g.delayMs - FLANK.togetherMs) : g.delayMs);
    }
    return { ...wave, groups: wave.groups.map((g) => ({ ...g, delayMs: delays.get(g) })) };
  });
}
