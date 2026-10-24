import { normalize } from './VoiceCommandManager.js';

/**
 * Quién dirige la falange. El jugador lo dice (por voz o con un botón); el
 * juego no lo deduce del sonido de la voz. Solo se usa para que Leónidas se
 * dirija a la persona correctamente y se guarda únicamente en el navegador.
 */
export const IDENTITIES = {
  female: { label: 'Mujer', ally: 'aliada' },
  male: { label: 'Hombre', ally: 'aliado' },
  unspecified: { label: 'Prefiero no decirlo', ally: 'estratega' },
};

// Respuestas reconocidas por voz (tabla cerrada, como las órdenes).
const ANSWERS = {
  female: ['mujer', 'femenino', 'aliada'],
  male: ['hombre', 'masculino', 'aliado', 'varon'],
  unspecified: ['prefiero no decirlo', 'no decirlo', 'prefiero no', 'neutro', 'otro', 'ninguno'],
};

/**
 * Interpreta la respuesta hablada a «¿cómo debo dirigirme a ti?».
 * @returns {{id: 'female'|'male'|'unspecified'|null, reason?: 'empty'|'unknown'|'ambiguous'}}
 */
export function matchIdentity(transcript) {
  const text = normalize(transcript);
  if (!text) return { id: null, reason: 'empty' };
  const padded = ` ${text} `;
  // «Prefiero no decirlo» gana aunque la frase nombre otra opción («no quiero decir si hombre o mujer»).
  if (ANSWERS.unspecified.some((a) => padded.includes(` ${a} `))) return { id: 'unspecified' };
  const found = ['female', 'male'].filter((id) => ANSWERS[id].some((a) => padded.includes(` ${a} `)));
  if (found.length === 1) return { id: found[0] };
  return { id: null, reason: found.length > 1 ? 'ambiguous' : 'unknown' };
}

/** Sustituye {aliado} / {Aliado} por la forma de trato elegida. */
export function personalize(text, identity = 'unspecified') {
  const ally = (IDENTITIES[identity] ?? IDENTITIES.unspecified).ally;
  return String(text)
    .replaceAll('{aliado}', ally)
    .replaceAll('{Aliado}', ally[0].toUpperCase() + ally.slice(1));
}
