// Variantes de luz: el momento del día cambia el color de toda la escena con una
// matriz de color sobre la cámara (WebGL) y, de noche, añade estrellas, luna,
// antorchas en el muro de los focenses y hogueras del campamento persa.
// Es solo presentación: no cambia ninguna regla de juego.
import Phaser from 'phaser';
import { LIGHTS, lightMatrix } from '../config/lighting.js';
import { PARALLAX } from '../config/balance.js';

export { LIGHT_SETTING, resolveLight } from '../config/lighting.js';

const lerp = (a, b, k) => a + (b - a) * k;
const mix = (a, b, k) => ({
  mult: a.mult.map((v, i) => lerp(v, b.mult[i], k)),
  add: a.add.map((v, i) => lerp(v, b.add[i], k)),
  sat: lerp(a.sat, b.sat, k),
  night: lerp(a.night, b.night, k),
});

const TORCHES = [[6, 114], [22, 113]]; // sobre el muro de los focenses, detrás de la falange
const SUN = [262, 66]; // posición del sol en layer-sky (tools/art/build.mjs, skyLayer)
const CAMPFIRES = [[304, 106], [318, 105]]; // campamento persa, donde sube el humo

/**
 * Crea la iluminación de una escena. `set(id, ms)` cambia la luz con una
 * transición suave; `id` es la luz actual.
 */
export function createLighting(scene, id = 'dawn') {
  const webgl = scene.renderer.type === Phaser.WEBGL;
  const grade = webgl ? scene.cameras.main.postFX?.addColorMatrix() : null;
  const night = createNightLayer(scene);
  if (grade) {
    // El fuego no pasa por la matriz de color (si no, la noche lo volvería azul):
    // una segunda cámara dibuja solo las luces, encima y sin corrección.
    const fireCam = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height).setName('luces');
    scene.cameras.main.ignore(night.fire);
    const hide = (obj) => { if (!night.fire.includes(obj)) obj.cameraFilter |= fireCam.id; };
    scene.children.list.forEach(hide);
    scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, hide);
    // Cuando la cámara se desliza (Anopea), las luces la acompañan.
    const follow = () => { fireCam.scrollX = scene.cameras.main.scrollX; };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, hide);
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, follow);
    });
  }
  let current = mix(LIGHTS[id], LIGHTS[id], 0);
  let tween = null;

  const apply = (light) => {
    current = light;
    grade?.set(lightMatrix(light));
    night.setLevel(light.night);
  };
  apply(current);

  const controller = {
    id,
    set(next, ms = 3000) {
      if (!LIGHTS[next] || next === controller.id) return;
      controller.id = next;
      tween?.remove();
      const from = current;
      const to = LIGHTS[next];
      if (ms <= 0) {
        apply(mix(to, to, 0));
        return;
      }
      tween = scene.tweens.addCounter({ from: 0, to: 1, duration: ms, ease: 'Sine.easeInOut', onUpdate: (tw) => apply(mix(from, to, tw.getValue())) });
    },
  };
  return controller;
}

