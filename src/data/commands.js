// Tabla cerrada de órdenes (sección 4 y 7.3 del documento de diseño).
// Los nombres visibles deben coincidir en HUD, controles y ajustes.

export const COMMAND_IDS = Object.freeze({
  SHIELDS: 'SHIELDS',
  SPEARS: 'SPEARS',
  PUSH: 'PUSH',
  RELIEF: 'RELIEF',
  PAUSE: 'PAUSE',
  RESUME: 'RESUME',
});

export const COMMANDS = [
  {
    id: COMMAND_IDS.SHIELDS,
    label: 'Escudos',
    aliases: ['escudos', 'falange'],
    keys: ['Digit1', 'Numpad1'],
    keyLabel: '1',
    tactical: true,
    icon: 0,
    help: 'Bloquea las lluvias de flechas. No ataca.',
  },
  {
    id: COMMAND_IDS.SPEARS,
    label: 'Lanzas',
    aliases: ['lanzas'],
    keys: ['Digit2', 'Numpad2'],
    keyLabel: '2',
    tactical: true,
    icon: 1,
    help: 'Ataca a los enemigos al alcance. Las flechas sí hacen daño.',
  },
  {
    id: COMMAND_IDS.PUSH,
    label: 'Empujen',
    aliases: ['empujen'],
    keys: ['Digit3', 'Numpad3'],
    keyLabel: '3',
    tactical: true,
    icon: 2,
    help: 'Retroceso breve. Junto al acantilado, los enemigos caen al mar.',
  },
  {
    id: COMMAND_IDS.RELIEF,
    label: 'Relevo',
    // «fuego» es solo un alias de juego para el relevo, no una orden de armas de fuego.
    aliases: ['relevo', 'cambio', 'fuego'],
    keys: ['Digit4', 'Numpad4'],
    keyLabel: '4',
    tactical: true,
    icon: 3,
    help: 'La reserva sustituye a la primera línea y recupera resistencia.',
  },
  {
    id: COMMAND_IDS.PAUSE,
    label: 'Pausa',
    aliases: ['pausa'],
    keys: ['KeyP', 'Escape'],
    keyLabel: 'P / Esc',
    tactical: false,
    help: 'Congela la partida.',
  },
  {
    id: COMMAND_IDS.RESUME,
    label: 'Continuar',
    aliases: ['continuar', 'reanudar'],
    keys: ['KeyP', 'Escape'],
    keyLabel: 'P / Esc',
    tactical: false,
    help: 'Reanuda la partida pausada.',
  },
];

export const TACTICAL_COMMANDS = COMMANDS.filter((c) => c.tactical);

export function getCommand(id) {
  return COMMANDS.find((c) => c.id === id) ?? null;
}
