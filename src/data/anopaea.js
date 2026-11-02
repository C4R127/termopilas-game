// Escenario histórico: el tercer día y la senda de Anopea (Heródoto, Historias, VII).
// Efialtes guía a la guardia real persa por un sendero de montaña que rodea el
// paso; la falange queda atacada por delante y por detrás. Oleadas de juego,
// no un orden literal de los hechos. `side: 'rear'` = llegan por la espalda.

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
        { type: 'infantry', count: 3, delayMs: 11000, intervalMs: 2600, rows: [2, 1, 0] },
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
        { type: 'infantry', count: 3, delayMs: 0, intervalMs: 2400, rows: [1, 2, 0] },
        { type: 'archer', count: 1, delayMs: 9000, intervalMs: 0, rows: [2] },
        { type: 'elite', side: 'rear', count: 1, delayMs: 24000, intervalMs: 0, rows: [1] },
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
        { type: 'mixed', mix: ['infantry', 'elite', 'infantry'], count: 4, delayMs: 2500, intervalMs: 3000, rows: [2, 1, 0, 2] },
        { type: 'archer', count: 2, delayMs: 4000, intervalMs: 1200, rows: [0, 2] },
        { type: 'infantry', side: 'rear', count: 2, delayMs: 34000, intervalMs: 2500, rows: [2, 0] },
      ],
      volley: { warningMs: 1900, intervalMs: 7000 },
    },
  ],
};
