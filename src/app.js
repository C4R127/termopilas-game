import { getCommand } from './data/commands.js';
import { LEONIDAS } from './data/leonidas.js';
import { AudioManager } from './systems/AudioManager.js';
import { EventBus, EVENTS } from './systems/EventBus.js';
import { GameState } from './systems/GameState.js';
import { Narrator } from './systems/Narrator.js';
import { IDENTITIES, matchIdentity, personalize } from './systems/PlayerProfile.js';
import { keyLabel, SettingsStore, VOICE_SENSITIVITY } from './systems/SettingsStore.js';
import { TUTORIAL_EVENT } from './systems/TutorialDirector.js';
import { VoiceCommandManager } from './systems/VoiceCommandManager.js';
import { CommanderView } from './ui/CommanderView.js';
import { HudView } from './ui/HudView.js';
import { Screens } from './ui/Screens.js';
import { TutorialView } from './ui/TutorialView.js';

const BATTLE_SCENES = ['BattleScene', 'TutorialScene'];

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
    battleKey: null, // escena de combate activa: BattleScene o TutorialScene
    probing: false, // comprobación del permiso desde el menú
    voiceTest: false, // prueba de voz desde Ajustes

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
      this.beginWithIdentity('TutorialScene');
    },

    startCampaign() {
      this.beginWithIdentity('BattleScene');
    },

    // ── Presentación: el jugador dice cómo quiere que se le trate ─────────
    /** Antes de la primera batalla, Leónidas pregunta cómo dirigirse al jugador. */
    beginWithIdentity(key) {
      audio.unlock();
      if (settings.get('player', 'asked')) {
        this.startBattle(key);
        return;
      }
      this.pendingStart = key;
      screens.identity({ voiceSupported: voice.supported });
      this.narrate(LEONIDAS.askIdentity);
      // Si el micrófono ya está permitido, se escucha la respuesta directamente.
      if (state.voiceEnabled && voice.supported) this.listenIdentity();
    },

    listenIdentity() {
      if (!voice.supported) return;
      if (this.identityListening) {
        this.identityListening = false;
        voice.stop();
        screens.setIdentityNote('', '', false);
        return;
      }
      this.identityListening = true;
      screens.setIdentityNote('Di «mujer», «hombre» o «prefiero no decirlo».', '', true);
      voice.start();
    },

    chooseIdentity(id) {
      if (!IDENTITIES[id]) return;
      settings.set('player', 'identity', id);
      settings.set('player', 'asked', true);
      if (this.identityListening) {
        this.identityListening = false;
        voice.stop();
      }
      const text = personalize(LEONIDAS.identityDone, id);
      screens.setIdentityNote(text, 'ok', false);
      this.narrate(LEONIDAS.identityDone);
      const key = this.pendingStart ?? 'BattleScene';
      this.pendingStart = null;
      setTimeout(() => this.startBattle(key), 1400);
    },

    cancelIdentity() {
      this.identityListening = false;
      this.pendingStart = null;
      voice.stop();
      narrator.stop();
      this.renderMenu();
    },

    /** Llamado por BattleScene/TutorialScene al crear la partida. */
    onBattleStarted(key) {
      this.battleKey = key;
      this.setScene(key);
      hud.clearAlerts();
      hud.show(true);
      hud.setWaveCaption(key === 'TutorialScene' ? 'Tutorial' : 'Oleada');
      hud.setBoss(null);
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
      commanderView.show(personalize(text, settings.get('player', 'identity')));
      this.narrate(text);
    },

    narrate(text) {
      const audioSet = settings.get('audio');
      if (!settings.get('access', 'narration') || audioSet.muted) return;
      narrator.speak(personalize(text, settings.get('player', 'identity')), { volume: audioSet.master });
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
      if (app.identityListening) return; // en la presentación solo cuenta la respuesta
      if (app.voiceTest || !app.inBattle) return;
      app.sendCommand(id, 'voice', transcript);
    },
    onHeard: (e) => {
      if (e.status === 'narration') return; // lo oído era la propia narración
      if (app.identityListening) {
        const m = matchIdentity(e.transcript);
        if (m.id) app.chooseIdentity(m.id);
        else screens.setIdentityNote(`«${e.transcript}»: ${m.reason === 'ambiguous' ? 'has dicho más de una opción' : 'no te he entendido'}. Di «mujer», «hombre» o «prefiero no decirlo».`, 'warn');
        return;
      }
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
      if (app.identityListening) {
        if (status === 'error') {
          app.identityListening = false;
          screens.setIdentityNote(`${message} Elige una opción con los botones.`, 'warn', false);
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
    onIdentity: (id) => app.chooseIdentity(id),
    onIdentityVoice: () => app.listenIdentity(),
    onIdentityCancel: () => app.cancelIdentity(),
    onVoiceToggle: () => app.toggleVoice(),
    onVoiceTest: () => app.toggleVoiceTest(),
    onSettingsClose: () => app.stopVoiceTest(),
    onSetting: (section, key, value) => settings.set(section, key, value),
    onResume: () => app.sendCommand('RESUME', 'button'),
    onRestart: () => app.startBattle(state.currentScene === 'TutorialScene' ? 'TutorialScene' : 'BattleScene'),
    onMenu: () => app.goToMenu(),
  });
  app.screens = screens;

  const narrator = new Narrator({
    lang: settings.get('voice', 'lang'),
    // Mientras Leónidas habla, el micrófono no convierte lo que oye en órdenes.
    onSpeaking: (on) => voice.setSuspended(on),
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
    const identity = settings.get('player', 'identity');
    tutorialView.render({ ...e, text: personalize(e.text, identity) });
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
    if (r.status === 'rejected') {
      audio.play('reject');
      hud.alert(r.message, 'warn', 1600, { icon: def?.icon });
    } else if (def?.tactical) {
      audio.play('accept');
      hud.alert(r.message, r.status === 'pending' ? 'info' : 'ok', 1200, { icon: def.icon });
    }
  });

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
