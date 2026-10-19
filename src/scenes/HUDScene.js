import Phaser from 'phaser';
import { RELIEF } from '../config/balance.js';
import { RANK_X } from '../entities/FormationView.js';
import { EVENTS } from '../systems/EventBus.js';
import { pixelText, toPixelText } from './pixelText.js';

const HUD_REFRESH_MS = 100;

/**
 * Corre en paralelo a BattleScene. Mantiene al día el HUD HTML (barras,
 * estado, enfriamientos) y dibuja en el lienzo los avisos de oleada y la
 * cuenta atrás de las lluvias de flechas. No contiene reglas de juego.
 */
export class HUDScene extends Phaser.Scene {
  constructor() {
    super('HUDScene');
  }

  create() {
    this.app = this.registry.get('app');
    const { bus, hud } = this.app;
    this.acc = HUD_REFRESH_MS;
    this.ready = { PUSH: true, RELIEF: true };
    this.volleyAlert = null;

    // Banda de oleada en el lienzo.
    this.band = this.add.rectangle(160, 44, 320, 15, 0x120d0a, 0.75).setVisible(false);
    this.bandText = pixelText(this, 160, 44, '').setVisible(false);
    this.countdown = pixelText(this, 160, 60, '', { tint: 0xecc272 }).setVisible(false);
    // Aviso de flechas sobre la falange con barra de tiempo restante.
    this.warn = this.add.container(RANK_X[1], 86).setVisible(false);
    this.warn.add([
      this.add.rectangle(0, 0, 58, 16, 0x3a1511, 0.85).setStrokeStyle(1, 0xd0533f),
      this.add.image(-21, -1, 'icons', 4),
      pixelText(this, 6, -3, 'FLECHAS!', { tint: 0xffd0a0 }),
      this.add.rectangle(-26, 5, 52, 2, 0x5a1d17).setOrigin(0, 0.5),
    ]);
    this.warnBar = this.add.rectangle(-26, 5, 52, 2, 0xe8a63a).setOrigin(0, 0.5);
    this.warn.add(this.warnBar);

    this.offs = [
      bus.on(EVENTS.WAVE_STARTED, ({ index, wave, total }) => {
        this.#banner(`Oleada ${index + 1}/${total}: ${wave.name}`);
        hud.alert(`Oleada ${index + 1}: ${wave.name}`, 'info', 2600);
        hud.alert(wave.hint, 'info', 5200);
        this.app.audio.play('wave');
      }),
      bus.on(EVENTS.WAVE_COMPLETED, ({ index, last }) => {
        if (!last) {
          this.#banner(`Oleada ${index + 1} superada`);
          hud.alert('Oleada superada · la formación recupera aliento', 'ok', 2600);
        }
      }),
      bus.on(EVENTS.VOLLEY_WARNING, ({ warningMs, fireAt }) => {
        this.warnUntil = fireAt;
        this.warnTotal = warningMs;
        this.warn.setVisible(true);
        this.volleyAlert?.remove();
        this.volleyAlert = hud.alert('¡Lluvia de flechas! Ordena ESCUDOS', 'danger', 0, { icon: 4 });
        this.app.audio.play('warning');
      }),
      bus.on(EVENTS.VOLLEY_FIRED, () => {
        this.warnUntil = 0;
      }),
      bus.on(EVENTS.VOLLEY_IMPACT, ({ blocked, damage }) => {
        this.warn.setVisible(false);
        this.volleyAlert?.remove();
        this.volleyAlert = null;
        if (blocked) hud.alert('Flechas bloqueadas por los escudos', 'ok', 1500, { icon: 0 });
        else hud.alert(`¡Impacto de flechas! −${damage} de cohesión`, 'danger', 2200, { icon: 4 });
      }),
      bus.on(EVENTS.ENEMY_BREACH, ({ breaches, max }) => hud.alert(`¡Brecha en la línea! (${breaches}/${max})`, 'danger', 2400)),
      bus.on(EVENTS.RELIEF_DONE, () => hud.alert(`Relevo completado: +${RELIEF.staminaGain} de resistencia`, 'ok', 1800, { icon: 3 })),
      bus.on(EVENTS.FORMATION_CHANGED, ({ reason }) => {
        if (reason === 'stamina') hud.alert('Formación agotada: ordena RELEVO o ESCUDOS', 'warn', 3200, { icon: 3 });
      }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.offs.forEach((off) => off());
      this.volleyAlert?.remove();
    });
  }

  update(_time, delta) {
    const { state, sim, hud } = this.app;
    if (!sim) return;
    const waves = sim.waves;

    if (this.warn.visible && this.warnTotal) {
      const left = Math.max(0, this.warnUntil - state.simTime);
      this.warnBar.width = 52 * (left / this.warnTotal);
      this.warn.alpha = left < 600 && Math.floor(state.simTime / 120) % 2 ? 0.6 : 1;
    }

    const next = waves.timeToNextWave;
    const showCountdown = waves.resting && state.waveIndex > 0 && next > 0;
    this.countdown.setVisible(showCountdown);
    if (showCountdown) this.countdown.setText(`SIGUIENTE OLEADA EN ${Math.ceil(next / 1000)}`);

    this.acc += delta;
    if (this.acc < HUD_REFRESH_MS) return;
    this.acc = 0;
    const snap = state.snapshot();
    const { spawned, total } = waves.spawnProgress;
    const waveFrac = waves.phase === 'intermission' ? 0 : total ? (spawned - state.activeEnemies) / total : 0;
    hud.update(snap, {
      total: waves.total,
      name: waves.current?.name ?? '—',
      progress: Math.min(1, (state.waveIndex + Math.max(0, waveFrac)) / waves.total),
    });
    this.#readyNotice('PUSH', snap.pushReadyIn, 'Empuje listo', 2);
    this.#readyNotice('RELIEF', snap.reliefReadyIn, 'Relevo disponible', 3);
  }

  /** Avisa una vez cuando una orden con enfriamiento vuelve a estar disponible. */
  #readyNotice(id, remaining, text, icon) {
    const ready = remaining <= 0;
    if (ready && !this.ready[id]) this.app.hud.alert(text, 'info', 1300, { icon });
    this.ready[id] = ready;
  }

  #banner(text) {
    this.band.setVisible(true).setAlpha(0);
    this.bandText.setText(toPixelText(text)).setVisible(true).setAlpha(0);
    this.tweens.killTweensOf([this.band, this.bandText]);
    this.tweens.add({ targets: [this.band, this.bandText], alpha: 1, duration: 200, hold: 1800, yoyo: true });
  }
}
