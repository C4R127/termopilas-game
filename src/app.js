import { getCommand } from './data/commands.js';
import { LEONIDAS } from './data/leonidas.js';
import { AudioManager } from './systems/AudioManager.js';
import { EventBus, EVENTS } from './systems/EventBus.js';
import { GameState } from './systems/GameState.js';
import { Narrator } from './systems/Narrator.js';
import { identityFromSamples, PITCH, PitchProfile, PitchSensor } from './systems/PitchSensor.js';
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
    detectedIdentity: null, // trato estimado por el tono de voz en esta sesión (no se guarda)
    voiceDecided: false, // en esta batalla ya se decidió el trato: se deja de analizar el tono

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
      narrator.stop();
      commanderView.hide();
      this.setScene('MenuScene');
      state.phase = 'idle';
      hud.show(false);
      tutorialView.show(false);
      voice.stop();
      pitch.stop();
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
      narrator.stop();
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
     * Desde un botón del menú: pantalla completa en táctil y a la batalla. Antes
     * de la campaña y de la senda de Anopea, si el trato es automático, Leónidas
     * pide oír la voz de quien juega (panel de identificación).
     */
    beginBattle(key) {
      audio.unlock();
      this.touchFullscreen();
      if (key !== 'TutorialScene' && settings.get('player', 'address') === 'auto' && PitchSensor.supported) {
        this.pendingStart = key;
        screens.voiceId({ phase: 'ask', identity: this.detectedIdentity });
        this.narrate(LEONIDAS.voiceIdAsk);
        return;
      }
      this.startBattle(key);
    },

    // ── Panel de identificación por la voz ────────────────────────────────
    /** Escucha unos segundos y decide el trato por el tono mediano. */
    async voiceIdListen() {
      if (this.voiceIdListening) return;
      narrator.stop();
      this.voiceIdListening = true;
      const samples = [];
      const sensor = new PitchSensor({ onFrame: (hz) => {
        samples.push(hz);
        screens.voiceIdProgress(Math.min(1, samples.length / PITCH.panelMinFrames));
      } });
      screens.voiceId({ phase: 'listening' });
      const ok = await sensor.start();
      if (!ok) {
        this.voiceIdListening = false;
        screens.voiceId({ phase: 'error' });
        return;
      }
      // Termina cuando ha oído la frase (voz de sobra tras el tiempo mínimo) o al agotar el máximo.
      const started = performance.now();
      while (screens.current === 'voiceid') {
        const elapsed = performance.now() - started;
        if ((elapsed >= PITCH.panelMinMs && samples.length >= PITCH.panelMinFrames * 2) || elapsed >= PITCH.panelMaxMs) break;
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
      this.narrate(LEONIDAS.voiceIdDone);
    },

    voiceIdContinue({ skip = false } = {}) {
      // Con un trato ya decidido, la batalla no vuelve a analizar el tono.
      this.presetIdentity = !skip && !!this.detectedIdentity;
      const key = this.pendingStart ?? 'BattleScene';
      this.pendingStart = null;
      narrator.stop();
      this.startBattle(key);
    },

    /** Sin identificar: Leónidas usa «estratega» y lo intentará con las órdenes de voz. */
    voiceIdSkip() {
      this.detectedIdentity = null;
      this.voiceIdContinue({ skip: true });
    },

    voiceIdCancel() {
      this.pendingStart = null;
      narrator.stop();
      this.renderMenu();
    },

    // ── Trato de Leónidas según el tono de voz ────────────────────────────
    /** Forma de trato actual: la fijada en Ajustes o la estimada por la voz. */
    identity() {
      return resolveIdentity(settings.get('player', 'address'), this.detectedIdentity);
    },

    /**
     * El tono solo se analiza en batalla, con la voz activa, el trato en
     * automático y mientras no se haya decidido en esta batalla.
     */
    syncPitch() {
      const wanted = this.inBattle && voice.wanted && settings.get('player', 'address') === 'auto' && !this.voiceDecided;
      if (wanted) pitch.start();
      else pitch.stop();
    },

    /** El reconocedor oyó una frase del jugador: su tono cuenta para decidir el trato. */
    onPlayerSpoke() {
      if (!pitch.running) return;
      pitchProfile.commitUtterance(performance.now());
      const id = pitchProfile.decide();
      if (!id) return;
      this.detectedIdentity = id;
      this.voiceDecided = true;
      this.syncPitch();
      hud.alert(`Leónidas te reconoce por la voz: «${IDENTITIES[id].ally}»`, 'info', 2600, { icon: 5 });
      if (this.battleKey !== 'TutorialScene') this.say(LEONIDAS.voiceRecognized);
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
      hud.el.lastCommand.textContent = 'Última orden: —';
      tutorialView.show(key === 'TutorialScene');
      audio.playMusic('battle');
      audio.setIntensity(0);
      if (state.voiceEnabled) voice.start();
      else hud.voiceStatus(voice.status, voice.message, false);
      // Cada batalla vuelve a escuchar el tono (puede jugar otra persona), salvo
      // si se acaba de identificar en el panel.
      this.voiceDecided = !!this.presetIdentity;
      this.presetIdentity = false;
      pitchProfile.reset();
      this.syncPitch();
    },

    showResult(result) {
      voice.stop();
      pitch.stop();
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

    // ── Leónidas y lectura en voz alta ────────────────────────────────────
    /** Mensaje de Leónidas en la campaña (panel y, si está activada, lectura en voz alta). */
    say(text) {
      commanderView.show(personalize(text, this.identity()));
      this.narrate(text);
    },

    narrate(text) {
      const audioSet = settings.get('audio');
      if (!settings.get('access', 'narration') || audioSet.muted) return;
      narrator.speak(personalize(text, this.identity()), { volume: audioSet.master });
    },

    toggleNarration() {
      const on = !settings.get('access', 'narration');
      settings.set('access', 'narration', on);
      if (!on) narrator.stop();
      else if (this.tutorial?.step) this.narrate(this.tutorial.step.text);
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
      if (e.status === 'narration') return; // lo oído era la propia narración
      if (app.voiceTest) {
        const label = e.id ? getCommand(e.id).label.toUpperCase() : null;
        const why = { unknown: 'no es una orden', ambiguous: 'contiene varias órdenes', 'low-confidence': 'no se entendió con claridad', repeat: 'repetida' }[e.status];
        const conf = e.confidence ? ` (confianza ${Math.round(e.confidence * 100)} %)` : '';
        screens.setVoiceTest(label ? `«${e.transcript}» → ${label}${conf}` : `«${e.transcript}»: ${why ?? e.status}${conf}`, label ? 'ok' : 'warn');
        return;
      }
      if (!app.inBattle) return;
      app.onPlayerSpoke();
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
      app.syncPitch();
    },
  });
  app.voice = voice;

  // Tono de voz para el trato de Leónidas (en memoria; no se graba ni se guarda audio).
  const pitchProfile = new PitchProfile();
  const pitch = new PitchSensor({ onFrame: (hz, t) => pitchProfile.addFrame(t, hz) });
  bus.on(EVENTS.GAME_OVER, () => pitch.stop());

  const screens = new Screens(document.getElementById('screen'), settings, {
    onStart: () => app.startCampaign(),
    onTutorial: () => app.startTutorial(),
    onAnopaea: () => app.startAnopaea(),
    identity: () => app.identity(),
    onVoiceId: (action, id) => {
      if (action === 'listen') app.voiceIdListen();
      else if (action === 'pick') app.voiceIdChoose(id);
      else if (action === 'continue') app.voiceIdContinue();
      else if (action === 'skip') app.voiceIdSkip();
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

  const narrator = new Narrator({
    lang: settings.get('voice', 'lang'),
    // Mientras Leónidas habla, el micrófono no convierte lo que oye en órdenes.
    onSpeaking: (on) => {
      voice.setSuspended(on);
      pitch.setSuspended(on);
    },
  });
  app.narrator = narrator;

  const commanderView = new CommanderView(document.getElementById('commander'), {
    onToggleNarration: () => app.toggleNarration(),
  });

  const tutorialView = new TutorialView(document.getElementById('tutorial'), {
    onNext: () => app.tutorial?.next(),
    onExit: () => app.goToMenu(),
    onCampaign: () => app.startBattle(),
    onToggleNarration: () => app.toggleNarration(),
  });
  let lastTutorial = { text: '', hint: '' };
  bus.on(TUTORIAL_EVENT, (e) => {
    tutorialView.render({ ...e, text: personalize(e.text, app.identity()) });
    if (!e.awaitNext) audio.play('step');
    if (e.finished) settings.set('progress', 'tutorialDone', true);
    // Se lee el texto nuevo del paso o, si solo cambió, la pista.
    if (e.text !== lastTutorial.text) app.narrate(e.text);
    else if (e.hint && e.hint !== lastTutorial.hint) app.narrate(e.hint);
    lastTutorial = { text: e.text, hint: e.hint };
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
    tutorialView.setNarration(a.narration, narrator.supported);
    commanderView.setNarration(a.narration, narrator.supported);
  };
  settings.onChange((section, key) => {
    applySettings();
    if (section === 'voice' && key === 'lang') {
      voice.setLanguage(settings.get('voice', 'lang'));
      narrator.setLanguage(settings.get('voice', 'lang'));
    }
    if (section === 'audio' && settings.get('audio', 'muted')) narrator.stop();
    if (section === 'player') app.syncPitch();
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
      narrator.stop();
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
