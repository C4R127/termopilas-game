/**
 * Cómo se dirige Leónidas a quien juega. En automático se estima por el tono
 * de la voz al dar las órdenes (ver PitchSensor); también se puede fijar en
 * Ajustes. Solo cambia la forma de trato: «aliada», «aliado» o «estratega».
 */
export const IDENTITIES = {
  female: { label: 'Aliada', ally: 'aliada' },
  male: { label: 'Aliado', ally: 'aliado' },
  unspecified: { label: 'Estratega', ally: 'estratega' },
};

/** Opciones del ajuste «Leónidas se dirige a ti como». */
export const ADDRESS_OPTIONS = {
  auto: 'Automático (por el tono de voz)',
  female: 'Aliada',
  male: 'Aliado',
  unspecified: 'Estratega',
};

/**
 * Umbrales de la frecuencia fundamental mediana (Hz). Las voces graves suelen
 * quedar por debajo de 155 Hz y las agudas por encima de 175 Hz; entre medias
 * el tono no basta para decidir y Leónidas usa la forma neutra.
 */
export const PITCH_THRESHOLDS = { low: 155, high: 175 };

/** Forma de trato a partir del tono medio de la voz. */
export function identityFromPitch(medianHz) {
  if (!Number.isFinite(medianHz)) return 'unspecified';
  if (medianHz < PITCH_THRESHOLDS.low) return 'male';
  if (medianHz > PITCH_THRESHOLDS.high) return 'female';
  return 'unspecified';
}

/** Trato efectivo: el fijado en Ajustes o, en automático, el detectado (neutro hasta entonces). */
export function resolveIdentity(address, detected) {
  if (IDENTITIES[address]) return address;
  return IDENTITIES[detected] ? detected : 'unspecified';
}

/** Sustituye {aliado} / {Aliado} por la forma de trato. */
export function personalize(text, identity = 'unspecified') {
  const ally = (IDENTITIES[identity] ?? IDENTITIES.unspecified).ally;
  return String(text)
    .replaceAll('{aliado}', ally)
    .replaceAll('{Aliado}', ally[0].toUpperCase() + ally.slice(1));
}
