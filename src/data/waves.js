// Datos de enemigos y oleadas de la beta. Separados del comportamiento para
// facilitar el balance. Son valores de juego, no equivalencias históricas.

export const ENEMY_TYPES = {
  infantry: {
    id: 'infantry',
    name: 'Infantería',
    hp: 40,
    speed: 15, // px/s
    contactDps: 2.6, // cohesión por segundo mientras está trabado
    score: 10,
  },
  archer: {
    id: 'archer',
    name: 'Arquero',
    hp: 16,
    speed: 18,
    contactDps: 0.9,
    score: 15,
    volleys: 3, // descargas antes de agotar las flechas y cargar cuerpo a cuerpo
  },
};

/**
 * Cada grupo aparece tras `delayMs` desde el inicio de la oleada y lanza
 * `count` unidades separadas `intervalMs`, rotando por las filas indicadas.
 * `volley` define el aviso y el ritmo de las lluvias de flechas.
 */
export const WAVES = [
  {
    id: 1,
    name: 'Exploración',
    hint: 'Ordena LANZAS para frenar a la infantería. Pide RELEVO si baja la resistencia.',
    groups: [{ type: 'infantry', count: 5, delayMs: 600, intervalMs: 2600, rows: [1, 0, 2] }],
    volley: { warningMs: 2400, intervalMs: 7000 },
  },
  {
    id: 2,
    name: 'Presión combinada',
    hint: 'Llegan arqueros: cuando aparezca el aviso de flechas, ordena ESCUDOS.',
    groups: [
      { type: 'archer', count: 2, delayMs: 0, intervalMs: 900, rows: [0, 2] },
      { type: 'infantry', count: 6, delayMs: 2600, intervalMs: 2300, rows: [2, 1, 0] },
    ],
    volley: { warningMs: 2100, intervalMs: 7500 },
  },
  {
    id: 3,
    name: 'Presión creciente',
    hint: 'Avisos más breves. Usa EMPUJEN cuando se amontonen junto al acantilado.',
    groups: [
      { type: 'archer', count: 3, delayMs: 0, intervalMs: 700, rows: [1, 0, 2] },
      { type: 'infantry', count: 4, delayMs: 2000, intervalMs: 900, rows: [2, 2, 1, 0] },
      { type: 'infantry', count: 5, delayMs: 10000, intervalMs: 1100, rows: [2, 1, 2, 0, 1] },
    ],
    volley: { warningMs: 1800, intervalMs: 6500 },
  },
];
