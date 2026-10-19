import Phaser from 'phaser';
import './styles/main.css';
import { createApp } from './app.js';
import { fitZoom, gameConfig } from './config/gameConfig.js';
import { COMMANDS } from './data/commands.js';

const app = createApp();
const game = new Phaser.Game(gameConfig);
app.game = game;
game.registry.set('app', app);

// Teclado: 1–4 órdenes, P/Esc pausa, V micrófono, M silencio.
const TACTICAL_KEYS = new Map(COMMANDS.filter((c) => c.tactical).flatMap((c) => c.keys.map((k) => [k, c.id])));

window.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, select, textarea')) return;
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === 'KeyV') {
    app.toggleVoice();
    return;
  }
  if (e.code === 'KeyM') {
    const muted = app.audio.toggleMute();
    if (app.inBattle) app.hud.alert(muted ? 'Sonido desactivado' : 'Sonido activado', 'info', 1200);
    return;
  }
  if (!app.inBattle) return;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    // Con una confirmación abierta, Esc la cierra en lugar de reanudar.
    const confirmBox = document.querySelector('.confirm-box');
    if (e.code === 'Escape' && confirmBox) confirmBox.remove();
    else app.togglePause('keyboard');
    e.preventDefault();
    return;
  }
  const id = TACTICAL_KEYS.get(e.code);
  if (id) {
    e.preventDefault();
    app.sendCommand(id, 'keyboard');
  }
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
