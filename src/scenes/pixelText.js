// Texto dentro del lienzo con la fuente pixel de 3 × 5 (solo mayúsculas sin tildes).

export const PIXEL_FONT = 'pixel';

export function toPixelText(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¡¿«»]/g, '')
    .toUpperCase();
}

export function pixelText(scene, x, y, text, { origin = 0.5, tint, depth = 900 } = {}) {
  const t = scene.add.bitmapText(Math.round(x), Math.round(y), PIXEL_FONT, toPixelText(text)).setOrigin(origin).setDepth(depth);
  if (tint != null) t.setTint(tint);
  return t;
}

/** Texto flotante que sube y se desvanece (daño, avisos sobre el campo). */
export function floatText(scene, x, y, text, tint = 0xffffff) {
  const t = pixelText(scene, x, y, text, { tint, depth: 950 });
  scene.tweens.add({ targets: t, y: y - 12, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  return t;
}
