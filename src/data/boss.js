// Enfrentamiento final: Jerjes I. Según Heródoto (Historias, VII), el rey no
// combatió en persona: dirigía el asalto desde su trono, y llegó a levantarse
// de él temiendo por su ejército. En el juego es el jefe final: no entra en el
// cuerpo a cuerpo, sino que lanza decretos desde el fondo del paso. Son valores
// de juego, no datos históricos.

export const XERXES = {
  name: 'Jerjes I',
  resolveMax: 80, // «determinación»: al llegar a 0 ordena la retirada
  introMs: 7000, // pausa antes del primer decreto
  // Respiro antes del enfrentamiento: la falange cierra filas y recupera el aliento.
  restore: { cohesion: 50, stamina: 100 },
  // Umbrales de determinación en los que se levanta del trono y endurece los decretos.
  phaseThresholds: [54, 27],
  decreeGapMs: [10000, 9000, 7500], // tiempo entre decretos en cada fase
  // Orden de los decretos en cada fase; en la última se combinan de dos en dos.
  decreeOrder: [
    [['storm'], ['whips'], ['guard']],
    [['whips'], ['storm'], ['guard']],
    [['storm', 'whips'], ['guard'], ['whips', 'storm']],
  ],
  // Refuerzos continuos mientras dura el enfrentamiento.
  reinforcements: { intervalMs: 4200, maxActive: 6, cycle: ['infantry', 'infantry', 'infantry', 'archer', 'infantry', 'infantry'], rows: [2, 0, 1, 2, 1, 0] },
  decrees: {
    storm: {
      name: 'Que las flechas oculten el sol',
      warningMs: [2600, 2200, 1900],
      volleys: [3, 4, 4],
      gapMs: 1000,
      damage: 9,
      resolveIfAllBlocked: 12,
    },
    whips: {
      name: 'Látigos de los capitanes',
      warningMs: 2000,
      durationMs: 6000,
      speedMult: 1.6,
      contactMult: 1.25,
      extraSpawns: 2, // los capitanes empujan a más hombres hacia el paso
      resolvePerQuelled: 3, // cada enfurecido empujado o abatido
    },
    guard: {
      name: 'Carga de la guardia real',
      warningMs: 2200,
      count: [2, 3, 3], // guardias por fase (uno por fila)
      resolveIfRepelled: 10, // si todos caen sin abrir brecha
    },
  },
  // Lo que resta determinación además de los decretos resistidos.
  resolveLoss: { kill: 2, edgeKill: 4, eliteKill: 6, blockedVolley: 2, breach: -4 },
};