/** Estrellas, luna, antorchas y hogueras: visibles en proporción a `night`. */
function createNightLayer(scene) {
  const calm = !!scene.reduceEffects;
  const items = [];
  const rnd = new Phaser.Math.RandomDataGenerator(['termopilas-noche']); // el mismo cielo en cada partida
  // Estrellas sobre el cielo, por debajo de las nubes.
  const stars = [];
  for (let i = 0; i < 44; i++) {
    const s = scene.add.rectangle(rnd.between(-66, 318), rnd.between(2, 62), 1, 1, i % 5 ? 0xf3e7c9 : 0xffffff).setOrigin(0).setDepth(-39).setScrollFactor(PARALLAX.sky, 1);
    s.base = rnd.realInRange(0.45, 1);
    s.phase = rnd.realInRange(0, Math.PI * 2);
    stars.push(s);
  }
  items.push(...stars);
  // Luna creciente: un disco claro mordido por otro del color del cielo nocturno.
  const moon = scene.add.circle(252, 20, 5, 0xf3e7c9).setDepth(-38).setScrollFactor(PARALLAX.sky, 1);
  const bite = scene.add.circle(255, 18, 4.5, 0x33425e).setDepth(-38).setScrollFactor(PARALLAX.sky, 1);
  items.push(moon, bite);
  // Velo nocturno sobre el cielo (el sol del amanecer queda oculto).
  const veil = scene.add.rectangle(-120, 0, 440, 100, 0x1d2638).setOrigin(0).setDepth(-39.5).setScrollFactor(PARALLAX.sky, 1);
  const sunCover = scene.add.circle(SUN[0], SUN[1], 11, 0x1d2638).setDepth(-39.4).setScrollFactor(PARALLAX.sky, 1); // el sol del amanecer, pintado en el cielo
  items.push(veil, sunCover);
  // Antorchas y hogueras: halos aditivos en anillos escalonados (luz «pixel») que parpadean.
  const lights = [];
  const flames = [];
  const fire = []; // objetos que no pasan por la corrección de color
  const glow = (x, y, radius, base) => {
    for (const [k, a] of [[1, 0.16], [0.66, 0.2], [0.36, 0.34]]) {
      const ring = scene.add.circle(x, y, Math.round(radius * k), 0xff9a3a).setBlendMode(Phaser.BlendModes.ADD).setDepth(1890);
      lights.push({ halo: ring, base: base * a });
      fire.push(ring);
    }
  };
  for (const [x, y] of TORCHES) {
    const pole = scene.add.rectangle(x, y, 2, 12, 0x5b3a22).setOrigin(0.5, 1).setDepth(y * 10 - 1);
    const flame = scene.add.ellipse(x, y - 13, 3, 5, 0xffc060).setDepth(1889);
    items.push(pole, flame);
    fire.push(flame);
    flames.push(flame);
    glow(x, y - 13, 26, 1);
  }
  for (const [x, y] of CAMPFIRES) {
    const flame = scene.add.ellipse(x, y, 3, 2, 0xffc070).setDepth(1889);
    items.push(flame);
    fire.push(flame);
    flames.push(flame);
    glow(x, y, 10, 1.2);
  }
  const sparks = calm ? [] : TORCHES.map(([x, y]) => scene.add.particles(x, y - 15, 'particles', {
    frame: 1, speedY: { min: -14, max: -6 }, speedX: { min: -3, max: 3 }, lifespan: 600, scale: { start: 0.6, end: 0 },
    tint: [0xffc070, 0xe8a63a], blendMode: Phaser.BlendModes.ADD, frequency: 160, maxParticles: 12, emitting: false,
  }).setDepth(1891));
  fire.push(...sparks);
  items.push(...fire.filter((o) => !items.includes(o) && !sparks.includes(o)));

  let level = -1;
  let t = 0;
  const onUpdate = (_time, delta) => {
    if (level <= 0) return;
    t += delta / 1000;
    for (const s of stars) s.alpha = level * (calm ? s.base : s.base * (0.75 + 0.25 * Math.sin(t * 2 + s.phase)));
    for (const l of lights) {
      const flicker = calm ? 1 : 0.85 + Math.random() * 0.3;
      l.halo.alpha = level * l.base * flicker;
    }
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));

  return {
    fire,
    setLevel(value) {
      if (Math.abs(value - level) < 0.001) return;
      level = value;
      const visible = level > 0.01;
      for (const item of items) item.setVisible(visible);
      for (const s of stars) s.alpha = level * s.base;
      moon.alpha = level;
      bite.alpha = level;
      veil.alpha = level * 0.55;
      sunCover.alpha = level * 0.85;
      for (const l of lights) l.halo.alpha = level * l.base;
      for (const f of flames) f.alpha = Math.min(1, level * 1.4);
      for (const p of sparks) p.emitting = level > 0.5;
    },
  };
}
