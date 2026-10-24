import Phaser from 'phaser';
import './styles/main.css';
import { createApp } from './app.js';
import { fitZoom, gameConfig } from './config/gameConfig.js';

const app = createApp();
const game = new Phaser.Game(gameConfig);
app.game = game;
game.registry.set('app', app);

// Teclado: las teclas de cada acción vienen de los ajustes (se pueden reasignar).
// Esc siempre pausa, cierra la confirmación abierta o vuelve atrás en los menús.
window.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, select, textarea')) return;
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const screens = app.screens;
  if (e.code === 'Escape') {
    const confirmBox = document.querySelector('.confirm-box');
    if (confirmBox) confirmBox.remove();
    else if (['controls', 'settings', 'epilogue'].includes(screens.current)) screens.back();
    else app.togglePause('keyboard');
    e.preventDefault();
    return;
  }
  const action = app.settings.actionFor(e.code);
  if (!action) return;
  e.preventDefault();
  if (action === 'VOICE') app.toggleVoice();
  else if (action === 'MUTE') {
    const muted = !app.settings.get('audio', 'muted');
    app.settings.set('audio', 'muted', muted);
    if (app.inBattle) app.hud.alert(muted ? 'Sonido desactivado' : 'Sonido activado', 'info', 1200);
  } else if (action === 'PAUSE') {
    // Con Ajustes o Controles abiertos durante la pausa, la tecla de pausa no reanuda por accidente.
    if (screens.current === null || screens.current === 'pause') app.togglePause('keyboard');
  } else app.sendCommand(action, 'keyboard');
});

// Botones en pantalla.
document.getElementById('hud-bottom').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-cmd]');
  if (btn) app.sendCommand(btn.dataset.cmd, 'button');
});
document.getElementById('pause-btn').addEventListener('click', () => app.togglePause('button'));
document.getElementById('mic-btn').addEventListener('click', () => app.toggleVoice());
window.addEventListener('pointerdown', () => app.audio.unlock(), { once: true });

// Escalado del lienzo al espacio disponible manteniendo la proporción 16:9.
const holder = document.getElementById('game');
const fit = () => {
  const { width, height } = holder.getBoundingClientRect();
  if (width > 0 && height > 0) game.scale.setZoom(fitZoom(width, height));
};
game.events.once('ready', () => {
  fit();
  new ResizeObserver(fit).observe(holder);
});

// Acceso de depuración y pruebas manuales desde la consola (solo en desarrollo).
if (import.meta.env.DEV) window.__termopilas = app;
