/**
 * Cómo se dirige Leónidas a quien juega: «aliada» o «aliado». Antes de la
 * batalla se estima por el tono de la voz en el panel «Antes de la batalla»
 * (ver PitchSensor), o se elige con un botón; también se puede fijar en Ajustes.
 */
export const IDENTITIES = {
  female: { label: 'Aliada', ally: 'aliada' },
  male: { label: 'Aliado', ally: 'aliado' },
};

/** Opciones del ajuste «Leónidas se dirige a ti como». */
export const ADDRESS_OPTIONS = {
  auto: 'Automático (por el tono de voz)',
  female: 'Aliada',
  male: 'Aliado',
};

/**
 * Umbral de la frecuencia fundamental mediana (Hz): las voces más graves que
 * esto se tratan como «aliado» y las más agudas como «aliada». Está entre los
 * tonos habituales de voces graves (unos 85–155 Hz) y agudas (unos 165–255 Hz);
 * si no acierta, el jugador lo corrige con un botón.
 */
export const PITCH_SPLIT_HZ = 165;

/** Forma de trato a partir del tono medio de la voz (null si no hay tono). */
export function identityFromPitch(medianHz) {
  if (!Number.isFinite(medianHz)) return null;
  return medianHz < PITCH_SPLIT_HZ ? 'male' : 'female';
}

/** Trato efectivo: el fijado en Ajustes o, en automático, el decidido antes de la batalla (null si aún no hay). */
export function resolveIdentity(address, detected) {
  if (IDENTITIES[address]) return address;
  return IDENTITIES[detected] ? detected : null;
}

/** Sustituye {aliado} / {Aliado} por la forma de trato («aliado/a» solo si aún no se conoce). */
export function personalize(text, identity) {
  const ally = IDENTITIES[identity]?.ally ?? 'aliado/a';
  return String(text)
    .replaceAll('{aliado}', ally)
    .replaceAll('{Aliado}', ally[0].toUpperCase() + ally.slice(1));
}
