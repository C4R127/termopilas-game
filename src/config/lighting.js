// Variantes de luz (datos y cálculos puros; el dibujo vive en scenes/lighting.js).

export const LIGHTS = {
  // mult: ganancia por canal; add: desplazamiento (0–255); sat: saturación; night: capa nocturna (0–1).
  dawn: { label: 'Amanecer', mult: [1, 1, 1], add: [0, 0, 0], sat: 1, night: 0 },
  day: { label: 'Mediodía', mult: [1.05, 1.05, 1.08], add: [12, 12, 14], sat: 0.84, night: 0 },
  dusk: { label: 'Atardecer', mult: [1.08, 0.84, 0.7], add: [14, 2, 0], sat: 1.15, night: 0 },
  night: { label: 'Noche', mult: [0.6, 0.66, 0.92], add: [2, 6, 20], sat: 0.72, night: 1 },
};

/** Opciones del ajuste «Iluminación». */
export const LIGHT_SETTING = {
  auto: 'Automática', // la luz avanza con la batalla
  dawn: 'Amanecer',
  day: 'Mediodía',
  dusk: 'Atardecer',
  night: 'Noche',
};

/**
 * Momento del día automático. La campaña avanza del amanecer a la noche (Jerjes
 * llega con la última luz); en la senda de Anopea los persas bajan de noche y
 * atacan con el día. El tutorial, a mediodía.
 */
export function autoLight(sceneKey, { waveIndex = 0, boss = false } = {}) {
  if (sceneKey === 'TutorialScene') return 'day';
  if (sceneKey === 'AnopaeaScene') return ['night', 'dawn', 'day', 'day'][Math.min(waveIndex, 3)];
  if (sceneKey === 'BattleScene') return boss ? 'night' : ['dawn', 'dawn', 'day', 'dusk', 'dusk'][Math.min(waveIndex, 4)];
  return 'dawn';
}

/** Luz que corresponde según el ajuste: fija o automática. */
export function resolveLight(setting, sceneKey, ctx) {
  return LIGHTS[setting] ? setting : autoLight(sceneKey, ctx);
}

const LUM = [0.2126, 0.7152, 0.0722];

/** Matriz de color 5 × 4 (formato de Phaser.Display.ColorMatrix) para una luz. */
export function lightMatrix({ mult, add, sat }) {
  const m = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) m.push(mult[row] * (LUM[col] * (1 - sat) + (row === col ? sat : 0)));
    m.push(0, add[row]);
  }
  m.push(0, 0, 0, 1, 0);
  return m;
}
