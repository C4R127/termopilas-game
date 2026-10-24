// Mensajes de Leónidas I durante la campaña (sección 2.1: figura de mando en la
// introducción, el tutorial y los mensajes de campaña). Textos originales del
// proyecto; las indicaciones de cada oleada están en waves.js (`hint`).
// {aliado} / {Aliado} se sustituyen por la forma de trato que elige el jugador.

export const LEONIDAS = {
  intro:
    'Escúchame, {aliado}: el paso es estrecho y su ejército, inmenso. Aquí su número no les sirve de nada si la línea aguanta. Atentos a mis órdenes.',
  waveCleared: [
    'Primera oleada rechazada. Recuperad el aliento: vendrán más.',
    'Sus flechas no atraviesan nuestros escudos. Bien hecho.',
    'El borde del acantilado trabaja para nosotros. Mantened la línea.',
    'Ni su guardia de élite ha roto la falange. Queda la última embestida.',
  ],
  lowCohesion: '¡Cerrad filas! Si la línea se rompe, el paso está perdido.',
  breach: '¡Han cruzado la línea! No dejéis que se queden trabados: empujad o atacad.',
  exhausted: 'La primera línea no puede más. ¡Relevo!',
  victory: 'La línea ha resistido, {aliado}. Hoy el paso sigue siendo nuestro.',
  defeat: 'La línea ha cedido, {aliado}. Pero la Hélade recordará a quienes defendieron este paso.',
  // Enfrentamiento final con Jerjes I.
  bossIntro: 'Cinco oleadas rechazadas. Pero mirad al fondo del paso: Jerjes en persona nos observa desde su trono. Cerrad filas y recuperad el aliento, sus decretos llegarán uno tras otro.',
  decrees: {
    storm: 'Dicen que sus flechas taparán el sol. Como respondió Diéneces, lucharemos a la sombra: ¡escudos hasta la última descarga!',
    whips: 'Sus capitanes los azuzan a latigazos. ¡Empujad a los enfurecidos y se calmarán!',
    guard: 'Carga su guardia real. Empujad para desequilibrarlos y atacad sin pausa.',
  },
  bossPhase: '¡Jerjes se ha levantado de su trono! Teme por su ejército: no cedáis ahora.',
  victoryXerxes: 'Jerjes ordena la retirada. Hoy el paso es nuestro, {aliado}.',
  // Presentación: se pregunta al jugador cómo dirigirse a él antes de su primera batalla.
  askIdentity: 'Antes de la batalla, dime: ¿cómo debo dirigirme a ti? Responde «mujer», «hombre» o «prefiero no decirlo».',
  identityDone: 'Entendido, {aliado}. Ocupa tu puesto en la falange.',
};

export const LOW_COHESION = 35; // umbral del aviso de cerrar filas
