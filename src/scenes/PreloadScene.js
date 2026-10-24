import Phaser from 'phaser';
import { PIXEL_FONT } from './pixelText.js';

const FRAME = { frameWidth: 20, frameHeight: 20 };

/** Carga sprites, fondos, iconos y fuente; muestra el progreso y crea las animaciones. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    const { width, height } = this.scale;
    const box = this.add.rectangle(width / 2, height / 2, 122, 8).setStrokeStyle(1, 0x8a5a26);
    const bar = this.add.rectangle(box.x - 60, box.y, 1, 4, 0xc2873a).setOrigin(0, 0.5);
    this.load.on('progress', (p) => { bar.width = Math.max(1, 120 * p); });
    this.load.on('loaderror', (file) => console.error(`No se pudo cargar ${file.src}`));

    this.load.setPath('assets/');
    for (const layer of ['sky', 'far', 'mountain', 'ground']) this.load.image(`layer-${layer}`, `images/backgrounds/layer-${layer}.png`);
    this.load.image('bg-pass', 'images/backgrounds/pass.png');
    this.load.spritesheet('sea', 'images/backgrounds/sea.png', { frameWidth: 320, frameHeight: 20 });
    this.load.spritesheet('clouds', 'images/backgrounds/clouds.png', { frameWidth: 64, frameHeight: 12 });
    this.load.spritesheet('hoplite', 'images/characters/hoplite.png', FRAME);
    this.load.spritesheet('infantry', 'images/characters/persian-infantry.png', FRAME);
    this.load.spritesheet('archer', 'images/characters/persian-archer.png', FRAME);
    this.load.spritesheet('elite', 'images/characters/persian-elite.png', FRAME);
    this.load.spritesheet('xerxes', 'images/characters/xerxes.png', { frameWidth: 40, frameHeight: 48 });
    this.load.image('arrow', 'images/effects/arrow.png');
    this.load.spritesheet('particles', 'images/effects/particles.png', { frameWidth: 4, frameHeight: 4 });
    this.load.spritesheet('icons', 'images/ui/icons.png', { frameWidth: 12, frameHeight: 12 });
    this.load.image('font-pixel', 'fonts/pixel-3x5.png');
    this.load.json('font-pixel-def', 'fonts/pixel-3x5.json');
  }

  create() {
    const def = this.cache.json.get('font-pixel-def');
    const font = Phaser.GameObjects.RetroFont.Parse(this, {
      image: 'font-pixel',
      width: def.width,
      height: def.height,
      chars: def.chars,
      charsPerRow: def.perRow,
      spacing: { x: 0, y: 0 },
      offset: { x: 0, y: 0 },
      lineSpacing: 1,
    });
    this.cache.bitmapFont.add(PIXEL_FONT, font);
    this.#createAnimations();
    this.scene.start('MenuScene');
  }

  #createAnimations() {
    const anim = (key, sheet, frames, frameRate, repeat = -1) => {
      this.anims.create({ key, frames: this.anims.generateFrameNumbers(sheet, { frames }), frameRate, repeat });
    };
    anim('sea-waves', 'sea', [0, 1, 2, 3], 3);
    anim('hop-idle', 'hoplite', [0, 1], 2);
    anim('hop-shields', 'hoplite', [2, 3], 2);
    anim('hop-thrust', 'hoplite', [4, 5, 4], 5);
    anim('hop-push', 'hoplite', [6, 7], 8, 0);
    anim('hop-tired', 'hoplite', [8, 9], 1.5);
    anim('hop-walk', 'hoplite', [10, 11], 6);
    anim('hop-defeat', 'hoplite', [8, 12, 13], 3, 0);
    anim('hop-victory', 'hoplite', [14, 15], 3);
    anim('inf-walk', 'infantry', [0, 1, 2, 3], 6);
    anim('inf-attack', 'infantry', [4, 5], 2.5);
    anim('arc-walk', 'archer', [0, 1, 2, 3], 7);
    anim('arc-melee', 'archer', [1, 3], 2.5);
    anim('arc-release', 'archer', [5, 5, 4], 6, 0);
    anim('eli-walk', 'elite', [0, 1, 2, 3], 5);
    anim('eli-attack', 'elite', [4, 5], 2);
  }
}
