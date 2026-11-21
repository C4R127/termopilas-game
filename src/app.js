import { TIME_SPEEDS } from './config/balance.js';
import { getCommand } from './data/commands.js';
import { LEONIDAS } from './data/leonidas.js';
import { AudioManager } from './systems/AudioManager.js';
import { EventBus, EVENTS } from './systems/EventBus.js';
import { GameState } from './systems/GameState.js';
import { identityFromSamples, PITCH, PitchSensor } from './systems/PitchSensor.js';
import { IDENTITIES, personalize, resolveIdentity } from './systems/PlayerProfile.js';
import { keyLabel, SettingsStore, VOICE_SENSITIVITY } from './systems/SettingsStore.js';
import { TUTORIAL_EVENT } from './systems/TutorialDirector.js';
import { VoiceCommandManager } from './systems/VoiceCommandManager.js';
import { CommanderView } from './ui/CommanderView.js';
import { HudView } from './ui/HudView.js';
import { Screens } from './ui/Screens.js';
import { TutorialView } from './ui/TutorialView.js';

const BATTLE_SCENES = ['BattleScene', 'TutorialScene', 'AnopaeaScene'];

/**
 * Composición de la aplicación: estado, bus de eventos, ajustes, voz, audio y
 * vistas HTML. Las escenas de Phaser la obtienen del registro (`registry.get('app')`).
 */
