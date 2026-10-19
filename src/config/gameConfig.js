import Phaser from 'phaser';
import { WORLD } from './balance.js';
import { BootScene } from '../scenes/BootScene.js';
import { PreloadScene } from '../scenes/PreloadScene.js';
import { MenuScene } from '../scenes/MenuScene.js';
import { BattleScene } from '../scenes/BattleScene.js';
import { HUDScene } from '../scenes/HUDScene.js';
import { ResultScene } from '../scenes/ResultScene.js';

/** Resolución lógica de 320 × 180, ampliada sin suavizado (ver fitZoom). */
export const gameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: WORLD.width,
  height: WORLD.height,
  backgroundColor: '#17120e',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.NONE, zoom: 3 },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
  fps: { target: 60 },
  scene: [BootScene, PreloadScene, MenuScene, BattleScene, HUDScene, ResultScene],
};

/**
 * Zoom para encajar 320 × 180 en el espacio disponible. Se prefiere un factor
 * entero (píxeles idénticos); si desperdicia demasiado espacio, se usa uno
 * fraccionario, igualmente sin suavizado.
 */
export function fitZoom(width, height) {
  const exact = Math.min(width / WORLD.width, height / WORLD.height);
  if (!Number.isFinite(exact) || exact <= 0) return 1;
  const whole = Math.floor(exact);
  if (whole >= 1 && whole / exact >= 0.85) return whole;
  return Math.max(0.5, Math.floor(exact * 4) / 4);
}
