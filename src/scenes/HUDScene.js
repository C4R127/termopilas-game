import Phaser from 'phaser';
import { RELIEF } from '../config/balance.js';
import { RANK_X } from '../entities/FormationView.js';
import { ANOPAEA } from '../data/anopaea.js';
import { CommanderMessages } from '../systems/CommanderMessages.js';
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
    this.eliteWarned = -1;
    this.flankWarned = new Set(); // lado y oleada de los avisos de flanco ya dados

    // Banda de oleada en el lienzo.
    this.band = this.add.rectangle(160, 66, 320, 15, 0x120d0a, 0.75).setVisible(false);
    this.bandText = pixelText(this, 160, 66, '').setVisible(false);
    this.countdown = pixelText(this, 160, 80, '', { tint: 0xecc272 }).setVisible(false);
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
    // En la senda de Anopea, flechas en los bordes con los enemigos que se acercan fuera de la vista.
    this.edges = this.app.battleKey === 'AnopaeaScene' ? ['left', 'right'].map((side) => this.#edgeMarker(side)) : [];

    this.offs = [
      bus.on(EVENTS.ENEMY_SPAWNED, ({ enemy }) => this.#flankNotice(enemy)),
      bus.on(EVENTS.FORMATION_TURNED, ({ facing, auto }) => {
        const where = facing === 'rear' ? 'la senda de Anopea' : 'el paso';
        hud.alert(auto ? `La falange gira sola y encara ${where}` : `La falange encara ${where}`, 'ok', 1600, { icon: 12 });
      }),
      bus.on(EVENTS.ENEMY_SPAWNED, ({ enemy }) => {
        // Primer guardia de élite de cada oleada: aviso con la táctica a seguir.
        const wave = this.app.state.waveIndex;
        if (enemy.type !== 'elite' || this.eliteWarned === wave || this.app.tutorial) return;
        this.eliteWarned = wave;
        hud.alert('Guardia de élite: EMPUJEN para desequilibrarla y luego LANZAS', 'warn', 4200, { icon: 7 });
        this.app.audio.play('elite');
      }),
      bus.on(EVENTS.BOSS_STARTED, () => {
        this.#banner('Enfrentamiento final: Jerjes I');
        hud.alert('Enfrentamiento final: Jerjes I', 'danger', 3200, { icon: 10 });
        this.app.audio.play('elite');
      }),
      bus.on(EVENTS.BOSS_DECREE, ({ ids, names }) => {
        const tips = { storm: 'mantén ESCUDOS hasta la última descarga', whips: 'EMPUJEN calma a los enfurecidos', guard: 'EMPUJEN y luego LANZAS' };
        hud.alert(`Decreto de Jerjes: «${names.join('» y «')}» — ${ids.map((id) => tips[id]).join('; ')}`, 'danger', 4500, { icon: ids.includes('storm') ? 4 : ids.includes('whips') ? 11 : 7 });
        this.app.audio.play('warning');
      }),
      bus.on(EVENTS.BOSS_PHASE, () => {
        this.#banner('Jerjes se levanta del trono');
        this.app.audio.play('elite');
      }),
      bus.on(EVENTS.DECREE_RESULT, ({ id, success }) => {
        const text = {
          storm: success ? 'Tormenta resistida: ni una flecha pasó' : 'La tormenta alcanzó a la falange',
          guard: success ? 'Carga de la guardia real rechazada' : 'La guardia real abrió brecha',
        }[id];
        if (text) hud.alert(text, success ? 'ok' : 'warn', 2200, { icon: id === 'storm' ? 0 : 7 });
      }),
      bus.on(EVENTS.BOSS_DEFEATED, () => this.#banner('Jerjes ordena la retirada')),
      bus.on(EVENTS.WAVE_STARTED, ({ index, wave, total }) => {
        this.#banner(`Oleada ${index + 1}/${total}: ${wave.name}`);
        hud.alert(`Oleada ${index + 1}: ${wave.name}`, 'info', 2600); // la indicación la da Leónidas
        this.app.audio.play('wave');
      }),
      bus.on(EVENTS.WAVE_COMPLETED, ({ index, last }) => {
        if (!last) {
          this.#banner(`Oleada ${index + 1} superada`);
          hud.alert('Oleada superada · la formación recupera aliento', 'ok', 2600);
        }
      }),
      bus.on(EVENTS.VOLLEY_WARNING, ({ warningMs, fireAt, storm }) => {
        this.warnUntil = fireAt;
        this.warnTotal = warningMs;
        this.warn.setVisible(true);
        this.volleyAlert?.remove();
        const text = storm ? `¡Tormenta de flechas! ${storm} descargas: mantén ESCUDOS` : '¡Lluvia de flechas! Ordena ESCUDOS';
        this.volleyAlert = hud.alert(text, 'danger', 0, { icon: 4 });
        this.app.audio.play('warning');
      }),
      bus.on(EVENTS.VOLLEY_FIRED, () => {
        this.warnUntil = 0;
      }),
      bus.on(EVENTS.VOLLEY_IMPACT, ({ blocked, damage, remaining }) => {
        if (remaining > 0) {
          // Tormenta en curso: el aviso sigue hasta la última descarga.
          if (!blocked) hud.alert(`¡Impacto de flechas! −${damage} de cohesión`, 'danger', 1500, { icon: 4 });
          return;
        }
        this.warn.setVisible(false);
        this.volleyAlert?.remove();
        this.volleyAlert = null;
        if (blocked) hud.alert('Flechas bloqueadas por los escudos', 'ok', 1500, { icon: 0 });
        else hud.alert(`¡Impacto de flechas! −${damage} de cohesión`, 'danger', 2200, { icon: 4 });
      }),
      bus.on(EVENTS.ENEMY_BREACH, ({ breaches, max }) => hud.alert(`¡Brecha en la línea! (${breaches}/${max})`, 'danger', 2400)),
      bus.on(EVENTS.RELIEF_DONE, () => this.app.audio.play('relief')),
      bus.on(EVENTS.RELIEF_DONE, () => hud.alert(`Relevo completado: +${RELIEF.staminaGain} de resistencia`, 'ok', 1800, { icon: 3 })),
      bus.on(EVENTS.FORMATION_CHANGED, ({ reason }) => {
        if (reason === 'stamina') hud.alert('Formación agotada: ordena RELEVO o ESCUDOS', 'warn', 3200, { icon: 3 });
      }),
    ];
    // En la campaña, Leónidas comenta la batalla (en el tutorial ya guía su panel).
    const key = this.app.battleKey;
    const script = key === 'AnopaeaScene' ? { intro: ANOPAEA.intro, victory: ANOPAEA.victory, rearAlert: ANOPAEA.rearAlert } : {};
    this.commander = key === 'TutorialScene' ? null : new CommanderMessages(bus, this.app.state, ({ text }) => this.app.say(text), script);
    this.commander?.start();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.commander?.destroy();
      this.offs.forEach((off) => off());
      this.volleyAlert?.remove();
    });
  }

  update(_time, delta) {
    const { state, sim, hud } = this.app;
    if (!sim) return;
    const waves = sim.waves;
    const battle = this.scene.get(this.app.battleKey);
    const cam = battle?.cameras?.main;
    // El aviso de flechas sigue a la falange aunque la cámara se desplace.
    if (cam && battle.formation) this.warn.x = Math.round(battle.formation.midX - cam.scrollX);
    if (cam && this.edges.length) this.#updateEdges(cam.worldView, state.simTime);

    if (this.warn.visible && this.warnTotal) {
      const left = Math.max(0, this.warnUntil - state.simTime);
      this.warnBar.width = 52 * (left / this.warnTotal);
      const blink = !this.app.settings.get('access', 'reduceEffects');
      this.warn.alpha = blink && left < 600 && Math.floor(state.simTime / 120) % 2 ? 0.6 : 1;
    }

    const next = waves.timeToNextWave;
    const showCountdown = waves.resting && state.waveIndex > 0 && next > 0;
    this.countdown.setVisible(showCountdown);
    if (showCountdown) this.countdown.setText(`SIGUIENTE OLEADA EN ${Math.ceil(next / 1000)}`);

    this.acc += delta;
    if (this.acc < HUD_REFRESH_MS) return;
    this.acc = 0;
    const snap = state.snapshot();
    this.commander?.check();
    const tutorial = this.app.tutorial;
    if (tutorial) {
      hud.update(snap, { total: tutorial.steps.length, index: Math.max(0, tutorial.index), name: 'Tutorial', progress: (tutorial.index + 1) / tutorial.steps.length });
    } else {
      const { spawned, total } = waves.spawnProgress;
      const waveFrac = waves.phase === 'intermission' ? 0 : total ? (spawned - state.activeEnemies) / total : 0;
      hud.update(snap, {
        total: waves.total,
        index: state.waveIndex,
        name: waves.current?.name ?? '—',
        progress: Math.min(1, (state.waveIndex + Math.max(0, waveFrac)) / waves.total),
      });
      // La música de batalla gana capas con el avance de la campaña y la presión en pantalla.
      this.app.audio.setIntensity(snap.boss ? 1 : state.waveIndex / Math.max(1, waves.total - 1) * 0.8 + Math.min(0.3, state.activeEnemies * 0.04));
      hud.setBoss(snap.boss);
    }
    this.#readyNotice('PUSH', snap.pushReadyIn, 'Empuje listo', 2);
    this.#readyNotice('RELIEF', snap.reliefReadyIn, 'Relevo disponible', 3);
  }

  /** Enemigos por el lado al que no mira la falange: aviso una vez por oleada y lado. */
  #flankNotice(enemy) {
    const { facing, waveIndex } = this.app.state;
    if (!this.app.sim?.commands.allowTurn || enemy.side === facing) return;
    const id = `${waveIndex}-${enemy.side}`;
    if (this.flankWarned.has(id)) return;
    this.flankWarned.add(id);
    const auto = this.app.sim.diff.autoTurn;
    const text = enemy.side === 'rear'
      ? `¡Enemigos por la senda, a nuestra espalda!${auto ? ' La falange girará al llegar' : ' Ordena MEDIA VUELTA'}`
      : `¡Enemigos en el paso!${auto ? ' La falange girará al llegar' : ' MEDIA VUELTA para encararlos'}`;
    this.app.hud.alert(text, 'danger', 3200, { icon: 12 });
    this.app.audio.play('warning');
  }

  /** Marcador de borde: flecha y número de enemigos que llegan por ese lado sin verse. */
  #edgeMarker(side) {
    const left = side === 'left';
    const box = this.add.container(left ? 13 : 307, 122).setVisible(false);
    const bg = this.add.rectangle(0, 0, 22, 13, 0x120d0a, 0.85).setStrokeStyle(1, 0xd0533f);
    const arrow = left ? this.add.triangle(-6, 0, 0, 3.5, 5, 0, 5, 7, 0xff8a70) : this.add.triangle(6, 0, 5, 3.5, 0, 0, 0, 7, 0xff8a70);
    const count = pixelText(this, left ? 3 : -3, 0, '0', { tint: 0xffd0a0 });
    box.add([bg, arrow, count]);
    return { box, count, bg, left, shown: 0 };
  }

  #updateEdges(view, now) {
    const counts = { left: 0, right: 0 };
    for (const e of this.app.sim.enemies) {
      if (e.removed) continue;
      if (e.x < view.x + 4) counts.left++;
      else if (e.x > view.right - 4) counts.right++;
    }
    const blink = !this.app.settings.get('access', 'reduceEffects') && Math.floor(now / 300) % 2 === 0;
    for (const m of this.edges) {
      const n = counts[m.left ? 'left' : 'right'];
      m.box.setVisible(n > 0);
      if (n !== m.shown) {
        m.shown = n;
        m.count.setText(String(n));
      }
      m.bg.setStrokeStyle(1, blink ? 0xff8a70 : 0xd0533f);
    }
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
