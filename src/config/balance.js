// Valores de balance de la beta (Avance 1). Son decisiones de diseño, no datos
// históricos: se ajustan con `npm run simulate` y pruebas con jugadores.
// Unidades: tiempo en milisegundos, distancias en píxeles lógicos (320 × 180).

export const WORLD = {
  width: 320,
  height: 180,
};

// Geometría del paso: la formación aliada a la izquierda, el enemigo entra por la derecha.
export const LANE = {
  frontX: 92, // borde delantero de la falange
  contactGap: 9, // distancia a la que un enemigo queda trabado con la primera línea
  enemyGap: 11, // separación mínima entre enemigos de la misma fila
  spawnX: 336, // fuera de pantalla, a la derecha
  archerStopX: 238, // los arqueros se detienen fuera del alcance de las lanzas
  // Filas del carril (pies de los sprites). La fila 2 linda con el acantilado.
  rowsY: [124, 134, 144],
  edgeRow: 2,
};

export const FORMATION = {
  cohesionMax: 100,
  staminaMax: 100,
  moraleMax: 100,
  moraleStart: 70,
  modeChangeMs: 350, // bloqueo breve tras un cambio de estado; admite una orden pendiente
};

export const SPEARS = {
  range: 24, // alcance desde el frente de la formación
  dps: 12, // daño por segundo al enemigo más adelantado de cada fila
  staminaPerSec: 3.2, // coste mientras hay enemigos al alcance
  idleStaminaPerSec: 0.4,
  minStamina: 10, // por debajo no se pueden adelantar las lanzas
};

export const SHIELDS = {
  meleeFactor: 0.5, // los escudos reducen a la mitad la presión cuerpo a cuerpo
  staminaPerSec: -1.4, // negativo: tras los escudos la formación recupera aliento
};

export const PUSH = {
  cooldownMs: 6000,
  durationMs: 500,
  staminaCost: 18,
  range: 42,
  damage: 6,
  knockbackSpeed: 140, // px/s iniciales
  knockbackDecel: 210, // px/s² → retroceso ≈ 47 px
  stunMs: 900,
};

export const RELIEF = {
  cooldownMs: 10000,
  durationMs: 1500,
  staminaGain: 45,
  meleeFactor: 1.3, // durante el cambio de línea la formación es más vulnerable
};

export const EXHAUSTED = {
  meleeFactor: 1.5,
  staminaPerSec: -2, // recuperación lenta mientras está agotada
};

export const ARROWS = {
  damagePerArcher: 11,
  maxDamage: 30,
  flightMs: 900,
  moralePenalty: 4,
};

export const BREACH = {
  contactMs: 7000, // tiempo trabado sin caer antes de abrir brecha
  cohesionLoss: 8,
  moralePenalty: 8,
  maxBreaches: 4, // con este número de brechas la línea cede
};

export const MORALE = {
  waveBonus: 10,
  killBonus: 1,
  edgeKillBonus: 2,
  highThreshold: 75,
  lowThreshold: 30,
  highFactor: 1.2,
  lowFactor: 0.8,
};

export const INTERMISSION = {
  durationMs: 4000, // dentro del rango de diseño de 3–6 s
  staminaPerSec: 8,
  cohesionBonus: 10,
};

export const VOICE = {
  lang: 'es-PE',
  fallbackLang: 'es-ES',
  minConfidence: 0.45, // solo se aplica si el navegador informa confianza
  repeatCooldownMs: 1200, // la misma orden por voz no se repite antes de este tiempo
};
