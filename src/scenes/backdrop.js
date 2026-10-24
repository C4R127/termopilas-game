import Phaser from 'phaser';

/**
 * Escenario por capas (sección 6.1): cielo con nubes que se desplazan, Eubea y
 * el golfo, la ladera del Calídromo, el paso y el mar animado en primer plano.
 * Lo comparten el menú, la batalla, el tutorial y el resultado.
 */
export function createBackdrop(scene, { calm = false } = {}) {
  scene.add.image(0, 0, 'layer-sky').setOrigin(0).setDepth(-40);
  const clouds = [];
  for (let i = 0; i < 4; i++) {
    const cloud = scene.add.image(Phaser.Math.Between(-40, 320), Phaser.Math.Between(8, 40), 'clouds', i % 3).setOrigin(0).setDepth(-35).setAlpha(0.9);
    cloud.speed = Phaser.Math.FloatBetween(1.5, 4); // px/s: un desplazamiento lento y suave
    clouds.push(cloud);
  }
  scene.add.image(0, 0, 'layer-far').setOrigin(0).setDepth(-30);
  scene.add.image(0, 0, 'layer-mountain').setOrigin(0).setDepth(-20);
  scene.add.image(0, 0, 'layer-ground').setOrigin(0).setDepth(-10);
  const sea = scene.add.sprite(0, 160, 'sea', 0).setOrigin(0).setDepth(-8);
  if (!calm) sea.play('sea-waves');

  scene.events.on(Phaser.Scenes.Events.UPDATE, (_t, delta) => {
    for (const cloud of clouds) {
      cloud.x += (cloud.speed * delta) / 1000;
      if (cloud.x > 320) {
        cloud.x = -64;
        cloud.y = Phaser.Math.Between(8, 40);
      }
    }
  });
}