export function createApp() {
  const bus = new EventBus();
  const state = new GameState();
  const settings = new SettingsStore();
  const audio = new AudioManager();
  const hud = new HudView(document);
  const root = document.documentElement;
  const appEl = document.getElementById('app');

  const coarsePointer = window.matchMedia('(pointer: coarse)');

  const stopScenes = (keys) => {
    const scenes = app.game.scene;
    for (const key of keys) if (scenes.isActive(key) || scenes.isPaused(key)) scenes.stop(key);
  };

  const app = {
    bus,
    state,
    settings,
    audio,
    hud,
    game: null,
    sim: null,
    tutorial: null,
    battleKey: null, // escena de combate activa: BattleScene, TutorialScene o AnopaeaScene
    probing: false, // comprobación del permiso desde el menú
    voiceTest: false, // prueba de voz desde Ajustes
    detectedIdentity: null, // trato decidido en el panel «Antes de la batalla» en esta sesión (no se guarda)
    timeScale: 1, // velocidad del tiempo en batalla (×1, ×2, ×4); cada batalla empieza a ×1

    get inBattle() {
      return BATTLE_SCENES.includes(state.currentScene) && state.phase === 'playing';
    },

    get warningScale() {
      return settings.get('access', 'longWarnings') ? 1.5 : 1;
    },

    setScene(name) {
      state.currentScene = name;
      appEl.dataset.scene = name;
    },

    // ── Navegación ────────────────────────────────────────────────────────
    enterMenu() {
      commanderView.hide();
      this.setScene('MenuScene');
      state.phase = 'idle';
      hud.show(false);
      tutorialView.show(false);
      voice.stop();
      audio.playMusic('menu');
      this.renderMenu();
    },

    renderMenu(note, noteKind) {
      const prev = screens.lastMenu ?? {};
      screens.menu({
        voiceWanted: state.voiceEnabled,
        voiceSupported: voice.supported,
        note: note ?? prev.note ?? (voice.supported ? '' : 'Este navegador no ofrece reconocimiento de voz (prueba Chrome o Edge). El juego se completa igual con teclado y botones.'),
        noteKind: noteKind ?? prev.noteKind ?? (voice.supported ? '' : 'warn'),
      });
    },

    startBattle(key = 'BattleScene') {
      audio.unlock();
      commanderView.hide();
      screens.hide();
      tutorialView.show(false);
      stopScenes(['MenuScene', 'ResultScene', 'HUDScene', ...BATTLE_SCENES]);
      this.game.scene.start(key);
    },

    startTutorial() {
      this.beginBattle('TutorialScene');
    },

    startCampaign() {
      this.beginBattle('BattleScene');
    },

    /** Escenario histórico del día 3: la senda de Anopea. */
    startAnopaea() {
      this.beginBattle('AnopaeaScene');
    },

    /**
     * Desde un botón del menú: pantalla completa en táctil y a la batalla. Con el
     * trato en automático, Leónidas pregunta antes cómo dirigirse a quien juega
     * (panel «Antes de la batalla»): por el tono de la voz o con un botón. En el
     * tutorial solo se pregunta si aún no se sabe.
     */
    beginBattle(key) {
      audio.unlock();
      this.touchFullscreen();
      const ask = settings.get('player', 'address') === 'auto' && (key !== 'TutorialScene' || !this.detectedIdentity);
      if (ask) {
        this.pendingStart = key;
        screens.voiceId({ phase: PitchSensor.supported ? 'ask' : 'choose', identity: this.detectedIdentity });
        return;
      }
      this.startBattle(key);
    },

    // ── Panel de identificación por la voz ────────────────────────────────
    /** Escucha unos segundos y decide el trato por el tono mediano. */
    async voiceIdListen() {
      if (this.voiceIdListening) return;
      this.voiceIdListening = true;
      const samples = [];
      let lastVoiceAt = null;
      const sensor = new PitchSensor({ onFrame: (hz, t) => {
        samples.push(hz);
        lastVoiceAt = t;
        screens.voiceIdProgress(Math.min(1, samples.length / PITCH.panelMinFrames));
      } });
      screens.voiceId({ phase: 'listening' });
      const ok = await sensor.start();
      if (!ok) {
        this.voiceIdListening = false;
        screens.voiceId({ phase: 'error' });
        return;
      }
      // Termina cuando, tras oír voz suficiente (basta una palabra), el jugador se calla, o al agotar el máximo.
      const started = performance.now();
      while (screens.current === 'voiceid') {
        const now = performance.now();
        const quiet = now - (lastVoiceAt ?? now) >= PITCH.panelSilenceMs;
        if ((samples.length >= PITCH.panelMinFrames && quiet) || now - started >= PITCH.panelMaxMs) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      sensor.stop(); // se libera el micrófono: no se guarda nada
      this.voiceIdListening = false;
      if (screens.current !== 'voiceid') return; // se canceló mientras escuchaba
      const result = identityFromSamples(samples);
      if (!result) {
        screens.voiceId({ phase: 'retry' });
        return;
      }
      this.voiceIdChoose(result.identity, { heard: true });
    },

    /** Trato decidido (por la voz o corregido a mano) para esta sesión. */
    voiceIdChoose(id, { heard = false } = {}) {
      if (!IDENTITIES[id]) return;
      this.detectedIdentity = id;
      screens.voiceId({ phase: 'done', identity: id, heard });
    },

    /** Solo se empieza con un trato decidido: «aliada» o «aliado». */
    voiceIdContinue() {
      if (!this.detectedIdentity) return;
      const key = this.pendingStart ?? 'BattleScene';
      this.pendingStart = null;
      this.startBattle(key);
    },

    voiceIdCancel() {
      this.pendingStart = null;
      this.renderMenu();
    },

    // ── Trato de Leónidas según el tono de voz ────────────────────────────
    /** Forma de trato actual: la fijada en Ajustes o la decidida antes de la batalla. */
    identity() {
      return resolveIdentity(settings.get('player', 'address'), this.detectedIdentity);
    },

    /** Llamado por BattleScene/TutorialScene al crear la partida. */
    onBattleStarted(key) {
      this.battleKey = key;
      this.setScene(key);
      hud.clearAlerts();
      hud.show(true);
      hud.setWaveCaption(key === 'TutorialScene' ? 'Tutorial' : 'Oleada');
      hud.setBoss(null);
      hud.setTurnAvailable(key === 'AnopaeaScene');
      this.setSpeed(1);
      hud.el.lastCommand.textContent = 'Última orden: —';
      tutorialView.show(key === 'TutorialScene');
      audio.playMusic('battle');
      audio.setIntensity(0);
      if (state.voiceEnabled) voice.start();
      else hud.voiceStatus(voice.status, voice.message, false);
    },

    showResult(result) {
      voice.stop();
      commanderView.hide();
      this.setScene('ResultScene');
      hud.show(false);
      audio.stinger(result.victory ? 'victory' : 'defeat');
      screens.result(result, state.stats);
    },

    goToMenu() {
      stopScenes(['HUDScene', 'ResultScene', ...BATTLE_SCENES]);
      this.game.scene.start('MenuScene');
    },

    // ── Pantallas táctiles ────────────────────────────────────────────────
    /**
     * En móviles y tabletas la batalla pasa a pantalla completa y, si el navegador
     * lo permite, se fija la orientación horizontal. Debe llamarse desde un toque.
     */
    touchFullscreen() {
      if (!coarsePointer.matches || !document.fullscreenEnabled || document.fullscreenElement) return;
      document.documentElement.requestFullscreen({ navigationUI: 'hide' })
        .then(() => screen.orientation?.lock?.('landscape'))
        .catch(() => {}); // sin permiso o sin bloqueo de orientación: se sigue jugando igual
    },

    toggleFullscreen() {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    },

    /** Vibración breve en pantallas táctiles (se omite con «Reducir efectos»). */
    buzz(pattern) {
      if (coarsePointer.matches && !settings.get('access', 'reduceEffects')) navigator.vibrate?.(pattern);
    },

    // ── Órdenes ───────────────────────────────────────────────────────────
    sendCommand(id, source, transcript) {
      audio.unlock();
      if (!this.inBattle) return;
      bus.emit(EVENTS.COMMAND_RECEIVED, { id, source, transcript });
    },

    /** Pasa a la siguiente velocidad del tiempo (×1 → ×2 → ×4 → ×1). */
    cycleSpeed() {
      if (!this.inBattle || state.isPaused) return;
      const next = TIME_SPEEDS[(TIME_SPEEDS.indexOf(this.timeScale) + 1) % TIME_SPEEDS.length];
      this.setSpeed(next);
      const tip = next > 1 && voice.wanted ? ': las órdenes de voz tienen menos margen' : '';
      hud.alert(next === 1 ? 'Velocidad normal' : `Tiempo acelerado ×${next}${tip}`, 'info', 1600);
    },

    setSpeed(speed) {
      this.timeScale = speed;
      hud.setSpeed(speed);
      this.game?.scene.getScene(this.battleKey)?.applyTimeScale?.(speed);
    },

    togglePause(source) {
      if (!this.inBattle) return;
      this.sendCommand(state.isPaused ? 'RESUME' : 'PAUSE', source);
    },

    // ── Voz ───────────────────────────────────────────────────────────────
    toggleVoice() {
      audio.unlock();
      if (!voice.supported) {
        const msg = 'Este navegador no ofrece reconocimiento de voz. Usa teclado y botones.';
        if (state.currentScene === 'MenuScene') this.renderMenu(msg, 'warn');
        else hud.alert(msg, 'warn', 2500);
        return;
      }
      if (state.currentScene === 'MenuScene') {
        if (state.voiceEnabled) {
          state.voiceEnabled = false;
          voice.stop();
          this.renderMenu('Micrófono desactivado.', '');
        } else {
          // Se pide el permiso ahora (acción explícita); solo escuchará durante la batalla.
          state.voiceEnabled = true;
          this.probing = true;
          this.renderMenu('Solicitando permiso del micrófono…', '');
          voice.start();
        }
        return;
      }
      if (!this.inBattle) return;
      if (voice.wanted) {
        state.voiceEnabled = false;
        voice.stop();
        hud.alert('Micrófono desactivado', 'info', 1400);
      } else {
        state.voiceEnabled = true;
        voice.start();
      }
    },

    /** Prueba de voz en Ajustes: muestra cómo se entiende cada frase sin ejecutar nada. */
    toggleVoiceTest() {
      audio.unlock();
      if (!voice.supported) {
        screens.setVoiceTest('Este navegador no ofrece reconocimiento de voz.', 'warn', false);
        return;
      }
      if (this.voiceTest) {
        this.stopVoiceTest();
        return;
      }
      this.voiceTest = true;
      this.resumeAfterTest = voice.wanted;
      screens.setVoiceTest('Solicitando micrófono…', '', true);
      voice.start();
    },

    stopVoiceTest() {
      if (!this.voiceTest) return;
      this.voiceTest = false;
      voice.stop();
      if (this.resumeAfterTest && this.inBattle) voice.start();
      screens.setVoiceTest('Prueba detenida.', '', false);
    },

    // ── Leónidas ──────────────────────────────────────────────────────────
    /** Mensaje de Leónidas en la campaña: se muestra en su panel (solo texto). */
    say(text) {
      commanderView.show(personalize(text, this.identity()));
    },

    keyLabel(action) {
      return keyLabel(settings.get('keys', action));
    },
  };

  const voice = new VoiceCommandManager({
    lang: settings.get('voice', 'lang'),
    minConfidence: VOICE_SENSITIVITY[settings.get('voice', 'sensitivity')].minConfidence,
    onCommand: (id, { transcript }) => {
      if (app.voiceTest || !app.inBattle) return;
      app.sendCommand(id, 'voice', transcript);
    },
    onHeard: (e) => {
      if (app.voiceTest) {
        const label = e.id ? getCommand(e.id).label.toUpperCase() : null;
        const why = { unknown: 'no es una orden', ambiguous: 'contiene varias órdenes', 'low-confidence': 'no se entendió con claridad', repeat: 'repetida' }[e.status];
        const conf = e.confidence ? ` (confianza ${Math.round(e.confidence * 100)} %)` : '';
        screens.setVoiceTest(label ? `«${e.transcript}» → ${label}${conf}` : `«${e.transcript}»: ${why ?? e.status}${conf}`, label ? 'ok' : 'warn');
        return;
      }
      if (!app.inBattle) return;
      if (e.status !== 'repeat') state.stats.voiceHeard++;
      if (e.status === 'matched') state.stats.voiceMatched++;
      else {
        audio.play('reject');
        hud.voiceHeard(e);
      }
    },
    onStatus: (status, message) => {
      hud.voiceStatus(status, message, voice.wanted);
      state.voiceEnabled = state.voiceEnabled && status !== 'error' && status !== 'unsupported';
      if (status === 'error') bus.emit(EVENTS.VOICE_ERROR, { message });
      if (app.voiceTest) {
        if (status === 'listening') screens.setVoiceTest('Escuchando: di una orden.', 'ok', true);
        else if (status === 'error') {
          app.voiceTest = false;
          screens.setVoiceTest(message, 'warn', false);
        }
        return;
      }
      if (state.currentScene === 'MenuScene' && app.probing) {
        if (status === 'listening') {
          app.probing = false;
          voice.stop();
          app.renderMenu('Micrófono permitido. Escuchará solo durante la batalla.', 'ok');
        } else if (status === 'error') {
          app.probing = false;
          app.renderMenu(message, 'warn');
        }
      } else if (status === 'error' && app.inBattle) {
        hud.alert(`${message} Los botones y el teclado siguen activos.`, 'warn', 4000);
      }
    },
  });
  app.voice = voice;

  const screens = new Screens(document.getElementById('screen'), settings, {
    onStart: () => app.startCampaign(),
    onTutorial: () => app.startTutorial(),
    onAnopaea: () => app.startAnopaea(),
    identity: () => app.identity(),
    onVoiceId: (action, id) => {
      if (action === 'listen') app.voiceIdListen();
      else if (action === 'pick') app.voiceIdChoose(id);
      else if (action === 'continue') app.voiceIdContinue();
      else if (action === 'cancel') app.voiceIdCancel();
    },
    onVoiceToggle: () => app.toggleVoice(),
    onVoiceTest: () => app.toggleVoiceTest(),
    onSettingsClose: () => app.stopVoiceTest(),
    onSetting: (section, key, value) => settings.set(section, key, value),
    onResume: () => app.sendCommand('RESUME', 'button'),
    onRestart: () => app.startBattle(app.battleKey ?? 'BattleScene'),
    onMenu: () => app.goToMenu(),
  });
  app.screens = screens;

  const commanderView = new CommanderView(document.getElementById('commander'));

  const tutorialView = new TutorialView(document.getElementById('tutorial'), {
    onNext: () => app.tutorial?.next(),
    onExit: () => app.goToMenu(),
    onCampaign: () => app.startBattle(),
  });
  bus.on(TUTORIAL_EVENT, (e) => {
    tutorialView.render({ ...e, text: personalize(e.text, app.identity()) });
    if (!e.awaitNext) audio.play('step');
    if (e.finished) settings.set('progress', 'tutorialDone', true);
  });

  // ── Ajustes aplicados en vivo ───────────────────────────────────────────
  const applySettings = () => {
    audio.setVolumes(settings.get('audio'));
    const a = settings.get('access');
    root.dataset.reduceEffects = String(a.reduceEffects);
    root.dataset.contrast = a.highContrast ? 'high' : 'normal';
    root.dataset.largeText = String(a.largeText);
    root.dataset.plainText = String(a.plainText);
    voice.setMinConfidence(VOICE_SENSITIVITY[settings.get('voice', 'sensitivity')].minConfidence);
    hud.setKeyLabels(settings.get('keys'), keyLabel);
  };
  settings.onChange((section, key) => {
    applySettings();
    if (section === 'voice' && key === 'lang') {
      voice.setLanguage(settings.get('voice', 'lang'));
    }
    if (section === 'game' && key === 'lighting') {
      // También el menú, que está en pausa.
      for (const scene of app.game?.scene.getScenes(false) ?? []) if (scene.sys.isActive() || scene.sys.isPaused()) scene.applyLighting?.({}, 1200);
    }
    if (section === 'access' && key === 'reduceEffects') {
      // Las escenas leen la opción al crearse; la de combate activa se actualiza aquí.
      for (const scene of app.game?.scene.getScenes(true) ?? []) scene.reduceEffects = settings.get('access', 'reduceEffects');
    }
  });
  applySettings();

  // Confirmación de cada orden en el HUD (último comando, aviso y sonido).
  bus.on(EVENTS.COMMAND_RESULT, (r) => {
    hud.commandResult(r);
    const def = getCommand(r.id);
    if (r.source === 'button') app.buzz(r.status === 'rejected' ? [20, 30, 20] : 12);
    if (r.status === 'rejected') {
      audio.play('reject');
      hud.alert(r.message, 'warn', 1600, { icon: def?.icon });
    } else if (def?.tactical) {
      audio.play('accept');
      hud.alert(r.message, r.status === 'pending' ? 'info' : 'ok', 1200, { icon: def.icon });
    }
  });

  // Golpes que se notan en la mano: flechas que alcanzan la falange y brechas.
  bus.on(EVENTS.VOLLEY_IMPACT, ({ blocked, damage }) => {
    if (!blocked && damage > 0) app.buzz(60);
  });
  bus.on(EVENTS.ENEMY_BREACH, () => app.buzz([50, 40, 50]));

  bus.on(EVENTS.PAUSE_CHANGED, ({ paused }) => {
    const scenes = app.game.scene;
    audio.duck(paused);
    if (paused) {
      scenes.pause(app.battleKey);
      scenes.pause('HUDScene');
      tutorialView.show(false);
      screens.pause();
    } else {
      scenes.resume(app.battleKey);
      scenes.resume('HUDScene');
      screens.hide();
      tutorialView.show(app.battleKey === 'TutorialScene');
    }
  });

  hud.voiceStatus(voice.status, voice.message, false);
  return app;
}
