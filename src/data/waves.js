// Datos de enemigos y oleadas de la campaña. Separados del comportamiento para
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
  elite: {
    // Arquetipo jugable inspirado en la guardia real persa (los «Inmortales»).
    id: 'elite',
    name: 'Guardia de élite',
    hp: 80,
    speed: 12,
    contactDps: 2.0,
    score: 40,
    armor: 0.35, // las lanzas solo hacen el 35 % del daño…
    staggerFactor: 2, // …salvo justo después de un empuje: entonces, el 200 %
    staggerMs: 2000,
    pushResist: 0.45, // retroceden menos con el empuje
    edgeImmune: true, // se afianzan junto al acantilado: no caen al mar
  },
};

/**
 * Patrones de aparición (sección 5.2): infantería, arqueros, guardia de élite y
 * grupo mixto. Cada grupo aparece tras `delayMs` desde el inicio de la oleada y
 * lanza `count` unidades separadas `intervalMs`, rotando por las filas indicadas.
 * Un grupo mixto (`type: 'mixed'`) alterna los tipos de `mix`.
 * `restMs` es la pausa previa a la oleada; `volley`, el aviso y ritmo de las flechas.
 */
export const WAVES = [
  {
    id: 1,
    name: 'Exploración',
    hint: 'Ordena LANZAS para frenar a la infantería. Pide RELEVO si baja la resistencia.',
    restMs: 2500,
    groups: [{ type: 'infantry', count: 5, delayMs: 600, intervalMs: 2600, rows: [1, 0, 2] }],
    volley: { warningMs: 2400, intervalMs: 7000 },
  },
  {
    id: 2,
    name: 'Presión combinada',
    hint: 'Llegan arqueros: cuando aparezca el aviso de flechas, ordena ESCUDOS.',
    restMs: 5000,
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
    restMs: 5000,
    groups: [
      { type: 'archer', count: 3, delayMs: 0, intervalMs: 700, rows: [1, 0, 2] },
      { type: 'infantry', count: 4, delayMs: 2000, intervalMs: 900, rows: [2, 2, 1, 0] },
      { type: 'infantry', count: 5, delayMs: 10000, intervalMs: 1100, rows: [2, 1, 2, 0, 1] },
    ],
    volley: { warningMs: 1800, intervalMs: 6500 },
  },
  {
    id: 4,
    name: 'Guardia de élite',
    hint: 'La guardia de élite resiste las lanzas: EMPUJEN para desequilibrarla y ataca justo después.',
    restMs: 3500, // menos tiempo de recuperación
    groups: [
      { type: 'elite', count: 3, delayMs: 0, intervalMs: 7000, rows: [1, 0, 2] },
      { type: 'infantry', count: 4, delayMs: 9000, intervalMs: 2600, rows: [2, 0, 2, 1] },
      { type: 'archer', count: 1, delayMs: 12000, intervalMs: 0, rows: [0] },
    ],
    volley: { warningMs: 1800, intervalMs: 7000 },
  },
  {
    id: 5,
    name: 'Última línea',
    hint: 'Todo a la vez: alterna las cuatro órdenes y protege la cohesión.',
    restMs: 5000,
    groups: [
      { type: 'archer', count: 2, delayMs: 0, intervalMs: 800, rows: [1, 2] },
      { type: 'mixed', mix: ['infantry', 'infantry', 'elite', 'infantry'], count: 8, delayMs: 2500, intervalMs: 1700, rows: [2, 0, 1, 2, 1, 0, 2, 1] },
      { type: 'archer', count: 1, delayMs: 12000, intervalMs: 0, rows: [0] },
      { type: 'infantry', count: 4, delayMs: 17000, intervalMs: 700, rows: [2, 1, 2, 0] },
    ],
    volley: { warningMs: 1600, intervalMs: 6000 },
  },
];

/** Los cuatro patrones enemigos que configura la campaña. */
export function campaignPatterns(waves = WAVES) {
  return [...new Set(waves.flatMap((w) => w.groups.map((g) => g.type)))].sort();
}
