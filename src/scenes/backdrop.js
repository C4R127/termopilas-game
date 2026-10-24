import Phaser from 'phaser';

/**
 * Escenario por capas (sección 6.1): cielo con nubes que se desplazan, Eubea y
 * el golfo, la ladera del Calídromo, el suelo del paso (mapa Tiled con su capa
 * de decoración) y el mar animado en primer plano. Lo comparten el menú, la
 * batalla, el tutorial y el resultado.
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
  const ambient = createAmbient(scene);
  scene.add.image(0, 0, 'layer-mountain').setOrigin(0).setDepth(-20);
  createGround(scene);
  const sea = scene.add.sprite(0, 160, 'sea', 0).setOrigin(0).setDepth(-8);
  if (!calm) sea.play('sea-waves');

  scene.events.on(Phaser.Scenes.Events.UPDATE, (_t, delta) => {
    ambient.update(delta);
    for (const cloud of clouds) {
      cloud.x += (cloud.speed * delta) / 1000;
      if (cloud.x > 320) {
        cloud.x = -64;
        cloud.y = Phaser.Math.Between(8, 40);
      }
    }
  });
}

/**
 * Ambiente del fondo: la flota persa navega despacio por el golfo, unas
 * gaviotas cruzan el cielo y sube el humo del campamento persa tras el paso.
 * Con «Reducir destellos y partículas» no hay humo y las gaviotas no aletean.
 */
function createAmbient(scene) {
  const calm = !!scene.reduceEffects;
  const ships = [
    scene.add.image(206, 97, 'fleet', 0).setOrigin(0).setDepth(-29),
    scene.add.image(290, 99, 'fleet', 1).setOrigin(0).setDepth(-29),
  ];
  ships.forEach((s, i) => { s.speed = 0.6 + i * 0.25; }); // px/s: casi inmóviles a esa distancia
  const gulls = [0, 1, 2].map((i) => {
    const g = scene.add.sprite(-20 - i * 60, 30 + i * 9, 'gulls', i % 2).setDepth(-34);
    g.speed = 9 + i * 3;
    g.baseY = g.y;
    g.phase = i * 1.7;
    if (!calm) g.play({ key: 'gull-flap', startFrame: i % 2 });
    return g;
  });
  if (!calm) {
    // Humo de las hogueras del campamento persa, más allá del borde derecho.
    for (const x of [304, 318]) {
      scene.add.particles(x, 104, 'particles', {
        frame: 4, speedY: { min: -9, max: -5 }, speedX: { min: -3, max: 1 }, lifespan: 7000,
        scale: { start: 1, end: 2.6 }, alpha: { start: 0.55, end: 0 }, frequency: 420, maxParticles: 24,
      }).setDepth(-25);
    }
  }
  let t = 0;
  return {
    update(delta) {
      t += delta / 1000;
      for (const s of ships) {
        s.x -= (s.speed * delta) / 1000;
        if (s.x < 140) s.x = 320; // reaparece por la derecha tras cruzar detrás de la ladera
      }
      for (const g of gulls) {
        g.x += (g.speed * delta) / 1000;
        g.y = g.baseY + Math.sin(t * 0.8 + g.phase) * 3;
        if (g.x > 340) {
          g.x = -20;
          g.baseY = 24 + Math.random() * 26;
        }
      }
    },
  };
}

/**
 * Suelo del paso desde `maps/pass.json` (formato Tiled): la capa de tiles «suelo»
 * y la capa de objetos «decoracion» (sin colisión). La capa «logica» no se dibuja:
 * documenta los carriles, que la simulación toma de LANE (balance.js).
 */
function createGround(scene) {
  const map = scene.make.tilemap({ key: 'map-pass' });
  const tiles = map.addTilesetImage('pass-tiles', 'tiles-pass');
  const ground = map.createLayer('suelo', tiles);
  ground.setDepth(-10);
  for (const obj of map.getObjectLayer('decoracion')?.objects ?? []) {
    const props = Object.fromEntries((obj.properties ?? []).map((p) => [p.name, p.value]));
    // Los objetos de Tiled se anclan en su esquina inferior izquierda.
    scene.add.image(obj.x, obj.y, props.textura, props.fotograma ?? 0).setOrigin(0, 1).setDepth(-9);
  }
  return map;
}
